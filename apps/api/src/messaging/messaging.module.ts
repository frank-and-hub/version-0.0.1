import { Module } from '@nestjs/common';
import { PrismaModule } from '../database/prisma.module';
import { ValkeyModule } from '../cache/valkey.module';
import { SmtpEmailProvider } from './adapters/smtp-email.provider';
import { SendGridEmailProvider } from './adapters/sendgrid-email.provider';
import {
  WhatsAppCloudApiAdapter,
  InteraktWhatsAppAdapter,
  WatiWhatsAppAdapter,
  TwilioWhatsAppAdapter,
  InfobipWhatsAppAdapter,
  GupshupWhatsAppAdapter,
  VonageWhatsAppAdapter,
  AiSensyWhatsAppAdapter,
} from './adapters/whatsapp-cloud.provider';
import { ProviderEncryptionService } from './services/provider-encryption.service';
import { ProviderRegistryService } from './services/provider-registry.service';
import { ProviderConfigurationService } from './services/provider-configuration.service';
import { EmailTemplateService } from './services/email-template.service';
import { EmailQueueService } from './services/email-queue.service';
import { EmailSendingService } from './services/email-sending.service';
import { EmailWorkerService } from './services/email-worker.service';
import { WhatsAppService } from './services/whatsapp.service';
import { MessagingController } from './messaging.controller';
import { WhatsAppController } from './whatsapp.controller';

import { MessagingWebhooksModule } from './webhooks/messaging-webhooks.module';

@Module({
  imports: [PrismaModule, ValkeyModule, MessagingWebhooksModule],
  controllers: [MessagingController, WhatsAppController],
  providers: [
    SmtpEmailProvider,
    SendGridEmailProvider,
    WhatsAppCloudApiAdapter,
    InteraktWhatsAppAdapter,
    WatiWhatsAppAdapter,
    TwilioWhatsAppAdapter,
    InfobipWhatsAppAdapter,
    GupshupWhatsAppAdapter,
    VonageWhatsAppAdapter,
    AiSensyWhatsAppAdapter,
    ProviderEncryptionService,
    ProviderRegistryService,
    ProviderConfigurationService,
    EmailTemplateService,
    EmailQueueService,
    EmailSendingService,
    EmailWorkerService,
    WhatsAppService,
  ],
  exports: [
    ProviderRegistryService,
    ProviderConfigurationService,
    EmailSendingService,
    EmailTemplateService,
    WhatsAppService,
    WhatsAppCloudApiAdapter,
    InteraktWhatsAppAdapter,
    WatiWhatsAppAdapter,
    TwilioWhatsAppAdapter,
    InfobipWhatsAppAdapter,
    GupshupWhatsAppAdapter,
    VonageWhatsAppAdapter,
    AiSensyWhatsAppAdapter,
  ],
})
export class MessagingModule {}
