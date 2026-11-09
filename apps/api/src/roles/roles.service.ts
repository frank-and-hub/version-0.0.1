import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { PermissionsService } from '../auth/services/permissions.service';
import { UserRole, CreateRoleDto, UpdateRoleDto } from '@monorepo/shared-types';

@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly permissionsService: PermissionsService,
  ) {}

  async getRolesSummary() {
    // Fetch all roles from dynamic roles table
    const roles = await this.prisma.roleDefinition.findMany({
      include: {
        role_permissions: {
          include: { permission: true },
        },
      },
      orderBy: [{ is_system: 'desc' }, { created_at: 'asc' }],
    });

    const results = await Promise.all(
      roles.map(async (r) => {
        const userCount = await this.prisma.user.count({
          where: {
            OR: [
              { role: r.code as any },
              { role_uuid: r.role_uuid },
            ],
          },
        });

        return {
          role_uuid: r.role_uuid,
          role: r.code,
          code: r.code,
          name: r.name,
          description: r.description,
          is_system: r.is_system,
          userCount,
          permissions: r.role_permissions.map((rp) => rp.permission),
          created_at: r.created_at,
          updated_at: r.updated_at,
        };
      }),
    );

    return results;
  }

  async getAllPermissions() {
    return this.prisma.permission.findMany({
      orderBy: [{ category: 'asc' }, { code: 'asc' }],
    });
  }

  async createRole(dto: CreateRoleDto, actorUuid?: string) {
    if (!dto.name || !dto.code) {
      throw new BadRequestException('Role name and code are required');
    }

    const cleanCode = dto.code.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');
    if (!cleanCode) {
      throw new BadRequestException('Invalid role code format');
    }

    const existing = await this.prisma.roleDefinition.findUnique({
      where: { code: cleanCode },
    });
    if (existing) {
      throw new BadRequestException(`Role with code '${cleanCode}' already exists`);
    }

    // Verify requested permissions if any
    let permissionsToAssign: string[] = [];
    if (dto.permissions && dto.permissions.length > 0) {
      const validPerms = await this.prisma.permission.findMany({
        where: { code: { in: dto.permissions } },
      });
      permissionsToAssign = validPerms.map((p) => p.permission_uuid);
    }

    const createdRole = await this.prisma.$transaction(async (tx) => {
      const role = await tx.roleDefinition.create({
        data: {
          code: cleanCode,
          name: dto.name.trim(),
          description: dto.description?.trim() || null,
          is_system: false,
        },
      });

      for (const pUuid of permissionsToAssign) {
        await tx.rolePermission.create({
          data: {
            role_uuid: role.role_uuid,
            role_code: cleanCode,
            permission_uuid: pUuid,
          },
        });
      }

      return role;
    });

    await this.permissionsService.invalidateCache(cleanCode);

    await this.auditService.logAuditEvent({
      actor_uuid: actorUuid,
      action: 'ROLE_CREATED',
      resource_type: 'RoleDefinition',
      affected_resource_uuid: createdRole.role_uuid,
      after_state: { role: cleanCode, name: dto.name, permissions: dto.permissions },
    });

    return {
      success: true,
      role_uuid: createdRole.role_uuid,
      code: createdRole.code,
      name: createdRole.name,
      description: createdRole.description,
      is_system: createdRole.is_system,
      permissions: dto.permissions || [],
    };
  }

  async updateRole(
    roleUuidOrCode: string,
    dto: UpdateRoleDto,
    actorRole: UserRole,
    actorUuid?: string,
  ) {
    const role = await this.prisma.roleDefinition.findFirst({
      where: {
        OR: [
          { role_uuid: roleUuidOrCode },
          { code: roleUuidOrCode },
        ],
      },
    });

    if (!role) {
      throw new NotFoundException(`Role '${roleUuidOrCode}' not found`);
    }

    if (role.code === 'SUPER_ADMIN') {
      throw new ForbiddenException('Super Admin role is immutable and complete');
    }

    if (actorRole !== UserRole.SUPER_ADMIN && role.code === 'ADMIN') {
      throw new ForbiddenException('Only Super Admins can modify Administrator role');
    }

    const updated = await this.prisma.roleDefinition.update({
      where: { role_uuid: role.role_uuid },
      data: {
        name: dto.name !== undefined ? dto.name.trim() : role.name,
        description: dto.description !== undefined ? dto.description?.trim() : role.description,
      },
    });

    if (dto.permissions !== undefined) {
      await this.updateRolePermissions(role.code, dto.permissions, actorRole, actorUuid);
    }

    return {
      success: true,
      role: updated,
    };
  }

  async deleteRole(roleUuid: string, actorRole: UserRole, actorUuid?: string) {
    if (actorRole !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only Super Admins can delete roles');
    }

    const role = await this.prisma.roleDefinition.findFirst({
      where: {
        OR: [{ role_uuid: roleUuid }, { code: roleUuid }],
      },
    });

    if (!role) {
      throw new NotFoundException(`Role '${roleUuid}' not found`);
    }

    if (role.is_system) {
      throw new ForbiddenException(`System role '${role.name}' cannot be deleted`);
    }

    // Check if any users are assigned
    const assignedUsers = await this.prisma.user.count({
      where: {
        OR: [{ role_uuid: role.role_uuid }, { role: role.code as any }],
      },
    });

    if (assignedUsers > 0) {
      throw new BadRequestException(
        `Cannot delete role '${role.name}' because ${assignedUsers} user(s) are assigned to it. Please reassign them first.`,
      );
    }

    await this.prisma.roleDefinition.delete({
      where: { role_uuid: role.role_uuid },
    });

    await this.permissionsService.invalidateCache(role.code);

    await this.auditService.logAuditEvent({
      actor_uuid: actorUuid,
      action: 'ROLE_DELETED',
      resource_type: 'RoleDefinition',
      affected_resource_uuid: role.role_uuid,
      before_state: { role: role.code, name: role.name },
    });

    return { success: true, message: `Role '${role.name}' deleted successfully` };
  }

  async updateRolePermissions(
    targetRoleCodeOrUuid: string,
    permissionCodes: string[],
    actorRole: UserRole,
    actorUuid?: string,
  ) {
    const role = await this.prisma.roleDefinition.findFirst({
      where: {
        OR: [
          { role_uuid: targetRoleCodeOrUuid },
          { code: targetRoleCodeOrUuid },
        ],
      },
    });

    if (!role) {
      throw new NotFoundException(`Role '${targetRoleCodeOrUuid}' not found`);
    }

    // Privilege Hierarchy: Super Admin role can never have permissions removed or modified
    if (role.code === 'SUPER_ADMIN') {
      throw new ForbiddenException('Super Admin permissions are immutable and complete');
    }

    // Privilege Escalation Prevention: Admin cannot modify Admin/SuperAdmin permissions unless Super Admin
    if (actorRole !== UserRole.SUPER_ADMIN) {
      if (role.code === 'ADMIN') {
        throw new ForbiddenException('Only Super Admins can modify Administrator permissions');
      }
    }

    // Verify all permission codes exist
    const permissions = await this.prisma.permission.findMany({
      where: { code: { in: permissionCodes } },
    });

    if (permissions.length !== permissionCodes.length) {
      throw new BadRequestException('One or more permission codes are invalid');
    }

    // Atomic update of role permissions
    await this.prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({
        where: { role_uuid: role.role_uuid },
      });

      for (const p of permissions) {
        await tx.rolePermission.create({
          data: {
            role_uuid: role.role_uuid,
            role_code: role.code,
            permission_uuid: p.permission_uuid,
          },
        });
      }
    });

    // Invalidate caches and broadcast SSE event to all connected sessions
    await this.permissionsService.invalidateCache(role.code);

    // Write structured audit log
    await this.auditService.logAuditEvent({
      actor_uuid: actorUuid,
      action: 'ROLE_PERMISSIONS_UPDATED',
      resource_type: 'RolePermission',
      affected_resource_uuid: role.role_uuid,
      after_state: { role: role.code, permissions: permissionCodes },
    });

    return { success: true, role: role.code, updatedPermissions: permissionCodes };
  }

  // --------------------------------------------------------------------------
  // User-Specific Permission Overrides (Section 8)
  // --------------------------------------------------------------------------

  async getUserEffectivePermissions(userUuid: string) {
    return this.permissionsService.getEffectivePermissionsDetail(userUuid);
  }

  async setUserPermissionOverride(
    userUuid: string,
    permissionCode: string,
    isGranted: boolean,
    actorUuid?: string,
  ) {
    return this.permissionsService.setUserPermissionOverride(
      userUuid,
      permissionCode,
      isGranted,
      actorUuid,
    );
  }

  async removeUserPermissionOverride(
    userUuid: string,
    permissionCode: string,
    actorUuid?: string,
  ) {
    return this.permissionsService.removeUserPermissionOverride(
      userUuid,
      permissionCode,
      actorUuid,
    );
  }

  async getUserOverrides(userUuid: string) {
    return this.permissionsService.getUserPermissionOverrides(userUuid);
  }
}
