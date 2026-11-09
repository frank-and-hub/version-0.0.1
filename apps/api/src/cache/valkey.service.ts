import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class ValkeyService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ValkeyService.name);
  private client: Redis;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const host = this.configService.get<string>('valkey.host', 'localhost');
    const port = this.configService.get<number>('valkey.port', 6379);
    const password = this.configService.get<string>('valkey.password');

    this.client = new Redis({
      host,
      port,
      password: password || undefined,
      lazyConnect: true,
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => Math.min(times * 100, 3000),
    });

    this.client.connect()
      .then(() => this.logger.log(`Connected to Valkey/Redis on ${host}:${port}`))
      .catch((err: any) => this.logger.warn(`Valkey connection deferred: ${err?.message || err}`));

    this.client.on('error', (err: any) => {
      this.logger.error(`Valkey error: ${err?.message || err}`);
    });
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.quit();
      this.logger.log('Disconnected from Valkey');
    }
  }

  async ping(): Promise<string> {
    return this.client.ping();
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    try {
      const data = await this.client.get(key);
      if (!data) return null;
      return JSON.parse(data) as T;
    } catch {
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      if (ttlSeconds && ttlSeconds > 0) {
        await this.client.set(key, serialized, 'EX', ttlSeconds);
      } else {
        await this.client.set(key, serialized);
      }
    } catch (err: any) {
      this.logger.error(`Valkey set error for key ${key}: ${err?.message || err}`);
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch (err: any) {
      this.logger.error(`Valkey del error for key ${key}: ${err?.message || err}`);
    }
  }

  async delByPattern(pattern: string): Promise<void> {
    try {
      const keys = await this.client.keys(pattern);
      if (keys && keys.length > 0) {
        await this.client.del(...keys);
      }
    } catch (err: any) {
      this.logger.error(`Valkey delByPattern error for pattern ${pattern}: ${err?.message || err}`);
    }
  }

  async publish(channel: string, message: string): Promise<number> {
    try {
      return await this.client.publish(channel, message);
    } catch (err: any) {
      this.logger.error(`Valkey publish error on channel ${channel}: ${err?.message || err}`);
      return 0;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const count = await this.client.exists(key);
      return count > 0;
    } catch {
      return false;
    }
  }

  // Direct client access for advanced operations (e.g., queues, pipelines)
  getClient(): Redis {
    return this.client;
  }

  // Fast token revocation support
  async blacklistToken(tokenId: string, ttlSeconds = 900): Promise<void> {
    await this.set(`blacklist:token:${tokenId}`, { revokedAt: new Date().toISOString() }, ttlSeconds);
  }

  async isTokenBlacklisted(tokenId: string): Promise<boolean> {
    return this.exists(`blacklist:token:${tokenId}`);
  }

  // Sliding window / fixed window rate limiter
  async checkRateLimit(key: string, maxRequests = 60, windowSeconds = 60) {
    const rateLimitKey = `ratelimit:${key}`;
    try {
      const current = await this.client.incr(rateLimitKey);
      if (current === 1) {
        await this.client.expire(rateLimitKey, windowSeconds);
      }
      const ttl = await this.client.ttl(rateLimitKey);
      const remaining = Math.max(0, maxRequests - current);
      return {
        allowed: current <= maxRequests,
        remaining,
        resetTime: ttl > 0 ? ttl : windowSeconds,
      };
    } catch {
      // Fail-open if cache is temporarily unreachable
      return { allowed: true, remaining: maxRequests, resetTime: windowSeconds };
    }
  }
}
