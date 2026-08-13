import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@school-erp/shared';

export const ROLES_KEY = 'roles';

/**
 * Decorator to specify which roles can access a route.
 *
 * Usage:
 * @Roles(USER_ROLES.SCHOOL_ADMIN, USER_ROLES.PRINCIPAL)
 * @Get('students')
 * findAll() { ... }
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
