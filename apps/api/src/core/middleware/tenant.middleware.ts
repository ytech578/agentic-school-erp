import {
  Injectable,
  NestMiddleware,
  BadRequestException,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const schoolId = req.headers['x-school-id'] || req.query.schoolId;

    const user: any = req.user;
    // If we have a user (e.g., after AuthGuard), ensure the requested tenant matches their schoolId
    if (user && user.schoolId) {
      if (
        schoolId &&
        schoolId !== user.schoolId &&
        user.role !== 'SUPER_ADMIN'
      ) {
        throw new BadRequestException(
          'Tenant mismatch: You cannot access another school’s data.',
        );
      }
      // Auto-inject the user's schoolId if not provided
      if (!schoolId) {
        req.headers['x-school-id'] = user.schoolId;
      }
    }

    next();
  }
}
