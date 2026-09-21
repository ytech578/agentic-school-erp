import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditAction } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const EXCLUDED_PATHS = [
  '/auth/login',
  '/auth/refresh',
  '/auth/forgot-password',
  '/auth/reset-password',
];

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditLogInterceptor.name);

  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const http = context.switchToHttp();
    const request = http.getRequest();

    if (!request || !MUTATION_METHODS.has(request.method)) {
      return next.handle();
    }

    const url = request.originalUrl || request.url || '';
    if (EXCLUDED_PATHS.some((path) => url.includes(path))) {
      return next.handle();
    }

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
              user.schoolId || request.headers['x-school-id'] || null;

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
                  request.headers['x-forwarded-for'] ||
                  ''
                )
                  .toString()
                  .slice(0, 45),
                userAgent: (request.headers['user-agent'] || '').slice(0, 255),
                after: sanitizedAfter
                  ? JSON.parse(JSON.stringify(sanitizedAfter))
                  : null,
              },
            });
          } catch (err: any) {
            this.logger.warn(
              `Failed to record audit activity log: ${err?.message}`,
            );
          }
        },
      }),
    );
  }

  private sanitizeData(data: any): any {
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
    const sanitized: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
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
