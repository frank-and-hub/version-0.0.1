import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RolesService } from './roles.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole, CreateRoleDto, UpdateRoleDto } from '@monorepo/shared-types';

@ApiTags('Role & Permission Management')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @RequirePermissions('roles.manage')
  @ApiOperation({ summary: 'Get overview of roles, user counts, and assigned permissions' })
  async getRoles() {
    return this.rolesService.getRolesSummary();
  }

  @Post()
  @RequirePermissions('roles.manage')
  @ApiOperation({ summary: 'Create a new custom dynamic role' })
  async createRole(
    @Body() dto: CreateRoleDto,
    @CurrentUser('user_uuid') actorUuid: string,
  ) {
    return this.rolesService.createRole(dto, actorUuid);
  }

  @Put(':role')
  @RequirePermissions('roles.manage')
  @ApiOperation({ summary: 'Update a role definition and its assigned permissions' })
  async updateRole(
    @Param('role') role: string,
    @Body() dto: UpdateRoleDto,
    @CurrentUser('role') actorRole: UserRole,
    @CurrentUser('user_uuid') actorUuid: string,
  ) {
    return this.rolesService.updateRole(role, dto, actorRole, actorUuid);
  }

  @Delete(':roleUuid')
  @RequirePermissions('roles.manage')
  @ApiOperation({ summary: 'Delete a custom dynamic role' })
  async deleteRole(
    @Param('roleUuid') roleUuid: string,
    @CurrentUser('role') actorRole: UserRole,
    @CurrentUser('user_uuid') actorUuid: string,
  ) {
    return this.rolesService.deleteRole(roleUuid, actorRole, actorUuid);
  }

  @Get('permissions')
  @RequirePermissions('roles.manage')
  @ApiOperation({ summary: 'List all granular system permissions' })
  async getPermissions() {
    return this.rolesService.getAllPermissions();
  }

  @Post(':role/permissions')
  @RequirePermissions('permissions.manage')
  @ApiOperation({ summary: 'Assign granular permissions to a role (Super Admin / Admin)' })
  async updateRolePermissions(
    @Param('role') role: string,
    @Body('permissions') permissions: string[],
    @CurrentUser('role') actorRole: UserRole,
    @CurrentUser('user_uuid') actorUuid: string,
  ) {
    return this.rolesService.updateRolePermissions(role, permissions, actorRole, actorUuid);
  }

  // --------------------------------------------------------------------------
  // User-Specific Overrides (Section 8)
  // --------------------------------------------------------------------------

  @Get('users/:userUuid/effective')
  @RequirePermissions('permissions.manage')
  @ApiOperation({ summary: 'Get calculated effective permissions breakdown for a user' })
  async getUserEffectivePermissions(@Param('userUuid') userUuid: string) {
    return this.rolesService.getUserEffectivePermissions(userUuid);
  }

  @Get('users/:userUuid/overrides')
  @RequirePermissions('permissions.manage')
  @ApiOperation({ summary: 'Get user explicit grants and denials' })
  async getUserOverrides(@Param('userUuid') userUuid: string) {
    return this.rolesService.getUserOverrides(userUuid);
  }

  @Post('users/:userUuid/overrides')
  @RequirePermissions('permissions.manage')
  @ApiOperation({ summary: 'Set user-specific explicit grant or denial override' })
  async setUserOverride(
    @Param('userUuid') userUuid: string,
    @Body('permission') permission: string,
    @Body('is_granted') isGranted: boolean,
    @CurrentUser('user_uuid') actorUuid: string,
  ) {
    return this.rolesService.setUserPermissionOverride(userUuid, permission, isGranted, actorUuid);
  }

  @Delete('users/:userUuid/overrides/:permissionCode')
  @RequirePermissions('permissions.manage')
  @ApiOperation({ summary: 'Remove user-specific override, reverting to role default' })
  async removeUserOverride(
    @Param('userUuid') userUuid: string,
    @Param('permissionCode') permissionCode: string,
    @CurrentUser('user_uuid') actorUuid: string,
  ) {
    return this.rolesService.removeUserPermissionOverride(userUuid, permissionCode, actorUuid);
  }
}
