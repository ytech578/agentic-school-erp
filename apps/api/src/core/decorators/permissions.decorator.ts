import { SetMetadata } from '@nestjs/common';
import { Permission } from '@school-erp/shared';

export const PERMISSIONS_KEY = 'permissions';

/**
 * Decorator to specify which permissions are required to access a route.
 *
 * Usage:
 * @Permissions(PERMISSIONS.STUDENTS_CREATE)
 * @Post('students')
 * create() { ... }
 */
export const Permissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
