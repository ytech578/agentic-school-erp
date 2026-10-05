import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditAction, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const EXCLUDED_PATHS = [
  '/auth/login',
  '/auth/refresh',
  '/auth/forgot-password',
  '/auth/reset-password',
];

interface RequestLike {
  method?: string;
  originalUrl?: string;
  url?: string;
  body?: Record<string, unknown>;
  params?: Record<string, string>;
  headers?: Record<string, string | string[] | undefined>;
  user?: {
    id?: string;
    schoolId?: string;
    role?: string;
    [key: string]: unknown;
  };
  route?: { path?: string };
  ip?: string;
  socket?: { remoteAddress?: string };
}

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditLogInterceptor.name);

  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const http = context.switchToHttp();
    const request = http.getRequest<RequestLike>();

    if (!request || !request.method || !MUTATION_METHODS.has(request.method)) {
      return next.handle();
    }

    const url = request.originalUrl || request.url || '';
    if (EXCLUDED_PATHS.some((path) => url.includes(path))) {
      return next.handle();
    }

    // Capture incoming payload as the "before" state (intent of mutation)
    const beforeState =
      request.body && Object.keys(request.body).length > 0
        ? this.sanitizeData(
            JSON.parse(JSON.stringify(request.body)) as Record<string, unknown>,
          )
        : null;

    return next.handle().pipe(
      tap({
        next: async (responseBody) => {
          try {
            const user = request.user;
            if (!user || !user.id) return;

            let action: AuditAction = AuditAction.UPDATE;
            if (request.method === 'POST') action = AuditAction.CREATE;
            if (request.method === 'DELETE') action = AuditAction.DELETE;

            const controllerName =
              context.getClass()?.name?.replace(/Controller$/, '') || 'System';
            const resourceId = request.params?.id || request.body?.id || null;
            const schoolId =
              user.schoolId || request.headers?.['x-school-id'] || null;

            // Sanitize payload: strip passwords, secrets, tokens
            const sanitizedAfter = this.sanitizeData(
              responseBody?.data ?? responseBody,
            );

            await this.prisma.activityLog.create({
              data: {
                schoolId: typeof schoolId === 'string' ? schoolId : null,
                userId: user.id,
                action,
                module: controllerName.toUpperCase(),
                resourceId: resourceId ? String(resourceId) : null,
                resourceType: controllerName,
                description: `${request.method} ${request.route?.path || url} executed by ${user.role || 'USER'}`,
                ipAddress: (
                  request.ip ||
                  request.headers?.['x-forwarded-for'] ||
                  ''
                )
                  .toString()
                  .slice(0, 45),
                userAgent: String(request.headers?.['user-agent'] || '').slice(
                  0,
                  255,
                ),
                before: beforeState
                  ? (beforeState as Prisma.InputJsonValue)
                  : Prisma.DbNull,
                after: sanitizedAfter
                  ? (sanitizedAfter as unknown as Prisma.InputJsonValue)
                  : Prisma.DbNull,
              },
            });
          } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.warn(`Failed to record audit activity log: ${message}`);
          }
        },
      }),
    );
  }

  private sanitizeData(data: unknown): Record<string, unknown> | null {
    if (!data || typeof data !== 'object') return null;
    const sensitiveKeys = new Set([
      'password',
      'passwordHash',
      'token',
      'refreshToken',
      'secret',
      'twoFactorSecret',
    ]);
    if (Array.isArray(data)) {
      return {
        count: data.length,
        sample: data.slice(0, 2).map((item) => this.sanitizeData(item)),
      };
    }
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(
      data as Record<string, unknown>,
    )) {
      if (sensitiveKeys.has(key)) continue;
      if (value !== null && typeof value === 'object') {
        sanitized[key] = '[Object]';
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }
}
