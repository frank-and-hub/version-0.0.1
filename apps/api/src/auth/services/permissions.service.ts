import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  OnModuleInit,
  MessageEvent,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ValkeyService } from '../../cache/valkey.service';
import { Role as PrismaRole } from '@prisma/client';
import { UserRole, EffectivePermissionsDto } from '@monorepo/shared-types';
import { Subject, Observable } from 'rxjs';

/**
 * Permission Inheritance Map:
 * Granting a parent permission automatically implies access to all its children.
 */
export const PERMISSION_INHERITANCE: Record<string, string[]> = {
  'messaging.manage': [
    'messaging.read',
    'messaging.messages',
    'messaging.campaigns',
    'messaging.contacts',
    'messaging.templates',
    'messaging.providers',
    'messaging.analytics',
    'messaging.webhooks',
    'messaging.settings',
  ],
  'roles.manage': ['permissions.manage'],
  'users.create': ['users.read'],
  'users.update': ['users.read'],
  'users.delete': ['users.read'],
  'users.view_activity': ['users.read'],
};

export interface PermissionUpdateBroadcast {
  role?: string;
  userUuid?: string;
  version: number;
  timestamp: string;
}

@Injectable()
export class PermissionsService implements OnModuleInit {
  private readonly logger = new Logger(PermissionsService.name);
  private readonly permissionsUpdated$ = new Subject<MessageEvent>();
  private globalVersion = 1;

  constructor(
    private readonly prisma: PrismaService,
    private readonly valkey: ValkeyService,
  ) {}

  async onModuleInit() {
    try {
      const storedVersion = await this.valkey.get<number>('permissions:global_version');
      if (typeof storedVersion === 'number') {
        this.globalVersion = storedVersion;
      } else {
        await this.valkey.set('permissions:global_version', this.globalVersion);
      }

      // Multi-instance synchronization via Valkey Pub/Sub
      const subClient = this.valkey.getClient().duplicate();
      await subClient.subscribe('permissions:invalidation_channel');
      subClient.on('message', (channel, message) => {
        if (channel === 'permissions:invalidation_channel') {
          try {
            const data: PermissionUpdateBroadcast = JSON.parse(message);
            this.globalVersion = data.version;
            this.permissionsUpdated$.next({
              data,
              type: 'permissions_updated',
            });
            this.logger.debug(
              `[Cross-Instance Sync] Permissions invalidated: role=${data.role || 'ALL'} version=${data.version}`,
            );
          } catch (err: any) {
            this.logger.error(`Error parsing cross-instance invalidation message: ${err?.message}`);
          }
        }
      });
    } catch (err: any) {
      this.logger.warn(`Valkey permission pub/sub initialization deferred: ${err?.message || err}`);
    }
  }

  /**
   * Retrieves live or cached effective permissions for a user.
   * Effective Permissions = (Role Permissions U Explicit Grants) \ Explicit Denials
   */
  async getEffectivePermissions(userUuid: string, role?: UserRole): Promise<string[]> {
    if (role === UserRole.SUPER_ADMIN) {
      const all = await this.prisma.permission.findMany({ select: { code: true } });
      return all.map((p) => p.code);
    }

    const cacheKey = `permissions:effective:${userUuid}`;
    const cached = await this.valkey.get<string[]>(cacheKey);
    if (cached && Array.isArray(cached)) {
      return cached;
    }

    const detail = await this.getEffectivePermissionsDetail(userUuid, role);
    await this.valkey.set(cacheKey, detail.effective_permissions, 300); // 5 min TTL
    return detail.effective_permissions;
  }

  /**
   * Detailed breakdown showing Role grants, User grants, and User denials.
   */
  async getEffectivePermissionsDetail(
    userUuid: string,
    fallbackRole?: UserRole,
  ): Promise<EffectivePermissionsDto> {
    const user = await this.prisma.user.findUnique({
      where: { user_uuid: userUuid },
      select: { role: true },
    });

    const activeRole = (user?.role as UserRole) || fallbackRole || UserRole.USER;

    // Super Admin has all permissions
    if (activeRole === UserRole.SUPER_ADMIN) {
      const all = await this.prisma.permission.findMany({ select: { code: true } });
      const allCodes = all.map((p) => p.code);
      return {
        role: activeRole,
        effective_permissions: allCodes,
        role_permissions: allCodes,
        user_grants: [],
        user_denials: [],
        version: this.globalVersion,
      };
    }

    // 1. Fetch role-level permissions
    const roleMappings = await this.prisma.rolePermission.findMany({
      where: { role_code: activeRole },
      include: { permission: true },
    });
    const rolePermissions = roleMappings.map((rp) => rp.permission.code);

    // 2. Fetch user-specific overrides (grants and explicit denials)
    const userOverrides = await this.prisma.userPermission.findMany({
      where: { user_uuid: userUuid },
      include: { permission: true },
    });

    const userGrants = userOverrides
      .filter((uo) => uo.is_granted)
      .map((uo) => uo.permission.code);

    const userDenials = userOverrides
      .filter((uo) => !uo.is_granted)
      .map((uo) => uo.permission.code);

    // 3. Calculate Effective Set: (Role + Grants) - Denials
    const effectiveSet = new Set<string>([...rolePermissions, ...userGrants]);
    userDenials.forEach((deniedCode) => effectiveSet.delete(deniedCode));

    const effectivePermissions = Array.from(effectiveSet);

    return {
      role: activeRole,
      effective_permissions: effectivePermissions,
      role_permissions: rolePermissions,
      user_grants: userGrants,
      user_denials: userDenials,
      version: this.globalVersion,
    };
  }

  /**
   * Checks whether the user's permissions satisfy the required permission,
   * taking Super Admin bypass and parent-child inheritance into account.
   */
  hasPermission(
    userPermissions: string[],
    requiredPermission: string,
    role?: UserRole,
  ): boolean {
    if (role === UserRole.SUPER_ADMIN) {
      return true;
    }

    // Direct match
    if (userPermissions.includes(requiredPermission)) {
      return true;
    }

    // Parent inheritance check (e.g. messaging.manage grants messaging.templates)
    for (const [parent, children] of Object.entries(PERMISSION_INHERITANCE)) {
      if (userPermissions.includes(parent) && children.includes(requiredPermission)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Invalidates caches, increments epoch version, and broadcasts SSE & Pub/Sub notifications.
   */
  async invalidateCache(role?: string, userUuid?: string): Promise<number> {
    this.globalVersion += 1;
    await this.valkey.set('permissions:global_version', this.globalVersion);

    // Invalidate affected effective permission keys in Valkey
    if (userUuid) {
      await this.valkey.del(`permissions:effective:${userUuid}`);
    } else {
      await this.valkey.delByPattern('permissions:effective:*');
    }

    const broadcast: PermissionUpdateBroadcast = {
      role,
      userUuid,
      version: this.globalVersion,
      timestamp: new Date().toISOString(),
    };

    // 1. Broadcast to local subscribers
    this.permissionsUpdated$.next({
      data: broadcast,
      type: 'permissions_updated',
    });

    // 2. Publish to Redis / Valkey channel for other horizontal instances
    await this.valkey.publish('permissions:invalidation_channel', JSON.stringify(broadcast));

    this.logger.log(
      `[Permission Invalidation] Cache flushed, epoch bumped to v${this.globalVersion} (role: ${role || 'ALL'}, user: ${userUuid || 'ALL'})`,
    );

    return this.globalVersion;
  }

  /**
   * Observable stream for Server-Sent Events (SSE)
   */
  getStream(): Observable<MessageEvent> {
    return this.permissionsUpdated$.asObservable();
  }

  /**
   * Returns current global permission version
   */
  async getVersion(): Promise<number> {
    const v = await this.valkey.get<number>('permissions:global_version');
    return typeof v === 'number' ? v : this.globalVersion;
  }

  /**
   * Super Admin sets user-level grant or explicit denial override
   */
  async setUserPermissionOverride(
    userUuid: string,
    permissionCode: string,
    isGranted: boolean,
    grantedByUuid?: string,
  ) {
    const permission = await this.prisma.permission.findUnique({
      where: { code: permissionCode },
    });
    if (!permission) {
      throw new NotFoundException(`Permission with code "${permissionCode}" does not exist`);
    }

    const override = await this.prisma.userPermission.upsert({
      where: {
        user_uuid_permission_uuid: {
          user_uuid: userUuid,
          permission_uuid: permission.permission_uuid,
        },
      },
      update: {
        is_granted: isGranted,
        granted_by_uuid: grantedByUuid || null,
      },
      create: {
        user_uuid: userUuid,
        permission_uuid: permission.permission_uuid,
        is_granted: isGranted,
        granted_by_uuid: grantedByUuid || null,
      },
      include: { permission: true },
    });

    await this.invalidateCache(undefined, userUuid);
    return override;
  }

  /**
   * Super Admin removes a user-level override, reverting to role default
   */
  async removeUserPermissionOverride(userUuid: string, permissionCode: string, actorUuid?: string) {
    const permission = await this.prisma.permission.findUnique({
      where: { code: permissionCode },
    });
    if (!permission) {
      throw new NotFoundException(`Permission with code "${permissionCode}" does not exist`);
    }

    await this.prisma.userPermission.deleteMany({
      where: {
        user_uuid: userUuid,
        permission_uuid: permission.permission_uuid,
      },
    });

    await this.invalidateCache(undefined, userUuid);
  }

  /**
   * Lists all user overrides for a given user
   */
  async getUserPermissionOverrides(userUuid: string) {
    return this.prisma.userPermission.findMany({
      where: { user_uuid: userUuid },
      include: { permission: true },
      orderBy: { created_at: 'desc' },
    });
  }
}
