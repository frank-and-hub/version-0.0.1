import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import {
  EmailProviderInterface,
  ProviderCapability,
  SendEmailPayload,
  SendEmailResult,
} from './email-provider.interface';

export interface TwilioSmsCredentials {
  account_sid: string;
  auth_token: string;
  sender_phone?: string;
  messaging_service_sid?: string;
  api_key_sid?: string;
  api_key_secret?: string;
  webhook_verify_token?: string;
}

export interface SendSmsPayload {
  to: string;
  from?: string;
  body: string;
  messaging_service_sid?: string;
  status_callback?: string;
}

export interface SendSmsResult {
  success: boolean;
  provider_message_id?: string;
  status: string;
  segment_count: number;
  encoding: 'GSM_7BIT' | 'UCS2';
  price?: number;
  price_unit?: string;
  error?: string;
  raw_response?: any;
}

// GSM 7-bit default alphabet + extension table characters
const GSM_7BIT_BASIC = '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà';
const GSM_7BIT_EXTENDED = '|^€{}[]~\\';

@Injectable()
export class TwilioSmsProviderAdapter implements EmailProviderInterface {
  readonly slug = 'twilio-sms';
  private readonly logger = new Logger(TwilioSmsProviderAdapter.name);

  // -------------------------------------------------------------
  // Interface Compatibility
  // -------------------------------------------------------------
  async sendEmail(credentials: Record<string, any>, payload: SendEmailPayload): Promise<SendEmailResult> {
    return {
      success: false,
      error: 'TwilioSmsProviderAdapter does not support email. Use sendSms() instead.',
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

  // -------------------------------------------------------------
  // Validation & Connection Testing
  // -------------------------------------------------------------
  async validateConfiguration(credentials: Record<string, any>): Promise<{ valid: boolean; error?: string }> {
    if (!credentials.account_sid) {
      return { valid: false, error: 'Twilio Account SID is required' };
    }
    if (!credentials.auth_token) {
      return { valid: false, error: 'Twilio Auth Token is required' };
    }
    if (!credentials.account_sid.startsWith('AC') || credentials.account_sid.length !== 34) {
      return { valid: false, error: 'Twilio Account SID must start with "AC" and be exactly 34 characters' };
    }
    if (credentials.messaging_service_sid && (!credentials.messaging_service_sid.startsWith('MG') || credentials.messaging_service_sid.length !== 34)) {
      return { valid: false, error: 'Messaging Service SID must start with "MG" and be exactly 34 characters' };
    }
    if (credentials.api_key_sid && (!credentials.api_key_sid.startsWith('SK') || credentials.api_key_sid.length !== 34)) {
      return { valid: false, error: 'API Key SID must start with "SK" and be exactly 34 characters' };
    }
    return { valid: true };
  }

  async testConnection(credentials: Record<string, any>): Promise<{ success: boolean; message: string; details?: any }> {
    const val = await this.validateConfiguration(credentials);
    if (!val.valid) {
      return { success: false, message: val.error || 'Invalid configuration' };
    }

    // Attempt real HTTP authentication against Twilio Accounts API
    const authUser = credentials.api_key_sid || credentials.account_sid;
    const authPass = credentials.api_key_secret || credentials.auth_token;
    const basicAuth = Buffer.from(`${authUser}:${authPass}`).toString('base64');

    const url = `https://api.twilio.com/2010-04-01/Accounts/${credentials.account_sid}.json`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Basic ${basicAuth}`,
          Accept: 'application/json',
        },
      });

      const body: any = await response.json();

      if (!response.ok) {
        // If testing in sandbox or mock mode without internet, return descriptive error
        const errMsg = body?.message || `HTTP ${response.status}: Failed to authenticate with Twilio`;
        return {
          success: false,
          message: `Twilio Authentication Failed: ${errMsg}`,
          details: body,
        };
      }

      return {
        success: true,
        message: `Successfully connected to Twilio Account: ${body.friendly_name || credentials.account_sid} (Status: ${body.status || 'active'})`,
        details: body,
      };
    } catch (err: any) {
      // Return structured error for offline/network issues
      return {
        success: false,
        message: `Network error connecting to Twilio API: ${err.message}`,
      };
    }
  }

  // -------------------------------------------------------------
  // E.164 Phone Normalization
  // -------------------------------------------------------------
  normalizePhoneNumber(phone: string): { e164: string; digitsOnly: string } {
    if (!phone) {
      throw new Error('Phone number is required');
    }
    const trimmed = phone.trim();
    const digitsOnly = trimmed.replace(/\D/g, '');
    if (digitsOnly.length < 7 || digitsOnly.length > 15) {
      throw new Error(`Invalid phone number format: '${phone}'. Must contain 7 to 15 digits.`);
    }
    const e164 = `+${digitsOnly}`;
    return { e164, digitsOnly };
  }

  // -------------------------------------------------------------
  // Character & Segment Counter (GSM 7-bit vs UCS-2 Unicode)
  // -------------------------------------------------------------
  calculateSegments(body: string): {
    encoding: 'GSM_7BIT' | 'UCS2';
    charCount: number;
    segmentCount: number;
    maxCharsPerSegment: number;
    charsRemainingInCurrentSegment: number;
  } {
    if (!body || body.length === 0) {
      return {
        encoding: 'GSM_7BIT',
        charCount: 0,
        segmentCount: 1,
        maxCharsPerSegment: 160,
        charsRemainingInCurrentSegment: 160,
      };
    }

    let isGsm = true;
    let gsmCharCount = 0;

    for (const char of body) {
      if (GSM_7BIT_BASIC.includes(char)) {
        gsmCharCount += 1;
      } else if (GSM_7BIT_EXTENDED.includes(char)) {
        gsmCharCount += 2; // Extension characters count as 2 characters
      } else {
        isGsm = false;
        break;
      }
    }

    if (isGsm) {
      const charCount = gsmCharCount;
      if (charCount <= 160) {
        return {
          encoding: 'GSM_7BIT',
          charCount,
          segmentCount: 1,
          maxCharsPerSegment: 160,
          charsRemainingInCurrentSegment: 160 - charCount,
        };
      }
      const segmentCount = Math.ceil(charCount / 153);
      const charsInLastSegment = charCount % 153 || 153;
      return {
        encoding: 'GSM_7BIT',
        charCount,
        segmentCount,
        maxCharsPerSegment: 153,
        charsRemainingInCurrentSegment: 153 - charsInLastSegment,
      };
    }

    // UCS-2 / UTF-16 Unicode
    const charCount = body.length;
    if (charCount <= 70) {
      return {
        encoding: 'UCS2',
        charCount,
        segmentCount: 1,
        maxCharsPerSegment: 70,
        charsRemainingInCurrentSegment: 70 - charCount,
      };
    }
    const segmentCount = Math.ceil(charCount / 67);
    const charsInLastSegment = charCount % 67 || 67;
    return {
      encoding: 'UCS2',
      charCount,
      segmentCount,
      maxCharsPerSegment: 67,
      charsRemainingInCurrentSegment: 67 - charsInLastSegment,
    };
  }

  // -------------------------------------------------------------
  // Twilio SMS Dispatch
  // -------------------------------------------------------------
  async sendSms(credentials: Record<string, any>, payload: SendSmsPayload): Promise<SendSmsResult> {
    const val = await this.validateConfiguration(credentials);
    if (!val.valid) {
      return {
        success: false,
        status: 'FAILED',
        segment_count: 1,
        encoding: 'GSM_7BIT',
        error: val.error,
      };
    }

    const { e164: recipientE164 } = this.normalizePhoneNumber(payload.to);
    const segmentInfo = this.calculateSegments(payload.body);

    const authUser = credentials.api_key_sid || credentials.account_sid;
    const authPass = credentials.api_key_secret || credentials.auth_token;
    const basicAuth = Buffer.from(`${authUser}:${authPass}`).toString('base64');

    const formParams = new URLSearchParams();
    formParams.append('To', recipientE164);
    formParams.append('Body', payload.body);

    if (payload.messaging_service_sid || credentials.messaging_service_sid) {
      formParams.append('MessagingServiceSid', payload.messaging_service_sid || credentials.messaging_service_sid);
    } else if (payload.from || credentials.sender_phone) {
      formParams.append('From', payload.from || credentials.sender_phone);
    } else {
      return {
        success: false,
        status: 'FAILED',
        segment_count: segmentInfo.segmentCount,
        encoding: segmentInfo.encoding,
        error: 'Either a sender phone number or a Messaging Service SID must be provided.',
      };
    }

    if (payload.status_callback) {
      formParams.append('StatusCallback', payload.status_callback);
    }

    const url = `https://api.twilio.com/2010-04-01/Accounts/${credentials.account_sid}/Messages.json`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${basicAuth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: formParams.toString(),
      });

      const body: any = await response.json();

      if (!response.ok) {
        return {
          success: false,
          status: 'FAILED',
          segment_count: segmentInfo.segmentCount,
          encoding: segmentInfo.encoding,
          error: body?.message || `HTTP ${response.status}: Failed to send SMS via Twilio`,
          raw_response: body,
        };
      }

      return {
        success: true,
        provider_message_id: body.sid,
        status: body.status || 'queued',
        segment_count: Number(body.num_segments) || segmentInfo.segmentCount,
        encoding: segmentInfo.encoding,
        price: body.price ? Math.abs(parseFloat(body.price)) : undefined,
        price_unit: body.price_unit,
        raw_response: body,
      };
    } catch (err: any) {
      return {
        success: false,
        status: 'FAILED',
        segment_count: segmentInfo.segmentCount,
        encoding: segmentInfo.encoding,
        error: `Network error connecting to Twilio API: ${err.message}`,
      };
    }
  }

  // -------------------------------------------------------------
  // Twilio Webhook Signature Validation (HMAC-SHA1)
  // -------------------------------------------------------------
  validateWebhookSignature(
    url: string,
    params: Record<string, string>,
    signatureHeader: string | undefined,
    authToken: string,
  ): boolean {
    if (!signatureHeader || !authToken || !url) {
      return false;
    }

    // Twilio signature calculation:
    // 1. Take the full URL of the request.
    // 2. Sort the POST parameter keys alphabetically.
    // 3. Append each key and its value to the URL string without delimiters.
    // 4. Compute HMAC-SHA1 with the Auth Token and base64-encode.
    let data = url;
    const sortedKeys = Object.keys(params).sort();
    for (const key of sortedKeys) {
      data += `${key}${params[key]}`;
    }

    const expectedSignature = crypto
      .createHmac('sha1', authToken)
      .update(Buffer.from(data, 'utf-8'))
      .digest('base64');

    try {
      const bufExpected = Buffer.from(expectedSignature);
      const bufProvided = Buffer.from(signatureHeader);
      if (bufExpected.length !== bufProvided.length) {
        return false;
      }
      return crypto.timingSafeEqual(bufExpected, bufProvided);
    } catch {
      return false;
    }
  }
}
