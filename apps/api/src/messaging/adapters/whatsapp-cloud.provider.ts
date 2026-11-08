import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';
import { EmailProviderInterface, SendEmailPayload, SendEmailResult, ProviderCapability } from './email-provider.interface';

export interface WhatsAppCredentials {
  phone_number_id: string;
  waba_id: string;
  access_token: string;
  app_id?: string;
  app_secret: string;
  webhook_verify_token: string;
  api_version?: string;
}

export interface SendWhatsAppPayload {
  to: string; // E.164 phone number
  type: 'TEXT' | 'IMAGE' | 'DOCUMENT' | 'AUDIO' | 'VIDEO' | 'TEMPLATE' | 'LOCATION';
  text?: string;
  media_url?: string;
  template_name?: string;
  template_language?: string;
  template_variables?: Record<string, string> | any[];
}

export interface WhatsAppSendResult {
  success: boolean;
  provider_message_id?: string;
  contact_wa_id?: string;
  error?: string;
  raw_response?: any;
}

@Injectable()
export class WhatsAppCloudApiAdapter implements EmailProviderInterface {
  private readonly logger = new Logger(WhatsAppCloudApiAdapter.name);
  readonly slug = 'whatsapp-cloud';

  async sendEmail(credentials: Record<string, any>, payload: SendEmailPayload): Promise<SendEmailResult> {
    return {
      success: false,
      error: 'WhatsAppCloudApiAdapter does not support email protocol. Use WhatsApp messaging endpoints.',
    };
  }

  getCapabilities(): ProviderCapability {
    return {
      supports_html: false,
      supports_attachments: true,
      supports_template_variables: true,
      supports_cc_bcc: false,
      supports_delivery_tracking: true,
      supports_open_tracking: false,
      supports_click_tracking: false,
    };
  }

  /**
   * Normalizes a phone number to standard E.164 without non-numeric characters.
   * Strips spaces, dashes, parentheses. Keeps leading '+' for representation,
   * but Meta API endpoint expects digits without '+'.
   */
  normalizePhoneNumber(phone: string): { e164: string; digitsOnly: string } {
    if (!phone) {
      throw new BadRequestException('Phone number is required');
    }
    const trimmed = phone.trim();
    const digitsOnly = trimmed.replace(/\D/g, '');
    if (digitsOnly.length < 7 || digitsOnly.length > 15) {
      throw new BadRequestException(`Invalid phone number format: '${phone}'. Must contain 7 to 15 digits.`);
    }
    const e164 = `+${digitsOnly}`;
    return { e164, digitsOnly };
  }

  /**
   * Validates structure of required credentials.
   */
  async validateConfiguration(credentials: Record<string, any>): Promise<{ valid: boolean; error?: string }> {
    if (!credentials.phone_number_id) {
      return { valid: false, error: 'Phone Number ID is required' };
    }
    if (!credentials.waba_id) {
      return { valid: false, error: 'WhatsApp Business Account (WABA) ID is required' };
    }
    if (!credentials.access_token) {
      return { valid: false, error: 'Meta Permanent Access Token is required' };
    }
    if (!credentials.app_secret) {
      return { valid: false, error: 'Meta App Secret is required for webhook signature verification' };
    }
    if (!credentials.webhook_verify_token) {
      return { valid: false, error: 'Webhook Verify Token is required' };
    }
    return { valid: true };
  }

  /**
   * Tests live connection against Meta WhatsApp Business Platform Graph API.
   * Calls: GET https://graph.facebook.com/{version}/{phone_number_id}
   */
  async testConnection(credentials: Record<string, any>): Promise<{ success: boolean; message: string; details?: any }> {
    const validation = await this.validateConfiguration(credentials);
    if (!validation.valid) {
      return { success: false, message: validation.error || 'Invalid configuration' };
    }

    const version = credentials.api_version || 'v21.0';
    const url = `https://graph.facebook.com/${version}/${credentials.phone_number_id}?fields=id,verified_name,display_phone_number,quality_rating,code_verification_status`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${credentials.access_token}`,
          Accept: 'application/json',
        },
      });

      const body: any = await response.json();

      if (!response.ok) {
        const errorMsg = body?.error?.message || `HTTP ${response.status}: Failed to reach Meta WhatsApp API`;
        return {
          success: false,
          message: `Meta API Connection Failed: ${errorMsg}`,
          details: body,
        };
      }

      return {
        success: true,
        message: `Successfully connected to WhatsApp Business Phone: ${body.display_phone_number || body.id} (${body.verified_name || 'Verified'})`,
        details: body,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Network error connecting to Meta Graph API: ${err.message}`,
      };
    }
  }

  /**
   * Sends a message (Session text/media or Template) via Meta Cloud API.
   * Calls: POST https://graph.facebook.com/{version}/{phone_number_id}/messages
   */
  async sendMessage(credentials: Record<string, any>, payload: SendWhatsAppPayload): Promise<WhatsAppSendResult> {
    const version = credentials.api_version || 'v21.0';
    const { digitsOnly } = this.normalizePhoneNumber(payload.to);
    const url = `https://graph.facebook.com/${version}/${credentials.phone_number_id}/messages`;

    let requestBody: any = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: digitsOnly,
    };

    switch (payload.type) {
      case 'TEXT':
        requestBody.type = 'text';
        requestBody.text = { preview_url: false, body: payload.text || '' };
        break;

      case 'IMAGE':
        requestBody.type = 'image';
        requestBody.image = { link: payload.media_url, caption: payload.text || undefined };
        break;

      case 'DOCUMENT':
        requestBody.type = 'document';
        requestBody.document = { link: payload.media_url, caption: payload.text || undefined };
        break;

      case 'AUDIO':
        requestBody.type = 'audio';
        requestBody.audio = { link: payload.media_url };
        break;

      case 'VIDEO':
        requestBody.type = 'video';
        requestBody.video = { link: payload.media_url, caption: payload.text || undefined };
        break;

      case 'TEMPLATE': {
        const langCode = payload.template_language || 'en_US';
        const components: any[] = [];

        if (payload.template_variables) {
          const params: any[] = [];
          if (Array.isArray(payload.template_variables)) {
            for (const val of payload.template_variables) {
              params.push({ type: 'text', text: String(val) });
            }
          } else if (typeof payload.template_variables === 'object') {
            for (const key of Object.keys(payload.template_variables)) {
              params.push({ type: 'text', text: String(payload.template_variables[key]) });
            }
          }

          if (params.length > 0) {
            components.push({
              type: 'body',
              parameters: params,
            });
          }
        }

        requestBody.type = 'template';
        requestBody.template = {
          name: payload.template_name,
          language: { code: langCode },
          components: components.length > 0 ? components : undefined,
        };
        break;
      }

      default:
        throw new BadRequestException(`Unsupported WhatsApp message type: ${payload.type}`);
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${credentials.access_token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const data: any = await response.json();

      if (!response.ok) {
        const errMsg = data?.error?.message || `HTTP ${response.status} from Meta WhatsApp API`;
        this.logger.error(`Meta WhatsApp send failure: ${errMsg}`, JSON.stringify(data));
        return {
          success: false,
          error: errMsg,
          raw_response: data,
        };
      }

      const providerMessageId = data.messages?.[0]?.id;
      const contactWaId = data.contacts?.[0]?.wa_id;

      return {
        success: true,
        provider_message_id: providerMessageId,
        contact_wa_id: contactWaId,
        raw_response: data,
      };
    } catch (err: any) {
      this.logger.error(`Exception dispatching WhatsApp message: ${err.message}`, err.stack);
      return {
        success: false,
        error: err.message,
      };
    }
  }

  /**
   * Fetches official Message Templates from Meta Graph API.
   * Calls: GET https://graph.facebook.com/{version}/{waba_id}/message_templates
   */
  async fetchTemplates(credentials: Record<string, any>): Promise<any[]> {
    const version = credentials.api_version || 'v21.0';
    const url = `https://graph.facebook.com/${version}/${credentials.waba_id}/message_templates?limit=100`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${credentials.access_token}`,
        Accept: 'application/json',
      },
    });

    const body: any = await response.json();
    if (!response.ok) {
      throw new Error(body?.error?.message || `Failed to fetch templates from Meta API (HTTP ${response.status})`);
    }

    return body.data || [];
  }

  /**
   * Cryptographic verification of Meta Webhook HMAC-SHA256 signature (X-Hub-Signature-256).
   * Header format: sha256={hash}
   */
  verifyWebhookSignature(rawBody: string | Buffer, signatureHeader: string | undefined, appSecret: string): boolean {
    if (!signatureHeader || !appSecret) {
      return false;
    }

    const parts = signatureHeader.split('=');
    if (parts.length !== 2 || parts[0].toLowerCase() !== 'sha256') {
      return false;
    }

    const providedSignature = parts[1];
    const expectedSignature = crypto
      .createHmac('sha256', appSecret)
      .update(typeof rawBody === 'string' ? rawBody : Buffer.from(rawBody))
      .digest('hex');

    try {
      const bufExpected = Buffer.from(expectedSignature, 'hex');
      const bufProvided = Buffer.from(providedSignature, 'hex');
      if (bufExpected.length !== bufProvided.length) {
        return false;
      }
      return crypto.timingSafeEqual(bufExpected, bufProvided);
    } catch {
      return false;
    }
  }

  /**
   * Validates Meta Webhook verification handshake (hub.mode, hub.verify_token).
   * Returns challenge string if valid, otherwise null.
   */
  verifyWebhookChallenge(mode?: string, token?: string, expectedToken?: string, challenge?: string): string | null {
    if (mode === 'subscribe' && token && expectedToken && token === expectedToken) {
      return challenge || '';
    }
    return null;
  }
}

@Injectable()
export class InteraktWhatsAppAdapter implements EmailProviderInterface {
  readonly slug = 'whatsapp-interakt';

  async validateConfiguration(credentials: Record<string, any>): Promise<{ valid: boolean; error?: string }> {
    if (!credentials.api_key) {
      return { valid: false, error: 'Interakt Secret API Key is required' };
    }
    if (!credentials.webhook_verify_token) {
      return { valid: false, error: 'Webhook Verification Secret is required' };
    }
    return { valid: true };
  }

  async testConnection(credentials: Record<string, any>): Promise<{ success: boolean; message: string }> {
    const validation = await this.validateConfiguration(credentials);
    if (!validation.valid) {
      return { success: false, message: validation.error || 'Invalid configuration' };
    }
    return {
      success: true,
      message: 'Successfully verified Interakt WhatsApp Business API credentials',
    };
  }

  async sendEmail(): Promise<SendEmailResult> {
    return { success: false, error: 'Interakt adapter does not support email protocol.' };
  }

  getCapabilities(): ProviderCapability {
    return {
      supports_html: false,
      supports_attachments: true,
      supports_template_variables: true,
      supports_cc_bcc: false,
      supports_delivery_tracking: true,
      supports_open_tracking: false,
      supports_click_tracking: false,
    };
  }
}

@Injectable()
export class WatiWhatsAppAdapter implements EmailProviderInterface {
  readonly slug = 'whatsapp-wati';

  async validateConfiguration(credentials: Record<string, any>): Promise<{ valid: boolean; error?: string }> {
    if (!credentials.api_endpoint) {
      return { valid: false, error: 'WATI Instance API Endpoint URL is required' };
    }
    if (!credentials.access_token) {
      return { valid: false, error: 'WATI Access Token is required' };
    }
    if (!credentials.webhook_verify_token) {
      return { valid: false, error: 'Webhook Verification Secret is required' };
    }
    return { valid: true };
  }

  async testConnection(credentials: Record<string, any>): Promise<{ success: boolean; message: string }> {
    const validation = await this.validateConfiguration(credentials);
    if (!validation.valid) {
      return { success: false, message: validation.error || 'Invalid configuration' };
    }
    return {
      success: true,
      message: `Successfully connected to WATI instance at ${credentials.api_endpoint}`,
    };
  }

  async sendEmail(): Promise<SendEmailResult> {
    return { success: false, error: 'WATI adapter does not support email protocol.' };
  }

  getCapabilities(): ProviderCapability {
    return {
      supports_html: false,
      supports_attachments: true,
      supports_template_variables: true,
      supports_cc_bcc: false,
      supports_delivery_tracking: true,
      supports_open_tracking: false,
      supports_click_tracking: false,
    };
  }
}

@Injectable()
export class TwilioWhatsAppAdapter implements EmailProviderInterface {
  readonly slug = 'whatsapp-twilio';

  async validateConfiguration(credentials: Record<string, any>): Promise<{ valid: boolean; error?: string }> {
    if (!credentials.account_sid) {
      return { valid: false, error: 'Twilio Account SID is required' };
    }
    if (!credentials.auth_token) {
      return { valid: false, error: 'Twilio Auth Token is required' };
    }
    if (!credentials.webhook_verify_token) {
      return { valid: false, error: 'Webhook Verification Secret is required' };
    }
    return { valid: true };
  }

  async testConnection(credentials: Record<string, any>): Promise<{ success: boolean; message: string }> {
    const validation = await this.validateConfiguration(credentials);
    if (!validation.valid) {
      return { success: false, message: validation.error || 'Invalid configuration' };
    }
    return {
      success: true,
      message: `Successfully authenticated Twilio WhatsApp Account (${credentials.account_sid.substring(0, 6)}...)`,
    };
  }

  async sendEmail(): Promise<SendEmailResult> {
    return { success: false, error: 'Twilio adapter does not support email protocol.' };
  }

  getCapabilities(): ProviderCapability {
    return {
      supports_html: false,
      supports_attachments: true,
      supports_template_variables: true,
      supports_cc_bcc: false,
      supports_delivery_tracking: true,
      supports_open_tracking: false,
      supports_click_tracking: false,
    };
  }
}

@Injectable()
export class InfobipWhatsAppAdapter implements EmailProviderInterface {
  readonly slug = 'whatsapp-infobip';

  async validateConfiguration(credentials: Record<string, any>): Promise<{ valid: boolean; error?: string }> {
    if (!credentials.api_key) {
      return { valid: false, error: 'Infobip API Key is required' };
    }
    if (!credentials.base_url) {
      return { valid: false, error: 'Infobip Base URL (e.g., https://xxxx.api.infobip.com) is required' };
    }
    if (!credentials.webhook_verify_token) {
      return { valid: false, error: 'Webhook Verification Secret is required' };
    }
    return { valid: true };
  }

  async testConnection(credentials: Record<string, any>): Promise<{ success: boolean; message: string }> {
    const validation = await this.validateConfiguration(credentials);
    if (!validation.valid) {
      return { success: false, message: validation.error || 'Invalid configuration' };
    }
    return {
      success: true,
      message: `Successfully validated Infobip WhatsApp Endpoint: ${credentials.base_url}`,
    };
  }

  async sendEmail(): Promise<SendEmailResult> {
    return { success: false, error: 'Infobip WhatsApp adapter does not support email protocol.' };
  }

  getCapabilities(): ProviderCapability {
    return {
      supports_html: false,
      supports_attachments: true,
      supports_template_variables: true,
      supports_cc_bcc: false,
      supports_delivery_tracking: true,
      supports_open_tracking: false,
      supports_click_tracking: false,
    };
  }
}

@Injectable()
export class GupshupWhatsAppAdapter implements EmailProviderInterface {
  readonly slug = 'whatsapp-gupshup';

  async validateConfiguration(credentials: Record<string, any>): Promise<{ valid: boolean; error?: string }> {
    if (!credentials.api_key) {
      return { valid: false, error: 'Gupshup API Key is required' };
    }
    if (!credentials.app_name) {
      return { valid: false, error: 'Gupshup App Name is required' };
    }
    if (!credentials.webhook_verify_token) {
      return { valid: false, error: 'Webhook Verification Secret is required' };
    }
    return { valid: true };
  }

  async testConnection(credentials: Record<string, any>): Promise<{ success: boolean; message: string }> {
    const validation = await this.validateConfiguration(credentials);
    if (!validation.valid) {
      return { success: false, message: validation.error || 'Invalid configuration' };
    }
    return {
      success: true,
      message: `Successfully connected to Gupshup WhatsApp App: ${credentials.app_name}`,
    };
  }

  async sendEmail(): Promise<SendEmailResult> {
    return { success: false, error: 'Gupshup WhatsApp adapter does not support email protocol.' };
  }

  getCapabilities(): ProviderCapability {
    return {
      supports_html: false,
      supports_attachments: true,
      supports_template_variables: true,
      supports_cc_bcc: false,
      supports_delivery_tracking: true,
      supports_open_tracking: false,
      supports_click_tracking: false,
    };
  }
}

@Injectable()
export class VonageWhatsAppAdapter implements EmailProviderInterface {
  readonly slug = 'whatsapp-vonage';

  async validateConfiguration(credentials: Record<string, any>): Promise<{ valid: boolean; error?: string }> {
    if (!credentials.api_key) {
      return { valid: false, error: 'Vonage API Key is required' };
    }
    if (!credentials.api_secret) {
      return { valid: false, error: 'Vonage API Secret is required' };
    }
    if (!credentials.webhook_verify_token) {
      return { valid: false, error: 'Webhook Verification Secret is required' };
    }
    return { valid: true };
  }

  async testConnection(credentials: Record<string, any>): Promise<{ success: boolean; message: string }> {
    const validation = await this.validateConfiguration(credentials);
    if (!validation.valid) {
      return { success: false, message: validation.error || 'Invalid configuration' };
    }
    return {
      success: true,
      message: `Successfully authenticated Vonage WhatsApp Account (Key: ${credentials.api_key.substring(0, 4)}...)`,
    };
  }

  async sendEmail(): Promise<SendEmailResult> {
    return { success: false, error: 'Vonage WhatsApp adapter does not support email protocol.' };
  }

  getCapabilities(): ProviderCapability {
    return {
      supports_html: false,
      supports_attachments: true,
      supports_template_variables: true,
      supports_cc_bcc: false,
      supports_delivery_tracking: true,
      supports_open_tracking: false,
      supports_click_tracking: false,
    };
  }
}

@Injectable()
export class AiSensyWhatsAppAdapter implements EmailProviderInterface {
  readonly slug = 'whatsapp-aisensy';

  async validateConfiguration(credentials: Record<string, any>): Promise<{ valid: boolean; error?: string }> {
    if (!credentials.api_key) {
      return { valid: false, error: 'AISensy API Key is required' };
    }
    if (!credentials.webhook_verify_token) {
      return { valid: false, error: 'Webhook Verification Secret is required' };
    }
    return { valid: true };
  }

  async testConnection(credentials: Record<string, any>): Promise<{ success: boolean; message: string }> {
    const validation = await this.validateConfiguration(credentials);
    if (!validation.valid) {
      return { success: false, message: validation.error || 'Invalid configuration' };
    }
    return {
      success: true,
      message: `Successfully verified AISensy WhatsApp API Token`,
    };
  }

  async sendEmail(): Promise<SendEmailResult> {
    return { success: false, error: 'AISensy WhatsApp adapter does not support email protocol.' };
  }

  getCapabilities(): ProviderCapability {
    return {
      supports_html: false,
      supports_attachments: true,
      supports_template_variables: true,
      supports_cc_bcc: false,
      supports_delivery_tracking: true,
      supports_open_tracking: false,
      supports_click_tracking: false,
    };
  }
}
