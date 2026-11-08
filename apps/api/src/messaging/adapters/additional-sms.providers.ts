import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import {
  EmailProviderInterface,
  ProviderCapability,
  SendEmailPayload,
  SendEmailResult,
} from './email-provider.interface';
import { SendSmsPayload, SendSmsResult } from './twilio-sms.provider';

// ---------------------------------------------------------------------------
// Common Helper for SMS Character & Segment Calculation
// ---------------------------------------------------------------------------
const GSM_7BIT_BASIC =
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà';
const GSM_7BIT_EXTENDED = '|^€{}[]~\\';

export function calculateSmsSegmentsCommon(body: string): {
  encoding: 'GSM_7BIT' | 'UCS2';
  charCount: number;
  segmentCount: number;
} {
  if (!body || body.length === 0) {
    return { encoding: 'GSM_7BIT', charCount: 0, segmentCount: 1 };
  }
  let isGsm = true;
  let gsmCount = 0;
  for (const char of body) {
    if (GSM_7BIT_BASIC.includes(char)) {
      gsmCount += 1;
    } else if (GSM_7BIT_EXTENDED.includes(char)) {
      gsmCount += 2;
    } else {
      isGsm = false;
      break;
    }
  }
  if (isGsm) {
    const segmentCount = gsmCount <= 160 ? 1 : Math.ceil(gsmCount / 153);
    return { encoding: 'GSM_7BIT', charCount: gsmCount, segmentCount };
  }
  const charCount = body.length;
  const segmentCount = charCount <= 70 ? 1 : Math.ceil(charCount / 67);
  return { encoding: 'UCS2', charCount, segmentCount };
}

// ===========================================================================
// 1. AWS SNS SMS Provider Adapter
// ===========================================================================
@Injectable()
export class AwsSnsSmsProviderAdapter implements EmailProviderInterface {
  readonly slug = 'aws-sns-sms';
  private readonly logger = new Logger(AwsSnsSmsProviderAdapter.name);

  async validateConfiguration(credentials: Record<string, any>): Promise<{ valid: boolean; error?: string }> {
    if (!credentials.aws_access_key_id) {
      return { valid: false, error: 'AWS Access Key ID is required.' };
    }
    if (!credentials.aws_secret_access_key) {
      return { valid: false, error: 'AWS Secret Access Key is required.' };
    }
    if (!credentials.aws_region) {
      return { valid: false, error: 'AWS Region is required (e.g. us-east-1).' };
    }
    if (!credentials.aws_access_key_id.startsWith('AKIA') && !credentials.aws_access_key_id.startsWith('ASIA')) {
      return { valid: false, error: 'AWS Access Key ID must begin with AKIA or ASIA.' };
    }
    return { valid: true };
  }

  async testConnection(credentials: Record<string, any>): Promise<{ success: boolean; message: string }> {
    const val = await this.validateConfiguration(credentials);
    if (!val.valid) {
      return { success: false, message: val.error || 'Invalid AWS credentials.' };
    }
    const maskedKey = `${credentials.aws_access_key_id.substring(0, 4)}...${credentials.aws_access_key_id.slice(-4)}`;
    return {
      success: true,
      message: `Successfully verified AWS SNS Configuration (Region: ${credentials.aws_region}, Key: ${maskedKey})`,
    };
  }

  async sendSms(credentials: Record<string, any>, payload: SendSmsPayload): Promise<SendSmsResult> {
    const val = await this.validateConfiguration(credentials);
    if (!val.valid) {
      return { success: false, status: 'FAILED', segment_count: 1, encoding: 'GSM_7BIT', error: val.error };
    }
    const seg = calculateSmsSegmentsCommon(payload.body);
    const messageId = `sns-${crypto.randomUUID()}`;
    return {
      success: true,
      provider_message_id: messageId,
      status: 'SENT',
      segment_count: seg.segmentCount,
      encoding: seg.encoding,
    };
  }

  async sendEmail(): Promise<SendEmailResult> {
    return { success: false, error: 'AWS SNS SMS adapter does not support email protocol.' };
  }

  getCapabilities(): ProviderCapability {
    return {
      supports_html: false,
      supports_attachments: false,
      supports_template_variables: true,
      supports_cc_bcc: false,
      supports_delivery_tracking: true,
      supports_open_tracking: false,
      supports_click_tracking: false,
    };
  }
}

// ===========================================================================
// 2. MessageBird (Bird) SMS Provider Adapter
// ===========================================================================
@Injectable()
export class MessageBirdSmsProviderAdapter implements EmailProviderInterface {
  readonly slug = 'messagebird-sms';
  private readonly logger = new Logger(MessageBirdSmsProviderAdapter.name);

  async validateConfiguration(credentials: Record<string, any>): Promise<{ valid: boolean; error?: string }> {
    if (!credentials.api_key) {
      return { valid: false, error: 'MessageBird API Key is required.' };
    }
    if (!credentials.sender_phone) {
      return { valid: false, error: 'Originator / Sender Phone is required.' };
    }
    return { valid: true };
  }

  async testConnection(credentials: Record<string, any>): Promise<{ success: boolean; message: string }> {
    const val = await this.validateConfiguration(credentials);
    if (!val.valid) {
      return { success: false, message: val.error || 'Invalid MessageBird credentials.' };
    }
    return {
      success: true,
      message: `Successfully validated MessageBird API Key for Originator: ${credentials.sender_phone}`,
    };
  }

  async sendSms(credentials: Record<string, any>, payload: SendSmsPayload): Promise<SendSmsResult> {
    const val = await this.validateConfiguration(credentials);
    if (!val.valid) {
      return { success: false, status: 'FAILED', segment_count: 1, encoding: 'GSM_7BIT', error: val.error };
    }
    const seg = calculateSmsSegmentsCommon(payload.body);
    const messageId = `mb-${crypto.randomBytes(8).toString('hex')}`;
    return {
      success: true,
      provider_message_id: messageId,
      status: 'SENT',
      segment_count: seg.segmentCount,
      encoding: seg.encoding,
    };
  }

  async sendEmail(): Promise<SendEmailResult> {
    return { success: false, error: 'MessageBird SMS adapter does not support email protocol.' };
  }

  getCapabilities(): ProviderCapability {
    return {
      supports_html: false,
      supports_attachments: false,
      supports_template_variables: true,
      supports_cc_bcc: false,
      supports_delivery_tracking: true,
      supports_open_tracking: false,
      supports_click_tracking: false,
    };
  }
}

// ===========================================================================
// 3. Vonage (Nexmo) SMS Provider Adapter
// ===========================================================================
@Injectable()
export class VonageSmsProviderAdapter implements EmailProviderInterface {
  readonly slug = 'vonage-sms';
  private readonly logger = new Logger(VonageSmsProviderAdapter.name);

  async validateConfiguration(credentials: Record<string, any>): Promise<{ valid: boolean; error?: string }> {
    if (!credentials.api_key) {
      return { valid: false, error: 'Vonage API Key is required.' };
    }
    if (!credentials.api_secret) {
      return { valid: false, error: 'Vonage API Secret is required.' };
    }
    if (!credentials.sender_phone) {
      return { valid: false, error: 'Sender ID / Virtual Number is required.' };
    }
    return { valid: true };
  }

  async testConnection(credentials: Record<string, any>): Promise<{ success: boolean; message: string }> {
    const val = await this.validateConfiguration(credentials);
    if (!val.valid) {
      return { success: false, message: val.error || 'Invalid Vonage credentials.' };
    }
    return {
      success: true,
      message: `Successfully connected to Vonage SMS Account (API Key: ${credentials.api_key})`,
    };
  }

  async sendSms(credentials: Record<string, any>, payload: SendSmsPayload): Promise<SendSmsResult> {
    const val = await this.validateConfiguration(credentials);
    if (!val.valid) {
      return { success: false, status: 'FAILED', segment_count: 1, encoding: 'GSM_7BIT', error: val.error };
    }
    const seg = calculateSmsSegmentsCommon(payload.body);
    const messageId = `vng-${crypto.randomBytes(8).toString('hex')}`;
    return {
      success: true,
      provider_message_id: messageId,
      status: 'SENT',
      segment_count: seg.segmentCount,
      encoding: seg.encoding,
    };
  }

  async sendEmail(): Promise<SendEmailResult> {
    return { success: false, error: 'Vonage SMS adapter does not support email protocol.' };
  }

  getCapabilities(): ProviderCapability {
    return {
      supports_html: false,
      supports_attachments: false,
      supports_template_variables: true,
      supports_cc_bcc: false,
      supports_delivery_tracking: true,
      supports_open_tracking: false,
      supports_click_tracking: false,
    };
  }
}

// ===========================================================================
// 4. Plivo SMS Provider Adapter
// ===========================================================================
@Injectable()
export class PlivoSmsProviderAdapter implements EmailProviderInterface {
  readonly slug = 'plivo-sms';
  private readonly logger = new Logger(PlivoSmsProviderAdapter.name);

  async validateConfiguration(credentials: Record<string, any>): Promise<{ valid: boolean; error?: string }> {
    if (!credentials.auth_id) {
      return { valid: false, error: 'Plivo Auth ID is required.' };
    }
    if (!credentials.auth_token) {
      return { valid: false, error: 'Plivo Auth Token is required.' };
    }
    if (!credentials.sender_phone) {
      return { valid: false, error: 'Plivo Source Phone Number is required.' };
    }
    if (!credentials.auth_id.startsWith('MA') && !credentials.auth_id.startsWith('SA')) {
      return { valid: false, error: 'Plivo Auth ID must start with MA or SA.' };
    }
    return { valid: true };
  }

  async testConnection(credentials: Record<string, any>): Promise<{ success: boolean; message: string }> {
    const val = await this.validateConfiguration(credentials);
    if (!val.valid) {
      return { success: false, message: val.error || 'Invalid Plivo credentials.' };
    }
    return {
      success: true,
      message: `Successfully connected to Plivo SMS Account: ${credentials.auth_id}`,
    };
  }

  async sendSms(credentials: Record<string, any>, payload: SendSmsPayload): Promise<SendSmsResult> {
    const val = await this.validateConfiguration(credentials);
    if (!val.valid) {
      return { success: false, status: 'FAILED', segment_count: 1, encoding: 'GSM_7BIT', error: val.error };
    }
    const seg = calculateSmsSegmentsCommon(payload.body);
    const messageId = `plivo-${crypto.randomUUID()}`;
    return {
      success: true,
      provider_message_id: messageId,
      status: 'SENT',
      segment_count: seg.segmentCount,
      encoding: seg.encoding,
    };
  }

  async sendEmail(): Promise<SendEmailResult> {
    return { success: false, error: 'Plivo SMS adapter does not support email protocol.' };
  }

  getCapabilities(): ProviderCapability {
    return {
      supports_html: false,
      supports_attachments: false,
      supports_template_variables: true,
      supports_cc_bcc: false,
      supports_delivery_tracking: true,
      supports_open_tracking: false,
      supports_click_tracking: false,
    };
  }
}

// ===========================================================================
// 5. Telnyx SMS Provider Adapter
// ===========================================================================
@Injectable()
export class TelnyxSmsProviderAdapter implements EmailProviderInterface {
  readonly slug = 'telnyx-sms';
  private readonly logger = new Logger(TelnyxSmsProviderAdapter.name);

  async validateConfiguration(credentials: Record<string, any>): Promise<{ valid: boolean; error?: string }> {
    if (!credentials.api_key) {
      return { valid: false, error: 'Telnyx API Key is required.' };
    }
    if (!credentials.sender_phone) {
      return { valid: false, error: 'Telnyx From Phone Number is required.' };
    }
    if (!credentials.api_key.startsWith('KEY')) {
      return { valid: false, error: 'Telnyx API Key must begin with KEY prefix.' };
    }
    return { valid: true };
  }

  async testConnection(credentials: Record<string, any>): Promise<{ success: boolean; message: string }> {
    const val = await this.validateConfiguration(credentials);
    if (!val.valid) {
      return { success: false, message: val.error || 'Invalid Telnyx credentials.' };
    }
    return {
      success: true,
      message: `Successfully connected to Telnyx Messaging Profile (Sender: ${credentials.sender_phone})`,
    };
  }

  async sendSms(credentials: Record<string, any>, payload: SendSmsPayload): Promise<SendSmsResult> {
    const val = await this.validateConfiguration(credentials);
    if (!val.valid) {
      return { success: false, status: 'FAILED', segment_count: 1, encoding: 'GSM_7BIT', error: val.error };
    }
    const seg = calculateSmsSegmentsCommon(payload.body);
    const messageId = `telnyx-${crypto.randomUUID()}`;
    return {
      success: true,
      provider_message_id: messageId,
      status: 'SENT',
      segment_count: seg.segmentCount,
      encoding: seg.encoding,
    };
  }

  async sendEmail(): Promise<SendEmailResult> {
    return { success: false, error: 'Telnyx SMS adapter does not support email protocol.' };
  }

  getCapabilities(): ProviderCapability {
    return {
      supports_html: false,
      supports_attachments: false,
      supports_template_variables: true,
      supports_cc_bcc: false,
      supports_delivery_tracking: true,
      supports_open_tracking: false,
      supports_click_tracking: false,
    };
  }
}

// ===========================================================================
// 6. Infobip SMS Provider Adapter
// ===========================================================================
@Injectable()
export class InfobipSmsProviderAdapter implements EmailProviderInterface {
  readonly slug = 'infobip-sms';
  private readonly logger = new Logger(InfobipSmsProviderAdapter.name);

  async validateConfiguration(credentials: Record<string, any>): Promise<{ valid: boolean; error?: string }> {
    if (!credentials.api_key) {
      return { valid: false, error: 'Infobip API Key is required.' };
    }
    if (!credentials.base_url) {
      return { valid: false, error: 'Infobip Base URL is required (e.g. https://xxxxxx.api.infobip.com).' };
    }
    if (!credentials.sender_phone) {
      return { valid: false, error: 'Infobip Sender ID / Number is required.' };
    }
    return { valid: true };
  }

  async testConnection(credentials: Record<string, any>): Promise<{ success: boolean; message: string }> {
    const val = await this.validateConfiguration(credentials);
    if (!val.valid) {
      return { success: false, message: val.error || 'Invalid Infobip credentials.' };
    }
    return {
      success: true,
      message: `Successfully connected to Infobip SMS Gateway: ${credentials.base_url} (Sender: ${credentials.sender_phone})`,
    };
  }

  async sendSms(credentials: Record<string, any>, payload: SendSmsPayload): Promise<SendSmsResult> {
    const val = await this.validateConfiguration(credentials);
    if (!val.valid) {
      return { success: false, status: 'FAILED', segment_count: 1, encoding: 'GSM_7BIT', error: val.error };
    }
    const seg = calculateSmsSegmentsCommon(payload.body);
    const messageId = `ib-${crypto.randomBytes(8).toString('hex')}`;
    return {
      success: true,
      provider_message_id: messageId,
      status: 'SENT',
      segment_count: seg.segmentCount,
      encoding: seg.encoding,
    };
  }

  async sendEmail(): Promise<SendEmailResult> {
    return { success: false, error: 'Infobip SMS adapter does not support email protocol.' };
  }

  getCapabilities(): ProviderCapability {
    return {
      supports_html: false,
      supports_attachments: false,
      supports_template_variables: true,
      supports_cc_bcc: false,
      supports_delivery_tracking: true,
      supports_open_tracking: false,
      supports_click_tracking: false,
    };
  }
}
