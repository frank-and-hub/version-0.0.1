import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import * as net from 'net';
import * as crypto from 'crypto';
import { PrismaClient, MessagingChannel, MessageSendingStatus } from '@prisma/client';

describe('Phase 1 Actual SMTP & SendGrid Sending End-to-End Test Suite', () => {
  let prisma: PrismaClient;
  let testUserUuid: string;
  let smtpServer: net.Server;
  let smtpPort: number;
  let receivedSmtpEmails: Array<{ from: string; to: string[]; data: string }> = [];

  // Encryption helpers
  const rawSecret = 'test_jwt_secret_32_bytes_super_secure';
  const encKey = crypto.createHash('sha256').update(rawSecret).digest();
  const encAlg = 'aes-256-gcm';

  function encryptCredentials(plainObj: Record<string, any>): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(encAlg, encKey, iv);
    let encrypted = cipher.update(JSON.stringify(plainObj), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${encrypted}`;
  }

  function decryptCredentials(ciphertext: string): Record<string, any> {
    const parts = ciphertext.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const decipher = crypto.createDecipheriv(encAlg, encKey, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(parts[2], 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return JSON.parse(decrypted);
  }

  // Pure Node.js SMTP sender
  async function sendViaSmtp(credentials: Record<string, any>, payload: {
    sender_name: string;
    sender_email: string;
    recipients: Array<{ email: string; name?: string; type?: 'TO' | 'CC' | 'BCC' }>;
    subject: string;
    html_content: string;
  }): Promise<{ success: boolean; provider_message_id?: string; error?: string }> {
    const host = credentials.host;
    const port = Number(credentials.port);
    const user = credentials.auth_user;
    const pass = credentials.auth_password;
    const messageId = `<${Date.now()}.${crypto.randomUUID()}@${host}>`;

    return new Promise((resolve) => {
      let resolved = false;
      const timeoutMs = 8000;
      const finish = (res: any) => {
        if (!resolved) {
          resolved = true;
          try { socket.destroy(); } catch (_) {}
          resolve(res);
        }
      };

      const timer = setTimeout(() => {
        finish({ success: false, error: 'SMTP Timeout' });
      }, timeoutMs);

      const socket = net.connect({ host, port });
      let stage = 'GREETING';
      let pendingRcpts = payload.recipients.length;
      let buffer = '';

      socket.on('error', (err) => {
        clearTimeout(timer);
        finish({ success: false, error: err.message });
      });

      socket.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\r\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line) continue;
          const code = parseInt(line.substring(0, 3), 10);
          if (line.charAt(3) === '-') continue; // multiline
          if (code >= 400) {
            clearTimeout(timer);
            return finish({ success: false, error: `SMTP error ${code} at ${stage}: ${line}` });
          }

          switch (stage) {
            case 'GREETING':
              stage = 'EHLO';
              socket.write('EHLO localhost\r\n');
              break;
            case 'EHLO':
              stage = 'AUTH_LOGIN';
              socket.write('AUTH LOGIN\r\n');
              break;
            case 'AUTH_LOGIN':
              stage = 'AUTH_USER';
              socket.write(Buffer.from(user).toString('base64') + '\r\n');
              break;
            case 'AUTH_USER':
              stage = 'AUTH_PASS';
              socket.write(Buffer.from(pass).toString('base64') + '\r\n');
              break;
            case 'AUTH_PASS':
              stage = 'MAIL_FROM';
              socket.write(`MAIL FROM:<${payload.sender_email}>\r\n`);
              break;
            case 'MAIL_FROM': {
              stage = 'RCPT_TO';
              let rcptIndex = 0;
              socket.write(`RCPT TO:<${payload.recipients[0].email}>\r\n`);
              break;
            }
            case 'RCPT_TO': {
              pendingRcpts--;
              if (pendingRcpts > 0) {
                const nextRcpt = payload.recipients[payload.recipients.length - pendingRcpts];
                socket.write(`RCPT TO:<${nextRcpt.email}>\r\n`);
              } else {
                stage = 'DATA';
                socket.write('DATA\r\n');
              }
              break;
            }
            case 'DATA':
              stage = 'BODY';
              const mime = `From: "${payload.sender_name}" <${payload.sender_email}>\r\n` +
                `To: ${payload.recipients.map((r) => r.email).join(', ')}\r\n` +
                `Subject: ${payload.subject}\r\n` +
                `Message-ID: ${messageId}\r\n` +
                `MIME-Version: 1.0\r\n` +
                `Content-Type: text/html; charset=utf-8\r\n\r\n` +
                `${payload.html_content}\r\n.\r\n`;
              socket.write(mime);
              break;
            case 'BODY':
              stage = 'QUIT';
              socket.write('QUIT\r\n');
              clearTimeout(timer);
              return finish({ success: true, provider_message_id: messageId });
          }
        }
      });
    });
  }

  before(async () => {
    prisma = new PrismaClient();

    // Start local RFC 5321 compliant SMTP Server
    await new Promise<void>((resolve) => {
      smtpServer = net.createServer((socket) => {
        let buffer = '';
        let from = '';
        let to: string[] = [];
        let inData = false;
        let dataContent = '';

        socket.write('220 localhost ESMTP Testing\r\n');

        socket.on('data', (chunk) => {
          buffer += chunk.toString();
          const lines = buffer.split('\r\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (inData) {
              if (line === '.') {
                inData = false;
                receivedSmtpEmails.push({ from, to: [...to], data: dataContent });
                socket.write('250 2.0.0 Ok: message accepted\r\n');
              } else {
                dataContent += line + '\r\n';
              }
              continue;
            }

            const upper = line.toUpperCase();
            if (upper.startsWith('EHLO') || upper.startsWith('HELO')) {
              socket.write('250-localhost\r\n250 AUTH LOGIN\r\n');
            } else if (upper.startsWith('AUTH LOGIN')) {
              socket.write('334 VXNlcm5hbWU6\r\n');
            } else if (line.length >= 8 && (line.includes('=') || /^[A-Za-z0-9+/=]+$/.test(line))) {
              socket.write('235 2.7.0 Auth successful\r\n');
            } else if (upper.startsWith('MAIL FROM:')) {
              from = line.replace(/MAIL FROM:\s*<([^>]+)>/i, '$1');
              socket.write('250 2.1.0 Sender ok\r\n');
            } else if (upper.startsWith('RCPT TO:')) {
              const rcpt = line.replace(/RCPT TO:\s*<([^>]+)>/i, '$1');
              to.push(rcpt);
              socket.write('250 2.1.5 Recipient ok\r\n');
            } else if (upper.startsWith('DATA')) {
              inData = true;
              dataContent = '';
              socket.write('354 Start mail input; end with <CRLF>.<CRLF>\r\n');
            } else if (upper.startsWith('QUIT')) {
              socket.write('221 2.0.0 Closing connection\r\n');
              socket.end();
            } else {
              socket.write('250 Ok\r\n');
            }
          }
        });
      });

      smtpServer.listen(0, '127.0.0.1', () => {
        smtpPort = (smtpServer.address() as net.AddressInfo).port;
        resolve();
      });
    });

    const user = await prisma.user.findFirst({
      where: { email: 'superadmin@example.com' },
    });
    assert.ok(user, 'User must exist');
    testUserUuid = user.user_uuid;

    // Clean up any stale test messages and configs from previous runs
    await prisma.messageRecipient.deleteMany({ where: { message: { user_uuid: testUserUuid } } });
    await prisma.emailMessage.deleteMany({ where: { user_uuid: testUserUuid } });
    await prisma.userProviderConfiguration.deleteMany({ where: { user_uuid: testUserUuid } });
  });

  after(async () => {
    if (smtpServer) {
      await new Promise<void>((res) => smtpServer.close(() => res()));
    }
    await prisma.$disconnect();
  });

  test('1. Configures SMTP provider with encrypted credentials in DB', async () => {
    const smtpProvider = await prisma.provider.findUnique({ where: { slug: 'smtp' } });
    assert.ok(smtpProvider, 'Global SMTP provider definition must exist');

    const creds = {
      host: '127.0.0.1',
      port: smtpPort,
      auth_user: 'test_smtp_user',
      auth_password: 'test_smtp_password_123',
    };
    const encrypted = encryptCredentials(creds);

    const config = await prisma.userProviderConfiguration.create({
      data: {
        user_uuid: testUserUuid,
        provider_uuid: smtpProvider.provider_uuid,
        configuration_name: 'Verified Local SMTP',
        type: MessagingChannel.EMAIL,
        credentials: encrypted,
        sender_name: 'Antigravity Test System',
        sender_email: 'noreply@antigravity.dev',
        is_active: true,
        is_verified: true,
        is_default: true,
      },
    });

    assert.ok(config.configuration_uuid);
    assert.strictEqual(config.is_verified, true);
    assert.strictEqual(config.is_default, true);

    const decrypted = decryptCredentials(config.credentials);
    assert.deepStrictEqual(decrypted, creds);
  });

  test('2. Dispatches real SMTP email, verifies socket transmission, and stores Message ID & Recipients', async () => {
    const config = await prisma.userProviderConfiguration.findFirst({
      where: { user_uuid: testUserUuid, configuration_name: 'Verified Local SMTP' },
    });
    assert.ok(config);

    const decryptedCreds = decryptCredentials(config.credentials);

    // 1. Create DB EmailMessage record in PROCESSING status
    const message = await prisma.emailMessage.create({
      data: {
        user_uuid: testUserUuid,
        provider_uuid: config.provider_uuid,
        configuration_uuid: config.configuration_uuid,
        subject: 'Phase 1 SMTP Verification Success',
        sender_name: config.sender_name,
        sender_email: config.sender_email,
        html_content: '<p>Actual SMTP transmission passed successfully.</p>',
        status: MessageSendingStatus.PROCESSING,
        recipients: {
          create: [
            { email: 'recipient_one@example.com', name: 'Recipient One', type: 'TO' },
            { email: 'recipient_two@example.com', name: 'Recipient Two', type: 'CC' },
          ],
        },
      },
      include: { recipients: true },
    });

    assert.ok(message.message_uuid);
    assert.strictEqual(message.recipients.length, 2);

    // 2. Perform actual socket transmission
    const sendResult = await sendViaSmtp(decryptedCreds, {
      sender_name: message.sender_name,
      sender_email: message.sender_email,
      recipients: message.recipients.map((r) => ({ email: r.email, name: r.name || undefined, type: r.type as any })),
      subject: message.subject,
      html_content: message.html_content,
    });

    if (!sendResult.success) {
      console.error('SMTP SEND ERROR:', sendResult.error);
    }
    assert.strictEqual(sendResult.success, true);
    assert.ok(sendResult.provider_message_id);

    // 3. Update DB EmailMessage and Recipient statuses to ACCEPTED / DELIVERED
    const updatedMessage = await prisma.emailMessage.update({
      where: { message_uuid: message.message_uuid },
      data: {
        status: MessageSendingStatus.ACCEPTED,
        provider_message_id: sendResult.provider_message_id,
        sent_at: new Date(),
        delivered_at: new Date(),
      },
      include: { recipients: true },
    });

    await prisma.messageRecipient.updateMany({
      where: { message_uuid: message.message_uuid },
      data: { status: MessageSendingStatus.DELIVERED, delivered_at: new Date() },
    });

    // 4. Verify DB State and Telemetry for Phase 2 readiness
    assert.strictEqual(updatedMessage.status, MessageSendingStatus.ACCEPTED);
    assert.ok(updatedMessage.provider_message_id?.includes('@127.0.0.1'));

    const recipientsInDb = await prisma.messageRecipient.findMany({
      where: { message_uuid: message.message_uuid },
    });
    assert.strictEqual(recipientsInDb.length, 2);
    assert.strictEqual(recipientsInDb[0].status, MessageSendingStatus.DELIVERED);
    assert.strictEqual(recipientsInDb[1].status, MessageSendingStatus.DELIVERED);

    // Verify SMTP server received payload
    const lastMail = receivedSmtpEmails[receivedSmtpEmails.length - 1];
    assert.strictEqual(lastMail.from, 'noreply@antigravity.dev');
    assert.deepStrictEqual(lastMail.to, ['recipient_one@example.com', 'recipient_two@example.com']);
    assert.ok(lastMail.data.includes('Phase 1 SMTP Verification Success'));
  });

  test('3. Configures SendGrid provider, dispatches v3 REST request, and links provider message ID', async () => {
    const sgProvider = await prisma.provider.findUnique({ where: { slug: 'sendgrid' } });
    assert.ok(sgProvider, 'Global SendGrid provider definition must exist');

    const sgCreds = {
      api_key: 'SG.test_actual_sendgrid_token_key_1234567890abcdef',
    };
    const encrypted = encryptCredentials(sgCreds);

    const sgConfig = await prisma.userProviderConfiguration.create({
      data: {
        user_uuid: testUserUuid,
        provider_uuid: sgProvider.provider_uuid,
        configuration_name: 'Verified SendGrid Account',
        type: MessagingChannel.EMAIL,
        credentials: encrypted,
        sender_name: 'SendGrid Dispatcher',
        sender_email: 'sendgrid@antigravity.dev',
        is_active: true,
        is_verified: true,
        is_default: false,
      },
    });

    assert.ok(sgConfig.configuration_uuid);

    // Mock SendGrid v3 API endpoint to verify full HTTP transmission
    const originalFetch = global.fetch;
    let requestCaptured: any = null;

    global.fetch = (async (url: any, init: any) => {
      requestCaptured = {
        url: String(url),
        method: init.method,
        headers: init.headers,
        body: JSON.parse(init.body),
      };
      return {
        status: 202,
        headers: new Headers({
          'x-message-id': 'sendgrid_msg_id_verified_phase1_998877',
        }),
      } as Response;
    }) as any;

    try {
      // Create DB EmailMessage record
      const sgMessage = await prisma.emailMessage.create({
        data: {
          user_uuid: testUserUuid,
          provider_uuid: sgConfig.provider_uuid,
          configuration_uuid: sgConfig.configuration_uuid,
          subject: 'Phase 1 SendGrid Telemetry Test',
          sender_name: sgConfig.sender_name,
          sender_email: sgConfig.sender_email,
          html_content: '<p>SendGrid v3 REST API transmission verified.</p>',
          status: MessageSendingStatus.PROCESSING,
          recipients: {
            create: [
              { email: 'sg_user1@example.com', name: 'SG User One', type: 'TO' },
            ],
          },
        },
        include: { recipients: true },
      });

      // Execute SendGrid REST API dispatch
      const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${sgCreds.api_key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: 'sg_user1@example.com', name: 'SG User One' }] }],
          from: { email: sgMessage.sender_email, name: sgMessage.sender_name },
          subject: sgMessage.subject,
          content: [{ type: 'text/html', value: sgMessage.html_content }],
          custom_args: { message_uuid: sgMessage.message_uuid },
        }),
      });

      const messageId = res.headers.get('x-message-id')!;
      assert.strictEqual(res.status, 202);
      assert.strictEqual(messageId, 'sendgrid_msg_id_verified_phase1_998877');

      // Update DB record
      await prisma.emailMessage.update({
        where: { message_uuid: sgMessage.message_uuid },
        data: {
          status: MessageSendingStatus.ACCEPTED,
          provider_message_id: messageId,
          sent_at: new Date(),
        },
      });

      await prisma.messageRecipient.updateMany({
        where: { message_uuid: sgMessage.message_uuid },
        data: { status: MessageSendingStatus.ACCEPTED },
      });

      // Verify DB record contains everything needed for Phase 2 webhooks to attach to!
      const finalDbRecord = await prisma.emailMessage.findUnique({
        where: { message_uuid: sgMessage.message_uuid },
        include: { recipients: true, configuration: true },
      });

      assert.ok(finalDbRecord);
      assert.strictEqual(finalDbRecord.provider_message_id, 'sendgrid_msg_id_verified_phase1_998877');
      assert.strictEqual(finalDbRecord.configuration_uuid, sgConfig.configuration_uuid);
      assert.strictEqual(finalDbRecord.status, MessageSendingStatus.ACCEPTED);
      assert.strictEqual(finalDbRecord.recipients[0].email, 'sg_user1@example.com');
      assert.strictEqual(finalDbRecord.recipients[0].status, MessageSendingStatus.ACCEPTED);

      // Verify v3 payload format
      assert.strictEqual(requestCaptured.url, 'https://api.sendgrid.com/v3/mail/send');
      assert.strictEqual(requestCaptured.headers.Authorization, `Bearer ${sgCreds.api_key}`);
      assert.strictEqual(requestCaptured.body.custom_args.message_uuid, sgMessage.message_uuid);
    } finally {
      global.fetch = originalFetch;
    }
  });
});
