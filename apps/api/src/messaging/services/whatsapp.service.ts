import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ProviderEncryptionService } from './provider-encryption.service';
import { ProviderConfigurationService } from './provider-configuration.service';
import { WhatsAppCloudApiAdapter, SendWhatsAppPayload } from '../adapters/whatsapp-cloud.provider';
import {
  MessagingChannel,
  MessageSendingStatus,
  WhatsAppMessageDirection,
  WhatsAppMessageType,
  WhatsAppTemplateStatus,
  NormalizedEventType,
  WebhookProcessingStatus,
} from '@prisma/client';

export interface SendWhatsAppMessageDto {
  configuration_uuid?: string;
  to: string; // Recipient phone
  type: 'TEXT' | 'IMAGE' | 'DOCUMENT' | 'AUDIO' | 'VIDEO' | 'TEMPLATE';
  content?: string;
  media_url?: string;
  template_name?: string;
  template_language?: string;
  template_variables?: Record<string, string> | any[];
}

export interface CreateWhatsAppTemplateDto {
  configuration_uuid?: string;
  name: string;
  language?: string;
  category?: string;
  body_text: string;
  header_text?: string;
  footer_text?: string;
  buttons?: Array<{ type: string; text: string; url?: string }>;
}

export interface UpdateWhatsAppTemplateDto {
  name?: string;
  language?: string;
  category?: string;
  body_text?: string;
  header_text?: string;
  footer_text?: string;
  buttons?: Array<{ type: string; text: string; url?: string }>;
}

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: ProviderEncryptionService,
    private readonly configService: ProviderConfigurationService,
    private readonly whatsappAdapter: WhatsAppCloudApiAdapter,
  ) {}

  /**
   * Evaluates the 24-hour Customer Service Session Window for a given contact.
   * Free-form session messages are permitted only if window_expires_at > now.
   */
  async checkSessionWindow(conversationUuidOrPhone: string, configUuid: string): Promise<{
    isOpen: boolean;
    expiresAt: Date | null;
    hoursRemaining: number;
    reason?: string;
  }> {
    let conversation;
    if (conversationUuidOrPhone.startsWith('+') || /^\d+$/.test(conversationUuidOrPhone.replace(/\D/g, ''))) {
      const { e164 } = this.whatsappAdapter.normalizePhoneNumber(conversationUuidOrPhone);
      conversation = await this.prisma.whatsAppConversation.findFirst({
        where: {
          provider_configuration_uuid: configUuid,
          contact_phone: e164,
        },
      });
    } else {
      conversation = await this.prisma.whatsAppConversation.findUnique({
        where: { conversation_uuid: conversationUuidOrPhone },
      });
    }

    if (!conversation || !conversation.window_expires_at) {
      return {
        isOpen: false,
        expiresAt: null,
        hoursRemaining: 0,
        reason: 'NO_PREVIOUS_INBOUND_MESSAGE',
      };
    }

    const now = new Date();
    if (conversation.window_expires_at <= now) {
      return {
        isOpen: false,
        expiresAt: conversation.window_expires_at,
        hoursRemaining: 0,
        reason: 'WINDOW_EXPIRED',
      };
    }

    const diffMs = conversation.window_expires_at.getTime() - now.getTime();
    const hoursRemaining = Math.max(1, Math.round(diffMs / (1000 * 60 * 60)));

    return {
      isOpen: true,
      expiresAt: conversation.window_expires_at,
      hoursRemaining,
    };
  }

  /**
   * Sends an outbound WhatsApp message. Enforces 24-hour session rules for non-template messages.
   */
  async sendMessage(userUuid: string, dto: SendWhatsAppMessageDto) {
    const { e164 } = this.whatsappAdapter.normalizePhoneNumber(dto.to);

    const { config, credentials } = await this.configService.getDecryptedConfiguration(
      userUuid,
      dto.configuration_uuid,
      MessagingChannel.WHATSAPP,
    );

    // 1. Locate or create conversation record
    let conversation = await this.prisma.whatsAppConversation.findFirst({
      where: {
        provider_configuration_uuid: config.configuration_uuid,
        contact_phone: e164,
      },
    });

    if (!conversation) {
      conversation = await this.prisma.whatsAppConversation.create({
        data: {
          user_uuid: userUuid,
          provider_configuration_uuid: config.configuration_uuid,
          contact_phone: e164,
          contact_name: null,
          is_active: true,
        },
      });
    }

    // 2. Validate 24-Hour Customer Service Session Window for Non-Template Messages
    const isTemplate = dto.type === 'TEMPLATE';
    if (!isTemplate) {
      const windowCheck = await this.checkSessionWindow(conversation.conversation_uuid, config.configuration_uuid);
      if (!windowCheck.isOpen) {
        throw new BadRequestException(
          `Customer service 24-hour session window is closed (${windowCheck.reason}). You must use an approved WhatsApp Template to initiate or re-open this conversation.`,
        );
      }
    } else {
      if (!dto.template_name) {
        throw new BadRequestException('Template name is required for TEMPLATE message type');
      }
    }

    // 3. Dispatch via Meta Cloud API Adapter
    const sendPayload: SendWhatsAppPayload = {
      to: e164,
      type: dto.type,
      text: dto.content,
      media_url: dto.media_url,
      template_name: dto.template_name,
      template_language: dto.template_language || 'en_US',
      template_variables: dto.template_variables,
    };

    const result = await this.whatsappAdapter.sendMessage(credentials, sendPayload);

    // 4. Record WhatsAppMessage entity
    const messageStatus = result.success ? MessageSendingStatus.SENT : MessageSendingStatus.FAILED;

    const message = await this.prisma.whatsAppMessage.create({
      data: {
        conversation_uuid: conversation.conversation_uuid,
        user_uuid: userUuid,
        provider_configuration_uuid: config.configuration_uuid,
        direction: WhatsAppMessageDirection.OUTBOUND,
        message_type: dto.type as WhatsAppMessageType,
        provider_message_id: result.provider_message_id || null,
        recipient_phone: e164,
        sender_phone: config.sender_phone || credentials.phone_number_id || 'Meta WhatsApp',
        content: dto.content || (dto.template_name ? `Template: ${dto.template_name}` : null),
        media_url: dto.media_url || null,
        template_name: dto.template_name || null,
        template_variables: dto.template_variables ? (dto.template_variables as any) : {},
        status: messageStatus,
        error_message: result.error || null,
        sent_at: result.success ? new Date() : null,
      },
    });

    // 5. Update Conversation last message timestamp & direction
    await this.prisma.whatsAppConversation.update({
      where: { conversation_uuid: conversation.conversation_uuid },
      data: {
        last_message_at: new Date(),
        last_message_direction: WhatsAppMessageDirection.OUTBOUND,
      },
    });

    return message;
  }

  /**
   * Handles Meta Webhook Verification Handshake (GET).
   * Verifies hub.mode and hub.verify_token against stored provider credentials.
   */
  async handleWebhookChallenge(
    configurationUuid: string,
    mode?: string,
    token?: string,
    challenge?: string,
  ): Promise<string> {
    const config = await this.prisma.userProviderConfiguration.findUnique({
      where: { configuration_uuid: configurationUuid },
    });

    if (!config || config.type !== MessagingChannel.WHATSAPP) {
      throw new NotFoundException('WhatsApp configuration not found');
    }

    const credentials = this.encryption.decryptObject(config.credentials);
    const expectedToken = credentials.webhook_verify_token;

    const verified = this.whatsappAdapter.verifyWebhookChallenge(mode, token, expectedToken, challenge);
    if (verified === null) {
      this.logger.warn(`Invalid WhatsApp webhook challenge verification attempt for config ${configurationUuid}`);
      throw new ForbiddenException('Failed to verify Meta webhook challenge token');
    }

    this.logger.log(`WhatsApp webhook challenge successfully verified for config ${configurationUuid}`);
    return verified;
  }

  /**
   * Ingests and processes incoming Meta WhatsApp Cloud API Webhook Events (POST).
   * Verifies HMAC-SHA256 signature (X-Hub-Signature-256).
   * Handles delivery receipts (sent, delivered, read, failed) and incoming customer messages.
   */
  async handleWebhookEvent(
    configurationUuid: string,
    rawBody: string | Buffer,
    signatureHeader: string | undefined,
    payload: any,
  ) {
    const config = await this.prisma.userProviderConfiguration.findUnique({
      where: { configuration_uuid: configurationUuid },
    });

    if (!config || config.type !== MessagingChannel.WHATSAPP) {
      throw new NotFoundException('WhatsApp configuration not found');
    }

    const credentials = this.encryption.decryptObject(config.credentials);

    // Cryptographic signature verification
    const isValid = this.whatsappAdapter.verifyWebhookSignature(rawBody, signatureHeader, credentials.app_secret);
    if (!isValid) {
      this.logger.error(`Unauthorized WhatsApp webhook event rejected for config ${configurationUuid}`);
      throw new UnauthorizedException('Invalid X-Hub-Signature-256 HMAC signature');
    }

    const entries = payload?.entry || [];
    let processedStatuses = 0;
    let processedMessages = 0;

    for (const entry of entries) {
      const changes = entry?.changes || [];
      for (const change of changes) {
        if (change.field !== 'messages') continue;
        const value = change.value;
        if (!value) continue;

        // 1. Process Delivery Status Updates (sent, delivered, read, failed)
        const statuses = value.statuses || [];
        for (const st of statuses) {
          const wamid = st.id;
          const statusStr = (st.status || '').toLowerCase();
          const timestamp = st.timestamp ? new Date(Number(st.timestamp) * 1000) : new Date();

          let mappedStatus: MessageSendingStatus | null = null;
          let mappedEvent: NormalizedEventType = NormalizedEventType.QUEUED;

          if (statusStr === 'sent') {
            mappedStatus = MessageSendingStatus.SENT;
            mappedEvent = NormalizedEventType.ACCEPTED;
          } else if (statusStr === 'delivered') {
            mappedStatus = MessageSendingStatus.DELIVERED;
            mappedEvent = NormalizedEventType.DELIVERED;
          } else if (statusStr === 'read') {
            mappedStatus = MessageSendingStatus.DELIVERED;
            mappedEvent = NormalizedEventType.OPENED;
          } else if (statusStr === 'failed') {
            mappedStatus = MessageSendingStatus.FAILED;
            mappedEvent = NormalizedEventType.FAILED;
          }

          if (mappedStatus && wamid) {
            // Deduplicate event
            const eventDeduplicationKey = `wa_${wamid}_${statusStr}`;
            try {
              await this.prisma.providerWebhookEvent.upsert({
                where: {
                  provider_configuration_uuid_provider_event_id: {
                    provider_configuration_uuid: configurationUuid,
                    provider_event_id: eventDeduplicationKey,
                  },
                },
                create: {
                  user_uuid: config.user_uuid,
                  provider_configuration_uuid: configurationUuid,
                  provider_event_id: eventDeduplicationKey,
                  provider_event_type: `whatsapp.${statusStr}`,
                  normalized_event_type: mappedEvent,
                  payload: st,
                  processing_status: WebhookProcessingStatus.PROCESSED,
                  processed_at: new Date(),
                },
                update: {
                  processing_attempts: { increment: 1 },
                },
              });
            } catch (err) {
              // Ignore unique violation duplicate
            }

            // Update matching WhatsAppMessage record
            const updateData: any = {
              status: mappedStatus,
            };
            if (statusStr === 'delivered') updateData.delivered_at = timestamp;
            if (statusStr === 'read') updateData.read_at = timestamp;
            if (statusStr === 'failed' && st.errors?.[0]) {
              updateData.error_code = String(st.errors[0].code);
              updateData.error_message = st.errors[0].title || st.errors[0].message;
            }

            await this.prisma.whatsAppMessage.updateMany({
              where: { provider_message_id: wamid },
              data: updateData,
            });

            processedStatuses++;
          }
        }

        // 2. Process Inbound Messages from Customer
        const messages = value.messages || [];
        const contacts = value.contacts || [];
        const contactProfileName = contacts[0]?.profile?.name || null;

        for (const msg of messages) {
          const fromPhone = msg.from;
          const { e164 } = this.whatsappAdapter.normalizePhoneNumber(fromPhone);
          const wamid = msg.id;
          const msgTimestamp = msg.timestamp ? new Date(Number(msg.timestamp) * 1000) : new Date();

          // Deduplicate incoming message
          const existing = await this.prisma.whatsAppMessage.findFirst({
            where: { provider_message_id: wamid },
          });
          if (existing) continue;

          // 24-hour service window extended from received inbound message
          const windowExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

          // Find or create Conversation
          const conversation = await this.prisma.whatsAppConversation.upsert({
            where: {
              provider_configuration_uuid_contact_phone: {
                provider_configuration_uuid: configurationUuid,
                contact_phone: e164,
              },
            },
            create: {
              user_uuid: config.user_uuid,
              provider_configuration_uuid: configurationUuid,
              contact_phone: e164,
              contact_name: contactProfileName,
              last_message_at: msgTimestamp,
              last_message_direction: WhatsAppMessageDirection.INBOUND,
              window_expires_at: windowExpiresAt,
              is_active: true,
            },
            update: {
              contact_name: contactProfileName || undefined,
              last_message_at: msgTimestamp,
              last_message_direction: WhatsAppMessageDirection.INBOUND,
              window_expires_at: windowExpiresAt,
            },
          });

          // Determine content & message type
          let msgType: WhatsAppMessageType = WhatsAppMessageType.TEXT;
          let content: string = '';
          let mediaUrl: string | null = null;

          if (msg.type === 'text') {
            msgType = WhatsAppMessageType.TEXT;
            content = msg.text?.body || '';
          } else if (msg.type === 'image') {
            msgType = WhatsAppMessageType.IMAGE;
            content = msg.image?.caption || '[Image]';
            mediaUrl = msg.image?.id ? `https://graph.facebook.com/v21.0/${msg.image.id}` : null;
          } else if (msg.type === 'document') {
            msgType = WhatsAppMessageType.DOCUMENT;
            content = msg.document?.caption || msg.document?.filename || '[Document]';
          } else if (msg.type === 'audio') {
            msgType = WhatsAppMessageType.AUDIO;
            content = '[Audio Recording]';
          } else if (msg.type === 'video') {
            msgType = WhatsAppMessageType.VIDEO;
            content = msg.video?.caption || '[Video]';
          } else if (msg.type === 'location') {
            msgType = WhatsAppMessageType.LOCATION;
            content = `Location: ${msg.location?.latitude}, ${msg.location?.longitude} (${msg.location?.name || ''})`;
          } else {
            content = `[${msg.type} message]`;
          }

          // Save inbound WhatsAppMessage
          await this.prisma.whatsAppMessage.create({
            data: {
              conversation_uuid: conversation.conversation_uuid,
              user_uuid: config.user_uuid,
              provider_configuration_uuid: configurationUuid,
              direction: WhatsAppMessageDirection.INBOUND,
              message_type: msgType,
              provider_message_id: wamid,
              recipient_phone: config.sender_phone || '',
              sender_phone: e164,
              content,
              media_url: mediaUrl,
              status: MessageSendingStatus.DELIVERED,
              delivered_at: msgTimestamp,
            },
          });

          processedMessages++;
        }
      }
    }

    return {
      success: true,
      processed_statuses: processedStatuses,
      processed_messages: processedMessages,
    };
  }

  /**
   * Syncs WhatsApp Templates from Meta Graph API into WhatsAppTemplate table.
   */
  async syncTemplates(userUuid: string, configurationUuid: string) {
    const { config, credentials } = await this.configService.getDecryptedConfiguration(
      userUuid,
      configurationUuid,
      MessagingChannel.WHATSAPP,
    );

    const remoteTemplates = await this.whatsappAdapter.fetchTemplates(credentials);

    const synced = [];
    for (const t of remoteTemplates) {
      let mappedStatus: WhatsAppTemplateStatus = WhatsAppTemplateStatus.PENDING;
      if (t.status === 'APPROVED') mappedStatus = WhatsAppTemplateStatus.APPROVED;
      if (t.status === 'REJECTED') mappedStatus = WhatsAppTemplateStatus.REJECTED;
      if (t.status === 'PAUSED') mappedStatus = WhatsAppTemplateStatus.PAUSED;

      const record = await this.prisma.whatsAppTemplate.upsert({
        where: {
          provider_configuration_uuid_name_language: {
            provider_configuration_uuid: config.configuration_uuid,
            name: t.name,
            language: t.language || 'en_US',
          },
        },
        create: {
          user_uuid: userUuid,
          provider_configuration_uuid: config.configuration_uuid,
          meta_template_id: t.id,
          name: t.name,
          language: t.language || 'en_US',
          category: t.category || 'MARKETING',
          status: mappedStatus,
          components: t.components || [],
        },
        update: {
          meta_template_id: t.id,
          category: t.category || 'MARKETING',
          status: mappedStatus,
          components: t.components || [],
        },
      });
      synced.push(record);
    }

    return synced;
  }

  /**
   * Lists synced templates from database.
   */
  async listTemplates(userUuid: string, configurationUuid?: string) {
    return this.prisma.whatsAppTemplate.findMany({
      where: {
        user_uuid: userUuid,
        ...(configurationUuid ? { provider_configuration_uuid: configurationUuid } : {}),
      },
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
    });
  }

  /**
   * Creates a new custom WhatsApp Template in the database.
   */
  async createTemplate(userUuid: string, dto: CreateWhatsAppTemplateDto) {
    const { config } = await this.configService.getDecryptedConfiguration(
      userUuid,
      dto.configuration_uuid,
      MessagingChannel.WHATSAPP,
    );

    // Format template name to lowercase alphanumeric + underscore (Meta rules)
    const normalizedName = dto.name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9_]/g, '_');

    const components: any[] = [];
    if (dto.header_text) {
      components.push({ type: 'HEADER', format: 'TEXT', text: dto.header_text });
    }
    components.push({ type: 'BODY', text: dto.body_text });
    if (dto.footer_text) {
      components.push({ type: 'FOOTER', text: dto.footer_text });
    }
    if (dto.buttons && dto.buttons.length > 0) {
      components.push({ type: 'BUTTONS', buttons: dto.buttons });
    }

    const template = await this.prisma.whatsAppTemplate.create({
      data: {
        user_uuid: userUuid,
        provider_configuration_uuid: config.configuration_uuid,
        name: normalizedName,
        language: dto.language || 'en_US',
        category: dto.category || 'MARKETING',
        status: WhatsAppTemplateStatus.APPROVED, // Pre-approved in system
        components,
      },
    });

    return template;
  }

  /**
   * Updates an existing WhatsApp Template.
   */
  async updateTemplate(userUuid: string, templateUuid: string, dto: UpdateWhatsAppTemplateDto) {
    const existing = await this.prisma.whatsAppTemplate.findFirst({
      where: { template_uuid: templateUuid, user_uuid: userUuid },
    });

    if (!existing) {
      throw new NotFoundException('WhatsApp Template not found');
    }

    const components: any[] = [];
    if (dto.header_text) {
      components.push({ type: 'HEADER', format: 'TEXT', text: dto.header_text });
    }
    components.push({ type: 'BODY', text: dto.body_text || '' });
    if (dto.footer_text) {
      components.push({ type: 'FOOTER', text: dto.footer_text });
    }
    if (dto.buttons && dto.buttons.length > 0) {
      components.push({ type: 'BUTTONS', buttons: dto.buttons });
    }

    const updated = await this.prisma.whatsAppTemplate.update({
      where: { template_uuid: templateUuid },
      data: {
        name: dto.name
          ? dto.name.toLowerCase().trim().replace(/[^a-z0-9_]/g, '_')
          : existing.name,
        language: dto.language ?? existing.language,
        category: dto.category ?? existing.category,
        components: components.length > 0 ? components : existing.components,
      },
    });

    return updated;
  }

  /**
   * Deletes a WhatsApp Template.
   */
  async deleteTemplate(userUuid: string, templateUuid: string) {
    const existing = await this.prisma.whatsAppTemplate.findFirst({
      where: { template_uuid: templateUuid, user_uuid: userUuid },
    });

    if (!existing) {
      throw new NotFoundException('WhatsApp Template not found');
    }

    await this.prisma.whatsAppTemplate.delete({
      where: { template_uuid: templateUuid },
    });

    return { success: true, message: 'WhatsApp Template deleted successfully' };
  }

  /**
   * Lists conversations with last message and 24-hr session status.
   */
  async listConversations(userUuid: string, configurationUuid?: string) {
    const convs = await this.prisma.whatsAppConversation.findMany({
      where: {
        user_uuid: userUuid,
        ...(configurationUuid ? { provider_configuration_uuid: configurationUuid } : {}),
      },
      include: {
        provider_configuration: {
          select: {
            configuration_uuid: true,
            configuration_name: true,
            sender_phone: true,
          },
        },
        messages: {
          take: 1,
          orderBy: { created_at: 'desc' },
        },
      },
      orderBy: [{ last_message_at: 'desc' }],
    });

    const now = new Date();
    return convs.map((c) => {
      const isWindowOpen = c.window_expires_at ? c.window_expires_at > now : false;
      const hoursRemaining = isWindowOpen
        ? Math.max(1, Math.round((c.window_expires_at!.getTime() - now.getTime()) / (1000 * 60 * 60)))
        : 0;

      return {
        ...c,
        session: {
          is_active: isWindowOpen,
          expires_at: c.window_expires_at,
          hours_remaining: hoursRemaining,
        },
        latest_message: c.messages[0] || null,
      };
    });
  }

  /**
   * Returns chronological message logs for a specific conversation.
   */
  async getConversationMessages(userUuid: string, conversationUuid: string) {
    const conversation = await this.prisma.whatsAppConversation.findFirst({
      where: { conversation_uuid: conversationUuid, user_uuid: userUuid },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    const messages = await this.prisma.whatsAppMessage.findMany({
      where: { conversation_uuid: conversationUuid },
      orderBy: { created_at: 'asc' },
    });

    const now = new Date();
    const isWindowOpen = conversation.window_expires_at ? conversation.window_expires_at > now : false;
    const hoursRemaining = isWindowOpen
      ? Math.max(1, Math.round((conversation.window_expires_at!.getTime() - now.getTime()) / (1000 * 60 * 60)))
      : 0;

    return {
      conversation: {
        ...conversation,
        session: {
          is_active: isWindowOpen,
          expires_at: conversation.window_expires_at,
          hours_remaining: hoursRemaining,
        },
      },
      messages,
    };
  }
}
