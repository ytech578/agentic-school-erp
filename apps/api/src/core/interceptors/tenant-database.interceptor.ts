import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Observable, from, lastValueFrom } from 'rxjs';
import { PrismaService } from '../database/prisma.service';
import type { AuthenticatedUser } from '../types/auth-request.interface';

interface RequestWithUser {
  user?: AuthenticatedUser;
  originalUrl?: string;
  url?: string;
}

const ANONYMOUS_DATABASE_ROUTES = [
  '/auth/login',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/sso/',
  '/health',
  '/certificates/verify',
];

const PLATFORM_FLEET_ROUTES = [
  '/auth/',
  '/users/me',
  '/schools',
  '/subscriptions',
  '/enterprise-identity/break-glass',
  '/enterprise-identity/scim-tokens',
];

@Injectable()
export class TenantDatabaseInterceptor implements NestInterceptor {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const enabled =
      this.config.get<string>('DATABASE_RLS_ENABLED') === 'true' ||
      this.config.get<string>('app.nodeEnv') === 'production';
    if (!enabled) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;
    const url = request.originalUrl || request.url || '';
    // A platform administrator in fleet mode may inspect cross-tenant fleet
    // metadata. Once a target school is selected (via an approved break-glass
    // grant), RLS constrains the request to that school like every other user.
    const isPlatformAdmin =
      user?.role === 'SUPER_ADMIN' &&
      user.schoolId === null &&
      PLATFORM_FLEET_ROUTES.some((route) => url.includes(route));

    return from(
      this.prisma.runWithSecurityContext(
        {
          schoolId: user?.schoolId ?? null,
          userId: user?.id ?? user?.sub ?? null,
          isPlatformAdmin,
          // Authentication and standards discovery must be able to locate the
          // tenant before a user context exists. Route services still enforce
          // their own credential/token validation.
          bypassRls:
            !user &&
            ANONYMOUS_DATABASE_ROUTES.some((route) => url.includes(route)),
        },
        () => lastValueFrom(next.handle()),
      ),
    );
  }
}
