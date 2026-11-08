import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { ValkeyService } from '../../../cache/valkey.service';
import { WebhookRegistryService } from './webhook-registry.service';
import { WebhookEventProcessorService } from './webhook-event-processor.service';
import { WebhookProcessingStatus, MessagingChannel } from '@prisma/client';

export interface IngestWebhookParams {
  configurationUuid: string;
  rawBody: string | Buffer;
  parsedBody: any;
  headers: Record<string, string | string[] | undefined>;
}

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly valkeyService: ValkeyService,
    private readonly registry: WebhookRegistryService,
    private readonly eventProcessor: WebhookEventProcessorService,
  ) {}

  /**
   * Primary ingestion handler for incoming HTTP POST webhooks
   */
  async ingestWebhook({
    configurationUuid,
    rawBody,
    parsedBody,
    headers,
  }: IngestWebhookParams) {
    // 1. Resolve configuration and active webhook endpoint
    const config = await this.prisma.userProviderConfiguration.findFirst({
      where: {
        configuration_uuid: configurationUuid,
        deleted_at: null,
      },
      include: {
        provider: true,
        webhook_endpoints: {
          where: { is_active: true, deleted_at: null },
        },
      },
    });

    if (!config) {
      throw new NotFoundException('Unknown or deactivated webhook configuration endpoint');
    }

    const endpoint = config.webhook_endpoints[0] || null;
    if (endpoint && !endpoint.is_active) {
      throw new BadRequestException('Webhook endpoint is currently disabled');
    }

    // 2. Resolve adapter
    const adapter = this.registry.getAdapter(config.provider.slug);

    // 3. Signature verification (if public key/secret is registered)
    const verificationSecret = endpoint?.verification_secret || undefined;
    const verification = await adapter.verifySignature(rawBody, headers, verificationSecret);

    if (!verification.valid) {
      this.logger.warn(
        `Webhook signature check failed for configuration ${configurationUuid}: ${verification.error}`,
      );
      if (endpoint) {
        await this.prisma.providerWebhookEndpoint.update({
          where: { endpoint_uuid: endpoint.endpoint_uuid },
          data: {
            failed_events_count: { increment: 1 },
            last_received_at: new Date(),
          },
        });
      }
      throw new BadRequestException(`Webhook signature verification failed: ${verification.error}`);
    }

    // 4. Normalize payload into standard NormalizedWebhookEvent array
    const normalizedEvents = adapter.normalizePayload(parsedBody);

    this.logger.log(
      `Ingested ${normalizedEvents.length} normalized webhook events for configuration ${configurationUuid} (${config.provider.slug})`,
    );

    let acceptedCount = 0;
    let duplicateCount = 0;

    // 5. Store & process events (with deduplication)
    for (const event of normalizedEvents) {
      // Deduplication check: check in Valkey for instant idempotency + unique constraint in DB
      const dedupKey = `webhook:dedup:${configurationUuid}:${event.provider_event_id}`;
      const isDuplicate = await this.valkeyService.exists(dedupKey);

      if (isDuplicate) {
        this.logger.debug(`Skipping duplicate event ${event.provider_event_id}`);
        duplicateCount++;
        continue;
      }

      // Check in DB for existence
      const existingInDb = await this.prisma.providerWebhookEvent.findFirst({
        where: {
          provider_configuration_uuid: configurationUuid,
          provider_event_id: event.provider_event_id,
        },
      });

      if (existingInDb) {
        duplicateCount++;
        await this.valkeyService.set(dedupKey, 1, 86400); // Cache for 24h
        continue;
      }

      // Create ProviderWebhookEvent record
      const eventRecord = await this.prisma.providerWebhookEvent.create({
        data: {
          user_uuid: config.user_uuid,
          provider_configuration_uuid: configurationUuid,
          webhook_endpoint_uuid: endpoint?.endpoint_uuid || null,
          provider_event_id: event.provider_event_id,
          provider_event_type: event.provider_event_type,
          normalized_event_type: event.normalized_event_type,
          payload: event.raw_payload,
          processing_status: WebhookProcessingStatus.PENDING,
          received_at: new Date(),
        },
      });

      await this.valkeyService.set(dedupKey, 1, 86400);
      acceptedCount++;

      // Process event asynchronously/immediately
      await this.eventProcessor.processEvent(
        eventRecord.event_uuid,
        event,
        config.user_uuid,
        configurationUuid,
      );
    }

    // 6. Update endpoint stats
    if (endpoint) {
      await this.prisma.providerWebhookEndpoint.update({
        where: { endpoint_uuid: endpoint.endpoint_uuid },
        data: {
          total_events_received: { increment: normalizedEvents.length },
          last_received_at: new Date(),
          last_processed_at: new Date(),
        },
      });
    }

    return {
      success: true,
      received: normalizedEvents.length,
      accepted: acceptedCount,
      duplicates: duplicateCount,
    };
  }

  /**
   * List webhook events with filters and pagination for UI
   */
  async listWebhookEvents(
    userUuid: string,
    query: {
      page?: number;
      limit?: number;
      configuration_uuid?: string;
      channel?: MessagingChannel;
      status?: WebhookProcessingStatus;
      event_type?: string;
      search?: string;
    },
  ) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const where: any = {
      user_uuid: userUuid,
      ...(query.configuration_uuid ? { provider_configuration_uuid: query.configuration_uuid } : {}),
      ...(query.channel ? { provider_configuration: { type: query.channel } } : {}),
      ...(query.status ? { processing_status: query.status } : {}),
      ...(query.event_type ? { normalized_event_type: query.event_type as any } : {}),
      ...(query.search
        ? {
            OR: [
              { provider_event_id: { contains: query.search, mode: 'insensitive' } },
              { provider_event_type: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.providerWebhookEvent.findMany({
        where,
        skip,
        take: limit,
        orderBy: { received_at: 'desc' },
        include: {
          provider_configuration: {
            include: { provider: true },
          },
        },
      }),
      this.prisma.providerWebhookEvent.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Retry a failed webhook event
   */
  async retryFailedEvent(userUuid: string, eventUuid: string) {
    const event = await this.prisma.providerWebhookEvent.findFirst({
      where: { event_uuid: eventUuid, user_uuid: userUuid },
      include: {
        provider_configuration: { include: { provider: true } },
      },
    });

    if (!event) {
      throw new NotFoundException('Webhook event record not found');
    }

    const adapter = this.registry.getAdapter(event.provider_configuration.provider.slug);
    const normalizedList = adapter.normalizePayload(event.payload);
    const targetEvent = normalizedList[0];

    if (!targetEvent) {
      throw new BadRequestException('Could not re-parse event payload');
    }

    return this.eventProcessor.processEvent(
      event.event_uuid,
      targetEvent,
      userUuid,
      event.provider_configuration_uuid,
    );
  }
}
