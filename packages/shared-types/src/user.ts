import { PaginationParams } from './pagination';

export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  MODERATOR = 'MODERATOR',
  USER = 'USER',
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
}

export const PERMISSIONS = {
  USERS_READ: 'users.read',
  USERS_CREATE: 'users.create',
  USERS_UPDATE: 'users.update',
  USERS_DELETE: 'users.delete',
  USERS_VIEW_ACTIVITY: 'users.view_activity',
  ROLES_MANAGE: 'roles.manage',
  PERMISSIONS_MANAGE: 'permissions.manage',
  NAVIGATION_MANAGE: 'navigation.manage',
  AUDIT_LOGS_READ: 'audit_logs.read',
  ERROR_LOGS_READ: 'error_logs.read',
  SETTINGS_MANAGE: 'settings.manage',
  MODERATORS_MANAGE: 'moderators.manage',
  MESSAGING_MANAGE: 'messaging.manage',
  MESSAGING_MESSAGES: 'messaging.messages',
  MESSAGING_CAMPAIGNS: 'messaging.campaigns',
  MESSAGING_CONTACTS: 'messaging.contacts',
  MESSAGING_TEMPLATES: 'messaging.templates',
  MESSAGING_PROVIDERS: 'messaging.providers',
  MESSAGING_ANALYTICS: 'messaging.analytics',
  MESSAGING_WEBHOOKS: 'messaging.webhooks',
  MESSAGING_SETTINGS: 'messaging.settings',
} as const;

export type PermissionCode = typeof PERMISSIONS[keyof typeof PERMISSIONS];

export interface Permission {
  permission_uuid: string;
  permissionUuid?: string;
  code: string;
  name: string;
  category: string;
  description?: string | null;
  created_at?: string | Date;
  createdAt?: string | Date;
}

export interface UserPermission {
  user_permission_uuid: string;
  user_uuid: string;
  permission_uuid: string;
  is_granted: boolean;
  granted_by_uuid?: string | null;
  permission?: Permission;
  created_at: string | Date;
  updated_at: string | Date;
}

export interface EffectivePermissionsDto {
  role: UserRole;
  effective_permissions: string[];
  role_permissions: string[];
  user_grants: string[];
  user_denials: string[];
  version: number;
}

export interface Role {
  role_uuid: string;
  roleUuid?: string;
  code: string;
  name: string;
  description?: string | null;
  is_system: boolean;
  isSystem?: boolean;
  permissions?: Permission[];
  userCount?: number;
  created_at?: string | Date;
  createdAt?: string | Date;
  updated_at?: string | Date;
  updatedAt?: string | Date;
}

export interface CreateRoleDto {
  name: string;
  code: string;
  description?: string;
  permissions?: string[];
}

export interface UpdateRoleDto {
  name?: string;
  description?: string;
  permissions?: string[];
}

export interface User {
  id?: string;
  user_uuid: string;
  userUuid?: string;
  email: string;
  first_name: string;
  firstName?: string;
  last_name: string;
  lastName?: string;
  phone_number?: string | null;
  phoneNumber?: string | null;
  address?: string | null;
  profile_picture_url?: string | null;
  profilePictureUrl?: string | null;
  role: UserRole;
  status: UserStatus;
  last_login_at?: string | Date | null;
  lastLoginAt?: string | Date | null;
  failed_login_attempts?: number;
  failedLoginAttempts?: number;
  permissions?: string[];
  created_at: string | Date;
  createdAt?: string | Date;
  updated_at: string | Date;
  updatedAt?: string | Date;
}

export interface CreateUserDto {
  email: string;
  password?: string;
  first_name?: string;
  firstName?: string;
  last_name?: string;
  lastName?: string;
  role?: UserRole;
  status?: UserStatus;
  phone_number?: string;
  phoneNumber?: string;
  address?: string;
}

export interface UpdateUserDto {
  email?: string;
  first_name?: string;
  firstName?: string;
  last_name?: string;
  lastName?: string;
  role?: UserRole;
  status?: UserStatus;
  password?: string;
  phone_number?: string;
  phoneNumber?: string;
  address?: string;
  profile_picture_url?: string;
  profilePictureUrl?: string;
}

export interface UserQueryDto extends PaginationParams {
  role?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
}
