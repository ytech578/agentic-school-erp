import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { PrismaService } from '../../../core/database/prisma.service';
import { hashRefreshToken } from '../utils/refresh-token.util';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(
    config: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      // Extract refresh token from HttpOnly cookie
      jwtFromRequest: (req: Request) => req.cookies?.['refresh_token'],
      ignoreExpiration: true, // We manually check session expiry
      secretOrKey: config.getOrThrow<string>('jwt.refreshSecret'),
      passReqToCallback: true,
    } as any);
  }

  async validate(req: Request, payload: any) {
    const cookies = req.cookies as Record<string, unknown> | undefined;
    const refreshToken = cookies?.['refresh_token'];
    if (typeof refreshToken !== 'string' || !refreshToken) {
      throw new UnauthorizedException('No refresh token provided');
    }

    const tokenHash = hashRefreshToken(refreshToken);

    const session = await this.prisma.userSession.findUnique({
      where: { refreshToken: tokenHash },
    });

    if (
      !session ||
      session.status !== 'ACTIVE' ||
      session.expiresAt < new Date()
    ) {
      throw new UnauthorizedException('Session expired. Please login again.');
    }

    return payload;
  }
}
