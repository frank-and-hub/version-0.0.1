import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { PermissionsService } from '../services/permissions.service';
import { UserRole } from '@monorepo/shared-types';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissionsService: PermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    if (!user) {
      throw new ForbiddenException('User context missing');
    }

    // Super Admin has unrestricted access to all endpoints
    if (user.role === UserRole.SUPER_ADMIN) {
      return true;
    }

    const userUuid = user.user_uuid || user.id;

    // Fetch live effective permissions (combining role permissions + user grants - user denials)
    const effectivePermissions = await this.permissionsService.getEffectivePermissions(
      userUuid,
      user.role as UserRole,
    );

    // Verify all required permissions (taking hierarchy into account)
    const hasAllRequired = requiredPermissions.every((perm) =>
      this.permissionsService.hasPermission(effectivePermissions, perm, user.role),
    );

    if (!hasAllRequired) {
      const missing = requiredPermissions.filter(
        (p) => !this.permissionsService.hasPermission(effectivePermissions, p, user.role),
      );
      throw new ForbiddenException(`Insufficient permissions: missing ${missing.join(', ')}`);
    }

    return true;
  }
}

