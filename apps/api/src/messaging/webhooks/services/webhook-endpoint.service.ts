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

    const webhookUrl = `${baseUrl.replace(/\/+$/, '')}/api/webhooks/messaging/email/${configurationUuid}`;

    return {
      endpoint_uuid: endpoint.endpoint_uuid,
      configuration_uuid: configurationUuid,
      provider_name: config.provider.name,
      provider_slug: config.provider.slug,
      configuration_name: config.configuration_name,
      webhook_url: webhookUrl,
      is_active: endpoint.is_active,
      verification_status: endpoint.verification_status,
      verification_secret: endpoint.verification_secret ? '••••••••' : null,
      has_verification_secret: !!endpoint.verification_secret,
      total_events_received: endpoint.total_events_received,
      failed_events_count: endpoint.failed_events_count,
      last_received_at: endpoint.last_received_at,
      last_processed_at: endpoint.last_processed_at,
      created_at: endpoint.created_at,
      setup_instructions: this.getSetupInstructions(config.provider.slug, webhookUrl),
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

  private getSetupInstructions(providerSlug: string, webhookUrl: string): string {
    switch (providerSlug.toLowerCase()) {
      case 'sendgrid':
        return `To configure SendGrid Event Webhooks:\n1. Log into your SendGrid Dashboard and navigate to Settings → Mail Settings → Event Webhook.\n2. In the 'HTTP Post URL' field, paste this exact URL:\n   ${webhookUrl}\n3. Select all event types you want to track (Delivered, Bounced, Dropped, Opened, Clicked, Spam Report, Unsubscribe).\n4. Enable 'Signed Event Webhook' and copy the Verification Key.\n5. Paste the verification key into the 'Verification Secret' field in this dashboard to verify signatures.\n6. Click 'Test Your Integration' in SendGrid and save.`;
      default:
        return `Configure your provider's HTTP POST notification URL to:\n${webhookUrl}\nEnsure JSON payload delivery is enabled.`;
    }
  }
}
