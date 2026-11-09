import { Injectable, BadRequestException, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { PermissionsService } from '../auth/services/permissions.service';
import { CreateMenuItemDto, UpdateMenuItemDto, UserRole, MenuItem } from '@monorepo/shared-types';
import { buildMenuTree, detectCircularReference } from '@monorepo/shared-utils';

@Injectable()
export class NavigationService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly permissionsService?: PermissionsService,
  ) {}

  // 1. Get filtered navigation tree for current authenticated user
  async getUserMenu(
    role: UserRole,
    permissions: string[] = [],
    userUuid?: string,
  ): Promise<MenuItem[]> {
    // 1. Resolve live effective permissions if userUuid is provided
    let effectivePerms = permissions;
    if (userUuid && this.permissionsService) {
      try {
        effectivePerms = await this.permissionsService.getEffectivePermissions(userUuid, role);
      } catch {
        effectivePerms = permissions;
      }
    }

    const allActive = await this.prisma.menuItem.findMany({
      where: { is_active: true },
      orderBy: { display_order: 'asc' },
    });

    const isDirectlyPermitted = (item: (typeof allActive)[number]): boolean => {
      if (role === UserRole.SUPER_ADMIN) {
        return true;
      }

      if (item.required_permission) {
        if (this.permissionsService) {
          return this.permissionsService.hasPermission(
            effectivePerms,
            item.required_permission,
            role,
          );
        }
        return effectivePerms.includes(item.required_permission);
      }

      // If no granular permission is required, fall back to allowed_roles check
      const allowedRoles = item.allowed_roles.split(',').map((r) => r.trim());
      return allowedRoles.includes(role);
    };

    // Index children by parent_uuid
    const childrenByParent = new Map<string, typeof allActive>();
    for (const item of allActive) {
      if (item.parent_uuid) {
        const list = childrenByParent.get(item.parent_uuid) || [];
        list.push(item);
        childrenByParent.set(item.parent_uuid, list);
      }
    }

    // Determine visibility recursively:
    // A parent item should appear ONLY when the user has access to at least one permitted child,
    // unless the parent has its own independently accessible page and direct clearance.
    const isNodeVisible = (item: (typeof allActive)[number]): boolean => {
      const children = childrenByParent.get(item.menu_uuid) || [];
      const hasDefinedChildren = children.length > 0;

      if (hasDefinedChildren) {
        const hasAnyVisibleChild = children.some((child) => isNodeVisible(child));
        if (hasAnyVisibleChild) {
          return true;
        }

        // Empty parent menus must NOT appear unless parent has an independent accessible page
        const hasIndependentPage = Boolean(
          item.route && item.route !== '#' && item.route !== '',
        );
        return hasIndependentPage && isDirectlyPermitted(item);
      }

      // Leaf node
      return isDirectlyPermitted(item);
    };

    const permitted = allActive.filter((item) => isNodeVisible(item));

    const mapped: MenuItem[] = permitted.map((item) => ({
      menu_uuid: item.menu_uuid,
      parent_uuid: item.parent_uuid,
      label: item.label,
      icon: item.icon,
      route: item.route,
      display_order: item.display_order,
      is_active: item.is_active,
      required_permission: item.required_permission,
      allowed_roles: item.allowed_roles.split(',').map((r) => r.trim() as UserRole),
      created_at: item.created_at,
      updated_at: item.updated_at,
    }));

    const tree = buildMenuTree(mapped);

    // Filter out any empty parent nodes that might have 0 children remaining after tree building
    const pruneEmptyParents = (nodes: MenuItem[]): MenuItem[] => {
      return nodes.filter((node) => {
        const hadChildrenInDb = (childrenByParent.get(node.menu_uuid) || []).length > 0;
        if (hadChildrenInDb) {
          const visibleChildren = node.children || [];
          if (visibleChildren.length === 0) {
            const hasIndependentPage = Boolean(
              node.route && node.route !== '#' && node.route !== '',
            );
            return hasIndependentPage && isDirectlyPermitted({
              ...node,
              allowed_roles: node.allowed_roles.join(','),
            } as any);
          }
          node.children = pruneEmptyParents(visibleChildren);
          return true;
        }
        return true;
      });
    };

    return pruneEmptyParents(tree);
  }

  // 2. Admin CRUD methods for Dynamic Sidebar Management
  async getAllItems(): Promise<MenuItem[]> {
    const items = await this.prisma.menuItem.findMany({
      orderBy: [{ parent_uuid: 'asc' }, { display_order: 'asc' }],
    });

    return items.map((item) => ({
      menu_uuid: item.menu_uuid,
      parent_uuid: item.parent_uuid,
      label: item.label,
      icon: item.icon,
      route: item.route,
      display_order: item.display_order,
      is_active: item.is_active,
      required_permission: item.required_permission,
      allowed_roles: item.allowed_roles.split(',').map((r) => r.trim() as UserRole),
      created_at: item.created_at,
      updated_at: item.updated_at,
    }));
  }

  async create(dto: CreateMenuItemDto): Promise<MenuItem> {
    if (dto.parent_uuid) {
      const parent = await this.prisma.menuItem.findUnique({
        where: { menu_uuid: dto.parent_uuid },
      });
      if (!parent) {
        throw new BadRequestException('Selected parent menu item does not exist');
      }
    }

    const created = await this.prisma.menuItem.create({
      data: {
        parent_uuid: dto.parent_uuid || null,
        label: dto.label,
        icon: dto.icon,
        route: dto.route,
        display_order: dto.display_order ?? 0,
        is_active: dto.is_active ?? true,
        required_permission: dto.required_permission || null,
        allowed_roles: dto.allowed_roles ? dto.allowed_roles.join(',') : 'SUPER_ADMIN,ADMIN,MODERATOR',
      },
    });

    return {
      menu_uuid: created.menu_uuid,
      parent_uuid: created.parent_uuid,
      label: created.label,
      icon: created.icon,
      route: created.route,
      display_order: created.display_order,
      is_active: created.is_active,
      required_permission: created.required_permission,
      allowed_roles: created.allowed_roles.split(',').map((r) => r.trim() as UserRole),
      created_at: created.created_at,
      updated_at: created.updated_at,
    };
  }

  async update(menuUuid: string, dto: UpdateMenuItemDto): Promise<MenuItem> {
    const existing = await this.prisma.menuItem.findUnique({
      where: { menu_uuid: menuUuid },
    });
    if (!existing) {
      throw new NotFoundException(`Menu item with ID ${menuUuid} not found`);
    }

    // Circular Dependency Validation (Requirement 9.3)
    if (dto.parent_uuid !== undefined && dto.parent_uuid !== existing.parent_uuid) {
      if (dto.parent_uuid === menuUuid) {
        throw new BadRequestException('A menu item cannot be its own parent');
      }

      if (dto.parent_uuid !== null) {
        const allItems = await this.prisma.menuItem.findMany({
          select: { menu_uuid: true, parent_uuid: true },
        });

        const isCircular = detectCircularReference(dto.parent_uuid, menuUuid, allItems);
        if (isCircular) {
          throw new BadRequestException(
            'Invalid parent selection: circular reference detected in menu hierarchy',
          );
        }
      }
    }

    const updated = await this.prisma.menuItem.update({
      where: { menu_uuid: menuUuid },
      data: {
        parent_uuid: dto.parent_uuid !== undefined ? dto.parent_uuid : existing.parent_uuid,
        label: dto.label ?? existing.label,
        icon: dto.icon ?? existing.icon,
        route: dto.route ?? existing.route,
        display_order: dto.display_order ?? existing.display_order,
        is_active: dto.is_active !== undefined ? dto.is_active : existing.is_active,
        required_permission:
          dto.required_permission !== undefined ? dto.required_permission : existing.required_permission,
        allowed_roles: dto.allowed_roles ? dto.allowed_roles.join(',') : existing.allowed_roles,
      },
    });

    return {
      menu_uuid: updated.menu_uuid,
      parent_uuid: updated.parent_uuid,
      label: updated.label,
      icon: updated.icon,
      route: updated.route,
      display_order: updated.display_order,
      is_active: updated.is_active,
      required_permission: updated.required_permission,
      allowed_roles: updated.allowed_roles.split(',').map((r) => r.trim() as UserRole),
      created_at: updated.created_at,
      updated_at: updated.updated_at,
    };
  }

  async remove(menuUuid: string): Promise<{ success: boolean; menu_uuid: string }> {
    await this.prisma.menuItem.delete({
      where: { menu_uuid: menuUuid },
    });
    return { success: true, menu_uuid: menuUuid };
  }
}

