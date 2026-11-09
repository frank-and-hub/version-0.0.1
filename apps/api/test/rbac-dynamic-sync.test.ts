import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { PrismaClient, Role as PrismaRole } from '@prisma/client';
import { UserRole, PERMISSIONS } from '@monorepo/shared-types';

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const { PermissionsService } = require('../dist/src/auth/services/permissions.service');
const { NavigationService } = require('../dist/src/navigation/navigation.service');
const { RolesService } = require('../dist/src/roles/roles.service');

describe('RBAC Dynamic Roles & Real-Time Sidebar Synchronization Suite', () => {
  let prisma: PrismaClient;
  let permissionsService: PermissionsService;
  let navigationService: NavigationService;
  let rolesService: RolesService;

  // Mock ValkeyService
  const mockCache = new Map<string, any>();
  const mockValkeyService: any = {
    get: async (key: string) => mockCache.get(key) ?? null,
    set: async (key: string, value: any) => {
      mockCache.set(key, value);
    },
    del: async (key: string) => {
      mockCache.delete(key);
    },
    delByPattern: async (pattern: string) => {
      const prefix = pattern.replace('*', '');
      for (const k of mockCache.keys()) {
        if (k.startsWith(prefix)) mockCache.delete(k);
      }
    },
    publish: async () => 1,
    getClient: () => null,
  };

  // Mock AuditService
  const mockAuditService: any = {
    logAuditEvent: async () => {},
  };

  let testModeratorUuid: string;
  let testUserUuid: string;
  let createdCustomRoleUuid: string;

  before(async () => {
    prisma = new PrismaClient();
    permissionsService = new PermissionsService(prisma as any, mockValkeyService);
    navigationService = new NavigationService(prisma as any, permissionsService);
    rolesService = new RolesService(prisma as any, mockAuditService, permissionsService);

    // Create test moderator user
    const mod = await prisma.user.upsert({
      where: { email: 'test.moderator.rbac@example.com' },
      update: {},
      create: {
        email: 'test.moderator.rbac@example.com',
        password_hash: 'hash123',
        first_name: 'Test',
        last_name: 'Mod',
        role: PrismaRole.MODERATOR,
      },
    });
    testModeratorUuid = mod.user_uuid;

    // Create test standard user
    const usr = await prisma.user.upsert({
      where: { email: 'test.user.rbac@example.com' },
      update: {},
      create: {
        email: 'test.user.rbac@example.com',
        password_hash: 'hash123',
        first_name: 'Test',
        last_name: 'User',
        role: PrismaRole.USER,
      },
    });
    testUserUuid = usr.user_uuid;

    // Ensure test user has no leftover overrides
    await prisma.userPermission.deleteMany({
      where: { user_uuid: { in: [testModeratorUuid, testUserUuid] } },
    });
  });

  after(async () => {
    // Cleanup
    if (createdCustomRoleUuid) {
      await prisma.rolePermission.deleteMany({ where: { role_uuid: createdCustomRoleUuid } });
      await prisma.roleDefinition.deleteMany({ where: { role_uuid: createdCustomRoleUuid } });
    }
    await prisma.userPermission.deleteMany({
      where: { user_uuid: { in: [testModeratorUuid, testUserUuid] } },
    });
    await prisma.user.deleteMany({
      where: { email: { in: ['test.moderator.rbac@example.com', 'test.user.rbac@example.com'] } },
    });
    await prisma.$disconnect();
  });

  // --------------------------------------------------------------------------
  // 1. Dynamic Roles Table Verification
  // --------------------------------------------------------------------------
  describe('Dynamic Roles Database Table', () => {
    test('Roles table contains system roles: SUPER_ADMIN, ADMIN, MODERATOR, USER', async () => {
      const roles = await prisma.roleDefinition.findMany();
      assert.ok(roles.length >= 4, 'Should contain at least 4 default system roles');

      const codes = roles.map((r) => r.code);
      assert.ok(codes.includes('SUPER_ADMIN'), 'Must include SUPER_ADMIN');
      assert.ok(codes.includes('ADMIN'), 'Must include ADMIN');
      assert.ok(codes.includes('MODERATOR'), 'Must include MODERATOR');
      assert.ok(codes.includes('USER'), 'Must include USER');

      const superAdminRole = roles.find((r) => r.code === 'SUPER_ADMIN')!;
      assert.strictEqual(superAdminRole.is_system, true, 'SUPER_ADMIN must be is_system = true');
    });

    test('Super Admin can dynamically create a new custom role with initial permissions', async () => {
      const roleCode = `CUSTOM_SUPPORT_${Date.now()}`;
      const result = await rolesService.createRole({
        name: 'Tier 1 Support Agent',
        code: roleCode,
        description: 'Handles basic customer tickets and view activity',
        permissions: ['users.read', 'users.view_activity'],
      });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.code, roleCode);
      assert.strictEqual(result.is_system, false, 'New dynamic roles must be custom (is_system = false)');
      createdCustomRoleUuid = result.role_uuid;

      // Verify in DB
      const dbRole = await prisma.roleDefinition.findUnique({
        where: { role_uuid: createdCustomRoleUuid },
        include: { role_permissions: { include: { permission: true } } },
      });
      assert.ok(dbRole, 'Role should be stored in postgres');
      assert.strictEqual(dbRole?.role_permissions.length, 2, 'Should have 2 assigned permissions');
    });

    test('System roles cannot be deleted', async () => {
      const modRole = await prisma.roleDefinition.findUnique({ where: { code: 'MODERATOR' } });
      assert.ok(modRole);

      await assert.rejects(
        async () => {
          await rolesService.deleteRole(modRole.role_uuid, UserRole.SUPER_ADMIN);
        },
        /System role .* cannot be deleted/,
        'Attempting to delete a system role must throw ForbiddenException',
      );
    });
  });

  // --------------------------------------------------------------------------
  // 2. Permission Inheritance Rules
  // --------------------------------------------------------------------------
  describe('Permission Inheritance & Hierarchy', () => {
    test('Super Admin role has implicit bypass on all permissions', () => {
      assert.strictEqual(
        permissionsService.hasPermission([], 'messaging.manage', UserRole.SUPER_ADMIN),
        true,
        'Super Admin must bypass all permission checks',
      );
      assert.strictEqual(
        permissionsService.hasPermission([], 'random.nonexistent.perm', UserRole.SUPER_ADMIN),
        true,
      );
    });

    test('Master permission "messaging.manage" implicitly authorizes all messaging child sub-features', () => {
      const userPerms = ['messaging.manage'];

      assert.strictEqual(
        permissionsService.hasPermission(userPerms, 'messaging.manage', UserRole.MODERATOR),
        true,
      );
      assert.strictEqual(
        permissionsService.hasPermission(userPerms, 'messaging.messages', UserRole.MODERATOR),
        true,
        'messaging.manage must grant messaging.messages',
      );
      assert.strictEqual(
        permissionsService.hasPermission(userPerms, 'messaging.templates', UserRole.MODERATOR),
        true,
        'messaging.manage must grant messaging.templates',
      );
      assert.strictEqual(
        permissionsService.hasPermission(userPerms, 'messaging.providers', UserRole.MODERATOR),
        true,
        'messaging.manage must grant messaging.providers',
      );
      assert.strictEqual(
        permissionsService.hasPermission(userPerms, 'users.delete', UserRole.MODERATOR),
        false,
        'messaging.manage must NOT grant unrelated permissions',
      );
    });

    test('Child permission "messaging.templates" does NOT grant "messaging.manage" or sibling permissions', () => {
      const userPerms = ['messaging.templates'];

      assert.strictEqual(
        permissionsService.hasPermission(userPerms, 'messaging.templates', UserRole.USER),
        true,
      );
      assert.strictEqual(
        permissionsService.hasPermission(userPerms, 'messaging.manage', UserRole.USER),
        false,
        'messaging.templates must NOT grant messaging.manage',
      );
      assert.strictEqual(
        permissionsService.hasPermission(userPerms, 'messaging.providers', UserRole.USER),
        false,
        'messaging.templates must NOT grant messaging.providers',
      );
    });
  });

  // --------------------------------------------------------------------------
  // 3. User-Level Overrides: Effective Permissions = (Role U Grants) \ Denials
  // --------------------------------------------------------------------------
  describe('Effective Permissions Calculation & Overrides', () => {
    test('User explicit grant adds capability not granted to their base role', async () => {
      // Moderator role normally lacks 'messaging.manage'
      const baseDetail = await permissionsService.getEffectivePermissionsDetail(testModeratorUuid);
      assert.strictEqual(baseDetail.effective_permissions.includes('messaging.manage'), false);

      // Super Admin explicitly grants 'messaging.manage' to this moderator
      await permissionsService.setUserPermissionOverride(
        testModeratorUuid,
        'messaging.manage',
        true,
      );

      const updatedDetail = await permissionsService.getEffectivePermissionsDetail(testModeratorUuid);
      assert.ok(
        updatedDetail.effective_permissions.includes('messaging.manage'),
        'Explicit grant must be included in effective permissions',
      );
      assert.ok(
        updatedDetail.user_grants.includes('messaging.manage'),
        'Must appear in user_grants array',
      );
    });

    test('User explicit denial revokes capability even if base role possesses it', async () => {
      // Moderator role normally has 'users.read'
      const modRolePerms = await prisma.rolePermission.findMany({
        where: { role_code: 'MODERATOR' },
        include: { permission: true },
      });
      const hasUsersRead = modRolePerms.some((rp) => rp.permission.code === 'users.read');
      assert.strictEqual(hasUsersRead, true, 'MODERATOR must have users.read');

      // Super Admin explicitly DENIES 'users.read' for this specific moderator
      await permissionsService.setUserPermissionOverride(
        testModeratorUuid,
        'users.read',
        false, // is_granted = false (explicit DENIAL)
      );

      const updatedDetail = await permissionsService.getEffectivePermissionsDetail(testModeratorUuid);
      assert.strictEqual(
        updatedDetail.effective_permissions.includes('users.read'),
        false,
        'Explicit denial must remove users.read from effective permissions',
      );
      assert.ok(
        updatedDetail.user_denials.includes('users.read'),
        'Must appear in user_denials array',
      );

      // Clean up denial
      await permissionsService.removeUserPermissionOverride(testModeratorUuid, 'users.read');
    });

    test('Reverting user override restores default base role capability', async () => {
      // Revert the earlier 'messaging.manage' grant
      await permissionsService.removeUserPermissionOverride(testModeratorUuid, 'messaging.manage');

      const detail = await permissionsService.getEffectivePermissionsDetail(testModeratorUuid);
      assert.strictEqual(
        detail.effective_permissions.includes('messaging.manage'),
        false,
        'Reverting override must restore role default (no messaging.manage)',
      );
      assert.strictEqual(detail.user_grants.length, 0);
    });
  });

  // --------------------------------------------------------------------------
  // 4. Dynamic Sidebar Menu Synchronization & Parent-Child Pruning
  // --------------------------------------------------------------------------
  describe('Dynamic Sidebar Synchronization & Empty Parent Suppression', () => {
    test('Standard Moderator WITHOUT messaging permissions does NOT see Messaging in menu', async () => {
      const menu = await navigationService.getUserMenu(
        UserRole.MODERATOR,
        ['users.read', 'users.view_activity'],
        testModeratorUuid,
      );

      const messagingItem = menu.find(
        (m) => m.label === 'Messaging Platform' || m.route === '/admin/messaging',
      );
      assert.strictEqual(
        messagingItem,
        undefined,
        'Messaging menu must be hidden when role lacks messaging permissions',
      );
    });

    test('When Moderator is granted "messaging.manage", Messaging parent and submenus appear in their sidebar', async () => {
      // Explicitly grant messaging.manage
      await permissionsService.setUserPermissionOverride(
        testModeratorUuid,
        'messaging.manage',
        true,
      );

      const effectivePerms = await permissionsService.getEffectivePermissions(
        testModeratorUuid,
        UserRole.MODERATOR,
      );

      const menu = await navigationService.getUserMenu(
        UserRole.MODERATOR,
        effectivePerms,
        testModeratorUuid,
      );

      const messagingItem = menu.find(
        (m) => m.label === 'Messaging Platform' || m.route === '/admin/messaging',
      );
      assert.ok(messagingItem, 'Messaging menu must dynamically appear in sidebar');
      assert.ok(messagingItem.children && messagingItem.children.length > 0, 'Must have submenus');

      const templateChild = messagingItem.children?.find((c) => c.label === 'Templates');
      assert.ok(templateChild, 'Templates submenu should be visible due to master inheritance');

      // Clean up override
      await permissionsService.removeUserPermissionOverride(testModeratorUuid, 'messaging.manage');
    });

    test('When User is granted ONLY "messaging.templates", Messaging parent appears with ONLY Templates child', async () => {
      // Explicitly grant ONLY messaging.templates to standard user
      await permissionsService.setUserPermissionOverride(
        testUserUuid,
        'messaging.templates',
        true,
      );

      const effectivePerms = await permissionsService.getEffectivePermissions(
        testUserUuid,
        UserRole.USER,
      );

      const menu = await navigationService.getUserMenu(
        UserRole.USER,
        effectivePerms,
        testUserUuid,
      );

      const messagingParent = menu.find(
        (m) => m.label === 'Messaging Platform' || m.route === '/admin/messaging',
      );
      assert.ok(messagingParent, 'Parent Messaging must appear because it has a permitted child');
      assert.ok(messagingParent.children, 'Must have children array');

      // The child list must contain ONLY Templates (and any other directly permitted children),
      // and NOT contain unauthorized submenus like Providers, Webhook Monitoring, etc.
      const childLabels = messagingParent.children.map((c) => c.label);
      assert.ok(childLabels.includes('Templates'), 'Must contain Templates child');
      assert.strictEqual(
        childLabels.includes('Providers'),
        false,
        'Must NOT contain Providers child because user lacks messaging.providers',
      );
      assert.strictEqual(
        childLabels.includes('Webhook Monitoring'),
        false,
        'Must NOT contain Webhooks child because user lacks messaging.webhooks',
      );

      // Clean up override
      await permissionsService.removeUserPermissionOverride(testUserUuid, 'messaging.templates');
    });

    test('Revoking permissions removes menu and prevents empty parent menus from appearing', async () => {
      // User with 0 permissions
      const menu = await navigationService.getUserMenu(UserRole.USER, [], testUserUuid);

      const messagingParent = menu.find(
        (m) => m.label === 'Messaging Platform' || m.route === '/admin/messaging',
      );
      assert.strictEqual(
        messagingParent,
        undefined,
        'Parent menu must completely disappear when user has 0 permitted children',
      );
    });
  });

  // --------------------------------------------------------------------------
  // 5. Cache Invalidation & Global Version Epoch
  // --------------------------------------------------------------------------
  describe('Cache Invalidation & SSE Broadcast Engine', () => {
    test('invalidateCache increments epoch and flushes cache', async () => {
      const v1 = await permissionsService.getVersion();
      const v2 = await permissionsService.invalidateCache('MODERATOR', testModeratorUuid);

      assert.strictEqual(v2, v1 + 1, 'Version epoch must increment on invalidation');

      const vCurrent = await permissionsService.getVersion();
      assert.strictEqual(vCurrent, v2);
    });
  });
});
