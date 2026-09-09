import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Permission, ROLE_PERMISSIONS, UserRole } from '@school-erp/shared';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No permission restriction on this route
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    // SUPER_ADMIN has global master permissions
    if (user.role === 'SUPER_ADMIN') {
      return true;
    }

    const userPermissions = ROLE_PERMISSIONS[user.role as UserRole] ?? [];
    const hasAllPermissions = requiredPermissions.every((p) =>
      userPermissions.includes(p),
    );

    if (!hasAllPermissions) {
      const missing = requiredPermissions.filter(
        (p) => !userPermissions.includes(p),
      );
      throw new ForbiddenException(
        `Insufficient permissions. Missing: ${missing.join(', ')}`,
      );
    }

    return true;
  }
}
