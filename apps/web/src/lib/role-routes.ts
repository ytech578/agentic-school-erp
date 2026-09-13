export type UserRole =
  | 'SUPER_ADMIN'
  | 'SCHOOL_ADMIN'
  | 'PRINCIPAL'
  | 'TEACHER'
  | 'STUDENT'
  | 'PARENT';

/**
 * Validates whether a specific role is authorized to view the given pathname.
 */
export function isRouteAllowedForRole(pathname: string, role?: string): boolean {
  if (!role) return false;

  const normalized = (pathname || '').toLowerCase().split('?')[0];

  // Universal routes accessible by all authenticated roles
  if (
    normalized === '/dashboard' ||
    normalized.startsWith('/messages') ||
    normalized.startsWith('/settings') ||
    normalized.startsWith('/notifications')
  ) {
    return true;
  }

  // ─── Parent Portal Routes ───
  if (normalized === '/parent-fees' || normalized.startsWith('/parent')) {
    return role === 'PARENT';
  }

  // ─── Student Portal Routes ───
  // Note: /students is the Admin/Teacher student directory, /student is the Student personal portal
  if (normalized.startsWith('/student') && !normalized.startsWith('/students')) {
    return role === 'STUDENT';
  }

  // ─── Finance & Admin Fees ───
  if (normalized.startsWith('/fees')) {
    return ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL'].includes(role);
  }

  // ─── Principal Command Portal ───
  if (normalized.startsWith('/principal')) {
    return ['SUPER_ADMIN', 'PRINCIPAL'].includes(role);
  }

  // ─── Teacher Copilot ───
  if (normalized.startsWith('/teacher-copilot')) {
    return ['TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN'].includes(role);
  }

  // ─── AI Assistant & Automation ───
  if (normalized.startsWith('/automation')) {
    return ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL'].includes(role);
  }
  if (normalized.startsWith('/ai')) {
    return ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER'].includes(role);
  }

  // ─── Admin Core Operations: Admissions, Staff, Users, Reports ───
  if (
    normalized.startsWith('/admissions') ||
    normalized.startsWith('/staff') ||
    normalized.startsWith('/users') ||
    normalized.startsWith('/reports')
  ) {
    return ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL'].includes(role);
  }

  // ─── Academic Management: Students Directory, Attendance, Timetable, Exams, Activities ───
  if (
    normalized.startsWith('/students') ||
    normalized.startsWith('/attendance') ||
    normalized.startsWith('/timetable') ||
    normalized.startsWith('/exams') ||
    normalized.startsWith('/activities')
  ) {
    return ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER'].includes(role);
  }

  // ─── HR & Leaves ───
  if (normalized.startsWith('/hr')) {
    return ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER'].includes(role);
  }

  // Default fallback for unrecognized routes in dashboard: allow if not explicitly blocked
  return true;
}

/**
 * Intelligently computes the appropriate destination route when a user attempts
 * to access an unauthorized route (e.g. after login with a stale returnUrl or cross-portal navigation).
 */
export function getAuthorizedRedirect(requestedPath: string | null | undefined, role?: string): string {
  if (!requestedPath || requestedPath === '/' || requestedPath === '/login') {
    return '/dashboard';
  }

  const cleanPath = requestedPath.split('?')[0].toLowerCase();

  // If the path is already allowed for this role, return the original requested path
  if (isRouteAllowedForRole(cleanPath, role)) {
    return requestedPath;
  }

  // ── Role-specific smart fallbacks ──
  if (role === 'PARENT') {
    // If a parent was directed to the admin fee dashboard (/fees), redirect to parent fee portal
    if (cleanPath.startsWith('/fees')) {
      return '/parent-fees';
    }
    return '/dashboard';
  }

  if (role === 'SCHOOL_ADMIN' || role === 'SUPER_ADMIN' || role === 'PRINCIPAL') {
    // If an admin was directed to parent fees, redirect to admin fee dashboard
    if (cleanPath === '/parent-fees' || cleanPath.startsWith('/parent/fee')) {
      return '/fees';
    }
    return '/dashboard';
  }

  if (role === 'TEACHER') {
    // Teachers do not have fees access; redirect to dashboard
    return '/dashboard';
  }

  if (role === 'STUDENT') {
    // Students access student portal
    return '/dashboard';
  }

  return '/dashboard';
}
