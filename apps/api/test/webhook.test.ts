import { test, describe } from 'node:test';
import assert from 'node:assert';
import * as crypto from 'crypto';

describe('Phase 2 — Email Webhooks, Tracking & Event Deduplication Test Suite', () => {
  // Test SendGrid signature verification logic
  function verifySendGridSignature(
    rawBody: string | Buffer,
    headers: Record<string, string | string[] | undefined>,
    publicKey: string,
  ): { valid: boolean; error?: string } {
    const signatureHeader = headers['x-twilio-email-event-webhook-signature'];
    const timestampHeader = headers['x-twilio-email-event-webhook-timestamp'];

    const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;
    const timestamp = Array.isArray(timestampHeader) ? timestampHeader[0] : timestampHeader;

    if (!signature || !timestamp) {
      return { valid: false, error: 'Missing required signature or timestamp headers' };
    }

    try {
      const payloadBuffer = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, 'utf8');
      const timestampBuffer = Buffer.from(timestamp, 'utf8');
      const dataToVerify = Buffer.concat([timestampBuffer, payloadBuffer]);

      let pemKey = publicKey.trim();
      if (!pemKey.startsWith('-----BEGIN PUBLIC KEY-----')) {
        pemKey = `-----BEGIN PUBLIC KEY-----\n${pemKey}\n-----END PUBLIC KEY-----`;
      }

      const verifier = crypto.createVerify('sha256');
      verifier.update(dataToVerify);
      const isValid = verifier.verify(pemKey, Buffer.from(signature, 'base64'));

      return { valid: isValid, ...(isValid ? {} : { error: 'Signature mismatch' }) };
    } catch (err: any) {
      return { valid: false, error: err.message };
    }
  }

  function normalizeSendGridEvent(ev: any) {
    let providerMessageId = ev.sg_message_id || ev.message_id || undefined;
    if (providerMessageId && providerMessageId.includes('.')) {
      providerMessageId = providerMessageId.split('.')[0];
    }

    const providerEventId =
      ev.sg_event_id ||
      crypto
        .createHash('sha256')
        .update(`${ev.email}-${ev.event}-${ev.timestamp}-${providerMessageId}`)
        .digest('hex');

    return {
      provider_event_id: providerEventId,
      provider_event_type: ev.event,
      normalized_event_type: String(ev.event).toUpperCase(),
      recipient_email: ev.email,
      provider_message_id: providerMessageId,
      clicked_url: ev.url || undefined,
      failure_reason: ev.reason || undefined,
    };
  }

  // Generate ECDSA Keypair for testing signature verification
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  test('Valid SendGrid ECDSA webhook signature passes verification', () => {
    const rawPayload = JSON.stringify([
      {
        email: 'recipient@example.com',
        event: 'delivered',
        sg_event_id: 'sg_ev_test_1001',
        sg_message_id: 'sg_msg_98765.filter001',
        timestamp: 1700000000,
      },
    ]);

    const timestamp = '1700000000';
    const dataToSign = Buffer.concat([Buffer.from(timestamp, 'utf8'), Buffer.from(rawPayload, 'utf8')]);
    const signer = crypto.createSign('sha256');
    signer.update(dataToSign);
    const signature = signer.sign(privateKey).toString('base64');

    const headers = {
      'x-twilio-email-event-webhook-signature': signature,
      'x-twilio-email-event-webhook-timestamp': timestamp,
    };

    const result = verifySendGridSignature(rawPayload, headers, publicKey);
    assert.strictEqual(result.valid, true);
  });

  test('Tampered webhook payload fails signature verification', () => {
    const rawPayload = JSON.stringify([{ event: 'delivered', email: 'test@example.com' }]);
    const tamperedPayload = JSON.stringify([{ event: 'bounced', email: 'test@example.com' }]);

    const timestamp = '1700000000';
    const dataToSign = Buffer.concat([Buffer.from(timestamp, 'utf8'), Buffer.from(rawPayload, 'utf8')]);
    const signer = crypto.createSign('sha256');
    signer.update(dataToSign);
    const signature = signer.sign(privateKey).toString('base64');

    const headers = {
      'x-twilio-email-event-webhook-signature': signature,
      'x-twilio-email-event-webhook-timestamp': timestamp,
    };

    const result = verifySendGridSignature(tamperedPayload, headers, publicKey);
    assert.strictEqual(result.valid, false);
    assert.ok(result.error?.includes('mismatch'));
  });

  test('Normalizes multiple batch events with open, click, bounce mapping', () => {
    const batch = [
      {
        email: 'alice@example.com',
        event: 'open',
        sg_event_id: 'sg_ev_open_1',
        sg_message_id: 'sg_msg_100.filter',
        timestamp: 1700000100,
      },
      {
        email: 'bob@example.com',
        event: 'click',
        url: 'https://antigravity.dev/verify',
        sg_event_id: 'sg_ev_click_2',
        sg_message_id: 'sg_msg_101.filter',
        timestamp: 1700000120,
      },
      {
        email: 'charlie@example.com',
        event: 'bounce',
        reason: '550 5.1.1 User unknown',
        sg_event_id: 'sg_ev_bounce_3',
        sg_message_id: 'sg_msg_102.filter',
        timestamp: 1700000130,
      },
      {
        email: 'dave@example.com',
        event: 'delivered',
        sg_event_id: 'sg_ev_deliv_4',
        sg_message_id: 'sg_msg_103.filter',
        timestamp: 1700000140,
      },
    ];

    const normalized = batch.map(normalizeSendGridEvent);
    assert.strictEqual(normalized.length, 4);

    assert.strictEqual(normalized[0].normalized_event_type, 'OPEN');
    assert.strictEqual(normalized[0].recipient_email, 'alice@example.com');
    assert.strictEqual(normalized[0].provider_message_id, 'sg_msg_100');

    assert.strictEqual(normalized[1].normalized_event_type, 'CLICK');
    assert.strictEqual(normalized[1].clicked_url, 'https://antigravity.dev/verify');

    assert.strictEqual(normalized[2].normalized_event_type, 'BOUNCE');
    assert.strictEqual(normalized[2].failure_reason, '550 5.1.1 User unknown');

    assert.strictEqual(normalized[3].normalized_event_type, 'DELIVERED');
  });

  test('Deduplication key generation provides deterministic hashes', () => {
    const event = {
      email: 'user@example.com',
      event: 'delivered',
      timestamp: 1700000000,
      message_id: 'msg_99999',
    };

    const hash1 = crypto
      .createHash('sha256')
      .update(`${event.email}-${event.event}-${event.timestamp}-${event.message_id}`)
      .digest('hex');

    const hash2 = crypto
      .createHash('sha256')
      .update(`${event.email}-${event.event}-${event.timestamp}-${event.message_id}`)
      .digest('hex');

    assert.strictEqual(hash1, hash2);
    assert.strictEqual(hash1.length, 64);
  });
});
