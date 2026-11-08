import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
  Res,
  Headers,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import {
  WhatsAppService,
  SendWhatsAppMessageDto,
  CreateWhatsAppTemplateDto,
  UpdateWhatsAppTemplateDto,
} from './services/whatsapp.service';

@ApiTags('Meta WhatsApp Business Messaging & Webhooks')
@Controller()
export class WhatsAppController {
  constructor(private readonly whatsappService: WhatsAppService) {}

  // --------------------------------------------------------------------------
  // Public Meta WhatsApp Cloud API Webhook Endpoints
  // --------------------------------------------------------------------------

  /**
   * Meta Webhook Verification Handshake (GET).
   * Meta sends hub.mode, hub.verify_token, and hub.challenge.
   */
  @Get('webhooks/messaging/whatsapp/:configurationUuid')
  @ApiOperation({ summary: 'Meta Webhook GET verification handshake' })
  async verifyWebhook(
    @Param('configurationUuid') configurationUuid: string,
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response,
  ) {
    const verifiedChallenge = await this.whatsappService.handleWebhookChallenge(
      configurationUuid,
      mode,
      token,
      challenge,
    );
    // Meta requires the response to be HTTP 200 with the exact challenge value as plain text
    res.setHeader('Content-Type', 'text/plain');
    return res.status(HttpStatus.OK).send(verifiedChallenge);
  }

  /**
   * Meta Webhook Inbound Message & Delivery Event Ingestion (POST).
   * Cryptographically verified with HMAC-SHA256 (X-Hub-Signature-256).
   */
  @Post('webhooks/messaging/whatsapp/:configurationUuid')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Meta Webhook POST event receiver' })
  async handleWebhookEvent(
    @Param('configurationUuid') configurationUuid: string,
    @Headers('x-hub-signature-256') signature: string | undefined,
    @Body() payload: any,
    @Req() req: Request,
  ) {
    const rawBody = (req as any).rawBody || JSON.stringify(payload);
    return this.whatsappService.handleWebhookEvent(configurationUuid, rawBody, signature, payload);
  }

  // --------------------------------------------------------------------------
  // Authenticated Business Messaging Endpoints
  // --------------------------------------------------------------------------

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('messaging/whatsapp/conversations')
  @ApiOperation({ summary: 'List customer WhatsApp conversations' })
  async listConversations(
    @CurrentUser('uuid') userUuid: string,
    @Query('configuration_uuid') configurationUuid?: string,
  ) {
    return this.whatsappService.listConversations(userUuid, configurationUuid);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('messaging/whatsapp/conversations/:conversationUuid/messages')
  @ApiOperation({ summary: 'Get chronological message history for a conversation' })
  async getConversationMessages(
    @CurrentUser('uuid') userUuid: string,
    @Param('conversationUuid') conversationUuid: string,
  ) {
    return this.whatsappService.getConversationMessages(userUuid, conversationUuid);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post('messaging/whatsapp/messages/send')
  @ApiOperation({ summary: 'Send an outbound WhatsApp message (Session or Template)' })
  async sendMessage(
    @CurrentUser('uuid') userUuid: string,
    @Body() dto: SendWhatsAppMessageDto,
  ) {
    return this.whatsappService.sendMessage(userUuid, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('messaging/whatsapp/session-check')
  @ApiOperation({ summary: 'Check 24-hour customer service window status for a contact' })
  async checkSessionWindow(
    @Query('contact') contact: string,
    @Query('configuration_uuid') configurationUuid: string,
  ) {
    return this.whatsappService.checkSessionWindow(contact, configurationUuid);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('messaging/whatsapp/templates')
  @ApiOperation({ summary: 'List synced WhatsApp templates' })
  async listTemplates(
    @CurrentUser('uuid') userUuid: string,
    @Query('configuration_uuid') configurationUuid?: string,
  ) {
    return this.whatsappService.listTemplates(userUuid, configurationUuid);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post('messaging/whatsapp/templates')
  @ApiOperation({ summary: 'Create a custom WhatsApp message template' })
  async createTemplate(
    @CurrentUser('uuid') userUuid: string,
    @Body() dto: CreateWhatsAppTemplateDto,
  ) {
    return this.whatsappService.createTemplate(userUuid, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Put('messaging/whatsapp/templates/:templateUuid')
  @ApiOperation({ summary: 'Update an existing WhatsApp message template' })
  async updateTemplate(
    @CurrentUser('uuid') userUuid: string,
    @Param('templateUuid') templateUuid: string,
    @Body() dto: UpdateWhatsAppTemplateDto,
  ) {
    return this.whatsappService.updateTemplate(userUuid, templateUuid, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Delete('messaging/whatsapp/templates/:templateUuid')
  @ApiOperation({ summary: 'Delete a WhatsApp message template' })
  async deleteTemplate(
    @CurrentUser('uuid') userUuid: string,
    @Param('templateUuid') templateUuid: string,
  ) {
    return this.whatsappService.deleteTemplate(userUuid, templateUuid);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post('messaging/whatsapp/templates/sync/:configurationUuid')
  @ApiOperation({ summary: 'Sync templates from Meta Cloud API into database' })
  async syncTemplates(
    @CurrentUser('uuid') userUuid: string,
    @Param('configurationUuid') configurationUuid: string,
  ) {
    return this.whatsappService.syncTemplates(userUuid, configurationUuid);
  }
}
