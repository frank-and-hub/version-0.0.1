import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { TwilioSmsProviderAdapter } from '../adapters/twilio-sms.provider';
import { ProviderConfigurationService } from './provider-configuration.service';
import { ProviderEncryptionService } from './provider-encryption.service';
import { ProviderRegistryService } from './provider-registry.service';
import {
  MessageSendingStatus,
  SmsMessageDirection,
  SmsEncoding,
  NormalizedEventType,
  WebhookProcessingStatus,
} from '@prisma/client';

export interface SendSmsDto {
  recipient_phone: string;
  body: string;
  provider_configuration_uuid?: string;
  sender_phone?: string;
  messaging_service_sid?: string;
  scheduled_at?: string;
  template_uuid?: string;
  template_variables?: Record<string, string>;
  metadata?: Record<string, any>;
}

export interface SendBulkSmsDto {
  recipients: Array<{
    phone: string;
    variables?: Record<string, string>;
  }>;
  body: string;
  provider_configuration_uuid?: string;
  sender_phone?: string;
  messaging_service_sid?: string;
  scheduled_at?: string;
  template_uuid?: string;
  metadata?: Record<string, any>;
}

export interface SmsQueryDto {
  status?: MessageSendingStatus;
  recipient?: string;
  sender?: string;
  direction?: SmsMessageDirection;
  is_scheduled?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

const OPT_OUT_KEYWORDS = ['STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT'];
const OPT_IN_KEYWORDS = ['START', 'UNSTOP', 'YES'];

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly twilioAdapter: TwilioSmsProviderAdapter,
    private readonly configService: ProviderConfigurationService,
    private readonly encryption: ProviderEncryptionService,
    private readonly providerRegistry: ProviderRegistryService,
  ) {}

  // -------------------------------------------------------------
  // Configuration Helper
  // -------------------------------------------------------------
  async getActiveConfiguration(userUuid: string, configUuid?: string) {
    let config;
    if (configUuid) {
      config = await this.prisma.userProviderConfiguration.findFirst({
        where: {
          configuration_uuid: configUuid,
          user_uuid: userUuid,
          type: 'SMS',
          deleted_at: null,
        },
        include: { provider: true },
      });
    } else {
      config = await this.prisma.userProviderConfiguration.findFirst({
        where: {
          user_uuid: userUuid,
          type: 'SMS',
          is_active: true,
          deleted_at: null,
        },
        orderBy: [{ is_default: 'desc' }, { created_at: 'desc' }],
        include: { provider: true },
      });
    }

    if (!config) {
      throw new NotFoundException(
        'No active SMS provider configuration found. Please connect your Twilio account first.',
      );
    }

    const decryptedCredentials = this.encryption.decryptObject(config.credentials);
    return { config, decryptedCredentials };
  }

  // -------------------------------------------------------------
  // Template Variable Interpolation
  // -------------------------------------------------------------
  interpolateTemplate(content: string, variables: Record<string, any> = {}): string {
    return content.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
      return variables[key] !== undefined ? String(variables[key]) : `{{${key}}}`;
    });
  }

  // -------------------------------------------------------------
  // Opt-Out & Consent Checks
  // -------------------------------------------------------------
  async isRecipientOptedOut(userUuid: string, phone: string): Promise<boolean> {
    const { e164 } = this.twilioAdapter.normalizePhoneNumber(phone);
    const optOut = await this.prisma.smsOptOut.findUnique({
      where: {
        user_uuid_phone_number: {
          user_uuid: userUuid,
          phone_number: e164,
        },
      },
    });
    return !!optOut && optOut.is_opted_out;
  }

  // -------------------------------------------------------------
  // Individual SMS Sending / Scheduling
  // -------------------------------------------------------------
  async sendSms(userUuid: string, dto: SendSmsDto) {
    const { config, decryptedCredentials } = await this.getActiveConfiguration(
      userUuid,
      dto.provider_configuration_uuid,
    );

    const { e164: recipientE164 } = this.twilioAdapter.normalizePhoneNumber(dto.recipient_phone);

    // Consent & Opt-Out Compliance Check
    const optedOut = await this.isRecipientOptedOut(userUuid, recipientE164);
    if (optedOut) {
      throw new BadRequestException(
        `Recipient ${recipientE164} has previously opted out of SMS notifications (TCPA/CTIA Compliance).`,
      );
    }

    // Message personalization
    let messageBody = dto.body;
    if (dto.template_uuid) {
      const template = await this.prisma.smsTemplate.findFirst({
        where: { template_uuid: dto.template_uuid, user_uuid: userUuid, deleted_at: null },
      });
      if (template) {
        messageBody = template.body;
      }
    }
    if (dto.template_variables && Object.keys(dto.template_variables).length > 0) {
      messageBody = this.interpolateTemplate(messageBody, dto.template_variables);
    }

    // Calculate segments and charset encoding
    const segmentInfo = this.twilioAdapter.calculateSegments(messageBody);

    const senderPhone =
      dto.sender_phone || config.sender_phone || decryptedCredentials.sender_phone || '+15005550006';
    const messagingServiceSid =
      dto.messaging_service_sid || decryptedCredentials.messaging_service_sid;

    // Determine if scheduled
    const isScheduled = !!dto.scheduled_at && new Date(dto.scheduled_at) > new Date();

    // 1. Thread or create SmsConversation
    let conversation = await this.prisma.smsConversation.findUnique({
      where: {
        provider_configuration_uuid_contact_phone: {
          provider_configuration_uuid: config.configuration_uuid,
          contact_phone: recipientE164,
        },
      },
    });

    if (!conversation) {
      conversation = await this.prisma.smsConversation.create({
        data: {
          user_uuid: userUuid,
          provider_configuration_uuid: config.configuration_uuid,
          contact_phone: recipientE164,
          last_message_at: new Date(),
          last_message_direction: SmsMessageDirection.OUTBOUND,
        },
      });
    }

    // 2. Persist SmsMessage record
    const smsRecord = await this.prisma.smsMessage.create({
      data: {
        conversation_uuid: conversation.conversation_uuid,
        user_uuid: userUuid,
        provider_configuration_uuid: config.configuration_uuid,
        direction: SmsMessageDirection.OUTBOUND,
        recipient_phone: recipientE164,
        sender_phone: senderPhone,
        messaging_service_sid: messagingServiceSid,
        body: messageBody,
        segment_count: segmentInfo.segmentCount,
        encoding: segmentInfo.encoding as SmsEncoding,
        status: isScheduled ? MessageSendingStatus.QUEUED : MessageSendingStatus.PROCESSING,
        scheduled_at: isScheduled ? new Date(dto.scheduled_at!) : null,
        is_scheduled: isScheduled,
        template_uuid: dto.template_uuid,
        template_variables: dto.template_variables || {},
        metadata: dto.metadata || {},
      },
    });

    if (isScheduled) {
      this.logger.log(`SMS scheduled for ${dto.scheduled_at} to ${recipientE164} [${smsRecord.message_uuid}]`);
      return {
        message: 'SMS message scheduled successfully',
        message_uuid: smsRecord.message_uuid,
        scheduled_at: smsRecord.scheduled_at,
        segment_count: smsRecord.segment_count,
        encoding: smsRecord.encoding,
        status: smsRecord.status,
      };
    }

    // 3. Dispatch to Provider API
    let result;
    const providerSlug = config.provider?.slug?.toLowerCase() || 'twilio-sms';

    if (this.providerRegistry.hasAdapter(providerSlug)) {
      const adapter = this.providerRegistry.getAdapter(providerSlug) as any;
      if (typeof adapter.sendSms === 'function') {
        const callbackUrl = process.env.API_PUBLIC_URL
          ? `${process.env.API_PUBLIC_URL}/api/webhooks/messaging/sms/${providerSlug}/${config.configuration_uuid}/status`
          : undefined;

        result = await adapter.sendSms(decryptedCredentials, {
          to: recipientE164,
          from: messagingServiceSid ? undefined : senderPhone,
          messaging_service_sid: messagingServiceSid,
          body: messageBody,
          status_callback: callbackUrl,
        });
      }
    }

    if (!result) {
      // Fallback to Twilio provider adapter
      const callbackUrl = process.env.API_PUBLIC_URL
        ? `${process.env.API_PUBLIC_URL}/api/webhooks/messaging/sms/twilio/${config.configuration_uuid}/status`
        : undefined;

      result = await this.twilioAdapter.sendSms(decryptedCredentials, {
        to: recipientE164,
        from: messagingServiceSid ? undefined : senderPhone,
        messaging_service_sid: messagingServiceSid,
        body: messageBody,
        status_callback: callbackUrl,
      });
    }

    // 4. Update status with Twilio SID or failure reason
    const updated = await this.prisma.smsMessage.update({
      where: { message_uuid: smsRecord.message_uuid },
      data: {
        provider_message_id: result.provider_message_id,
        status: result.success ? MessageSendingStatus.SENT : MessageSendingStatus.FAILED,
        error_message: result.error,
        sent_at: result.success ? new Date() : null,
        failed_at: !result.success ? new Date() : null,
        segment_count: result.segment_count || segmentInfo.segmentCount,
        price: result.price,
        price_unit: result.price_unit,
      },
    });

    // Update conversation last message timestamp
    await this.prisma.smsConversation.update({
      where: { conversation_uuid: conversation.conversation_uuid },
      data: {
        last_message_at: new Date(),
        last_message_direction: SmsMessageDirection.OUTBOUND,
      },
    });

    return {
      message: result.success ? 'SMS dispatched successfully' : 'SMS dispatch failed',
      message_uuid: updated.message_uuid,
      provider_message_id: updated.provider_message_id,
      status: updated.status,
      segment_count: updated.segment_count,
      encoding: updated.encoding,
      error: updated.error_message,
    };
  }

  // -------------------------------------------------------------
  // Bulk SMS Dispatch
  // -------------------------------------------------------------
  async sendBulkSms(userUuid: string, dto: SendBulkSmsDto) {
    if (!dto.recipients || dto.recipients.length === 0) {
      throw new BadRequestException('At least one recipient is required for bulk sending.');
    }

    const results: Array<{
      phone: string;
      status: 'QUEUED' | 'SENT' | 'FAILED' | 'OPTED_OUT';
      message_uuid?: string;
      error?: string;
    }> = [];

    // Deduplicate recipient list
    const seenPhones = new Set<string>();
    const uniqueRecipients: Array<{ phone: string; variables?: Record<string, string> }> = [];

    for (const r of dto.recipients) {
      try {
        const { e164 } = this.twilioAdapter.normalizePhoneNumber(r.phone);
        if (!seenPhones.has(e164)) {
          seenPhones.add(e164);
          uniqueRecipients.push({ phone: e164, variables: r.variables });
        }
      } catch (err: any) {
        results.push({ phone: r.phone, status: 'FAILED', error: err.message });
      }
    }

    for (const item of uniqueRecipients) {
      try {
        const isOptedOut = await this.isRecipientOptedOut(userUuid, item.phone);
        if (isOptedOut) {
          results.push({ phone: item.phone, status: 'OPTED_OUT', error: 'Recipient has opted out' });
          continue;
        }

        const dispatchRes = await this.sendSms(userUuid, {
          recipient_phone: item.phone,
          body: dto.body,
          provider_configuration_uuid: dto.provider_configuration_uuid,
          sender_phone: dto.sender_phone,
          messaging_service_sid: dto.messaging_service_sid,
          scheduled_at: dto.scheduled_at,
          template_uuid: dto.template_uuid,
          template_variables: item.variables,
          metadata: dto.metadata,
        });

        results.push({
          phone: item.phone,
          status: (dispatchRes.status as any) || 'SENT',
          message_uuid: dispatchRes.message_uuid,
        });
      } catch (err: any) {
        results.push({ phone: item.phone, status: 'FAILED', error: err.message });
      }
    }

    const totalQueued = results.filter((r) => r.status === 'QUEUED' || r.status === 'SENT').length;
    const totalFailed = results.filter((r) => r.status === 'FAILED').length;
    const totalOptedOut = results.filter((r) => r.status === 'OPTED_OUT').length;

    return {
      total: results.length,
      success_count: totalQueued,
      failed_count: totalFailed,
      opted_out_count: totalOptedOut,
      items: results,
    };
  }

  // -------------------------------------------------------------
  // Cancel Scheduled SMS
  // -------------------------------------------------------------
  async cancelScheduledSms(userUuid: string, messageUuid: string) {
    const msg = await this.prisma.smsMessage.findFirst({
      where: {
        message_uuid: messageUuid,
        user_uuid: userUuid,
      },
    });

    if (!msg) {
      throw new NotFoundException(`SMS message with ID '${messageUuid}' not found.`);
    }

    if (msg.status !== MessageSendingStatus.QUEUED || !msg.is_scheduled) {
      throw new BadRequestException('Only scheduled messages in QUEUED status can be cancelled.');
    }

    const cancelled = await this.prisma.smsMessage.update({
      where: { message_uuid: messageUuid },
      data: {
        status: MessageSendingStatus.CANCELLED,
        cancelled_at: new Date(),
      },
    });

    return {
      message: 'Scheduled SMS cancelled successfully',
      message_uuid: cancelled.message_uuid,
      status: cancelled.status,
    };
  }

  // -------------------------------------------------------------
  // Message Querying & Delivery History
  // -------------------------------------------------------------
  async getSmsMessages(userUuid: string, query: SmsQueryDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const where: any = {
      user_uuid: userUuid,
      ...(query.status ? { status: query.status } : {}),
      ...(query.direction ? { direction: query.direction } : {}),
      ...(query.is_scheduled !== undefined ? { is_scheduled: query.is_scheduled } : {}),
      ...(query.recipient ? { recipient_phone: { contains: query.recipient } } : {}),
      ...(query.sender ? { sender_phone: { contains: query.sender } } : {}),
    };

    if (query.search) {
      where.OR = [
        { body: { contains: query.search, mode: 'insensitive' } },
        { recipient_phone: { contains: query.search } },
        { provider_message_id: { contains: query.search } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.smsMessage.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
        include: {
          provider_configuration: {
            select: {
              configuration_name: true,
              sender_phone: true,
              provider: { select: { name: true, slug: true, logo: true } },
            },
          },
        },
      }),
      this.prisma.smsMessage.count({ where }),
    ]);

    return {
      items,
      meta: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  // -------------------------------------------------------------
  // Platform Statistics
  // -------------------------------------------------------------
  async getSmsStats(userUuid: string) {
    const [total, sent, delivered, failed, scheduled, optOuts, aggregates] = await Promise.all([
      this.prisma.smsMessage.count({ where: { user_uuid: userUuid } }),
      this.prisma.smsMessage.count({ where: { user_uuid: userUuid, status: MessageSendingStatus.SENT } }),
      this.prisma.smsMessage.count({ where: { user_uuid: userUuid, status: MessageSendingStatus.DELIVERED } }),
      this.prisma.smsMessage.count({ where: { user_uuid: userUuid, status: MessageSendingStatus.FAILED } }),
      this.prisma.smsMessage.count({ where: { user_uuid: userUuid, is_scheduled: true, status: MessageSendingStatus.QUEUED } }),
      this.prisma.smsOptOut.count({ where: { user_uuid: userUuid, is_opted_out: true } }),
      this.prisma.smsMessage.aggregate({
        where: { user_uuid: userUuid },
        _sum: { segment_count: true, price: true },
      }),
    ]);

    const deliveryRate = sent + delivered > 0 ? ((delivered / (sent + delivered)) * 100).toFixed(1) : '100.0';

    return {
      total,
      sent,
      delivered,
      failed,
      scheduled,
      opt_outs: optOuts,
      delivery_rate: `${deliveryRate}%`,
      total_segments: aggregates._sum.segment_count || 0,
      total_cost_estimated: aggregates._sum.price ? `$${aggregates._sum.price.toFixed(4)}` : '$0.0000',
    };
  }

  // -------------------------------------------------------------
  // Multi-Provider Status Callback Webhook
  // -------------------------------------------------------------
  async handleStatusCallback(
    configUuid: string,
    params: any,
    signature?: string,
    requestUrl?: string,
    providerSlug?: string,
  ) {
    const config = await this.prisma.userProviderConfiguration.findUnique({
      where: { configuration_uuid: configUuid },
      include: { provider: true },
    });

    if (!config) {
      throw new NotFoundException(`Provider configuration '${configUuid}' not found`);
    }

    const credentials = this.encryption.decryptObject(config.credentials);

    // Validate Twilio HMAC-SHA1 signature if provided
    if (signature && requestUrl && credentials.auth_token) {
      const isValid = this.twilioAdapter.validateWebhookSignature(
        requestUrl,
        params,
        signature,
        credentials.auth_token,
      );
      if (!isValid) {
        this.logger.warn(`Rejected invalid Twilio Webhook Signature for config ${configUuid}`);
        throw new ForbiddenException('Invalid Twilio signature header');
      }
    }

    // Extract Message SID / ID across all supported providers (Twilio, MessageBird, Vonage, Plivo, Telnyx, Infobip, AWS SNS)
    const messageSid =
      params.MessageSid ||
      params.SmsSid ||
      params.MessageUUID ||
      params.messageId ||
      params.message_id ||
      params.id ||
      params?.data?.payload?.id ||
      params?.results?.[0]?.messageId;

    const rawStatus = (
      params.MessageStatus ||
      params.SmsStatus ||
      params.Status ||
      params.status ||
      params?.data?.event_type ||
      params?.results?.[0]?.status?.name ||
      ''
    ).toLowerCase();

    if (!messageSid) {
      return { success: false, message: 'Missing MessageSid/messageId parameter in callback' };
    }

    const existing = await this.prisma.smsMessage.findUnique({
      where: { provider_message_id: messageSid },
    });

    if (!existing) {
      return { success: false, message: `Message '${messageSid}' not found in database` };
    }

    // Map raw status to MessageSendingStatus & NormalizedEventType
    let status: MessageSendingStatus = existing.status;
    let normalizedEvent: NormalizedEventType = NormalizedEventType.ACCEPTED;
    let deliveredAt = existing.delivered_at;
    let failedAt = existing.failed_at;
    let sentAt = existing.sent_at;

    if (rawStatus.includes('deliver') || rawStatus === 'success') {
      status = MessageSendingStatus.DELIVERED;
      normalizedEvent = NormalizedEventType.DELIVERED;
      deliveredAt = new Date();
    } else if (rawStatus.includes('sent') || rawStatus.includes('queued')) {
      status = MessageSendingStatus.SENT;
      normalizedEvent = NormalizedEventType.ACCEPTED;
      sentAt = sentAt || new Date();
    } else if (rawStatus.includes('fail') || rawStatus.includes('undeliver') || rawStatus.includes('reject')) {
      status = MessageSendingStatus.FAILED;
      normalizedEvent = NormalizedEventType.FAILED;
      failedAt = new Date();
    }

    await this.prisma.smsMessage.update({
      where: { message_uuid: existing.message_uuid },
      data: {
        status,
        delivered_at: deliveredAt,
        failed_at: failedAt,
        sent_at: sentAt,
        error_code: params.ErrorCode || params.err_code || existing.error_code,
        error_message: params.ErrorMessage || params.error || existing.error_message,
        price: params.Price ? Math.abs(parseFloat(params.Price)) : existing.price,
        price_unit: params.PriceUnit || existing.price_unit,
        metadata: {
          ...((existing.metadata as any) || {}),
          last_callback_payload: params,
        },
      },
    });

    // Store in ProviderWebhookEvent for omnichannel reporting
    const eventDeduplicationKey = `sms_${messageSid}_${rawStatus}`;
    try {
      await this.prisma.providerWebhookEvent.upsert({
        where: {
          provider_configuration_uuid_provider_event_id: {
            provider_configuration_uuid: configUuid,
            provider_event_id: eventDeduplicationKey,
          },
        },
        create: {
          user_uuid: config.user_uuid,
          provider_configuration_uuid: configUuid,
          provider_event_id: eventDeduplicationKey,
          provider_event_type: `sms.${rawStatus || 'status'}`,
          normalized_event_type: normalizedEvent,
          payload: params,
          processing_status: WebhookProcessingStatus.PROCESSED,
          processed_at: new Date(),
        },
        update: {
          processing_status: WebhookProcessingStatus.PROCESSED,
          processed_at: new Date(),
        },
      });
    } catch (e) {
      // Ignore unique deduplication conflict
    }

    return {
      success: true,
      message_uuid: existing.message_uuid,
      status,
    };
  }

  // -------------------------------------------------------------
  // Multi-Provider Inbound SMS Webhook Receiver & Opt-Out Automations
  // -------------------------------------------------------------
  async handleInboundSms(
    configUuid: string,
    params: any,
    signature?: string,
    requestUrl?: string,
    providerSlug?: string,
  ) {
    const config = await this.prisma.userProviderConfiguration.findUnique({
      where: { configuration_uuid: configUuid },
    });

    if (!config) {
      throw new NotFoundException(`Provider configuration '${configUuid}' not found`);
    }

    const credentials = this.encryption.decryptObject(config.credentials);

    // Validate signature if Twilio credentials are present
    if (signature && requestUrl && credentials.auth_token) {
      const isValid = this.twilioAdapter.validateWebhookSignature(
        requestUrl,
        params,
        signature,
        credentials.auth_token,
      );
      if (!isValid) {
        throw new ForbiddenException('Invalid Twilio signature header');
      }
    }

    // Extract parameters across all providers
    const fromNumber =
      params.From ||
      params.from ||
      params.sender ||
      params.source ||
      params?.data?.payload?.from?.phone_number;

    const toNumber =
      params.To ||
      params.to ||
      params.destination ||
      params?.data?.payload?.to?.[0]?.phone_number;

    const body = (
      params.Body ||
      params.body ||
      params.text ||
      params.message ||
      params?.data?.payload?.text ||
      ''
    ).trim();

    const messageSid =
      params.MessageSid ||
      params.SmsSid ||
      params.MessageUUID ||
      params.messageId ||
      params.id ||
      params?.data?.payload?.id ||
      `inbound-${crypto.randomUUID()}`;

    if (!fromNumber) {
      throw new BadRequestException('Missing sender phone number in inbound callback');
    }

    const { e164: contactE164 } = this.twilioAdapter.normalizePhoneNumber(fromNumber);
    const upperBody = body.toUpperCase();
    const isOptOut = OPT_OUT_KEYWORDS.includes(upperBody);

    // 1. Automatic TCPA/CTIA Opt-Out Management
    if (isOptOut) {
      await this.prisma.smsOptOut.upsert({
        where: {
          user_uuid_phone_number: {
            user_uuid: config.user_uuid,
            phone_number: contactE164,
          },
        },
        create: {
          user_uuid: config.user_uuid,
          phone_number: contactE164,
          reason: upperBody,
          source: 'INBOUND_SMS',
          is_opted_out: true,
          opted_out_at: new Date(),
        },
        update: {
          is_opted_out: true,
          reason: upperBody,
          opted_out_at: new Date(),
        },
      });
      this.logger.log(`Opt-out recorded for phone: ${contactE164} via keyword ${upperBody}`);
    } else if (OPT_IN_KEYWORDS.includes(upperBody)) {
      await this.prisma.smsOptOut.upsert({
        where: {
          user_uuid_phone_number: {
            user_uuid: config.user_uuid,
            phone_number: contactE164,
          },
        },
        create: {
          user_uuid: config.user_uuid,
          phone_number: contactE164,
          reason: upperBody,
          source: 'INBOUND_SMS',
          is_opted_out: false,
          opted_in_at: new Date(),
        },
        update: {
          is_opted_out: false,
          opted_in_at: new Date(),
        },
      });
      this.logger.log(`Opt-in recorded for phone: ${contactE164} via keyword ${upperBody}`);
    }

    // 2. Thread or create conversation
    let conversation = await this.prisma.smsConversation.findUnique({
      where: {
        provider_configuration_uuid_contact_phone: {
          provider_configuration_uuid: config.configuration_uuid,
          contact_phone: contactE164,
        },
      },
    });

    if (!conversation) {
      conversation = await this.prisma.smsConversation.create({
        data: {
          user_uuid: config.user_uuid,
          provider_configuration_uuid: config.configuration_uuid,
          contact_phone: contactE164,
          last_message_at: new Date(),
          last_message_direction: SmsMessageDirection.INBOUND,
        },
      });
    } else {
      await this.prisma.smsConversation.update({
        where: { conversation_uuid: conversation.conversation_uuid },
        data: {
          last_message_at: new Date(),
          last_message_direction: SmsMessageDirection.INBOUND,
        },
      });
    }

    // 3. Store Inbound Message Record
    const segmentInfo = this.twilioAdapter.calculateSegments(body);

    const inboundRecord = await this.prisma.smsMessage.create({
      data: {
        conversation_uuid: conversation.conversation_uuid,
        user_uuid: config.user_uuid,
        provider_configuration_uuid: config.configuration_uuid,
        direction: SmsMessageDirection.INBOUND,
        provider_message_id: messageSid,
        recipient_phone: toNumber || config.sender_phone || '',
        sender_phone: contactE164,
        body,
        segment_count: segmentInfo.segmentCount,
        encoding: segmentInfo.encoding as SmsEncoding,
        status: MessageSendingStatus.DELIVERED,
        delivered_at: new Date(),
        metadata: { inbound_params: params },
      },
    });

    // 4. Record event in ProviderWebhookEvent for unified analytics
    const eventDeduplicationKey = `sms_inbound_${messageSid}`;
    try {
      await this.prisma.providerWebhookEvent.upsert({
        where: {
          provider_configuration_uuid_provider_event_id: {
            provider_configuration_uuid: configUuid,
            provider_event_id: eventDeduplicationKey,
          },
        },
        create: {
          user_uuid: config.user_uuid,
          provider_configuration_uuid: configUuid,
          provider_event_id: eventDeduplicationKey,
          provider_event_type: 'sms.inbound',
          normalized_event_type: isOptOut ? NormalizedEventType.UNSUBSCRIBED : NormalizedEventType.ACCEPTED,
          payload: params,
          processing_status: WebhookProcessingStatus.PROCESSED,
          processed_at: new Date(),
        },
        update: {
          processing_status: WebhookProcessingStatus.PROCESSED,
          processed_at: new Date(),
        },
      });
    } catch (e) {
      // Deduplication ignore
    }

    return {
      success: true,
      message_uuid: inboundRecord.message_uuid,
      conversation_uuid: conversation.conversation_uuid,
      direction: inboundRecord.direction,
    };
  }

  // -------------------------------------------------------------
  // Opt-Out / Suppression List CRUD
  // -------------------------------------------------------------
  async getOptOuts(userUuid: string) {
    return this.prisma.smsOptOut.findMany({
      where: { user_uuid: userUuid },
      orderBy: { opted_out_at: 'desc' },
    });
  }

  async addOptOut(userUuid: string, phone: string, reason = 'MANUAL') {
    const { e164 } = this.twilioAdapter.normalizePhoneNumber(phone);
    return this.prisma.smsOptOut.upsert({
      where: {
        user_uuid_phone_number: {
          user_uuid: userUuid,
          phone_number: e164,
        },
      },
      create: {
        user_uuid: userUuid,
        phone_number: e164,
        reason,
        source: 'MANUAL',
        is_opted_out: true,
        opted_out_at: new Date(),
      },
      update: {
        is_opted_out: true,
        reason,
        opted_out_at: new Date(),
      },
    });
  }

  async removeOptOut(userUuid: string, phone: string) {
    const { e164 } = this.twilioAdapter.normalizePhoneNumber(phone);
    return this.prisma.smsOptOut.updateMany({
      where: {
        user_uuid: userUuid,
        phone_number: e164,
      },
      data: {
        is_opted_out: false,
        opted_in_at: new Date(),
      },
    });
  }

  // -------------------------------------------------------------
  // SMS Templates CRUD
  // -------------------------------------------------------------
  async getTemplates(userUuid: string) {
    return this.prisma.smsTemplate.findMany({
      where: { user_uuid: userUuid, deleted_at: null },
      orderBy: { created_at: 'desc' },
    });
  }

  async createTemplate(
    userUuid: string,
    dto: { name: string; description?: string; body: string; variables?: string[] },
  ) {
    // Extract variables from body if not provided
    const extractedVariables =
      dto.variables && dto.variables.length > 0
        ? dto.variables
        : Array.from(new Set([...(dto.body.match(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g) || [])].map((v) => v.replace(/[\{\}\s]/g, ''))));

    return this.prisma.smsTemplate.create({
      data: {
        user_uuid: userUuid,
        name: dto.name,
        description: dto.description,
        body: dto.body,
        variables: extractedVariables,
      },
    });
  }

  async updateTemplate(
    userUuid: string,
    templateUuid: string,
    dto: { name?: string; description?: string; body?: string },
  ) {
    const existing = await this.prisma.smsTemplate.findFirst({
      where: { template_uuid: templateUuid, user_uuid: userUuid, deleted_at: null },
    });
    if (!existing) {
      throw new NotFoundException(`Template '${templateUuid}' not found.`);
    }

    const newBody = dto.body || existing.body;
    const extractedVariables = Array.from(
      new Set([...(newBody.match(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g) || [])].map((v) => v.replace(/[\{\}\s]/g, ''))),
    );

    return this.prisma.smsTemplate.update({
      where: { template_uuid: templateUuid },
      data: {
        ...(dto.name ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.body ? { body: dto.body } : {}),
        variables: extractedVariables,
      },
    });
  }

  async deleteTemplate(userUuid: string, templateUuid: string) {
    const existing = await this.prisma.smsTemplate.findFirst({
      where: { template_uuid: templateUuid, user_uuid: userUuid, deleted_at: null },
    });
    if (!existing) {
      throw new NotFoundException(`Template '${templateUuid}' not found.`);
    }

    return this.prisma.smsTemplate.update({
      where: { template_uuid: templateUuid },
      data: { deleted_at: new Date(), is_active: false },
    });
  }

  // -------------------------------------------------------------
  // Conversations & History
  // -------------------------------------------------------------
  async getConversations(userUuid: string) {
    return this.prisma.smsConversation.findMany({
      where: { user_uuid: userUuid },
      orderBy: { last_message_at: 'desc' },
      include: {
        messages: {
          orderBy: { created_at: 'desc' },
          take: 1,
        },
      },
    });
  }

  async getConversationMessages(userUuid: string, conversationUuid: string) {
    const conv = await this.prisma.smsConversation.findFirst({
      where: { conversation_uuid: conversationUuid, user_uuid: userUuid },
    });
    if (!conv) {
      throw new NotFoundException(`Conversation '${conversationUuid}' not found.`);
    }

    return this.prisma.smsMessage.findMany({
      where: { conversation_uuid: conversationUuid },
      orderBy: { created_at: 'asc' },
    });
  }
}
