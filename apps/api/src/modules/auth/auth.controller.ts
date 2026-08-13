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
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiCookieAuth } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { LoginSchema, ForgotPasswordSchema, ResetPasswordSchema } from '@school-erp/shared';
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
    const ipAddress = (req.headers['x-forwarded-for'] as string) || req.ip || '';
    const userAgent = req.headers['user-agent'] || '';

    const result = await this.authService.login(dto, ipAddress, userAgent);

    // Set refresh token as HttpOnly cookie
    this.setRefreshTokenCookie(res, result.refreshToken);

    return {
      data: {
        user: result.user,
        accessToken: result.accessToken,
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
    const refreshToken = req.cookies?.['refresh_token'];
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
  @ApiOperation({ summary: 'Refresh access token using refresh token cookie' })
  async refreshToken(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies?.['refresh_token'];
    const ipAddress = (req.headers['x-forwarded-for'] as string) || req.ip || '';

    const tokens = await this.authService.refreshTokens(refreshToken, ipAddress);
    this.setRefreshTokenCookie(res, tokens.refreshToken);

    return {
      data: { accessToken: tokens.accessToken },
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
    await this.authService.forgotPassword(email);
    // Always return same message (prevents email enumeration)
    return {
      data: null,
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
    return { data: null, message: 'Password reset successful. Please login with your new password.' };
  }

  // ─── Private Cookie Helpers ───────────────────────────────────────────────

  private setRefreshTokenCookie(res: Response, token: string) {
    const isProduction = this.config.get('app.nodeEnv') === 'production';
    const maxAge = this.config.get<number>('jwt.refreshExpiresInMs', 7 * 24 * 60 * 60 * 1000);

    res.cookie('refresh_token', token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge,
      path: '/api/auth', // Only sent to auth endpoints
    });
  }

  private clearRefreshTokenCookie(res: Response) {
    res.clearCookie('refresh_token', {
      httpOnly: true,
      secure: this.config.get('app.nodeEnv') === 'production',
      sameSite: 'lax',
      path: '/api/auth',
    });
  }
}
