import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { ValkeyService } from '../../cache/valkey.service';
import { PermissionsService } from '../services/permissions.service';
import { TokenPayload, UserRole } from '@monorepo/shared-types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly valkeyService: ValkeyService,
    private readonly permissionsService: PermissionsService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.accessSecret', 'dev_jwt_access_secret_1234567890'),
    });
  }

  async validate(payload: TokenPayload) {
    // 1. Instant revocation check against Valkey cache
    if (payload.tokenId) {
      const isBlacklisted = await this.valkeyService.isTokenBlacklisted(payload.tokenId);
      if (isBlacklisted) {
        throw new UnauthorizedException('Token has been revoked');
      }
    }

    // 2. Fetch user by user_uuid
    const user = await this.prisma.user.findUnique({
      where: { user_uuid: payload.sub },
      select: {
        user_uuid: true,
        email: true,
        first_name: true,
        last_name: true,
        role: true,
        status: true,
        phone_number: true,
        address: true,
        profile_picture_url: true,
      },
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('User account is inactive or suspended');
    }

    // 3. Retrieve live effective permissions (combining role permissions + user grants - user denials)
    const permissions = await this.permissionsService.getEffectivePermissions(
      user.user_uuid,
      user.role as UserRole,
    );

    return {
      ...user,
      id: user.user_uuid, // alias for convenience
      permissions,
      tokenId: payload.tokenId,
    };
  }
}
