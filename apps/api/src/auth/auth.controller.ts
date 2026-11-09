import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  Sse,
  MessageEvent,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';
import { PermissionsService } from './services/permissions.service';
import { Public } from './decorators/public.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { CorrelationId } from '../common/middleware/correlation-id.middleware';
import {
  RegisterDto,
  LoginDto,
  RefreshTokenDto,
  ChangePasswordDto,
  SocialAuthDto,
} from '@monorepo/shared-types';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly permissionsService: PermissionsService,
  ) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register a new standard user account (default USER role)' })
  @ApiResponse({ status: 201, description: 'User successfully registered' })
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @CorrelationId() correlationId: string,
  ) {
    const ip = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    const result = await this.authService.register(dto, ip, userAgent, correlationId);

    res.cookie('refreshToken', result.tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/auth/refresh',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return result;
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate with email and password (no role selection)' })
  @ApiResponse({ status: 200, description: 'Authenticated successfully' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @CorrelationId() correlationId: string,
  ) {
    const ip = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    const result = await this.authService.login(dto, ip, userAgent, correlationId);

    res.cookie('refreshToken', result.tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/auth/refresh',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return result;
  }

  @Public()
  @Post('social')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'OAuth 2.0 social sign-in (Google, Facebook, Apple, Instagram)' })
  async socialAuth(
    @Body() dto: SocialAuthDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @CorrelationId() correlationId: string,
  ) {
    const ip = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    const result = await this.authService.handleSocialAuth(dto, ip, userAgent, correlationId);

    res.cookie('refreshToken', result.tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/auth/refresh',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return result;
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate and exchange refresh token for new access token' })
  async refresh(
    @Body() body: RefreshTokenDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @CorrelationId() correlationId: string,
  ) {
    const token = body.refreshToken || req.cookies?.refreshToken;
    const ip = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const newTokens = await this.authService.refreshTokens(token, ip, userAgent, correlationId);

    res.cookie('refreshToken', newTokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/auth/refresh',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return newTokens;
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout and blacklist current session' })
  async logout(
    @CurrentUser('user_uuid') userUuid: string,
    @CurrentUser('tokenId') tokenId: string,
    @Body() body: Partial<RefreshTokenDto>,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @CorrelationId() correlationId: string,
  ) {
    const refreshToken = body.refreshToken || req.cookies?.refreshToken;
    await this.authService.logout(userUuid, tokenId, refreshToken, correlationId);

    res.clearCookie('refreshToken', { path: '/api/auth/refresh' });
    return { message: 'Successfully logged out' };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change password requiring current password verification' })
  async changePassword(
    @CurrentUser('user_uuid') userUuid: string,
    @Body() dto: ChangePasswordDto,
    @CorrelationId() correlationId: string,
  ) {
    return this.authService.changePassword(userUuid, dto, correlationId);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: 'Get current user profile, role, and permissions' })
  async getProfile(@CurrentUser('user_uuid') userUuid: string) {
    return this.authService.getProfile(userUuid);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('effective-permissions')
  @ApiOperation({ summary: 'Get live effective permissions breakdown for authenticated user' })
  async getEffectivePermissions(@CurrentUser('user_uuid') userUuid: string) {
    return this.permissionsService.getEffectivePermissionsDetail(userUuid);
  }

  @Get('permissions/version')
  @Public()
  @ApiOperation({ summary: 'Get current global permissions cache version' })
  async getPermissionsVersion() {
    return { version: await this.permissionsService.getVersion() };
  }

  @Sse('permissions/stream')
  @Public()
  @ApiOperation({ summary: 'Server-Sent Events (SSE) real-time stream for permission invalidations' })
  streamPermissions(): Observable<MessageEvent> {
    return this.permissionsService.getStream();
  }
}
