import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { PrismaService } from '../../../core/database/prisma.service';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(
    config: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      // Extract refresh token from HttpOnly cookie
      jwtFromRequest: (req: Request) => req.cookies?.['refresh_token'],
      ignoreExpiration: true, // We manually check session expiry
      secretOrKey: config.get<string>('jwt.refreshSecret') || 'secret',
      passReqToCallback: true,
    } as any);
  }

  async validate(req: Request, payload: any) {
    const refreshToken = req.cookies?.['refresh_token'];
    if (!refreshToken) {
      throw new UnauthorizedException('No refresh token provided');
    }

    const session = await this.prisma.userSession.findUnique({
      where: { refreshToken },
    });

    if (!session || session.status !== 'ACTIVE' || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Session expired. Please login again.');
    }

    return payload;
  }
}
