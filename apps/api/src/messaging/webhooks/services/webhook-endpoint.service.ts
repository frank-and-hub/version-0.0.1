import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../../database/prisma.service';
import { MessagingChannel } from '@prisma/client';

@Injectable()
export class WebhookEndpointService {
  private readonly logger = new Logger(WebhookEndpointService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generates or retrieves an existing Webhook Endpoint for a user's provider configuration.
   */
  async getOrCreateEndpoint(
    userUuid: string,
    configurationUuid: string,
    baseUrl = 'http://localhost:4000',
  ) {
    const config = await this.prisma.userProviderConfiguration.findFirst({
      where: {
        configuration_uuid: configurationUuid,
        user_uuid: userUuid,
        deleted_at: null,
      },
      include: { provider: true },
    });

    if (!config) {
      throw new NotFoundException('Provider configuration not found');
    }

    let endpoint = await this.prisma.providerWebhookEndpoint.findFirst({
      where: {
        provider_configuration_uuid: configurationUuid,
        user_uuid: userUuid,
        deleted_at: null,
      },
    });

    if (!endpoint) {
      // Generate a secure high-entropy token and hash it for lookup
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

      endpoint = await this.prisma.providerWebhookEndpoint.create({
        data: {
          user_uuid: userUuid,
          provider_configuration_uuid: configurationUuid,
          channel: config.type,
          endpoint_token_hash: tokenHash,
          is_active: true,
          verification_status: false,
        },
      });
    }

    const cleanBaseUrl = baseUrl.replace(/\/+$/, '');
    let webhookUrl: string;
    let inboundWebhookUrl: string | undefined;

    if (config.type === MessagingChannel.WHATSAPP) {
      webhookUrl = `${cleanBaseUrl}/api/webhooks/messaging/whatsapp/${configurationUuid}`;
    } else if (config.type === MessagingChannel.SMS) {
      webhookUrl = `${cleanBaseUrl}/api/webhooks/messaging/sms/${config.provider.slug}/${configurationUuid}/status`;
      inboundWebhookUrl = `${cleanBaseUrl}/api/webhooks/messaging/sms/${config.provider.slug}/${configurationUuid}/inbound`;
    } else {
      webhookUrl = `${cleanBaseUrl}/api/webhooks/messaging/email/${configurationUuid}`;
    }

    return {
      endpoint_uuid: endpoint.endpoint_uuid,
      configuration_uuid: configurationUuid,
      provider_name: config.provider.name,
      provider_slug: config.provider.slug,
      channel: config.type,
      configuration_name: config.configuration_name,
      webhook_url: webhookUrl,
      inbound_webhook_url: inboundWebhookUrl,
      is_active: endpoint.is_active,
      verification_status: endpoint.verification_status,
      verification_secret: endpoint.verification_secret ? '••••••••' : null,
      has_verification_secret: !!endpoint.verification_secret,
      total_events_received: endpoint.total_events_received,
      failed_events_count: endpoint.failed_events_count,
      last_received_at: endpoint.last_received_at,
      last_processed_at: endpoint.last_processed_at,
      created_at: endpoint.created_at,
      setup_instructions: this.getSetupInstructions(config.provider.slug, config.type, webhookUrl, inboundWebhookUrl),
    };
  }

  async setVerificationSecret(
    userUuid: string,
    configurationUuid: string,
    secret: string,
  ) {
    const endpoint = await this.prisma.providerWebhookEndpoint.findFirst({
      where: {
        provider_configuration_uuid: configurationUuid,
        user_uuid: userUuid,
        deleted_at: null,
      },
    });

    if (!endpoint) {
      throw new NotFoundException('Webhook endpoint not found');
    }

    const updated = await this.prisma.providerWebhookEndpoint.update({
      where: { endpoint_uuid: endpoint.endpoint_uuid },
      data: {
        verification_secret: secret.trim(),
        verification_status: true,
      },
    });

    return {
      success: true,
      message: 'Webhook verification secret/public key saved successfully',
      verification_status: updated.verification_status,
    };
  }

  async toggleEndpointStatus(userUuid: string, configurationUuid: string, isActive: boolean) {
    const endpoint = await this.prisma.providerWebhookEndpoint.findFirst({
      where: {
        provider_configuration_uuid: configurationUuid,
        user_uuid: userUuid,
        deleted_at: null,
      },
    });

    if (!endpoint) {
      throw new NotFoundException('Webhook endpoint not found');
    }

    return this.prisma.providerWebhookEndpoint.update({
      where: { endpoint_uuid: endpoint.endpoint_uuid },
      data: { is_active: isActive },
    });
  }

  async rotateEndpointToken(userUuid: string, configurationUuid: string) {
    const endpoint = await this.prisma.providerWebhookEndpoint.findFirst({
      where: {
        provider_configuration_uuid: configurationUuid,
        user_uuid: userUuid,
        deleted_at: null,
      },
    });

    if (!endpoint) {
      throw new NotFoundException('Webhook endpoint not found');
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    return this.prisma.providerWebhookEndpoint.update({
      where: { endpoint_uuid: endpoint.endpoint_uuid },
      data: { endpoint_token_hash: tokenHash },
    });
  }

  private getSetupInstructions(
    providerSlug: string,
    channel: MessagingChannel,
    webhookUrl: string,
    inboundWebhookUrl?: string,
  ): string {
    const slug = providerSlug.toLowerCase();

    // 1. WhatsApp Providers
    if (channel === MessagingChannel.WHATSAPP) {
      if (slug.includes('meta') || slug.includes('cloud')) {
        return `To configure Meta WhatsApp Cloud API Webhooks:
1. Open your Meta Developer App Dashboard → WhatsApp → Configuration.
2. In 'Webhook Callback URL', paste this URL:
   ${webhookUrl}
3. In 'Verify Token', enter the exact Webhook Verify Token configured in your provider configuration.
4. Click 'Verify and Save'. Meta will send a GET challenge to verify ownership.
5. In 'Webhook Fields', subscribe to: 'messages' (for delivery receipts and inbound messages) and 'message_template_status_update'.
6. (Optional) Copy your Meta App Secret and save it as the Verification Secret here for X-Hub-Signature-256 HMAC validation.`;
      }
      return `To configure WhatsApp Webhooks for ${providerSlug}:
1. Log in to your ${providerSlug} admin console → Webhooks / Developer Settings.
2. Set the Callback / Status Notification URL to:
   ${webhookUrl}
3. Select message status events: Sent, Delivered, Read, and Failed.
4. Save and verify the endpoint.`;
    }

    // 2. SMS Providers
    if (channel === MessagingChannel.SMS) {
      if (slug.includes('twilio')) {
        return `To configure Twilio SMS Webhooks:
1. Status Callbacks: In your Twilio Console → Messaging Services (or individual phone numbers), set the Status Callback URL to:
   ${webhookUrl} (HTTP POST)
2. Inbound SMS: Under 'A Message Comes In', set Webhook URL to:
   ${inboundWebhookUrl || webhookUrl} (HTTP POST)
3. Twilio will report delivery receipts (delivered, undelivered, failed) and forward incoming messages with STOP/UNSTOP opt-outs.`;
      }
      if (slug.includes('sns') || slug.includes('aws')) {
        return `To configure AWS SNS SMS Delivery Feedback:
1. Open AWS SNS Console → Text messaging (SMS) → Delivery status.
2. Configure Amazon CloudWatch or SNS topic notification HTTP endpoint:
   ${webhookUrl}
3. Ingest delivery events (delivered, direct_publish_failure) directly into your telemetry.`;
      }
      return `To configure ${providerSlug} SMS Webhooks:
1. Status Callback URL: Set your delivery receipt callback URL to:
   ${webhookUrl}
2. Inbound SMS Callback URL: Set your incoming SMS notification webhook to:
   ${inboundWebhookUrl || webhookUrl}
3. Ensure HTTP POST with JSON or form-encoded payload is enabled.`;
    }

    // 3. Email Providers
    switch (slug) {
      case 'sendgrid':
        return `To configure SendGrid Event Webhooks:
1. Log into your SendGrid Dashboard and navigate to Settings → Mail Settings → Event Webhook.
2. In the 'HTTP Post URL' field, paste this exact URL:
   ${webhookUrl}
3. Select all event types you want to track (Delivered, Bounced, Dropped, Opened, Clicked, Spam Report, Unsubscribe).
4. Enable 'Signed Event Webhook' and copy the Verification Key.
5. Paste the verification key into the 'Verification Secret' field in this dashboard to verify signatures.
6. Click 'Test Your Integration' in SendGrid and save.`;
      case 'resend':
        return `To configure Resend Webhooks:
1. Go to your Resend Dashboard → Webhooks → Add Webhook.
2. Set Endpoint URL to:
   ${webhookUrl}
3. Select events: email.sent, email.delivered, email.bounced, email.opened, email.clicked.
4. Copy the Signing Secret (starts with 'whsec_') and save it here in Verification Secret.`;
      case 'postmark':
        return `To configure Postmark Webhooks:
1. Go to your Postmark Server → Settings → Webhooks.
2. Add Webhook with URL:
   ${webhookUrl}
3. Check Delivery, Bounce, Open, and Click tracking checkboxes.
4. Save the webhook.`;
      default:
        return `Configure your provider's HTTP POST notification URL to:
${webhookUrl}
Ensure JSON payload delivery is enabled for delivery, open, read, and bounce events.`;
    }
  }
}
