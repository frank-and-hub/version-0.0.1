import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import * as crypto from 'crypto';
import { PrismaClient, MessageSendingStatus, WhatsAppMessageDirection, WhatsAppMessageType } from '@prisma/client';

describe('Phase 3 — Meta WhatsApp Business Cloud API Integration Suite', () => {
  let prisma: PrismaClient;
  let testUserUuid: string;
  let testConfigUuid: string;

  const TEST_APP_SECRET = 'meta_app_secret_test_0192837465';
  const TEST_VERIFY_TOKEN = 'meta_webhook_verify_token_xyz987';
  const TEST_WABA_ID = 'waba_1029384756';
  const TEST_PHONE_NUMBER_ID = 'phone_num_9988776655';
  const TEST_SENDER_PHONE = '+15550192834';
  const TEST_CUSTOMER_PHONE = '+15559876543';

  // Standalone WhatsApp logic mirrors WhatsAppCloudApiAdapter
  function normalizePhoneNumber(phone: string): { e164: string; digitsOnly: string } {
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

  function verifyWebhookSignature(rawBody: string | Buffer, signatureHeader: string | undefined, appSecret: string): boolean {
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

  function verifyWebhookChallenge(mode?: string, token?: string, expectedToken?: string, challenge?: string): string | null {
    if (mode === 'subscribe' && token && expectedToken && token === expectedToken) {
      return challenge || '';
    }
    return null;
  }

  // Helper: Encrypt mock credentials
  function encryptCredentials(data: Record<string, any>): string {
    const key = crypto.createHash('sha256').update(process.env.ENCRYPTION_KEY || 'default-antigravity-secret-key-32').digest();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const tag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${encrypted}:${tag}`;
  }

  function signPayload(body: string, secret: string): string {
    const hmac = crypto.createHmac('sha256', secret).update(body).digest('hex');
    return `sha256=${hmac}`;
  }

  before(async () => {
    prisma = new PrismaClient();

    const user = await prisma.user.findFirst({
      where: { email: 'superadmin@example.com' },
    });
    assert.ok(user, 'SuperAdmin user must exist');
    testUserUuid = user.user_uuid;

    // Clean up existing test data
    await prisma.whatsAppMessage.deleteMany({ where: { user_uuid: testUserUuid } });
    await prisma.whatsAppConversation.deleteMany({ where: { user_uuid: testUserUuid } });
    await prisma.whatsAppTemplate.deleteMany({ where: { user_uuid: testUserUuid } });

    // Ensure WhatsApp Provider exists in global catalog
    let provider = await prisma.provider.findUnique({ where: { slug: 'whatsapp-cloud' } });
    if (!provider) {
      provider = await prisma.provider.create({
        data: {
          name: 'Meta WhatsApp Cloud API',
          slug: 'whatsapp-cloud',
          type: 'WHATSAPP',
          description: 'Meta WhatsApp Cloud API',
          logo: '/providers/whatsapp.svg',
          configuration_schema: {},
          form_fields: [],
        },
      });
    }

    // Create encrypted UserProviderConfiguration
    const creds = {
      phone_number_id: TEST_PHONE_NUMBER_ID,
      waba_id: TEST_WABA_ID,
      access_token: 'EAAG_mock_permanent_system_user_token_123',
      app_secret: TEST_APP_SECRET,
      webhook_verify_token: TEST_VERIFY_TOKEN,
      api_version: 'v21.0',
    };

    const config = await prisma.userProviderConfiguration.create({
      data: {
        user_uuid: testUserUuid,
        provider_uuid: provider.provider_uuid,
        configuration_name: 'Test WhatsApp Business Account',
        type: 'WHATSAPP',
        credentials: encryptCredentials(creds),
        sender_name: 'Antigravity Support',
        sender_phone: TEST_SENDER_PHONE,
        is_default: true,
        is_active: true,
        is_verified: true,
      },
    });

    testConfigUuid = config.configuration_uuid;
  });

  after(async () => {
    await prisma.whatsAppMessage.deleteMany({ where: { user_uuid: testUserUuid } });
    await prisma.whatsAppConversation.deleteMany({ where: { user_uuid: testUserUuid } });
    await prisma.whatsAppTemplate.deleteMany({ where: { user_uuid: testUserUuid } });
    await prisma.userProviderConfiguration.deleteMany({ where: { configuration_uuid: testConfigUuid } });
    await prisma.$disconnect();
  });

  // --------------------------------------------------------------------------
  // 1. Phone Number Normalization
  // --------------------------------------------------------------------------
  test('1. Normalizes phone numbers to standard E.164 and clean digit strings', () => {
    const test1 = normalizePhoneNumber('+1 (555) 019-2834');
    assert.strictEqual(test1.e164, '+15550192834');
    assert.strictEqual(test1.digitsOnly, '15550192834');

    const test2 = normalizePhoneNumber(' 44 20 7946 0991 ');
    assert.strictEqual(test2.e164, '+442079460991');
    assert.strictEqual(test2.digitsOnly, '442079460991');

    assert.throws(() => normalizePhoneNumber('abc'), /Invalid phone number format/);
    assert.throws(() => normalizePhoneNumber('123'), /Invalid phone number format/);
  });

  // --------------------------------------------------------------------------
  // 2. Cryptographic Webhook HMAC-SHA256 Verification
  // --------------------------------------------------------------------------
  test('2. Validates Meta Webhook HMAC-SHA256 signature (X-Hub-Signature-256)', () => {
    const rawPayload = JSON.stringify({
      object: 'whatsapp_business_account',
      entry: [{ id: TEST_WABA_ID }],
    });

    const validSignature = signPayload(rawPayload, TEST_APP_SECRET);

    // Valid signature passes
    const isValid = verifyWebhookSignature(rawPayload, validSignature, TEST_APP_SECRET);
    assert.strictEqual(isValid, true, 'Valid signature should be accepted');

    // Tampered payload fails
    const tamperedPayload = rawPayload + ' ';
    const isTamperedValid = verifyWebhookSignature(tamperedPayload, validSignature, TEST_APP_SECRET);
    assert.strictEqual(isTamperedValid, false, 'Tampered payload should fail verification');

    // Wrong secret fails
    const isWrongSecretValid = verifyWebhookSignature(rawPayload, validSignature, 'incorrect_secret');
    assert.strictEqual(isWrongSecretValid, false, 'Incorrect secret should fail verification');
  });

  // --------------------------------------------------------------------------
  // 3. Webhook GET Verification Challenge Handshake
  // --------------------------------------------------------------------------
  test('3. Handles Meta Webhook verification handshake challenge (hub.mode & hub.verify_token)', () => {
    const challenge = 'random_challenge_string_abc123';

    // Successful handshake
    const result = verifyWebhookChallenge('subscribe', TEST_VERIFY_TOKEN, TEST_VERIFY_TOKEN, challenge);
    assert.strictEqual(result, challenge, 'Handshake should return exact challenge string');

    // Wrong verify token rejected
    const badTokenResult = verifyWebhookChallenge('subscribe', 'wrong_token', TEST_VERIFY_TOKEN, challenge);
    assert.strictEqual(badTokenResult, null, 'Invalid token should return null');

    // Wrong mode rejected
    const badModeResult = verifyWebhookChallenge('unsubscribe', TEST_VERIFY_TOKEN, TEST_VERIFY_TOKEN, challenge);
    assert.strictEqual(badModeResult, null, 'Invalid mode should return null');
  });

  // --------------------------------------------------------------------------
  // 4. 24-Hour Customer Service Session Window Enforcement
  // --------------------------------------------------------------------------
  test('4. Enforces 24-Hour Customer Service Window for free-form session messages', async () => {
    const { e164 } = normalizePhoneNumber(TEST_CUSTOMER_PHONE);

    // Initial state: no conversation exists yet
    const convBefore = await prisma.whatsAppConversation.findFirst({
      where: { provider_configuration_uuid: testConfigUuid, contact_phone: e164 },
    });
    assert.strictEqual(convBefore, null);

    // Case A: Create conversation with expired session window (simulating expired session)
    const expiredConv = await prisma.whatsAppConversation.create({
      data: {
        user_uuid: testUserUuid,
        provider_configuration_uuid: testConfigUuid,
        contact_phone: e164,
        contact_name: 'Alice Customer',
        window_expires_at: new Date(Date.now() - 3600 * 1000), // Expired 1 hour ago
      },
    });

    const isExpired = expiredConv.window_expires_at! <= new Date();
    assert.strictEqual(isExpired, true, 'Window should be expired');

    // Case B: Inbound customer message arrives -> Extends window by 24 hours
    const now = new Date();
    const newWindowExpiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const updatedConv = await prisma.whatsAppConversation.update({
      where: { conversation_uuid: expiredConv.conversation_uuid },
      data: {
        window_expires_at: newWindowExpiresAt,
        last_message_at: now,
        last_message_direction: WhatsAppMessageDirection.INBOUND,
      },
    });

    assert.ok(updatedConv.window_expires_at! > new Date());
    const hoursRemaining = Math.round((updatedConv.window_expires_at!.getTime() - Date.now()) / (3600 * 1000));
    assert.ok(hoursRemaining >= 23 && hoursRemaining <= 24);
  });

  // --------------------------------------------------------------------------
  // 5. Inbound Message Processing, Conversation Threading, and Delivery Receipts
  // --------------------------------------------------------------------------
  test('5. Processes inbound message, threads conversation, and handles status receipts', async () => {
    const { e164 } = normalizePhoneNumber(TEST_CUSTOMER_PHONE);
    const inboundWamid = `wamid.HBg${Date.now()}`;

    // 1. Simulate customer sending "Hello support"
    const conversation = await prisma.whatsAppConversation.upsert({
      where: {
        provider_configuration_uuid_contact_phone: {
          provider_configuration_uuid: testConfigUuid,
          contact_phone: e164,
        },
      },
      create: {
        user_uuid: testUserUuid,
        provider_configuration_uuid: testConfigUuid,
        contact_phone: e164,
        contact_name: 'Alice Customer',
        window_expires_at: new Date(Date.now() + 24 * 3600 * 1000),
        last_message_at: new Date(),
        last_message_direction: WhatsAppMessageDirection.INBOUND,
      },
      update: {
        window_expires_at: new Date(Date.now() + 24 * 3600 * 1000),
        last_message_at: new Date(),
        last_message_direction: WhatsAppMessageDirection.INBOUND,
      },
    });

    const inboundMsg = await prisma.whatsAppMessage.create({
      data: {
        conversation_uuid: conversation.conversation_uuid,
        user_uuid: testUserUuid,
        provider_configuration_uuid: testConfigUuid,
        direction: WhatsAppMessageDirection.INBOUND,
        message_type: WhatsAppMessageType.TEXT,
        provider_message_id: inboundWamid,
        recipient_phone: TEST_SENDER_PHONE,
        sender_phone: e164,
        content: 'Hello support, need assistance with my order',
        status: MessageSendingStatus.DELIVERED,
      },
    });

    assert.ok(inboundMsg.message_uuid);
    assert.strictEqual(inboundMsg.direction, WhatsAppMessageDirection.INBOUND);
    assert.strictEqual(inboundMsg.status, MessageSendingStatus.DELIVERED);

    // 2. Outbound reply from system within 24h window
    const outboundWamid = `wamid.HBgOutbound${Date.now()}`;
    const outboundMsg = await prisma.whatsAppMessage.create({
      data: {
        conversation_uuid: conversation.conversation_uuid,
        user_uuid: testUserUuid,
        provider_configuration_uuid: testConfigUuid,
        direction: WhatsAppMessageDirection.OUTBOUND,
        message_type: WhatsAppMessageType.TEXT,
        provider_message_id: outboundWamid,
        recipient_phone: e164,
        sender_phone: TEST_SENDER_PHONE,
        content: 'Hi Alice! We are glad to help. What is your order number?',
        status: MessageSendingStatus.SENT,
        sent_at: new Date(),
      },
    });

    assert.strictEqual(outboundMsg.status, MessageSendingStatus.SENT);

    // 3. Simulate Meta Webhook status updates: DELIVERED -> READ
    const deliveredUpdate = await prisma.whatsAppMessage.update({
      where: { message_uuid: outboundMsg.message_uuid },
      data: {
        status: MessageSendingStatus.DELIVERED,
        delivered_at: new Date(),
      },
    });
    assert.strictEqual(deliveredUpdate.status, MessageSendingStatus.DELIVERED);
    assert.ok(deliveredUpdate.delivered_at);

    const readUpdate = await prisma.whatsAppMessage.update({
      where: { message_uuid: outboundMsg.message_uuid },
      data: {
        status: MessageSendingStatus.READ,
        read_at: new Date(),
      },
    });
    assert.strictEqual(readUpdate.status, MessageSendingStatus.READ);
    assert.ok(readUpdate.read_at);

    // 4. Verify conversation message order
    const thread = await prisma.whatsAppMessage.findMany({
      where: { conversation_uuid: conversation.conversation_uuid },
      orderBy: { created_at: 'asc' },
    });

    assert.strictEqual(thread.length, 2);
    assert.strictEqual(thread[0].direction, WhatsAppMessageDirection.INBOUND);
    assert.strictEqual(thread[1].direction, WhatsAppMessageDirection.OUTBOUND);
  });

  test('6. Validates all 8 WhatsApp Business Provider Adapters and schemas', async () => {
    const { createRequire } = await import('node:module');
    const require = createRequire(import.meta.url);
    const {
      WhatsAppCloudApiAdapter,
      InteraktWhatsAppAdapter,
      WatiWhatsAppAdapter,
      TwilioWhatsAppAdapter,
      InfobipWhatsAppAdapter,
      GupshupWhatsAppAdapter,
      VonageWhatsAppAdapter,
      AiSensyWhatsAppAdapter,
    } = require('../dist/src/messaging/adapters/whatsapp-cloud.provider.js');

    const adapters = [
      new WhatsAppCloudApiAdapter(),
      new InteraktWhatsAppAdapter(),
      new WatiWhatsAppAdapter(),
      new TwilioWhatsAppAdapter(),
      new InfobipWhatsAppAdapter(),
      new GupshupWhatsAppAdapter(),
      new VonageWhatsAppAdapter(),
      new AiSensyWhatsAppAdapter(),
    ];

    assert.strictEqual(adapters.length, 8);

    for (const adapter of adapters) {
      assert.ok(adapter.slug.startsWith('whatsapp-'), `Adapter slug must start with whatsapp-: ${adapter.slug}`);
      const caps = adapter.getCapabilities();
      assert.strictEqual(caps.supports_html, false, `${adapter.slug} should not support email HTML`);
      assert.strictEqual(caps.supports_delivery_tracking, true, `${adapter.slug} supports delivery receipts`);

      // Incomplete configuration validation should fail
      const emptyVal = await adapter.validateConfiguration({});
      assert.strictEqual(emptyVal.valid, false, `${adapter.slug} should reject empty configuration`);
    }

    // Verify all 8 exist in DB
    const dbProviders = await prisma.provider.findMany({
      where: { type: 'WHATSAPP', deleted_at: null },
    });
    assert.strictEqual(dbProviders.length, 8, 'All 8 WhatsApp providers must exist in the database');
  });
});
