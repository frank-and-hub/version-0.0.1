import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { PrismaService } from '../database/prisma.service';
import { ValkeyService } from '../cache/valkey.service';
import { AuditService } from '../audit/audit.service';
import { ActivityService } from '../activity/activity.service';
import { PermissionsService } from './services/permissions.service';
import {
  RegisterDto,
  LoginDto,
  AuthResponse,
  JwtTokens,
  User,
  UserRole,
  UserStatus,
  ChangePasswordDto,
  SocialAuthDto,
} from '@monorepo/shared-types';
import { Role as PrismaRole } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly valkeyService: ValkeyService,
    private readonly auditService: AuditService,
    private readonly activityService: ActivityService,
    private readonly permissionsService: PermissionsService,
  ) {}

  async register(
    dto: RegisterDto,
    ip?: string,
    userAgent?: string,
    correlationId?: string,
  ): Promise<AuthResponse> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (existing) {
      throw new ConflictException('A user with this email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    // Strict default: new accounts always receive USER role (Requirement 9.8)
    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        password_hash: passwordHash,
        first_name: dto.first_name,
        last_name: dto.last_name,
        phone_number: dto.phone_number || null,
        role: PrismaRole.USER,
        status: 'ACTIVE',
      },
    });

    const tokens = await this.generateTokens(user.user_uuid, user.email, UserRole.USER, ip, userAgent);

    // Audit and Activity logs
    await this.auditService.logAuditEvent({
      actor_uuid: user.user_uuid,
      actor_email: user.email,
      action: 'USER_REGISTERED',
      resource_type: 'User',
      affected_resource_uuid: user.user_uuid,
      correlation_id: correlationId,
      after_state: { email: user.email, role: user.role },
      ip_address: ip,
      user_agent: userAgent,
    });

    await this.activityService.logActivity({
      user_uuid: user.user_uuid,
      actor_uuid: user.user_uuid,
      action: 'REGISTRATION',
      correlation_id: correlationId,
      ip_address: ip,
      user_agent: userAgent,
    });

    return {
      user: {
        user_uuid: user.user_uuid,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        phone_number: user.phone_number,
        address: user.address,
        profile_picture_url: user.profile_picture_url,
        role: UserRole.USER,
        status: user.status as UserStatus,
        permissions: [],
        created_at: user.created_at,
        updated_at: user.updated_at,
      },
      tokens,
    };
  }

  async login(
    dto: LoginDto,
    ip?: string,
    userAgent?: string,
    correlationId?: string,
  ): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (!user) {
      // Record failed login attempt for telemetry
      await this.activityService.logActivity({
        action: 'FAILED_LOGIN_ATTEMPT',
        correlation_id: correlationId,
        metadata: { attempted_email: dto.email.toLowerCase(), reason: 'USER_NOT_FOUND' },
        ip_address: ip,
        user_agent: userAgent,
      });
      throw new UnauthorizedException('Invalid email or password');
    }

    // Check account lockout
    if (user.locked_until && user.locked_until > new Date()) {
      const waitMinutes = Math.ceil((user.locked_until.getTime() - Date.now()) / 60000);
      throw new UnauthorizedException(
        `Account is temporarily locked due to multiple failed login attempts. Try again in ${waitMinutes} minutes.`,
      );
    }

    const isValidPassword = await bcrypt.compare(dto.password, user.password_hash);
    if (!isValidPassword) {
      const newFailed = user.failed_login_attempts + 1;
      const data: any = { failed_login_attempts: newFailed };

      if (newFailed >= 5) {
        // Lock account for 15 minutes after 5 consecutive failures
        const lockUntil = new Date();
        lockUntil.setMinutes(lockUntil.getMinutes() + 15);
        data.locked_until = lockUntil;
      }

      await this.prisma.user.update({
        where: { user_uuid: user.user_uuid },
        data,
      });

      await this.activityService.logActivity({
        user_uuid: user.user_uuid,
        action: 'FAILED_LOGIN_ATTEMPT',
        correlation_id: correlationId,
        metadata: { attempt_number: newFailed },
        ip_address: ip,
        user_agent: userAgent,
      });

      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Your account is inactive or suspended');
    }

    // Reset failed attempts & record last login
    await this.prisma.user.update({
      where: { user_uuid: user.user_uuid },
      data: {
        failed_login_attempts: 0,
        locked_until: null,
        last_login_at: new Date(),
      },
    });

    // Retrieve active permissions
    const permissions = await this.getUserPermissions(user.role as UserRole);

    const tokens = await this.generateTokens(
      user.user_uuid,
      user.email,
      user.role as UserRole,
      ip,
      userAgent,
      permissions,
    );

    await this.activityService.logActivity({
      user_uuid: user.user_uuid,
      actor_uuid: user.user_uuid,
      action: 'LOGIN',
      correlation_id: correlationId,
      metadata: { login_method: 'PASSWORD' },
      ip_address: ip,
      user_agent: userAgent,
    });

    return {
      user: {
        user_uuid: user.user_uuid,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        phone_number: user.phone_number,
        address: user.address,
        profile_picture_url: user.profile_picture_url,
        role: user.role as UserRole,
        status: user.status as UserStatus,
        last_login_at: user.last_login_at,
        permissions,
        created_at: user.created_at,
        updated_at: user.updated_at,
      },
      tokens,
    };
  }

  async refreshTokens(
    refreshToken: string,
    ip?: string,
    userAgent?: string,
    correlationId?: string,
  ): Promise<JwtTokens> {
    if (!refreshToken) {
      throw new BadRequestException('Refresh token is required');
    }

    let payload: { sub: string; email: string; role: UserRole };
    try {
      payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const tokenHash = this.hashToken(refreshToken);
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { token_hash: tokenHash },
      include: { user: true },
    });

    if (!storedToken || storedToken.revoked || storedToken.expires_at < new Date()) {
      throw new UnauthorizedException('Refresh token has been revoked or expired');
    }

    // Revoke old refresh token (Token Rotation!)
    await this.prisma.refreshToken.update({
      where: { token_uuid: storedToken.token_uuid },
      data: { revoked: true },
    });

    const permissions = await this.getUserPermissions(storedToken.user.role as UserRole);
    const newTokens = await this.generateTokens(
      storedToken.user.user_uuid,
      storedToken.user.email,
      storedToken.user.role as UserRole,
      ip,
      userAgent,
      permissions,
    );

    await this.activityService.logActivity({
      user_uuid: storedToken.user.user_uuid,
      actor_uuid: storedToken.user.user_uuid,
      action: 'TOKEN_REFRESH',
      correlation_id: correlationId,
      ip_address: ip,
      user_agent: userAgent,
    });

    return newTokens;
  }

  async logout(
    userUuid: string,
    tokenId?: string,
    refreshToken?: string,
    correlationId?: string,
  ): Promise<void> {
    if (tokenId) {
      await this.valkeyService.blacklistToken(tokenId, 900);
    }

    if (refreshToken) {
      const tokenHash = this.hashToken(refreshToken);
      await this.prisma.refreshToken.updateMany({
        where: { token_hash: tokenHash },
        data: { revoked: true },
      });
    }

    await this.activityService.logActivity({
      user_uuid: userUuid,
      actor_uuid: userUuid,
      action: 'LOGOUT',
      correlation_id: correlationId,
    });
  }

  async changePassword(
    userUuid: string,
    dto: ChangePasswordDto,
    correlationId?: string,
  ): Promise<{ success: boolean; message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { user_uuid: userUuid },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Verify current password
    const isValid = await bcrypt.compare(dto.currentPassword, user.password_hash);
    if (!isValid) {
      throw new BadRequestException('Current password verification failed');
    }

    const newHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({
      where: { user_uuid: userUuid },
      data: { password_hash: newHash },
    });

    // Revoke all existing refresh tokens for security
    await this.prisma.refreshToken.updateMany({
      where: { user_uuid: userUuid },
      data: { revoked: true },
    });

    await this.activityService.logActivity({
      user_uuid: userUuid,
      actor_uuid: userUuid,
      action: 'PASSWORD_CHANGE',
      correlation_id: correlationId,
    });

    return { success: true, message: 'Password updated successfully' };
  }

  // Social Authentication Framework (Requirement 9.8)
  async handleSocialAuth(
    dto: SocialAuthDto,
    ip?: string,
    userAgent?: string,
    correlationId?: string,
  ): Promise<AuthResponse> {
    // Mock OAuth token exchange / profile extraction
    // In production, exchange dto.token with provider OAuth endpoint
    const mockEmail = `oauth.${dto.provider}.${dto.token.slice(0, 8)}@social-auth.local`;
    let user = await this.prisma.user.findUnique({
      where: { email: mockEmail },
    });

    if (!user) {
      // New accounts received via social auth must ALWAYS receive USER role (Requirement 9.8)
      const randomPassword = await bcrypt.hash(crypto.randomUUID(), 10);
      user = await this.prisma.user.create({
        data: {
          email: mockEmail,
          password_hash: randomPassword,
          first_name: dto.provider.toUpperCase(),
          last_name: 'Member',
          role: PrismaRole.USER,
          status: 'ACTIVE',
        },
      });

      await this.auditService.logAuditEvent({
        actor_uuid: user.user_uuid,
        action: 'SOCIAL_ACCOUNT_CREATED',
        resource_type: 'User',
        affected_resource_uuid: user.user_uuid,
        correlation_id: correlationId,
        after_state: { provider: dto.provider, email: mockEmail },
      });
    }

    const permissions = await this.getUserPermissions(user.role as UserRole);
    const tokens = await this.generateTokens(
      user.user_uuid,
      user.email,
      user.role as UserRole,
      ip,
      userAgent,
      permissions,
    );

    await this.activityService.logActivity({
      user_uuid: user.user_uuid,
      action: 'SOCIAL_LOGIN',
      correlation_id: correlationId,
      metadata: { provider: dto.provider },
      ip_address: ip,
      user_agent: userAgent,
    });

    return {
      user: {
        user_uuid: user.user_uuid,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        phone_number: user.phone_number,
        address: user.address,
        profile_picture_url: user.profile_picture_url,
        role: user.role as UserRole,
        status: user.status as UserStatus,
        permissions,
        created_at: user.created_at,
        updated_at: user.updated_at,
      },
      tokens,
    };
  }

  async getProfile(userUuid: string): Promise<User> {
    const user = await this.prisma.user.findUnique({
      where: { user_uuid: userUuid },
      select: {
        user_uuid: true,
        email: true,
        first_name: true,
        last_name: true,
        phone_number: true,
        address: true,
        profile_picture_url: true,
        role: true,
        status: true,
        last_login_at: true,
        created_at: true,
        updated_at: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const permissions = await this.permissionsService.getEffectivePermissions(
      user.user_uuid,
      user.role as UserRole,
    );

    return {
      ...user,
      role: user.role as UserRole,
      status: user.status as UserStatus,
      permissions,
    };
  }

  private async getUserPermissions(role: UserRole): Promise<string[]> {
    if (role === UserRole.SUPER_ADMIN) {
      const allPerms = await this.prisma.permission.findMany({ select: { code: true } });
      return allPerms.map((p) => p.code);
    }
    const rolePerms = await this.prisma.rolePermission.findMany({
      where: { role_code: role },
      include: { permission: true },
    });
    return rolePerms.map((rp) => rp.permission.code);
  }

  private async generateTokens(
    userUuid: string,
    email: string,
    role: UserRole,
    ip?: string,
    userAgent?: string,
    permissions: string[] = [],
  ): Promise<JwtTokens> {
    const tokenId = crypto.randomUUID();

    const accessSecret = this.configService.get<string>('jwt.accessSecret');
    const refreshSecret = this.configService.get<string>('jwt.refreshSecret');
    const accessExpiresIn = this.configService.get<string>('jwt.accessExpiresIn', '15m');
    const refreshExpiresIn = this.configService.get<string>('jwt.refreshExpiresIn', '7d');

    const accessToken = this.jwtService.sign(
      { sub: userUuid, email, role, tokenId, permissions },
      { secret: accessSecret, expiresIn: accessExpiresIn },
    );

    const refreshToken = this.jwtService.sign(
      { sub: userUuid, email, role, tokenId: crypto.randomUUID() },
      { secret: refreshSecret, expiresIn: refreshExpiresIn },
    );

    const tokenHash = this.hashToken(refreshToken);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.prisma.refreshToken.create({
      data: {
        token_hash: tokenHash,
        user_uuid: userUuid,
        expires_at: expiresAt,
        ip_address: ip,
        user_agent: userAgent,
      },
    });

    return { accessToken, refreshToken };
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
