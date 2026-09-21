import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiResponse<T> {
  success: boolean;
  statusCode: number;
  data: T;
  meta?: any;
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
    const response = context.switchToHttp().getResponse();

    return next.handle().pipe(
      map((data) => {
        // If the handler returned an object with a `data` key,
        // unwrap it to prevent double-wrapping while preserving pagination `meta`.
        if (
          data &&
          typeof data === 'object' &&
          !Array.isArray(data) &&
          'data' in data
        ) {
          return {
            success: true,
            statusCode: response.statusCode,
            data: data.data,
            meta: data.meta,
            message: data.message,
            timestamp: new Date().toISOString(),
          };
        }

        return {
          success: true,
          statusCode: response.statusCode,
          data,
          timestamp: new Date().toISOString(),
        };
      }),
    );
  }
}
