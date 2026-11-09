import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { MessagingChannel, MessageSendingStatus } from '@prisma/client';
import { ProviderConfigurationService } from './services/provider-configuration.service';
import { EmailTemplateService } from './services/email-template.service';
import { EmailSendingService } from './services/email-sending.service';
import {
  CreateConfigurationDto,
  UpdateConfigurationDto,
  TestAdHocConfigurationDto,
  CreateTemplateDto,
  UpdateTemplateDto,
  SendEmailRequestDto,
} from './dto/messaging.dto';

@ApiTags('Messaging')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@RequirePermissions('messaging.manage')
@Controller('messaging')
export class MessagingController {
  constructor(
    private readonly configService: ProviderConfigurationService,
    private readonly templateService: EmailTemplateService,
    private readonly sendingService: EmailSendingService,
  ) {}

  // -------------------------------------------------------------
  // Provider Catalog & Dynamic Configuration Schemas
  // -------------------------------------------------------------

  @Get('providers')
  @ApiOperation({ summary: 'List all global supported providers (SMTP, SendGrid, etc.)' })
  async getProviders(@Query('type') type?: MessagingChannel) {
    return this.configService.listGlobalProviders(type);
  }

  @Get('providers/:uuid/schema')
  @ApiOperation({ summary: 'Get provider configuration schema and dynamic form fields' })
  async getProviderSchema(@Param('uuid') identifier: string) {
    return this.configService.getProviderSchema(identifier);
  }

  // -------------------------------------------------------------
  // User Provider Configurations (dual support for /configurations and /provider-configurations)
  // -------------------------------------------------------------

  @Get('configurations')
  @ApiOperation({ summary: 'List configurations belonging to the authenticated user' })
  async getConfigurations(@CurrentUser('uuid') userUuid: string, @Query('type') type?: MessagingChannel) {
    return this.configService.listUserConfigurations(userUuid, type);
  }

  @Get('provider-configurations')
  @ApiOperation({ summary: 'Alias: List configurations belonging to the authenticated user' })
  async getProviderConfigurations(@CurrentUser('uuid') userUuid: string, @Query('type') type?: MessagingChannel) {
    return this.configService.listUserConfigurations(userUuid, type);
  }

  @Get('configurations/:uuid')
  @ApiOperation({ summary: 'Get a specific configuration by UUID' })
  async getConfiguration(@CurrentUser('uuid') userUuid: string, @Param('uuid') configUuid: string) {
    return this.configService.getUserConfiguration(userUuid, configUuid);
  }

  @Get('provider-configurations/:uuid')
  @ApiOperation({ summary: 'Alias: Get a specific configuration by UUID' })
  async getProviderConfiguration(@CurrentUser('uuid') userUuid: string, @Param('uuid') configUuid: string) {
    return this.configService.getUserConfiguration(userUuid, configUuid);
  }

  @Post('configurations')
  @ApiOperation({ summary: 'Create and encrypt a new provider configuration' })
  async createConfiguration(
    @CurrentUser('uuid') userUuid: string,
    @Body() dto: CreateConfigurationDto,
  ) {
    return this.configService.createConfiguration(userUuid, dto);
  }

  @Post('provider-configurations')
  @ApiOperation({ summary: 'Alias: Create and encrypt a new provider configuration' })
  async createProviderConfiguration(
    @CurrentUser('uuid') userUuid: string,
    @Body() dto: CreateConfigurationDto,
  ) {
    return this.configService.createConfiguration(userUuid, dto);
  }

  @Put('configurations/:uuid')
  @ApiOperation({ summary: 'Update an existing provider configuration' })
  async updateConfiguration(
    @CurrentUser('uuid') userUuid: string,
    @Param('uuid') configUuid: string,
    @Body() dto: UpdateConfigurationDto,
  ) {
    return this.configService.updateConfiguration(userUuid, configUuid, dto);
  }

  @Patch('provider-configurations/:uuid')
  @ApiOperation({ summary: 'Update an existing provider configuration (PATCH)' })
  async patchProviderConfiguration(
    @CurrentUser('uuid') userUuid: string,
    @Param('uuid') configUuid: string,
    @Body() dto: UpdateConfigurationDto,
  ) {
    return this.configService.updateConfiguration(userUuid, configUuid, dto);
  }

  @Post('configurations/:uuid/default')
  @ApiOperation({ summary: 'Set a configuration as user default for its channel' })
  async setConfigurationDefault(
    @CurrentUser('uuid') userUuid: string,
    @Param('uuid') configUuid: string,
  ) {
    return this.configService.setAsDefault(userUuid, configUuid);
  }

  @Patch('provider-configurations/:uuid/default')
  @ApiOperation({ summary: 'Alias: Set a configuration as user default for its channel (PATCH)' })
  async patchProviderConfigurationDefault(
    @CurrentUser('uuid') userUuid: string,
    @Param('uuid') configUuid: string,
  ) {
    return this.configService.setAsDefault(userUuid, configUuid);
  }

  @Post('configurations/:uuid/test')
  @ApiOperation({ summary: 'Test saved connection / authenticate credentials with provider' })
  async testSavedConfiguration(
    @CurrentUser('uuid') userUuid: string,
    @Param('uuid') configUuid: string,
  ) {
    return this.configService.testConfiguration(userUuid, configUuid);
  }

  @Post('provider-configurations/test')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Test ad-hoc provider credentials without saving to database' })
  async testAdHocConfiguration(
    @Body() dto: TestAdHocConfigurationDto,
  ) {
    return this.configService.testAdHocConfiguration(dto.provider_slug, dto.credentials);
  }

  @Delete('configurations/:uuid')
  @ApiOperation({ summary: 'Soft delete a user provider configuration' })
  async deleteConfiguration(
    @CurrentUser('uuid') userUuid: string,
    @Param('uuid') configUuid: string,
  ) {
    return this.configService.deleteConfiguration(userUuid, configUuid);
  }

  @Delete('provider-configurations/:uuid')
  @ApiOperation({ summary: 'Alias: Soft delete a user provider configuration' })
  async deleteProviderConfiguration(
    @CurrentUser('uuid') userUuid: string,
    @Param('uuid') configUuid: string,
  ) {
    return this.configService.deleteConfiguration(userUuid, configUuid);
  }

  // -------------------------------------------------------------
  // Email Templates
  // -------------------------------------------------------------

  @Get('templates')
  @ApiOperation({ summary: 'List email templates available to user (user + system)' })
  async getTemplates(@CurrentUser('uuid') userUuid: string, @Query('search') search?: string) {
    return this.templateService.listTemplates(userUuid, search);
  }

  @Get('templates/:uuid')
  @ApiOperation({ summary: 'Get a single template by UUID' })
  async getTemplate(@CurrentUser('uuid') userUuid: string, @Param('uuid') templateUuid: string) {
    return this.templateService.getTemplate(userUuid, templateUuid);
  }

  @Post('templates')
  @ApiOperation({ summary: 'Create a new custom email template' })
  async createTemplate(@CurrentUser('uuid') userUuid: string, @Body() dto: CreateTemplateDto) {
    return this.templateService.createTemplate(userUuid, dto);
  }

  @Put('templates/:uuid')
  @ApiOperation({ summary: 'Update an existing custom template' })
  async updateTemplate(
    @CurrentUser('uuid') userUuid: string,
    @Param('uuid') templateUuid: string,
    @Body() dto: UpdateTemplateDto,
  ) {
    return this.templateService.updateTemplate(userUuid, templateUuid, dto);
  }

  @Post('templates/:uuid/duplicate')
  @ApiOperation({ summary: 'Duplicate an existing template' })
  async duplicateTemplate(@CurrentUser('uuid') userUuid: string, @Param('uuid') templateUuid: string) {
    return this.templateService.duplicateTemplate(userUuid, templateUuid);
  }

  @Delete('templates/:uuid')
  @ApiOperation({ summary: 'Soft delete a custom template' })
  async deleteTemplate(@CurrentUser('uuid') userUuid: string, @Param('uuid') templateUuid: string) {
    return this.templateService.deleteTemplate(userUuid, templateUuid);
  }

  // -------------------------------------------------------------
  // Email Sending & Delivery History
  // -------------------------------------------------------------

  @Post('emails/send')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send email immediately or enqueue for background dispatch' })
  async sendEmail(@CurrentUser('uuid') userUuid: string, @Body() dto: SendEmailRequestDto) {
    return this.sendingService.prepareAndSendEmail(userUuid, dto);
  }

  @Get('emails')
  @ApiOperation({ summary: 'List user email sending history with pagination and status filter' })
  async listEmails(
    @CurrentUser('uuid') userUuid: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: MessageSendingStatus,
    @Query('search') search?: string,
  ) {
    return this.sendingService.listEmailHistory(userUuid, { page, limit, status, search });
  }

  @Get('emails/:uuid')
  @ApiOperation({ summary: 'Get detailed log for a specific sent email' })
  async getEmailDetails(@CurrentUser('uuid') userUuid: string, @Param('uuid') messageUuid: string) {
    return this.sendingService.getEmailDetails(userUuid, messageUuid);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get statistics overview: total sent, delivered, failed, queue size' })
  async getStats(@CurrentUser('uuid') userUuid: string) {
    return this.sendingService.getMessagingStats(userUuid);
  }
}
