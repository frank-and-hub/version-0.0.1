import { Injectable, NotFoundException } from '@nestjs/common';
import { EmailProviderInterface } from '../adapters/email-provider.interface';
import { SmtpEmailProvider } from '../adapters/smtp-email.provider';
import { SendGridEmailProvider } from '../adapters/sendgrid-email.provider';
import { PrescaledSmtpProvider, PRESET_SMTP_PROVIDERS } from '../adapters/prescaled-smtp.provider';
import {
  WhatsAppCloudApiAdapter,
  InteraktWhatsAppAdapter,
  WatiWhatsAppAdapter,
  TwilioWhatsAppAdapter,
  InfobipWhatsAppAdapter,
  GupshupWhatsAppAdapter,
  VonageWhatsAppAdapter,
  AiSensyWhatsAppAdapter,
} from '../adapters/whatsapp-cloud.provider';
import { TwilioSmsProviderAdapter } from '../adapters/twilio-sms.provider';
import {
  AwsSnsSmsProviderAdapter,
  MessageBirdSmsProviderAdapter,
  VonageSmsProviderAdapter,
  PlivoSmsProviderAdapter,
  TelnyxSmsProviderAdapter,
  InfobipSmsProviderAdapter,
} from '../adapters/additional-sms.providers';

@Injectable()
export class ProviderRegistryService {
  private readonly adapters = new Map<string, EmailProviderInterface>();

  constructor(
    private readonly smtpProvider: SmtpEmailProvider,
    private readonly sendgridProvider: SendGridEmailProvider,
    private readonly whatsappProvider: WhatsAppCloudApiAdapter,
    private readonly interaktProvider: InteraktWhatsAppAdapter,
    private readonly watiProvider: WatiWhatsAppAdapter,
    private readonly twilioProvider: TwilioWhatsAppAdapter,
    private readonly infobipProvider: InfobipWhatsAppAdapter,
    private readonly gupshupProvider: GupshupWhatsAppAdapter,
    private readonly vonageProvider: VonageWhatsAppAdapter,
    private readonly aisensyProvider: AiSensyWhatsAppAdapter,
    private readonly twilioSmsProvider: TwilioSmsProviderAdapter,
    private readonly awsSnsSmsProvider: AwsSnsSmsProviderAdapter,
    private readonly messageBirdSmsProvider: MessageBirdSmsProviderAdapter,
    private readonly vonageSmsProvider: VonageSmsProviderAdapter,
    private readonly plivoSmsProvider: PlivoSmsProviderAdapter,
    private readonly telnyxSmsProvider: TelnyxSmsProviderAdapter,
    private readonly infobipSmsProvider: InfobipSmsProviderAdapter,
  ) {
    this.registerAdapter(this.smtpProvider);
    this.registerAdapter(this.sendgridProvider);
    this.registerAdapter(this.whatsappProvider);
    this.registerAdapter(this.interaktProvider);
    this.registerAdapter(this.watiProvider);
    this.registerAdapter(this.twilioProvider);
    this.registerAdapter(this.infobipProvider);
    this.registerAdapter(this.gupshupProvider);
    this.registerAdapter(this.vonageProvider);
    this.registerAdapter(this.aisensyProvider);
    this.registerAdapter(this.twilioSmsProvider);
    this.registerAdapter(this.awsSnsSmsProvider);
    this.registerAdapter(this.messageBirdSmsProvider);
    this.registerAdapter(this.vonageSmsProvider);
    this.registerAdapter(this.plivoSmsProvider);
    this.registerAdapter(this.telnyxSmsProvider);
    this.registerAdapter(this.infobipSmsProvider);

    // Register all preset SMTP email providers so they are immediately fully functional!
    for (const slug of Object.keys(PRESET_SMTP_PROVIDERS)) {
      this.registerAdapter(new PrescaledSmtpProvider(this.smtpProvider, slug));
    }
  }

  registerAdapter(adapter: EmailProviderInterface) {
    this.adapters.set(adapter.slug.toLowerCase(), adapter);
  }

  getAdapter(slug: string): EmailProviderInterface {
    const adapter = this.adapters.get(slug.toLowerCase());
    if (!adapter) {
      throw new NotFoundException(`Provider adapter '${slug}' is not registered or not yet supported.`);
    }
    return adapter;
  }

  hasAdapter(slug: string): boolean {
    return this.adapters.has(slug.toLowerCase());
  }

  getSupportedSlugs(): string[] {
    return Array.from(this.adapters.keys());
  }
}
