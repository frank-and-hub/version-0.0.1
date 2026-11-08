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
import { TwilioSmsProviderAdapter } from './adapters/twilio-sms.provider';
import {
  AwsSnsSmsProviderAdapter,
  MessageBirdSmsProviderAdapter,
  VonageSmsProviderAdapter,
  PlivoSmsProviderAdapter,
  TelnyxSmsProviderAdapter,
  InfobipSmsProviderAdapter,
} from './adapters/additional-sms.providers';
import { ProviderEncryptionService } from './services/provider-encryption.service';
import { ProviderRegistryService } from './services/provider-registry.service';
import { ProviderConfigurationService } from './services/provider-configuration.service';
import { EmailTemplateService } from './services/email-template.service';
import { EmailQueueService } from './services/email-queue.service';
import { EmailSendingService } from './services/email-sending.service';
import { EmailWorkerService } from './services/email-worker.service';
import { WhatsAppService } from './services/whatsapp.service';
import { SmsService } from './services/sms.service';
import { MessagingController } from './messaging.controller';
import { WhatsAppController } from './whatsapp.controller';
import { SmsController } from './sms.controller';

import { MessagingWebhooksModule } from './webhooks/messaging-webhooks.module';

@Module({
  imports: [PrismaModule, ValkeyModule, MessagingWebhooksModule],
  controllers: [MessagingController, WhatsAppController, SmsController],
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
    TwilioSmsProviderAdapter,
    AwsSnsSmsProviderAdapter,
    MessageBirdSmsProviderAdapter,
    VonageSmsProviderAdapter,
    PlivoSmsProviderAdapter,
    TelnyxSmsProviderAdapter,
    InfobipSmsProviderAdapter,
    ProviderEncryptionService,
    ProviderRegistryService,
    ProviderConfigurationService,
    EmailTemplateService,
    EmailQueueService,
    EmailSendingService,
    EmailWorkerService,
    WhatsAppService,
    SmsService,
  ],
  exports: [
    ProviderRegistryService,
    ProviderConfigurationService,
    EmailSendingService,
    EmailTemplateService,
    WhatsAppService,
    SmsService,
    WhatsAppCloudApiAdapter,
    InteraktWhatsAppAdapter,
    WatiWhatsAppAdapter,
    TwilioWhatsAppAdapter,
    InfobipWhatsAppAdapter,
    GupshupWhatsAppAdapter,
    VonageWhatsAppAdapter,
    AiSensyWhatsAppAdapter,
    TwilioSmsProviderAdapter,
    AwsSnsSmsProviderAdapter,
    MessageBirdSmsProviderAdapter,
    VonageSmsProviderAdapter,
    PlivoSmsProviderAdapter,
    TelnyxSmsProviderAdapter,
    InfobipSmsProviderAdapter,
  ],
})
export class MessagingModule {}
