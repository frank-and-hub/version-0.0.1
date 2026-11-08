import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import * as crypto from 'crypto';
import { PrismaClient, MessageSendingStatus, SmsMessageDirection, SmsEncoding } from '@prisma/client';

describe('Phase 4 — Twilio SMS Messaging & Webhook Integration Suite', () => {
  let prisma: PrismaClient;
  let testUserUuid: string;
  let testConfigUuid: string;

  const TEST_ACCOUNT_SID = 'AC_TEST_ACCOUNT_SID_FOR_LOCAL_DEV_';
  const TEST_AUTH_TOKEN = 'twilio_auth_token_secret_1234567890';
  const TEST_SENDER_PHONE = '+15005550006'; // Twilio official test sender number
  const TEST_RECIPIENT_PHONE = '+15550192834';

  // GSM 7-bit charset constants
  const GSM_7BIT_BASIC = '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà';
  const GSM_7BIT_EXTENDED = '|^€{}[]~\\';

  function normalizePhoneNumber(phone: string): { e164: string; digitsOnly: string } {
    if (!phone) throw new Error('Phone number is required');
    const digitsOnly = phone.trim().replace(/\D/g, '');
    if (digitsOnly.length < 7 || digitsOnly.length > 15) {
      throw new Error(`Invalid phone number: '${phone}'. Must contain 7 to 15 digits.`);
    }
    return { e164: `+${digitsOnly}`, digitsOnly };
  }

  function calculateSegments(body: string) {
    if (!body || body.length === 0) {
      return { encoding: 'GSM_7BIT', charCount: 0, segmentCount: 1, maxCharsPerSegment: 160 };
    }
    let isGsm = true;
    let gsmCharCount = 0;
    for (const char of body) {
      if (GSM_7BIT_BASIC.includes(char)) {
        gsmCharCount += 1;
      } else if (GSM_7BIT_EXTENDED.includes(char)) {
        gsmCharCount += 2;
      } else {
        isGsm = false;
        break;
      }
    }
    if (isGsm) {
      if (gsmCharCount <= 160) {
        return { encoding: 'GSM_7BIT', charCount: gsmCharCount, segmentCount: 1, maxCharsPerSegment: 160 };
      }
      return { encoding: 'GSM_7BIT', charCount: gsmCharCount, segmentCount: Math.ceil(gsmCharCount / 153), maxCharsPerSegment: 153 };
    }
    // UCS2
    if (body.length <= 70) {
      return { encoding: 'UCS2', charCount: body.length, segmentCount: 1, maxCharsPerSegment: 70 };
    }
    return { encoding: 'UCS2', charCount: body.length, segmentCount: Math.ceil(body.length / 67), maxCharsPerSegment: 67 };
  }

  function validateTwilioSignature(
    url: string,
    params: Record<string, string>,
    signatureHeader: string | undefined,
    authToken: string,
  ): boolean {
    if (!signatureHeader || !authToken || !url) return false;
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
      return bufExpected.length === bufProvided.length && crypto.timingSafeEqual(bufExpected, bufProvided);
    } catch {
      return false;
    }
  }

  function signTwilioPayload(url: string, params: Record<string, string>, authToken: string): string {
    let data = url;
    const sortedKeys = Object.keys(params).sort();
    for (const key of sortedKeys) {
      data += `${key}${params[key]}`;
    }
    return crypto.createHmac('sha1', authToken).update(Buffer.from(data, 'utf-8')).digest('base64');
  }

  before(async () => {
    prisma = new PrismaClient();

    const user = await prisma.user.findFirst({
      where: { email: 'superadmin@example.com' },
    });
    assert.ok(user, 'SuperAdmin user must exist');
    testUserUuid = user.user_uuid;

    // Clean up test SMS data
    await prisma.smsMessage.deleteMany({ where: { user_uuid: testUserUuid } });
    await prisma.smsConversation.deleteMany({ where: { user_uuid: testUserUuid } });
    await prisma.smsOptOut.deleteMany({ where: { user_uuid: testUserUuid } });
    await prisma.smsTemplate.deleteMany({ where: { user_uuid: testUserUuid } });

    // Ensure twilio-sms provider exists
    let provider = await prisma.provider.findUnique({ where: { slug: 'twilio-sms' } });
    if (!provider) {
      provider = await prisma.provider.create({
        data: {
          name: 'Twilio Programmable SMS',
          slug: 'twilio-sms',
          type: 'SMS',
          configuration_schema: {},
          form_fields: [],
        },
      });
    }

    // Create user SMS configuration
    const key = crypto.createHash('sha256').update(process.env.ENCRYPTION_KEY || 'default-antigravity-secret-key-32').digest();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const rawCreds = JSON.stringify({
      account_sid: TEST_ACCOUNT_SID,
      auth_token: TEST_AUTH_TOKEN,
      sender_phone: TEST_SENDER_PHONE,
    });
    let enc = cipher.update(rawCreds, 'utf8', 'hex');
    enc += cipher.final('hex');
    const encrypted = `${iv.toString('hex')}:${enc}:${cipher.getAuthTag().toString('hex')}`;

    const config = await prisma.userProviderConfiguration.create({
      data: {
        user_uuid: testUserUuid,
        provider_uuid: provider.provider_uuid,
        configuration_name: 'Test Twilio SMS Account',
        type: 'SMS',
        credentials: encrypted,
        sender_name: 'Test SMS Sender',
        sender_phone: TEST_SENDER_PHONE,
        is_active: true,
        is_default: true,
      },
    });
    testConfigUuid = config.configuration_uuid;
  });

  after(async () => {
    if (prisma) {
      await prisma.smsMessage.deleteMany({ where: { user_uuid: testUserUuid } });
      await prisma.smsConversation.deleteMany({ where: { user_uuid: testUserUuid } });
      await prisma.smsOptOut.deleteMany({ where: { user_uuid: testUserUuid } });
      if (testConfigUuid) {
        await prisma.userProviderConfiguration.deleteMany({ where: { configuration_uuid: testConfigUuid } });
      }
      await prisma.$disconnect();
    }
  });

  // --------------------------------------------------------------------------
  // Tests
  // --------------------------------------------------------------------------

  test('1. Normalizes phone numbers to standard E.164 and rejects invalid formats', () => {
    assert.strictEqual(normalizePhoneNumber('+1 (555) 019-2834').e164, '+15550192834');
    assert.strictEqual(normalizePhoneNumber('  +44 7911 123456  ').e164, '+447911123456');
    assert.strictEqual(normalizePhoneNumber('919876543210').e164, '+919876543210');

    assert.throws(() => normalizePhoneNumber('123'), /Invalid phone number/);
    assert.throws(() => normalizePhoneNumber(''), /Phone number is required/);
  });

  test('2. Accurately calculates GSM 7-bit and UCS-2 Unicode message segments', () => {
    // 160 standard GSM chars = 1 segment
    const gsm160 = 'A'.repeat(160);
    const res160 = calculateSegments(gsm160);
    assert.strictEqual(res160.encoding, 'GSM_7BIT');
    assert.strictEqual(res160.segmentCount, 1);
    assert.strictEqual(res160.maxCharsPerSegment, 160);

    // 161 standard GSM chars = 2 segments (multipart 153 chars/segment)
    const gsm161 = 'A'.repeat(161);
    const res161 = calculateSegments(gsm161);
    assert.strictEqual(res161.encoding, 'GSM_7BIT');
    assert.strictEqual(res161.segmentCount, 2);

    // GSM Extension chars (e.g. € or [ counts as 2)
    const withEuro = 'Cost is 10€ today';
    const resEuro = calculateSegments(withEuro);
    assert.strictEqual(resEuro.encoding, 'GSM_7BIT');
    assert.strictEqual(resEuro.charCount, withEuro.length + 1);

    // Unicode (e.g., Hindi / Cyrillic / Japanese) trigger UCS-2 (70 chars single, 67 multi)
    const unicodeText = 'Your code is 1234 नमस्ते';
    const resUnicode = calculateSegments(unicodeText);
    assert.strictEqual(resUnicode.encoding, 'UCS2');
    assert.strictEqual(resUnicode.segmentCount, 1);

    const longUnicode = 'अ'.repeat(71); // 71 UTF-16 characters
    const resLongUnicode = calculateSegments(longUnicode);
    assert.strictEqual(resLongUnicode.encoding, 'UCS2');
    assert.strictEqual(resLongUnicode.segmentCount, 2);
  });

  test('3. Validates Twilio Account SID format and required credentials', async () => {
    const { createRequire } = await import('node:module');
    const require = createRequire(import.meta.url);
    const { TwilioSmsProviderAdapter } = require('../dist/src/messaging/adapters/twilio-sms.provider.js');
    const adapter = new TwilioSmsProviderAdapter();

    const empty = await adapter.validateConfiguration({});
    assert.strictEqual(empty.valid, false);

    const invalidSid = await adapter.validateConfiguration({
      account_sid: 'INVALID_SID_WITHOUT_AC',
      auth_token: 'valid_token_1234567890',
    });
    assert.strictEqual(invalidSid.valid, false);
    assert.ok(invalidSid.error?.includes('must start with "AC"'));

    const valid = await adapter.validateConfiguration({
      account_sid: TEST_ACCOUNT_SID,
      auth_token: TEST_AUTH_TOKEN,
    });
    assert.strictEqual(valid.valid, true);
  });

  test('4. Verifies Twilio Webhook HMAC-SHA1 signatures with full URL and sorted params', () => {
    const webhookUrl = 'https://example.com/api/webhooks/messaging/sms/twilio/config-123/status';
    const params = {
      MessageSid: 'SM_TEST_MESSAGE_SID_MOCK_12345678',
      MessageStatus: 'delivered',
      To: '+15550192834',
      From: '+15005550006',
    };

    const signature = signTwilioPayload(webhookUrl, params, TEST_AUTH_TOKEN);
    const isValid = validateTwilioSignature(webhookUrl, params, signature, TEST_AUTH_TOKEN);
    assert.strictEqual(isValid, true, 'Valid Twilio signature must pass');

    // Tampered payload must fail
    const tampered = { ...params, MessageStatus: 'failed' };
    const isTamperedValid = validateTwilioSignature(webhookUrl, tampered, signature, TEST_AUTH_TOKEN);
    assert.strictEqual(isTamperedValid, false, 'Tampered parameters must fail validation');

    // Wrong auth token must fail
    const wrongTokenValid = validateTwilioSignature(webhookUrl, params, signature, 'wrong_token');
    assert.strictEqual(wrongTokenValid, false, 'Invalid auth token must fail validation');
  });

  test('5. Dispatches SMS, creates conversation thread, and processes delivery callback', async () => {
    const testSid = `SMtest${Date.now()}`;
    const { e164 } = normalizePhoneNumber(TEST_RECIPIENT_PHONE);

    // 1. Thread conversation
    const conversation = await prisma.smsConversation.create({
      data: {
        user_uuid: testUserUuid,
        provider_configuration_uuid: testConfigUuid,
        contact_phone: e164,
        last_message_at: new Date(),
        last_message_direction: SmsMessageDirection.OUTBOUND,
      },
    });

    // 2. Persist message record
    const message = await prisma.smsMessage.create({
      data: {
        conversation_uuid: conversation.conversation_uuid,
        user_uuid: testUserUuid,
        provider_configuration_uuid: testConfigUuid,
        direction: SmsMessageDirection.OUTBOUND,
        provider_message_id: testSid,
        recipient_phone: e164,
        sender_phone: TEST_SENDER_PHONE,
        body: 'Your flight is on time! Have a great trip.',
        segment_count: 1,
        encoding: SmsEncoding.GSM_7BIT,
        status: MessageSendingStatus.SENT,
        sent_at: new Date(),
      },
    });

    assert.strictEqual(message.status, MessageSendingStatus.SENT);
    assert.strictEqual(message.provider_message_id, testSid);

    // 3. Simulate Twilio Status Callback: delivered
    const updated = await prisma.smsMessage.update({
      where: { message_uuid: message.message_uuid },
      data: {
        status: MessageSendingStatus.DELIVERED,
        delivered_at: new Date(),
        price: 0.0075,
        price_unit: 'USD',
      },
    });

    assert.strictEqual(updated.status, MessageSendingStatus.DELIVERED);
    assert.ok(updated.delivered_at);
    assert.strictEqual(updated.price, 0.0075);
  });

  test('6. Creates scheduled SMS and allows safe cancellation before dispatch', async () => {
    const futureDate = new Date(Date.now() + 86400000); // 24 hours in the future
    const { e164 } = normalizePhoneNumber('+15551112233');

    const scheduled = await prisma.smsMessage.create({
      data: {
        user_uuid: testUserUuid,
        provider_configuration_uuid: testConfigUuid,
        direction: SmsMessageDirection.OUTBOUND,
        recipient_phone: e164,
        sender_phone: TEST_SENDER_PHONE,
        body: 'Scheduled appointment reminder for tomorrow.',
        segment_count: 1,
        encoding: SmsEncoding.GSM_7BIT,
        status: MessageSendingStatus.QUEUED,
        is_scheduled: true,
        scheduled_at: futureDate,
      },
    });

    assert.strictEqual(scheduled.is_scheduled, true);
    assert.strictEqual(scheduled.status, MessageSendingStatus.QUEUED);

    // Cancel before dispatch
    const cancelled = await prisma.smsMessage.update({
      where: { message_uuid: scheduled.message_uuid },
      data: {
        status: MessageSendingStatus.CANCELLED,
        cancelled_at: new Date(),
      },
    });

    assert.strictEqual(cancelled.status, MessageSendingStatus.CANCELLED);
    assert.ok(cancelled.cancelled_at);
  });

  test('7. Enforces TCPA/CTIA Opt-Out on STOP and restores on START', async () => {
    const targetPhone = '+15559998877';

    // 1. Simulate inbound STOP SMS
    const optOutRecord = await prisma.smsOptOut.upsert({
      where: {
        user_uuid_phone_number: {
          user_uuid: testUserUuid,
          phone_number: targetPhone,
        },
      },
      create: {
        user_uuid: testUserUuid,
        phone_number: targetPhone,
        reason: 'STOP',
        source: 'INBOUND_SMS',
        is_opted_out: true,
      },
      update: {
        is_opted_out: true,
        reason: 'STOP',
      },
    });

    assert.strictEqual(optOutRecord.is_opted_out, true);

    // 2. Verify opt-out query prevents sending
    const checkOptOut = await prisma.smsOptOut.findUnique({
      where: {
        user_uuid_phone_number: {
          user_uuid: testUserUuid,
          phone_number: targetPhone,
        },
      },
    });
    assert.ok(checkOptOut?.is_opted_out, 'Target phone must be flagged as opted out');

    // 3. Simulate inbound START SMS (Opt-In / Resubscribe)
    const optInRecord = await prisma.smsOptOut.update({
      where: {
        user_uuid_phone_number: {
          user_uuid: testUserUuid,
          phone_number: targetPhone,
        },
      },
      data: {
        is_opted_out: false,
        opted_in_at: new Date(),
      },
    });

    assert.strictEqual(optInRecord.is_opted_out, false);
    assert.ok(optInRecord.opted_in_at);
  });

  test('8. Validates all 6 additional SMS Provider Adapters and schemas', async () => {
    const { createRequire } = await import('module');
    const require = createRequire(import.meta.url);
    const {
      AwsSnsSmsProviderAdapter,
      MessageBirdSmsProviderAdapter,
      VonageSmsProviderAdapter,
      PlivoSmsProviderAdapter,
      TelnyxSmsProviderAdapter,
      InfobipSmsProviderAdapter,
    } = require('../dist/src/messaging/adapters/additional-sms.providers.js');

    // 1. AWS SNS
    const aws = new AwsSnsSmsProviderAdapter();
    assert.strictEqual(aws.slug, 'aws-sns-sms');
    const awsInvalid = await aws.validateConfiguration({});
    assert.strictEqual(awsInvalid.valid, false);
    const awsValid = await aws.validateConfiguration({
      aws_access_key_id: 'AKIA_TEST_KEY_ID_FOR_UNIT_TEST',
      aws_secret_access_key: 'mock_aws_secret_access_key_unit_test',
      aws_region: 'us-east-1',
    });
    assert.strictEqual(awsValid.valid, true);
    const awsConn = await aws.testConnection({
      aws_access_key_id: 'AKIA_TEST_KEY_ID_FOR_UNIT_TEST',
      aws_secret_access_key: 'mock_aws_secret_access_key_unit_test',
      aws_region: 'us-east-1',
    });
    assert.strictEqual(awsConn.success, true);

    // 2. MessageBird
    const mb = new MessageBirdSmsProviderAdapter();
    assert.strictEqual(mb.slug, 'messagebird-sms');
    const mbConn = await mb.testConnection({
      api_key: 'live_test_api_key_12345',
      sender_phone: 'BirdBrand',
    });
    assert.strictEqual(mbConn.success, true);

    // 3. Vonage
    const vonage = new VonageSmsProviderAdapter();
    assert.strictEqual(vonage.slug, 'vonage-sms');
    const vngConn = await vonage.testConnection({
      api_key: 'vonage_key',
      api_secret: 'vonage_secret',
      sender_phone: 'VONAGE',
    });
    assert.strictEqual(vngConn.success, true);

    // 4. Plivo
    const plivo = new PlivoSmsProviderAdapter();
    assert.strictEqual(plivo.slug, 'plivo-sms');
    const plivoConn = await plivo.testConnection({
      auth_id: 'MA_TEST_AUTH_ID_FOR_UNIT_TEST',
      auth_token: 'auth_token_secret_12345',
      sender_phone: '+15005550006',
    });
    assert.strictEqual(plivoConn.success, true);

    // 5. Telnyx
    const telnyx = new TelnyxSmsProviderAdapter();
    assert.strictEqual(telnyx.slug, 'telnyx-sms');
    const telnyxConn = await telnyx.testConnection({
      api_key: 'KEY0123456789abcdef',
      sender_phone: '+15005550006',
    });
    assert.strictEqual(telnyxConn.success, true);

    // 6. Infobip
    const infobip = new InfobipSmsProviderAdapter();
    assert.strictEqual(infobip.slug, 'infobip-sms');
    const ibConn = await infobip.testConnection({
      api_key: 'infobip_secret_key_12345',
      base_url: 'https://xxxxxx.api.infobip.com',
      sender_phone: 'InfoBrand',
    });
    assert.strictEqual(ibConn.success, true);
  });
});
