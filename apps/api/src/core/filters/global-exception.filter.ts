import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';
import { ZodError } from 'zod';
import { isScimRequest } from '../http/protocol-response';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const requestPath = request.url.split('?')[0];

    let status: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let error = 'INTERNAL_SERVER_ERROR';
    let details: unknown = undefined;

    // ─── NestJS HTTP Exceptions ─────────────────────────────────────────
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null
      ) {
        const res = exceptionResponse as Record<string, unknown>;
        message = (res.message as string) || message;
        // Domain error codes (for example MFA_REQUIRED) are safe, stable
        // machine-readable signals for the client. Prefer them over Nest's
        // generic "Unauthorized" label when one is supplied.
        error =
          (typeof res.code === 'string' ? res.code : undefined) ||
          (res.error as string) ||
          error;
        details = res.details;
      }
    }

    // ─── Prisma Errors ─────────────────────────────────────────────────
    else if (exception instanceof ZodError) {
      status = HttpStatus.BAD_REQUEST;
      message = 'Validation failed';
      error = 'VALIDATION_ERROR';
      details = exception.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      }));
    }

    // Prisma query errors
    else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      switch (exception.code) {
        case 'P2002': {
          // Unique constraint violation
          status = HttpStatus.CONFLICT;
          const fields = (exception.meta?.target as string[]) || [];
          message = `A record with this ${fields.join(', ')} already exists`;
          error = 'DUPLICATE_ENTRY';
          break;
        }
        case 'P2025': {
          // Record not found
          status = HttpStatus.NOT_FOUND;
          message = 'Record not found';
          error = 'NOT_FOUND';
          break;
        }
        case 'P2003': {
          // Foreign key constraint
          status = HttpStatus.BAD_REQUEST;
          message = 'Related record not found';
          error = 'FOREIGN_KEY_CONSTRAINT';
          break;
        }
        default: {
          this.logger.error(
            `Prisma error ${exception.code}: ${exception.message}`,
          );
          message = 'Database operation failed';
          error = 'DATABASE_ERROR';
        }
      }
    }

    // ─── Prisma Validation Errors ────────────────────────────────────
    else if (exception instanceof Prisma.PrismaClientValidationError) {
      status = HttpStatus.BAD_REQUEST;
      message = 'Invalid data provided';
      error = 'VALIDATION_ERROR';
    }

    // ─── Unknown Errors ──────────────────────────────────────────────
    else {
      this.logger.error('Unexpected error:', exception);
      if (process.env.NODE_ENV === 'development') {
        message = (exception as Error)?.message || message;
      }
    }

    const responseBody = {
      success: false,
      statusCode: status,
      error,
      message,
      ...(details ? { details } : {}),
      path: requestPath,
      timestamp: new Date().toISOString(),
    };

    this.logger.warn(
      `${request.method} ${requestPath} → ${status}: ${message}`,
    );

    if (isScimRequest(request)) {
      response
        .status(status)
        .type('application/scim+json')
        .json({
          schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
          status: String(status),
          detail:
            status >= 500
              ? 'The provisioning request could not be completed'
              : message,
          ...(status === 409 ? { scimType: 'uniqueness' } : {}),
        });
      return;
    }
    response.status(status).json(responseBody);
  }
}
