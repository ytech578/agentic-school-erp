import {
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { UserRole } from '@school-erp/shared';

export interface TenantContext {
  userId: string;
  role: UserRole;
  schoolId: string | null;
  isGlobal: boolean;
}

/**
 * Validates and enforces that a non-empty, valid schoolId string is provided.
 * Fails closed: throws ForbiddenException if schoolId is undefined, null, or empty string.
 */
export function requireSchoolId(
  schoolId: string | null | undefined,
  contextName = 'School operation',
): string {
  if (
    schoolId === undefined ||
    schoolId === null ||
    typeof schoolId !== 'string' ||
    schoolId.trim().length === 0
  ) {
    throw new ForbiddenException(
      `${contextName}: Valid school context is required (fail-closed)`,
    );
  }
  return schoolId.trim();
}

/**
 * Validates tenant context from an authenticated user payload.
 * Identifies if user is a global platform admin (SUPER_ADMIN)
 * or a school-scoped user.
 */
export function getTenantContext(user: {
  id?: string;
  sub?: string;
  role?: UserRole;
  schoolId?: string | null;
}): TenantContext {
  if (!user || (!user.id && !user.sub)) {
    throw new UnauthorizedException('Authentication required');
  }

  const userId = user.id || user.sub!;
  const role = user.role as UserRole;
  const isGlobal = role === 'SUPER_ADMIN';

  return {
    userId,
    role,
    schoolId: user.schoolId || null,
    isGlobal,
  };
}

/**
 * Asserts that the authenticated user has access to the target schoolId.
 * Global platform admins (SUPER_ADMIN) may operate across schools when explicitly permitted.
 * School-scoped users MUST match the target schoolId.
 * If there is a mismatch, throws NotFoundException (404) to avoid leaking resource existence.
 */
export function assertSchoolAccess(
  userSchoolId: string | null | undefined,
  targetSchoolId: string | null | undefined,
  isGlobal = false,
): void {
  if (isGlobal) return;
  const current = requireSchoolId(userSchoolId);
  if (!targetSchoolId || current !== targetSchoolId) {
    throw new NotFoundException('Resource not found');
  }
}
