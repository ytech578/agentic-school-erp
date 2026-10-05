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

  // ─── Multi-School Fleet Management ───
  if (normalized.startsWith('/schools')) {
    return role === 'SUPER_ADMIN';
  }

  // ─── Faculty & Staff Directory (Admins, Principals, and Teachers viewing colleagues) ───
  if (normalized.startsWith('/staff')) {
    return ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER'].includes(role);
  }

  // ─── Admin Core Operations: Admissions, Users, Reports ───
  if (
    normalized.startsWith('/admissions') ||
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

  // ─── Assignments: Teachers create, Students/Parents view their own ───
  if (normalized.startsWith('/assignments')) {
    return ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER'].includes(role);
  }

  // ─── Curriculum & Lesson Planning ───
  if (normalized.startsWith('/curriculum')) {
    return ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER'].includes(role);
  }

  // ─── Classes & Sections Management ───
  if (normalized.startsWith('/classes')) {
    return ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL'].includes(role);
  }

  // ─── HR & Leaves & Payroll ───
  if (normalized.startsWith('/hr') || normalized.startsWith('/payroll')) {
    return ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER'].includes(role);
  }

  // ─── Certificates Engine ───
  if (normalized.startsWith('/certificates')) {
    return ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER', 'PARENT', 'STUDENT'].includes(role);
  }

  // ─── PTM Scheduling ───
  if (normalized.startsWith('/ptm')) {
    return ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER', 'PARENT'].includes(role);
  }

  // ─── Discipline Tracking ───
  if (normalized.startsWith('/discipline')) {
    return ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER'].includes(role);
  }

  // ─── Alumni & Transcripts ───
  if (normalized.startsWith('/alumni')) {
    return ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER', 'STUDENT'].includes(role);
  }

  // ─── SaaS Subscriptions & Metering ───
  if (normalized.startsWith('/subscriptions')) {
    return ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER'].includes(role);
  }

  // ─── DPDP Privacy Center ───
  if (normalized.startsWith('/privacy')) {
    return ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'PARENT', 'STUDENT'].includes(role);
  }

  // Default fallback: deny access for any unrecognized/unlisted route.
  // All new routes MUST be explicitly declared above.
  // Fail-closed is the secure enterprise default.
  return false;
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
