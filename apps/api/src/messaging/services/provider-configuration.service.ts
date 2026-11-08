import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ProviderEncryptionService } from './provider-encryption.service';
import { ProviderRegistryService } from './provider-registry.service';
import { MessagingChannel } from '@prisma/client';

export interface CreateProviderConfigDto {
  provider_slug: string;
  configuration_name: string;
  credentials: Record<string, any>;
  sender_name?: string;
  sender_email?: string;
  sender_phone?: string;
  reply_to?: string;
  is_default?: boolean;
}

export interface UpdateProviderConfigDto {
  configuration_name?: string;
  credentials?: Record<string, any>;
  sender_name?: string;
  sender_email?: string;
  sender_phone?: string;
  reply_to?: string;
  is_active?: boolean;
  is_default?: boolean;
}

@Injectable()
export class ProviderConfigurationService {
  private readonly logger = new Logger(ProviderConfigurationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: ProviderEncryptionService,
    private readonly registry: ProviderRegistryService,
  ) {}

  async listGlobalProviders(type?: MessagingChannel) {
    return this.prisma.provider.findMany({
      where: {
        deleted_at: null,
        ...(type ? { type } : {}),
      },
      orderBy: [{ is_default: 'desc' }, { name: 'asc' }],
    });
  }

  async getGlobalProviderBySlugOrUuid(identifier: string) {
    const provider = await this.prisma.provider.findFirst({
      where: {
        deleted_at: null,
        OR: [
          { slug: identifier.toLowerCase() },
          { provider_uuid: identifier },
        ],
      },
    });
    if (!provider) {
      throw new NotFoundException(`Provider '${identifier}' not found`);
    }
    return provider;
  }

  async getProviderSchema(identifier: string) {
    const provider = await this.getGlobalProviderBySlugOrUuid(identifier);
    return {
      provider_uuid: provider.provider_uuid,
      name: provider.name,
      slug: provider.slug,
      type: provider.type,
      status: provider.status,
      description: provider.description,
      logo: provider.logo,
      documentation_url: provider.documentation_url,
      configuration_schema: provider.configuration_schema,
      form_fields: provider.form_fields,
      is_operational: this.registry.hasAdapter(provider.slug),
    };
  }

  async listUserConfigurations(userUuid: string, type?: MessagingChannel) {
    const configs = await this.prisma.userProviderConfiguration.findMany({
      where: {
        user_uuid: userUuid,
        deleted_at: null,
        ...(type ? { type } : {}),
      },
      include: {
        provider: {
          select: {
            provider_uuid: true,
            name: true,
            slug: true,
            type: true,
            logo: true,
            status: true,
          },
        },
      },
      orderBy: [{ is_default: 'desc' }, { created_at: 'desc' }],
    });

    return configs.map((c) => this.sanitizeConfig(c));
  }

  async getUserConfiguration(userUuid: string, configUuid: string) {
    const config = await this.prisma.userProviderConfiguration.findFirst({
      where: {
        configuration_uuid: configUuid,
        user_uuid: userUuid,
        deleted_at: null,
      },
      include: {
        provider: true,
      },
    });

    if (!config) {
      throw new NotFoundException(`Provider configuration not found`);
    }

    return this.sanitizeConfig(config);
  }

  async testAdHocConfiguration(providerIdentifier: string, credentials: Record<string, any>) {
    const provider = await this.getGlobalProviderBySlugOrUuid(providerIdentifier);

    if (!this.registry.hasAdapter(provider.slug)) {
      throw new BadRequestException(
        `Provider '${provider.name}' is currently in COMING_SOON status. Adapter not yet implemented.`,
      );
    }

    const adapter = this.registry.getAdapter(provider.slug);
    const validation = await adapter.validateConfiguration(credentials);
    if (!validation.valid) {
      return { success: false, message: validation.error || 'Invalid credentials format' };
    }

    return adapter.testConnection(credentials);
  }

  async createConfiguration(userUuid: string, dto: CreateProviderConfigDto) {
    const provider = await this.getGlobalProviderBySlugOrUuid(dto.provider_slug);

    if (!this.registry.hasAdapter(provider.slug)) {
      throw new BadRequestException(
        `Provider '${provider.name}' is currently in COMING_SOON status. Only SMTP and SendGrid are operational.`,
      );
    }

    const adapter = this.registry.getAdapter(provider.slug);
    const validation = await adapter.validateConfiguration(dto.credentials);
    if (!validation.valid) {
      throw new BadRequestException(validation.error || 'Invalid credentials format');
    }

    const encryptedCredentials = this.encryption.encryptObject(dto.credentials);

    if (dto.is_default) {
      await this.prisma.userProviderConfiguration.updateMany({
        where: {
          user_uuid: userUuid,
          type: provider.type,
          is_default: true,
        },
        data: { is_default: false },
      });
    } else {
      const existingCount = await this.prisma.userProviderConfiguration.count({
        where: {
          user_uuid: userUuid,
          type: provider.type,
          deleted_at: null,
        },
      });
      if (existingCount === 0) {
        dto.is_default = true;
      }
    }

    const created = await this.prisma.userProviderConfiguration.create({
      data: {
        user_uuid: userUuid,
        provider_uuid: provider.provider_uuid,
        configuration_name: dto.configuration_name,
        type: provider.type,
        credentials: encryptedCredentials,
        sender_name: dto.sender_name || 'Antigravity User',
        sender_email: dto.sender_email || (provider.type === 'WHATSAPP' ? null : 'noreply@example.com'),
        sender_phone: dto.sender_phone || dto.credentials?.sender_phone || null,
        reply_to: dto.reply_to || null,
        is_default: !!dto.is_default,
        is_active: true,
        is_verified: false,
      },
      include: {
        provider: true,
      },
    });

    return this.sanitizeConfig(created);
  }

  async updateConfiguration(userUuid: string, configUuid: string, dto: UpdateProviderConfigDto) {
    const existing = await this.prisma.userProviderConfiguration.findFirst({
      where: {
        configuration_uuid: configUuid,
        user_uuid: userUuid,
        deleted_at: null,
      },
      include: {
        provider: true,
      },
    });

    if (!existing) {
      throw new NotFoundException(`Provider configuration not found`);
    }

    let encryptedCredentials = existing.credentials;
    let isVerified = existing.is_verified;

    // Secret merging logic:
    // If incoming credentials contain unmasked new values, merge them with previously decrypted secrets!
    // This ensures previously saved secrets are NOT overwritten by masked placeholders or empty strings.
    if (dto.credentials && Object.keys(dto.credentials).length > 0) {
      const existingDecrypted = this.encryption.decryptObject(existing.credentials);
      const mergedCredentials: Record<string, any> = { ...existingDecrypted };

      for (const [key, val] of Object.entries(dto.credentials)) {
        if (typeof val === 'string' && (val.includes('••••••••') || val.trim() === '')) {
          // Keep existing secret
          continue;
        }
        mergedCredentials[key] = val;
      }

      const adapter = this.registry.getAdapter(existing.provider.slug);
      const validation = await adapter.validateConfiguration(mergedCredentials);
      if (!validation.valid) {
        throw new BadRequestException(validation.error || 'Invalid credentials format');
      }
      encryptedCredentials = this.encryption.encryptObject(mergedCredentials);
      isVerified = false; // Reset verification on credentials change
    }

    if (dto.is_default) {
      await this.prisma.userProviderConfiguration.updateMany({
        where: {
          user_uuid: userUuid,
          type: existing.type,
          is_default: true,
          configuration_uuid: { not: configUuid },
        },
        data: { is_default: false },
      });
    }

    const updated = await this.prisma.userProviderConfiguration.update({
      where: { configuration_uuid: configUuid },
      data: {
        configuration_name: dto.configuration_name ?? existing.configuration_name,
        credentials: encryptedCredentials,
        sender_name: dto.sender_name ?? existing.sender_name,
        sender_email: dto.sender_email !== undefined ? dto.sender_email : existing.sender_email,
        sender_phone: dto.sender_phone !== undefined ? dto.sender_phone : existing.sender_phone,
        reply_to: dto.reply_to ?? existing.reply_to,
        is_active: dto.is_active ?? existing.is_active,
        is_default: dto.is_default ?? existing.is_default,
        is_verified: isVerified,
      },
      include: {
        provider: true,
      },
    });

    return this.sanitizeConfig(updated);
  }

  async setAsDefault(userUuid: string, configUuid: string) {
    const existing = await this.prisma.userProviderConfiguration.findFirst({
      where: {
        configuration_uuid: configUuid,
        user_uuid: userUuid,
        deleted_at: null,
      },
    });

    if (!existing) {
      throw new NotFoundException(`Provider configuration not found`);
    }

    await this.prisma.userProviderConfiguration.updateMany({
      where: {
        user_uuid: userUuid,
        type: existing.type,
        is_default: true,
      },
      data: { is_default: false },
    });

    const updated = await this.prisma.userProviderConfiguration.update({
      where: { configuration_uuid: configUuid },
      data: { is_default: true },
      include: {
        provider: true,
      },
    });

    return this.sanitizeConfig(updated);
  }

  async testConfiguration(userUuid: string, configUuid: string) {
    const config = await this.prisma.userProviderConfiguration.findFirst({
      where: {
        configuration_uuid: configUuid,
        user_uuid: userUuid,
        deleted_at: null,
      },
      include: {
        provider: true,
      },
    });

    if (!config) {
      throw new NotFoundException(`Provider configuration not found`);
    }

    const adapter = this.registry.getAdapter(config.provider.slug);
    const decryptedCredentials = this.encryption.decryptObject(config.credentials);

    const testResult = await adapter.testConnection(decryptedCredentials);

    await this.prisma.userProviderConfiguration.update({
      where: { configuration_uuid: configUuid },
      data: {
        is_verified: testResult.success,
        last_tested_at: new Date(),
        last_error: testResult.success ? null : testResult.message,
      },
    });

    return testResult;
  }

  async deleteConfiguration(userUuid: string, configUuid: string) {
    const existing = await this.prisma.userProviderConfiguration.findFirst({
      where: {
        configuration_uuid: configUuid,
        user_uuid: userUuid,
        deleted_at: null,
      },
    });

    if (!existing) {
      throw new NotFoundException(`Provider configuration not found`);
    }

    await this.prisma.userProviderConfiguration.update({
      where: { configuration_uuid: configUuid },
      data: {
        deleted_at: new Date(),
        is_default: false,
        is_active: false,
      },
    });

    if (existing.is_default) {
      const nextConfig = await this.prisma.userProviderConfiguration.findFirst({
        where: {
          user_uuid: userUuid,
          type: existing.type,
          deleted_at: null,
          is_active: true,
        },
        orderBy: { created_at: 'desc' },
      });

      if (nextConfig) {
        await this.prisma.userProviderConfiguration.update({
          where: { configuration_uuid: nextConfig.configuration_uuid },
          data: { is_default: true },
        });
      }
    }

    return { success: true, message: 'Provider configuration deleted successfully' };
  }

  async getDecryptedConfiguration(userUuid: string, configUuid?: string, channel: MessagingChannel = MessagingChannel.EMAIL) {
    let config;
    if (configUuid) {
      config = await this.prisma.userProviderConfiguration.findFirst({
        where: {
          configuration_uuid: configUuid,
          user_uuid: userUuid,
          deleted_at: null,
          is_active: true,
        },
        include: { provider: true },
      });
    } else {
      config = await this.prisma.userProviderConfiguration.findFirst({
        where: {
          user_uuid: userUuid,
          type: channel,
          is_default: true,
          deleted_at: null,
          is_active: true,
        },
        include: { provider: true },
      });

      if (!config) {
        config = await this.prisma.userProviderConfiguration.findFirst({
          where: {
            user_uuid: userUuid,
            type: channel,
            deleted_at: null,
            is_active: true,
          },
          include: { provider: true },
          orderBy: { created_at: 'desc' },
        });
      }
    }

    if (!config) {
      throw new BadRequestException(
        `No active ${channel} provider configured. Please configure a ${channel.toLowerCase()} provider in Messaging Settings.`,
      );
    }

    const decrypted = this.encryption.decryptObject(config.credentials);
    return {
      config,
      credentials: decrypted,
      adapter: this.registry.getAdapter(config.provider.slug),
    };
  }

  private sanitizeConfig(config: any) {
    let maskedCredentials: Record<string, any> = {};
    try {
      if (typeof config.credentials === 'string') {
        const decrypted = this.encryption.decryptObject(config.credentials);
        maskedCredentials = this.encryption.maskCredentials(decrypted);
      }
    } catch {
      maskedCredentials = { status: 'encrypted' };
    }

    return {
      ...config,
      credentials: maskedCredentials,
    };
  }
}
