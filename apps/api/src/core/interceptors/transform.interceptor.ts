import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import type { Response } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiResponse<T> {
  success: boolean;
  statusCode: number;
  data: T;
  meta?: unknown;
  message?: string;
  timestamp: string;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  ApiResponse<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    const response = context.switchToHttp().getResponse<Response>();

    return next.handle().pipe(
      map((data: unknown) => {
        // If the handler returned an object with a `data` key,
        // unwrap it to prevent double-wrapping while preserving pagination `meta`.
        if (
          data &&
          typeof data === 'object' &&
          !Array.isArray(data) &&
          'data' in data
        ) {
          const payload = data as Record<string, unknown>;
          return {
            success: true,
            statusCode: response?.statusCode ?? 200,
            data: payload.data as T,
            meta: payload.meta,
            message:
              typeof payload.message === 'string' ? payload.message : undefined,
            timestamp: new Date().toISOString(),
          };
        }

        return {
          success: true,
          statusCode: response?.statusCode ?? 200,
          data: data as T,
          timestamp: new Date().toISOString(),
        };
      }),
    );
  }
}
