import {
  PipeTransform,
  ArgumentMetadata,
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { ZodError } from 'zod';
import type { ZodSchema } from 'zod';

@Injectable()
export class ZodValidationPipe implements PipeTransform<unknown, unknown> {
  constructor(private schema: ZodSchema) {}

  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    if (metadata.type === 'custom') {
      return value;
    }

    try {
      const parsedValue: unknown = this.schema.parse(value);
      return parsedValue;
    } catch (error) {
      if (error instanceof ZodError) {
        throw new BadRequestException({
          message: 'Validation failed',
          errors: error.issues.map((err) => ({
            field: err.path.join('.'),
            message: err.message,
          })),
        });
      }
      throw new BadRequestException('Validation failed');
    }
  }
}
