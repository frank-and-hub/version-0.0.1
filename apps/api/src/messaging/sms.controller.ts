import {
  Controller,
  Get,
  Post,
  Patch,
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
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import {
  SmsService,
  SendSmsDto,
  SendBulkSmsDto,
  SmsQueryDto,
} from './services/sms.service';
import { TwilioSmsProviderAdapter } from './adapters/twilio-sms.provider';

@ApiTags('Twilio Programmable SMS & Webhooks')
@Controller()
export class SmsController {
  constructor(
    private readonly smsService: SmsService,
    private readonly twilioAdapter: TwilioSmsProviderAdapter,
  ) {}

  // --------------------------------------------------------------------------
  // Public Twilio Webhook Endpoints (Status Callbacks & Inbound SMS)
  // --------------------------------------------------------------------------

  @Post('webhooks/messaging/sms/twilio/:configurationUuid/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Twilio SMS Status Callback Webhook receiver' })
  async handleStatusCallback(
    @Param('configurationUuid') configurationUuid: string,
    @Body() body: any,
    @Headers('x-twilio-signature') signature: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const host = req.headers['x-forwarded-host'] || req.get('host');
    const fullUrl = `${protocol}://${host}${req.originalUrl || req.url}`;

    await this.smsService.handleStatusCallback(configurationUuid, body || {}, signature, fullUrl, 'twilio');
    return res.type('text/xml').send('<Response></Response>');
  }

  @Post('webhooks/messaging/sms/twilio/:configurationUuid/inbound')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Twilio Inbound SMS Webhook receiver (with TCPA opt-out detection)' })
  async handleInboundSms(
    @Param('configurationUuid') configurationUuid: string,
    @Body() body: any,
    @Headers('x-twilio-signature') signature: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const host = req.headers['x-forwarded-host'] || req.get('host');
    const fullUrl = `${protocol}://${host}${req.originalUrl || req.url}`;

    await this.smsService.handleInboundSms(configurationUuid, body || {}, signature, fullUrl, 'twilio');
    return res.type('text/xml').send('<Response></Response>');
  }

  @Post('webhooks/messaging/sms/:providerSlug/:configurationUuid/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Multi-provider SMS Status Callback Webhook receiver' })
  async handleProviderStatusCallback(
    @Param('providerSlug') providerSlug: string,
    @Param('configurationUuid') configurationUuid: string,
    @Body() body: any,
    @Headers('x-twilio-signature') signature: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const host = req.headers['x-forwarded-host'] || req.get('host');
    const fullUrl = `${protocol}://${host}${req.originalUrl || req.url}`;

    await this.smsService.handleStatusCallback(configurationUuid, body || {}, signature, fullUrl, providerSlug);
    return res.json({ success: true, message: 'Status callback processed' });
  }

  @Post('webhooks/messaging/sms/:providerSlug/:configurationUuid/inbound')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Multi-provider Inbound SMS Webhook receiver' })
  async handleProviderInboundSms(
    @Param('providerSlug') providerSlug: string,
    @Param('configurationUuid') configurationUuid: string,
    @Body() body: any,
    @Headers('x-twilio-signature') signature: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const host = req.headers['x-forwarded-host'] || req.get('host');
    const fullUrl = `${protocol}://${host}${req.originalUrl || req.url}`;

    await this.smsService.handleInboundSms(configurationUuid, body || {}, signature, fullUrl, providerSlug);
    return res.json({ success: true, message: 'Inbound SMS processed' });
  }

  // --------------------------------------------------------------------------
  // Authenticated SMS Management Endpoints
  // --------------------------------------------------------------------------

  @Post('messaging/sms/send')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('messaging.manage')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Send or schedule an SMS message' })
  async sendSms(
    @CurrentUser('uuid') userUuid: string,
    @Body() dto: SendSmsDto,
  ) {
    return this.smsService.sendSms(userUuid, dto);
  }

  @Post('messaging/sms/bulk')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('messaging.manage')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Send controlled bulk SMS messages' })
  async sendBulkSms(
    @CurrentUser('uuid') userUuid: string,
    @Body() dto: SendBulkSmsDto,
  ) {
    return this.smsService.sendBulkSms(userUuid, dto);
  }

  @Post('messaging/sms/:uuid/cancel')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('messaging.manage')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancel a scheduled SMS message before dispatch' })
  async cancelScheduled(
    @CurrentUser('uuid') userUuid: string,
    @Param('uuid') messageUuid: string,
  ) {
    return this.smsService.cancelScheduledSms(userUuid, messageUuid);
  }

  @Post('messaging/sms/calculate-segments')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Calculate character count and segments for live preview' })
  calculateSegments(@Body('body') bodyText: string) {
    return this.twilioAdapter.calculateSegments(bodyText || '');
  }

  @Get('messaging/sms')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('messaging.manage')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get SMS message history with pagination and filters' })
  async getMessages(
    @CurrentUser('uuid') userUuid: string,
    @Query() query: SmsQueryDto,
  ) {
    return this.smsService.getSmsMessages(userUuid, query);
  }

  @Get('messaging/sms/stats')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('messaging.manage')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get aggregated SMS platform delivery statistics' })
  async getStats(@CurrentUser('uuid') userUuid: string) {
    return this.smsService.getSmsStats(userUuid);
  }

  @Get('messaging/sms/conversations')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('messaging.manage')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List SMS two-way conversation threads' })
  async getConversations(@CurrentUser('uuid') userUuid: string) {
    return this.smsService.getConversations(userUuid);
  }

  @Get('messaging/sms/conversations/:uuid/messages')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('messaging.manage')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List message history inside an SMS conversation' })
  async getConversationMessages(
    @CurrentUser('uuid') userUuid: string,
    @Param('uuid') conversationUuid: string,
  ) {
    return this.smsService.getConversationMessages(userUuid, conversationUuid);
  }

  // --------------------------------------------------------------------------
  // Opt-Out & Suppression List
  // --------------------------------------------------------------------------

  @Get('messaging/sms/opt-outs')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('messaging.manage')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all opted-out phone numbers' })
  async getOptOuts(@CurrentUser('uuid') userUuid: string) {
    return this.smsService.getOptOuts(userUuid);
  }

  @Post('messaging/sms/opt-outs')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('messaging.manage')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Manually add a phone number to the opt-out list' })
  async addOptOut(
    @CurrentUser('uuid') userUuid: string,
    @Body('phone') phone: string,
    @Body('reason') reason?: string,
  ) {
    return this.smsService.addOptOut(userUuid, phone, reason);
  }

  @Delete('messaging/sms/opt-outs/:phone')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('messaging.manage')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove a phone number from opt-out list (opt back in)' })
  async removeOptOut(
    @CurrentUser('uuid') userUuid: string,
    @Param('phone') phone: string,
  ) {
    return this.smsService.removeOptOut(userUuid, phone);
  }

  // --------------------------------------------------------------------------
  // SMS Templates Management
  // --------------------------------------------------------------------------

  @Get('messaging/sms/templates')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('messaging.manage')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List saved SMS templates' })
  async getTemplates(@CurrentUser('uuid') userUuid: string) {
    return this.smsService.getTemplates(userUuid);
  }

  @Post('messaging/sms/templates')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('messaging.manage')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new SMS template' })
  async createTemplate(
    @CurrentUser('uuid') userUuid: string,
    @Body() dto: { name: string; description?: string; body: string; variables?: string[] },
  ) {
    return this.smsService.createTemplate(userUuid, dto);
  }

  @Patch('messaging/sms/templates/:uuid')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('messaging.manage')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update an existing SMS template' })
  async updateTemplate(
    @CurrentUser('uuid') userUuid: string,
    @Param('uuid') templateUuid: string,
    @Body() dto: { name?: string; description?: string; body?: string },
  ) {
    return this.smsService.updateTemplate(userUuid, templateUuid, dto);
  }

  @Delete('messaging/sms/templates/:uuid')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('messaging.manage')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete an SMS template' })
  async deleteTemplate(
    @CurrentUser('uuid') userUuid: string,
    @Param('uuid') templateUuid: string,
  ) {
    return this.smsService.deleteTemplate(userUuid, templateUuid);
  }
}
