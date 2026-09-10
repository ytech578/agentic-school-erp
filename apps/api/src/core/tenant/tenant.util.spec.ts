import {
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  requireSchoolId,
  getTenantContext,
  assertSchoolAccess,
} from './tenant.util';
import { UserRole } from '@school-erp/shared';

describe('Tenant Utility (tenant.util)', () => {
  describe('requireSchoolId — fail-closed tenant validation', () => {
    it('should return trimmed schoolId when given a valid non-empty string', () => {
      expect(requireSchoolId('school_123')).toBe('school_123');
      expect(requireSchoolId('  school_456  ')).toBe('school_456');
    });

    it('should throw ForbiddenException when schoolId is undefined', () => {
      expect(() => requireSchoolId(undefined)).toThrow(ForbiddenException);
      expect(() => requireSchoolId(undefined, 'TestOp')).toThrow(
        /TestOp: Valid school context is required/,
      );
    });

    it('should throw ForbiddenException when schoolId is null', () => {
      expect(() => requireSchoolId(null)).toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when schoolId is empty string or only whitespace', () => {
      expect(() => requireSchoolId('')).toThrow(ForbiddenException);
      expect(() => requireSchoolId('   ')).toThrow(ForbiddenException);
    });
  });

  describe('getTenantContext — trusted authentication context extraction', () => {
    it('should extract tenant context for school-scoped roles (isGlobal = false)', () => {
      const user: { id: string; role: UserRole; schoolId: string } = {
        id: 'usr_1',
        role: 'SCHOOL_ADMIN',
        schoolId: 'school_abc',
      };
      const context = getTenantContext(user);

      expect(context.userId).toBe('usr_1');
      expect(context.role).toBe('SCHOOL_ADMIN');
      expect(context.schoolId).toBe('school_abc');
      expect(context.isGlobal).toBe(false);
    });

    it('should mark SUPER_ADMIN as isGlobal = true', () => {
      const superAdminUser: { id: string; role: UserRole; schoolId: null } = {
        id: 'usr_sa',
        role: 'SUPER_ADMIN',
        schoolId: null,
      };
      const context = getTenantContext(superAdminUser);

      expect(context.userId).toBe('usr_sa');
      expect(context.role).toBe('SUPER_ADMIN');
      expect(context.isGlobal).toBe(true);
    });

    it('should throw UnauthorizedException when user identity is missing', () => {
      expect(() => getTenantContext(null as unknown as { id: string })).toThrow(
        UnauthorizedException,
      );
      expect(() => getTenantContext({})).toThrow(UnauthorizedException);
    });
  });

  describe('assertSchoolAccess — cross-school boundary enforcement', () => {
    it('should succeed when userSchoolId matches targetSchoolId', () => {
      expect(() => assertSchoolAccess('school_1', 'school_1')).not.toThrow();
    });

    it('should throw NotFoundException (404) when schoolId does not match (preventing enumeration)', () => {
      expect(() => assertSchoolAccess('school_A', 'school_B')).toThrow(
        NotFoundException,
      );
      expect(() => assertSchoolAccess('school_A', 'school_B')).toThrow(
        'Resource not found',
      );
    });

    it('should bypass school check when isGlobal is true', () => {
      expect(() =>
        assertSchoolAccess('school_A', 'school_B', true),
      ).not.toThrow();
    });

    it('should throw ForbiddenException when userSchoolId is missing (fail-closed)', () => {
      expect(() => assertSchoolAccess(null, 'school_B')).toThrow(
        ForbiddenException,
      );
    });
  });
});
