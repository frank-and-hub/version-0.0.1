import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import {
  NormalizedEventType,
  MessageSendingStatus,
  WebhookProcessingStatus,
} from '@prisma/client';
import { NormalizedWebhookEvent } from '../adapters/webhook-provider.interface';

@Injectable()
export class WebhookEventProcessorService {
  private readonly logger = new Logger(WebhookEventProcessorService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Processes a normalized event against the database:
   * 1. Resolves the corresponding EmailMessage by provider_message_id or custom_args message_uuid.
   * 2. Resolves and updates the MessageRecipient record for recipient-level isolation.
   * 3. Creates an immutable MessageEvent history entry.
   * 4. Updates EmailMessage high-level status without regressing terminal states.
   */
  async processEvent(
    eventRecordUuid: string,
    event: NormalizedWebhookEvent,
    userUuid: string,
    configUuid: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // 1. Resolve matching EmailMessage
      let emailMessage = null;
      if (event.message_uuid) {
        emailMessage = await this.prisma.emailMessage.findFirst({
          where: { message_uuid: event.message_uuid, user_uuid: userUuid },
        });
      }

      if (!emailMessage && event.provider_message_id) {
        emailMessage = await this.prisma.emailMessage.findFirst({
          where: {
            user_uuid: userUuid,
            OR: [
              { provider_message_id: event.provider_message_id },
              { provider_message_id: { startsWith: event.provider_message_id } },
            ],
          },
        });
      }

      // If still not found by provider_message_id, try matching latest message sent to this recipient
      if (!emailMessage && event.recipient_email) {
        emailMessage = await this.prisma.emailMessage.findFirst({
          where: {
            user_uuid: userUuid,
            configuration_uuid: configUuid,
            recipients: { some: { email: event.recipient_email } },
          },
          orderBy: { created_at: 'desc' },
        });
      }

      if (!emailMessage) {
        this.logger.warn(
          `Webhook event for provider_event_id ${event.provider_event_id} could not be matched to an existing EmailMessage. Recording event with null message reference.`,
        );
      }

      // 2. Create immutable MessageEvent entry if message was matched
      if (emailMessage) {
        await this.prisma.messageEvent.create({
          data: {
            user_uuid: userUuid,
            message_uuid: emailMessage.message_uuid,
            provider_configuration_uuid: configUuid,
            provider_event_uuid: eventRecordUuid,
            event_type: event.normalized_event_type,
            event_timestamp: event.timestamp,
            recipient_email: event.recipient_email || emailMessage.sender_email,
            clicked_url: event.clicked_url || null,
            failure_reason: event.failure_reason || null,
            metadata: event.metadata || {},
          },
        });

        // 3. Update recipient status independently
        if (event.recipient_email) {
          const recipientStatus = this.mapNormalizedToSendingStatus(event.normalized_event_type);
          if (recipientStatus) {
            await this.prisma.messageRecipient.updateMany({
              where: {
                message_uuid: emailMessage.message_uuid,
                email: event.recipient_email,
              },
              data: {
                status: recipientStatus,
                ...(recipientStatus === MessageSendingStatus.DELIVERED
                  ? { delivered_at: event.timestamp }
                  : {}),
                ...(event.failure_reason ? { error_details: event.failure_reason } : {}),
              },
            });
          }
        }

        // 4. Update EmailMessage high-level lifecycle status without regressing terminal states
        await this.updateMessageLifecycle(emailMessage.message_uuid, event);
      }

      // 5. Update WebhookEvent processing status
      await this.prisma.providerWebhookEvent.update({
        where: { event_uuid: eventRecordUuid },
        data: {
          processing_status: WebhookProcessingStatus.PROCESSED,
          processed_at: new Date(),
          error_message: null,
        },
      });

      return { success: true };
    } catch (err: any) {
      this.logger.error(`Error processing webhook event ${eventRecordUuid}: ${err.message}`, err.stack);
      await this.prisma.providerWebhookEvent.update({
        where: { event_uuid: eventRecordUuid },
        data: {
          processing_status: WebhookProcessingStatus.FAILED,
          error_message: err.message,
          processing_attempts: { increment: 1 },
        },
      });
      return { success: false, error: err.message };
    }
  }

  private mapNormalizedToSendingStatus(type: NormalizedEventType): MessageSendingStatus | null {
    switch (type) {
      case NormalizedEventType.DELIVERED:
      case NormalizedEventType.OPENED:
      case NormalizedEventType.CLICKED:
        return MessageSendingStatus.DELIVERED;
      case NormalizedEventType.ACCEPTED:
      case NormalizedEventType.PROCESSED:
        return MessageSendingStatus.ACCEPTED;
      case NormalizedEventType.BOUNCED:
        return MessageSendingStatus.BOUNCED;
      case NormalizedEventType.DROPPED:
      case NormalizedEventType.FAILED:
        return MessageSendingStatus.FAILED;
      default:
        return null;
    }
  }

  private async updateMessageLifecycle(messageUuid: string, event: NormalizedWebhookEvent) {
    const current = await this.prisma.emailMessage.findUnique({
      where: { message_uuid: messageUuid },
      include: { recipients: true },
    });

    if (!current) return;

    const dataToUpdate: any = {};

    if (
      event.normalized_event_type === NormalizedEventType.DELIVERED &&
      !current.delivered_at
    ) {
      dataToUpdate.delivered_at = event.timestamp;
      dataToUpdate.status = MessageSendingStatus.DELIVERED;
    } else if (
      event.normalized_event_type === NormalizedEventType.BOUNCED &&
      current.status !== MessageSendingStatus.DELIVERED
    ) {
      // Check if all recipients bounced or partial
      const allBounced = current.recipients.every((r) => r.status === MessageSendingStatus.BOUNCED);
      dataToUpdate.status = allBounced ? MessageSendingStatus.BOUNCED : MessageSendingStatus.FAILED;
      dataToUpdate.last_error = event.failure_reason || 'Email bounced by receiving mail transfer agent';
    } else if (
      event.normalized_event_type === NormalizedEventType.DROPPED ||
      event.normalized_event_type === NormalizedEventType.FAILED
    ) {
      if (current.status !== MessageSendingStatus.DELIVERED) {
        dataToUpdate.status = MessageSendingStatus.FAILED;
        dataToUpdate.last_error = event.failure_reason || 'Delivery dropped or rejected';
      }
    }

    if (Object.keys(dataToUpdate).length > 0) {
      await this.prisma.emailMessage.update({
        where: { message_uuid: messageUuid },
        data: dataToUpdate,
      });
    }
  }
}
