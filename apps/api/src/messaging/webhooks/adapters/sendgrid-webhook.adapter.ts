import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { NormalizedEventType } from '@prisma/client';
import {
  WebhookProviderAdapter,
  WebhookVerificationResult,
  NormalizedWebhookEvent,
} from './webhook-provider.interface';

@Injectable()
export class SendGridWebhookAdapter implements WebhookProviderAdapter {
  readonly slug = 'sendgrid';
  private readonly logger = new Logger(SendGridWebhookAdapter.name);

  /**
   * Verify SendGrid ECDSA P-256 (secp256r1) Webhook Signature
   * SendGrid signs payload using ECDSA SHA256 over: timestamp + payload
   * Header: X-Twilio-Email-Event-Webhook-Signature (Base64)
   * Header: X-Twilio-Email-Event-Webhook-Timestamp
   */
  async verifySignature(
    rawBody: string | Buffer,
    headers: Record<string, string | string[] | undefined>,
    publicKey?: string,
  ): Promise<WebhookVerificationResult> {
    if (!publicKey) {
      // If no verification key is configured on endpoint, accept with warning (unverified endpoint)
      return { valid: true };
    }

    const signatureHeader = headers['x-twilio-email-event-webhook-signature'];
    const timestampHeader = headers['x-twilio-email-event-webhook-timestamp'];

    const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;
    const timestamp = Array.isArray(timestampHeader) ? timestampHeader[0] : timestampHeader;

    if (!signature || !timestamp) {
      return {
        valid: false,
        error: 'Missing required SendGrid webhook signature or timestamp headers',
      };
    }

    try {
      const payloadBuffer = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, 'utf8');
      const timestampBuffer = Buffer.from(timestamp, 'utf8');
      const dataToVerify = Buffer.concat([timestampBuffer, payloadBuffer]);

      // Normalize SendGrid public key to PEM format if provided in raw base64
      let pemKey = publicKey.trim();
      if (!pemKey.startsWith('-----BEGIN PUBLIC KEY-----')) {
        pemKey = `-----BEGIN PUBLIC KEY-----\n${pemKey}\n-----END PUBLIC KEY-----`;
      }

      const verifier = crypto.createVerify('sha256');
      verifier.update(dataToVerify);
      const isValid = verifier.verify(pemKey, Buffer.from(signature, 'base64'));

      if (!isValid) {
        return { valid: false, error: 'SendGrid webhook signature verification failed' };
      }

      return { valid: true };
    } catch (err: any) {
      this.logger.error(`SendGrid signature verification exception: ${err.message}`);
      return { valid: false, error: `Signature verification exception: ${err.message}` };
    }
  }

  /**
   * SendGrid delivers batches of events as a JSON array:
   * [ { sg_event_id, sg_message_id, event, email, timestamp, url, reason, response, ... } ]
   */
  normalizePayload(payload: any): NormalizedWebhookEvent[] {
    const rawEvents: any[] = Array.isArray(payload) ? payload : [payload];
    const normalized: NormalizedWebhookEvent[] = [];

    for (const ev of rawEvents) {
      if (!ev || typeof ev !== 'object') continue;

      const eventTypeStr = String(ev.event || '').toLowerCase();
      const normalizedType = this.mapEventType(eventTypeStr);
      const timestamp = ev.timestamp ? new Date(ev.timestamp * 1000) : new Date();

      // SendGrid sg_message_id often includes filter string e.g. "messageId.filterd..."
      let providerMessageId = ev.sg_message_id || ev.message_id || undefined;
      if (providerMessageId && providerMessageId.includes('.')) {
        providerMessageId = providerMessageId.split('.')[0];
      }

      // Unique event ID fallback
      const providerEventId =
        ev.sg_event_id ||
        crypto
          .createHash('sha256')
          .update(`${ev.email}-${eventTypeStr}-${ev.timestamp}-${providerMessageId}`)
          .digest('hex');

      normalized.push({
        provider_event_id: providerEventId,
        provider_event_type: eventTypeStr,
        normalized_event_type: normalizedType,
        timestamp,
        recipient_email: ev.email || '',
        provider_message_id: providerMessageId,
        message_uuid: ev.message_uuid || ev.custom_args?.message_uuid || undefined,
        clicked_url: ev.url || undefined,
        failure_reason: ev.reason || ev.response || undefined,
        raw_payload: ev,
        metadata: {
          category: ev.category,
          ip: ev.ip,
          useragent: ev.useragent,
          attempt: ev.attempt,
          status: ev.status,
          asm_group_id: ev.asm_group_id,
        },
      });
    }

    return normalized;
  }

  private mapEventType(eventType: string): NormalizedEventType {
    switch (eventType) {
      case 'processed':
        return NormalizedEventType.PROCESSED;
      case 'delivered':
        return NormalizedEventType.DELIVERED;
      case 'deferred':
        return NormalizedEventType.DEFERRED;
      case 'open':
        return NormalizedEventType.OPENED;
      case 'click':
        return NormalizedEventType.CLICKED;
      case 'bounce':
        return NormalizedEventType.BOUNCED;
      case 'dropped':
        return NormalizedEventType.DROPPED;
      case 'spamreport':
        return NormalizedEventType.SPAM_REPORTED;
      case 'unsubscribe':
      case 'group_unsubscribe':
        return NormalizedEventType.UNSUBSCRIBED;
      default:
        return NormalizedEventType.FAILED;
    }
  }
}
