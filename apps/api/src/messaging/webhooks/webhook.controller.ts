import {
  Controller,
  Post,
  Get,
  Put,
  Param,
  Body,
  Query,
  Headers,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { WebhookService } from './services/webhook.service';
import { WebhookEndpointService } from './services/webhook-endpoint.service';
import { EmailAnalyticsService } from './services/email-analytics.service';
import { WebhookProcessingStatus } from '@prisma/client';

@ApiTags('Messaging Webhooks & Analytics')
@Controller()
export class WebhookController {
  constructor(
    private readonly webhookService: WebhookService,
    private readonly endpointService: WebhookEndpointService,
    private readonly analyticsService: EmailAnalyticsService,
  ) {}

  /**
   * Public HTTP POST endpoint for receiving email provider webhooks.
   * Path: /api/webhooks/messaging/email/:configurationUuid
   * Validated via cryptographic provider signatures.
   */
  @Post('webhooks/messaging/email/:configurationUuid')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Public webhook receiver for email providers (SendGrid, etc.)' })
  async handleIncomingWebhook(
    @Param('configurationUuid') configurationUuid: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() parsedBody: any,
    @Req() req: Request,
  ) {
    const rawBody = (req as any).rawBody || JSON.stringify(parsedBody);
    return this.webhookService.ingestWebhook({
      configurationUuid,
      rawBody,
      parsedBody,
      headers,
    });
  }

  // --------------------------------------------------------------------------
  // Authenticated Webhook Endpoint Management
  // --------------------------------------------------------------------------

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('messaging/webhook-endpoints/:configurationUuid')
  @ApiOperation({ summary: 'Get or generate dynamic webhook endpoint for a provider configuration' })
  async getEndpoint(
    @CurrentUser('uuid') userUuid: string,
    @Param('configurationUuid') configurationUuid: string,
    @Req() req: Request,
  ) {
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const host = req.get('host') || 'localhost:4000';
    const baseUrl = `${protocol}://${host}`;
    return this.endpointService.getOrCreateEndpoint(userUuid, configurationUuid, baseUrl);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Put('messaging/webhook-endpoints/:configurationUuid/secret')
  @ApiOperation({ summary: 'Save public verification key / signing secret for webhook verification' })
  async setEndpointSecret(
    @CurrentUser('uuid') userUuid: string,
    @Param('configurationUuid') configurationUuid: string,
    @Body('secret') secret: string,
  ) {
    return this.endpointService.setVerificationSecret(userUuid, configurationUuid, secret);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Put('messaging/webhook-endpoints/:configurationUuid/status')
  @ApiOperation({ summary: 'Enable or disable a webhook endpoint' })
  async toggleEndpointStatus(
    @CurrentUser('uuid') userUuid: string,
    @Param('configurationUuid') configurationUuid: string,
    @Body('is_active') isActive: boolean,
  ) {
    return this.endpointService.toggleEndpointStatus(userUuid, configurationUuid, isActive);
  }

  // --------------------------------------------------------------------------
  // Authenticated Webhook Monitoring & Event Inspection
  // --------------------------------------------------------------------------

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('messaging/webhook-events')
  @ApiOperation({ summary: 'List tenant-isolated webhook events log with filtering and pagination' })
  async listWebhookEvents(
    @CurrentUser('uuid') userUuid: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('configuration_uuid') configurationUuid?: string,
    @Query('status') status?: WebhookProcessingStatus,
    @Query('event_type') eventType?: string,
    @Query('search') search?: string,
  ) {
    return this.webhookService.listWebhookEvents(userUuid, {
      page,
      limit,
      configuration_uuid: configurationUuid,
      status,
      event_type: eventType,
      search,
    });
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post('messaging/webhook-events/:eventUuid/retry')
  @ApiOperation({ summary: 'Retry processing a failed webhook event' })
  async retryWebhookEvent(
    @CurrentUser('uuid') userUuid: string,
    @Param('eventUuid') eventUuid: string,
  ) {
    return this.webhookService.retryFailedEvent(userUuid, eventUuid);
  }

  // --------------------------------------------------------------------------
  // Authenticated Message Details Timeline & Aggregated Analytics
  // --------------------------------------------------------------------------

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('messaging/emails/:messageUuid/details')
  @ApiOperation({ summary: 'Get full message info, recipient outcomes, engagement metrics, and event timeline' })
  async getMessageDetails(
    @CurrentUser('uuid') userUuid: string,
    @Param('messageUuid') messageUuid: string,
  ) {
    return this.analyticsService.getMessageDetailsAndTimeline(userUuid, messageUuid);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('messaging/analytics')
  @ApiOperation({ summary: 'Get detailed email analytics counters, rates, and 7-day time series' })
  async getAnalytics(
    @CurrentUser('uuid') userUuid: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('provider_configuration_uuid') configurationUuid?: string,
    @Query('provider_slug') providerSlug?: string,
  ) {
    return this.analyticsService.getAnalytics(userUuid, {
      startDate,
      endDate,
      provider_configuration_uuid: configurationUuid,
      provider_slug: providerSlug,
    });
  }
}
