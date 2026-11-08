import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { ValkeyModule } from '../../cache/valkey.module';
import { SendGridWebhookAdapter } from './adapters/sendgrid-webhook.adapter';
import { WebhookRegistryService } from './services/webhook-registry.service';
import { WebhookEndpointService } from './services/webhook-endpoint.service';
import { WebhookEventProcessorService } from './services/webhook-event-processor.service';
import { WebhookService } from './services/webhook.service';
import { EmailAnalyticsService } from './services/email-analytics.service';
import { WebhookController } from './webhook.controller';

@Module({
  imports: [PrismaModule, ValkeyModule],
  controllers: [WebhookController],
  providers: [
    SendGridWebhookAdapter,
    WebhookRegistryService,
    WebhookEndpointService,
    WebhookEventProcessorService,
    WebhookService,
    EmailAnalyticsService,
  ],
  exports: [
    WebhookService,
    WebhookEndpointService,
    EmailAnalyticsService,
    WebhookEventProcessorService,
  ],
})
export class MessagingWebhooksModule {}
