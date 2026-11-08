import { NormalizedEventType } from '@prisma/client';

export interface NormalizedWebhookEvent {
  provider_event_id: string;
  provider_event_type: string;
  normalized_event_type: NormalizedEventType;
  timestamp: Date;
  recipient_email: string;
  message_uuid?: string;
  provider_message_id?: string;
  clicked_url?: string;
  failure_reason?: string;
  raw_payload: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface WebhookVerificationResult {
  valid: boolean;
  error?: string;
}

export interface WebhookProviderAdapter {
  readonly slug: string;
  verifySignature(
    rawBody: string | Buffer,
    headers: Record<string, string | string[] | undefined>,
    secret?: string,
  ): Promise<WebhookVerificationResult>;
  normalizePayload(payload: any): NormalizedWebhookEvent[];
}
