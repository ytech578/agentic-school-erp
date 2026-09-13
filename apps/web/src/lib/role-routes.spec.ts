import { isRouteAllowedForRole, getAuthorizedRedirect } from './role-routes';

describe('Role-Based Routes & Cross-Portal Redirection Guard', () => {
  describe('isRouteAllowedForRole', () => {
    it('allows universal dashboard, messages, and settings for all roles', () => {
      const roles = ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER', 'STUDENT', 'PARENT'];
      for (const role of roles) {
        expect(isRouteAllowedForRole('/dashboard', role)).toBe(true);
        expect(isRouteAllowedForRole('/messages', role)).toBe(true);
        expect(isRouteAllowedForRole('/settings', role)).toBe(true);
      }
    });

    it('strictly isolates Parent portal routes to PARENT only', () => {
      expect(isRouteAllowedForRole('/parent-fees', 'PARENT')).toBe(true);
      expect(isRouteAllowedForRole('/parent/academics', 'PARENT')).toBe(true);
      expect(isRouteAllowedForRole('/parent/attendance', 'PARENT')).toBe(true);

      // Denied for all other roles
      expect(isRouteAllowedForRole('/parent-fees', 'SCHOOL_ADMIN')).toBe(false);
      expect(isRouteAllowedForRole('/parent-fees', 'SUPER_ADMIN')).toBe(false);
      expect(isRouteAllowedForRole('/parent-fees', 'PRINCIPAL')).toBe(false);
      expect(isRouteAllowedForRole('/parent-fees', 'TEACHER')).toBe(false);
      expect(isRouteAllowedForRole('/parent-fees', 'STUDENT')).toBe(false);
      expect(isRouteAllowedForRole('/parent/attendance', 'TEACHER')).toBe(false);
      expect(isRouteAllowedForRole('/parent/academics', 'STUDENT')).toBe(false);
    });

    it('strictly isolates Student portal routes to STUDENT only', () => {
      expect(isRouteAllowedForRole('/student/attendance', 'STUDENT')).toBe(true);
      expect(isRouteAllowedForRole('/student/timetable', 'STUDENT')).toBe(true);

      // Denied for other roles
      expect(isRouteAllowedForRole('/student/attendance', 'TEACHER')).toBe(false);
      expect(isRouteAllowedForRole('/student/attendance', 'PARENT')).toBe(false);
      expect(isRouteAllowedForRole('/student/attendance', 'SCHOOL_ADMIN')).toBe(false);
    });

    it('allows /students directory for Admin and Teachers, but not Student or Parent', () => {
      expect(isRouteAllowedForRole('/students', 'SCHOOL_ADMIN')).toBe(true);
      expect(isRouteAllowedForRole('/students', 'TEACHER')).toBe(true);
      expect(isRouteAllowedForRole('/students', 'STUDENT')).toBe(false);
      expect(isRouteAllowedForRole('/students', 'PARENT')).toBe(false);
    });

    it('strictly isolates Admin Fee management (/fees) to Admins and Principals', () => {
      expect(isRouteAllowedForRole('/fees', 'SUPER_ADMIN')).toBe(true);
      expect(isRouteAllowedForRole('/fees', 'SCHOOL_ADMIN')).toBe(true);
      expect(isRouteAllowedForRole('/fees', 'PRINCIPAL')).toBe(true);

      expect(isRouteAllowedForRole('/fees', 'PARENT')).toBe(false);
      expect(isRouteAllowedForRole('/fees', 'STUDENT')).toBe(false);
      expect(isRouteAllowedForRole('/fees', 'TEACHER')).toBe(false);
    });

    it('allows Teacher Copilot for Teachers and Admins only', () => {
      expect(isRouteAllowedForRole('/teacher-copilot', 'TEACHER')).toBe(true);
      expect(isRouteAllowedForRole('/teacher-copilot', 'SCHOOL_ADMIN')).toBe(true);
      expect(isRouteAllowedForRole('/teacher-copilot', 'PARENT')).toBe(false);
      expect(isRouteAllowedForRole('/teacher-copilot', 'STUDENT')).toBe(false);
    });

    it('allows Principal portal for Super Admin and Principal only', () => {
      expect(isRouteAllowedForRole('/principal', 'PRINCIPAL')).toBe(true);
      expect(isRouteAllowedForRole('/principal', 'SUPER_ADMIN')).toBe(true);
      expect(isRouteAllowedForRole('/principal', 'TEACHER')).toBe(false);
      expect(isRouteAllowedForRole('/principal', 'PARENT')).toBe(false);
      expect(isRouteAllowedForRole('/principal', 'STUDENT')).toBe(false);
    });
  });

  describe('getAuthorizedRedirect', () => {
    it('redirects Admin attempting to access /parent-fees to /fees', () => {
      expect(getAuthorizedRedirect('/parent-fees', 'SCHOOL_ADMIN')).toBe('/fees');
      expect(getAuthorizedRedirect('/parent-fees', 'SUPER_ADMIN')).toBe('/fees');
      expect(getAuthorizedRedirect('/parent-fees', 'PRINCIPAL')).toBe('/fees');
    });

    it('redirects Parent attempting to access /fees to /parent-fees', () => {
      expect(getAuthorizedRedirect('/fees', 'PARENT')).toBe('/parent-fees');
      expect(getAuthorizedRedirect('/fees/settings', 'PARENT')).toBe('/parent-fees');
    });

    it('redirects Teacher attempting to access /parent-fees or /fees to /dashboard', () => {
      expect(getAuthorizedRedirect('/parent-fees', 'TEACHER')).toBe('/dashboard');
      expect(getAuthorizedRedirect('/fees', 'TEACHER')).toBe('/dashboard');
    });

    it('redirects Student attempting to access /parent-fees or /fees to /dashboard', () => {
      expect(getAuthorizedRedirect('/parent-fees', 'STUDENT')).toBe('/dashboard');
      expect(getAuthorizedRedirect('/fees', 'STUDENT')).toBe('/dashboard');
      expect(getAuthorizedRedirect('/admissions', 'STUDENT')).toBe('/dashboard');
    });

    it('preserves valid requestedPath for authorized roles', () => {
      expect(getAuthorizedRedirect('/parent-fees', 'PARENT')).toBe('/parent-fees');
      expect(getAuthorizedRedirect('/fees', 'SCHOOL_ADMIN')).toBe('/fees');
      expect(getAuthorizedRedirect('/teacher-copilot', 'TEACHER')).toBe('/teacher-copilot');
      expect(getAuthorizedRedirect('/student/attendance', 'STUDENT')).toBe('/student/attendance');
    });

    it('returns /dashboard on empty, root, or login path', () => {
      expect(getAuthorizedRedirect('', 'SCHOOL_ADMIN')).toBe('/dashboard');
      expect(getAuthorizedRedirect('/', 'PARENT')).toBe('/dashboard');
      expect(getAuthorizedRedirect('/login', 'TEACHER')).toBe('/dashboard');
    });
  });
});
