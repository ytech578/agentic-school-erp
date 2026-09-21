import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { firstValueFrom, isObservable } from 'rxjs';
import { Request } from 'express';
import { PrismaService } from '../../../core/database/prisma.service';
import { hashRefreshToken } from '../utils/refresh-token.util';

@Injectable()
export class JwtRefreshGuard extends AuthGuard('jwt-refresh') {
  constructor(private prisma: PrismaService) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      // 1. Primary path: passport-jwt strategy verification for signed JWT refresh tokens
      const result = super.canActivate(context);
      const can = isObservable(result)
        ? await firstValueFrom(result)
        : await result;
      if (can) return true;
    } catch {
      // 2. Resilient fallback: support legacy opaque hex tokens or transient validation
      const req = context.switchToHttp().getRequest<Request>();
      const refreshToken =
        req.cookies?.['refresh_token'] ||
        req.body?.refreshToken ||
        (Array.isArray(req.headers['x-refresh-token'])
          ? req.headers['x-refresh-token'][0]
          : req.headers['x-refresh-token']);

      if (!refreshToken || typeof refreshToken !== 'string') {
        throw new UnauthorizedException('No refresh token provided');
      }

      const tokenHash = hashRefreshToken(refreshToken);
      const session = await this.prisma.userSession.findUnique({
        where: { refreshToken: tokenHash },
        include: { user: true },
      });

      if (
        !session ||
        session.status !== 'ACTIVE' ||
        session.expiresAt < new Date()
      ) {
        throw new UnauthorizedException('Session expired. Please login again.');
      }

      req.user = {
        sub: session.userId,
        email: session.user.email,
        role: session.user.role,
        schoolId: session.user.schoolId,
      };

      return true;
    }
    return false;
  }
}
