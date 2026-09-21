import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiCookieAuth,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import {
  LoginSchema,
  ForgotPasswordSchema,
  ResetPasswordSchema,
} from '@school-erp/shared';
import type { JwtPayload } from '@school-erp/shared';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private authService: AuthService,
    private config: ConfigService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 attempts per minute
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 423, description: 'Account locked' })
  async login(
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const dto = LoginSchema.parse(body);
    const ipAddress =
      (req.headers['x-forwarded-for'] as string) || req.ip || '';
    const userAgent = req.headers['user-agent'] || '';

    const result = await this.authService.login(dto, ipAddress, userAgent);

    // Set refresh token as HttpOnly cookie
    this.setRefreshTokenCookie(res, result.refreshToken);

    return {
      data: {
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      },
      message: 'Login successful',
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Logout and revoke session' })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @CurrentUser() user: JwtPayload,
  ) {
    const refreshToken =
      req.cookies?.['refresh_token'] ||
      req.body?.refreshToken ||
      (req.headers['x-refresh-token'] as string);
    if (refreshToken) {
      await this.authService.logout(refreshToken, user.sub);
    }
    this.clearRefreshTokenCookie(res);
    return { data: null, message: 'Logged out successfully' };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtRefreshGuard)
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Refresh access token using refresh token cookie, body, or header',
  })
  async refreshToken(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken =
      req.cookies?.['refresh_token'] ||
      req.body?.refreshToken ||
      (req.headers['x-refresh-token'] as string);
    const ipAddress =
      (req.headers['x-forwarded-for'] as string) || req.ip || '';

    const tokens = await this.authService.refreshTokens(
      refreshToken,
      ipAddress,
    );
    this.setRefreshTokenCookie(res, tokens.refreshToken);

    return {
      data: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      },
      message: 'Token refreshed',
    };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get current authenticated user profile' })
  async getMe(@CurrentUser() user: JwtPayload) {
    const profile = await this.authService.getMe(user.sub);
    return { data: profile };
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 300000 } }) // 3 attempts per 5 minutes
  @ApiOperation({ summary: 'Send password reset email' })
  async forgotPassword(@Body() body: unknown) {
    const { email } = ForgotPasswordSchema.parse(body);
    const result = await this.authService.forgotPassword(email);
    // Always return standard message; in non-prod result contains devSimulation details
    return {
      data: result || null,
      message: 'If the email exists, a password reset link has been sent',
    };
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 300000 } })
  @ApiOperation({ summary: 'Reset password using token from email' })
  async resetPassword(@Body() body: unknown) {
    const dto = ResetPasswordSchema.parse(body);
    await this.authService.resetPassword(dto);
    return {
      data: null,
      message:
        'Password reset successful. Please login with your new password.',
    };
  }

  // ─── Private Cookie Helpers ───────────────────────────────────────────────

  private setRefreshTokenCookie(res: Response, token: string) {
    const isProduction = this.config.get('app.nodeEnv') === 'production';
    const maxAge = this.config.get<number>(
      'jwt.refreshExpiresInMs',
      7 * 24 * 60 * 60 * 1000,
    );
    const sameSite = isProduction
      ? this.config.get<'lax' | 'none' | 'strict'>('app.cookieSameSite') ||
        'none'
      : 'lax';

    res.cookie('refresh_token', token, {
      httpOnly: true,
      secure: isProduction,
      sameSite,
      maxAge,
      path: '/',
    });
  }

  private clearRefreshTokenCookie(res: Response) {
    const isProduction = this.config.get('app.nodeEnv') === 'production';
    const sameSite = isProduction
      ? this.config.get<'lax' | 'none' | 'strict'>('app.cookieSameSite') ||
        'none'
      : 'lax';

    res.clearCookie('refresh_token', {
      httpOnly: true,
      secure: isProduction,
      sameSite,
      path: '/',
    });
  }
}
