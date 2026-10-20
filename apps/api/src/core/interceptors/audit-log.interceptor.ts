import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { concatMap } from 'rxjs/operators';
import { AuditAction } from '@prisma/client';
import { AuditService } from '../audit/audit.service';

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

  constructor(private readonly audit: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<RequestLike>();

    if (!request || !request.method || !MUTATION_METHODS.has(request.method)) {
      return next.handle();
    }

    const url = request.originalUrl || request.url || '';
    if (EXCLUDED_PATHS.some((path) => url.includes(path))) {
      return next.handle();
    }

    return next.handle().pipe(
      concatMap(async (responseBody: unknown) => {
        try {
          const user = request.user;
          if (!user || !user.id) return responseBody;

          let action: AuditAction = AuditAction.UPDATE;
          if (request.method === 'POST') action = AuditAction.CREATE;
          if (request.method === 'DELETE') action = AuditAction.DELETE;

          const controllerName =
            context.getClass()?.name?.replace(/Controller$/, '') || 'System';

          let resourceId: string | null = null;
          if (typeof request.params?.id === 'string') {
            resourceId = request.params.id;
          } else if (
            typeof request.body?.id === 'string' ||
            typeof request.body?.id === 'number'
          ) {
            resourceId = String(request.body.id);
          }

          const schoolId =
            typeof user.schoolId === 'string'
              ? user.schoolId
              : typeof request.headers?.['x-school-id'] === 'string'
                ? request.headers['x-school-id']
                : null;

          // Sanitize payload: strip passwords, secrets, tokens
          const rawData =
            responseBody &&
            typeof responseBody === 'object' &&
            'data' in responseBody
              ? (responseBody as Record<string, unknown>).data
              : responseBody;
          const sanitizedAfter = this.sanitizeData(rawData);

          await this.audit.recordMutation({
            schoolId,
            userId: user.id,
            action,
            module: controllerName.toUpperCase(),
            resourceId,
            resourceType: controllerName,
            description: `${request.method} ${request.route?.path || url} executed by ${user.role || 'USER'}`,
            ipAddress: (
              request.ip ||
              (typeof request.headers?.['x-forwarded-for'] === 'string'
                ? request.headers['x-forwarded-for']
                : '') ||
              ''
            ).slice(0, 45),
            userAgent: String(request.headers?.['user-agent'] || '').slice(
              0,
              255,
            ),
            // An HTTP request body is an actor's intended change, not a
            // persisted pre-mutation snapshot. Do not record it as
            // `before`, because that creates a misleading audit trail.
            // Services that need immutable before/after values must take
            // their snapshot within the transaction that mutates the row.
            before: null,
            after: sanitizedAfter,
          });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          this.logger.warn(`Failed to record audit activity log: ${message}`);
        }
        return responseBody;
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
      'otpauthUri',
      'qrCodeDataUrl',
      'recoveryCodes',
      'accessToken',
      'clientSecret',
      'samlCertificate',
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
      if (
        sensitiveKeys.has(key) ||
        /(?:password|secret|token|recoverycodes)$/i.test(key)
      )
        continue;
      if (value !== null && typeof value === 'object') {
        sanitized[key] = '[Object]';
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }
}
