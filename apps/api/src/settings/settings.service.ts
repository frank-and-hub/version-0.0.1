import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { Setting } from '@monorepo/shared-types';

const KNOWN_DEFAULT_SETTINGS: Record<
  string,
  { value: string; type: string; category: string; is_public: boolean; description: string }
> = {
  'ui.theme.default': {
    value: 'light',
    type: 'STRING',
    category: 'UI',
    is_public: true,
    description: 'System-wide default theme (light, dark, system)',
  },
  'ui.pagination_default': {
    value: '10',
    type: 'NUMBER',
    category: 'UI',
    is_public: true,
    description: 'Default items per page for data tables',
  },
  'app.name': {
    value: 'Monorepo Enterprise Platform',
    type: 'STRING',
    category: 'GENERAL',
    is_public: true,
    description: 'Application display name',
  },
};

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async getAll(includePrivate = false): Promise<Setting[]> {
    const where = includePrivate ? {} : { is_public: true };
    const items = await this.prisma.setting.findMany({
      where,
      orderBy: [{ category: 'asc' }, { key: 'asc' }],
    });

    // Auto-heal missing essential UI settings if absent
    if (!items.some((i) => i.key === 'ui.theme.default')) {
      const defaultTheme = await this.prisma.setting.upsert({
        where: { key: 'ui.theme.default' },
        update: {},
        create: {
          key: 'ui.theme.default',
          ...KNOWN_DEFAULT_SETTINGS['ui.theme.default'],
        },
      });
      items.push(defaultTheme as any);
    }

    return items as unknown as Setting[];
  }

  async getByKey(key: string): Promise<Setting> {
    let item = await this.prisma.setting.findUnique({
      where: { key },
    });

    if (!item && key in KNOWN_DEFAULT_SETTINGS) {
      item = await this.prisma.setting.create({
        data: {
          key,
          ...KNOWN_DEFAULT_SETTINGS[key],
        },
      });
    }

    if (!item) {
      throw new NotFoundException(`Setting with key "${key}" not found`);
    }
    return item as unknown as Setting;
  }

  async update(key: string, value: string, actorUuid?: string): Promise<Setting> {
    let existing = await this.prisma.setting.findUnique({
      where: { key },
    });

    if (!existing && key in KNOWN_DEFAULT_SETTINGS) {
      existing = await this.prisma.setting.create({
        data: {
          key,
          ...KNOWN_DEFAULT_SETTINGS[key],
        },
      });
    }

    if (!existing) {
      throw new NotFoundException(`Setting with key "${key}" not found`);
    }

    // Validate type
    if (existing.type === 'BOOLEAN' && value !== 'true' && value !== 'false') {
      throw new BadRequestException(`Value for "${key}" must be "true" or "false"`);
    }
    if (existing.type === 'NUMBER' && isNaN(Number(value))) {
      throw new BadRequestException(`Value for "${key}" must be a valid number`);
    }
    if (existing.type === 'JSON') {
      try {
        JSON.parse(value);
      } catch {
        throw new BadRequestException(`Value for "${key}" must be valid JSON`);
      }
    }

    const updated = await this.prisma.setting.update({
      where: { key },
      data: {
        value,
        updated_by_uuid: actorUuid || null,
      },
    });

    // Write structured audit log
    await this.auditService.logAuditEvent({
      actor_uuid: actorUuid,
      action: 'SETTING_UPDATED',
      resource_type: 'Setting',
      affected_resource_uuid: key,
      before_state: { key, value: existing.value },
      after_state: { key, value: updated.value },
    });

    return updated as unknown as Setting;
  }
}


