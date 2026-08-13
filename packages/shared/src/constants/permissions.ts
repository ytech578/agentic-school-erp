// ============================================================
// Shared Constants — Roles & Permissions
// AI School ERP V1.0
// ============================================================

export const USER_ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  SCHOOL_ADMIN: 'SCHOOL_ADMIN',
  PRINCIPAL: 'PRINCIPAL',
  TEACHER: 'TEACHER',
  STUDENT: 'STUDENT',
  PARENT: 'PARENT',
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

export const PERMISSIONS = {
  // ─── Users ───────────────────────────────────────────────
  USERS_CREATE: 'users:create',
  USERS_READ_ALL: 'users:read:all',
  USERS_READ_SELF: 'users:read:self',
  USERS_UPDATE_ALL: 'users:update:all',
  USERS_UPDATE_SELF: 'users:update:self',
  USERS_DELETE: 'users:delete',
  USERS_MANAGE_ROLES: 'users:manage:roles',

  // ─── Students ────────────────────────────────────────────
  STUDENTS_CREATE: 'students:create',
  STUDENTS_READ_ALL: 'students:read:all',
  STUDENTS_READ_CLASS: 'students:read:class',
  STUDENTS_READ_OWN: 'students:read:own',
  STUDENTS_UPDATE: 'students:update',
  STUDENTS_DELETE: 'students:delete',
  STUDENTS_PROMOTE: 'students:promote',
  STUDENTS_TRANSFER: 'students:transfer',

  // ─── Staff ───────────────────────────────────────────────
  STAFF_CREATE: 'staff:create',
  STAFF_READ: 'staff:read',
  STAFF_UPDATE: 'staff:update',
  STAFF_DELETE: 'staff:delete',

  // ─── Attendance ──────────────────────────────────────────
  ATTENDANCE_MARK: 'attendance:mark',
  ATTENDANCE_EDIT: 'attendance:edit',
  ATTENDANCE_READ_ALL: 'attendance:read:all',
  ATTENDANCE_READ_CLASS: 'attendance:read:class',
  ATTENDANCE_READ_OWN: 'attendance:read:own',
  ATTENDANCE_READ_CHILD: 'attendance:read:child',

  // ─── Fees ────────────────────────────────────────────────
  FEES_MANAGE: 'fees:manage',
  FEES_COLLECT: 'fees:collect',
  FEES_DISCOUNT: 'fees:discount',
  FEES_READ_ALL: 'fees:read:all',
  FEES_READ_OWN: 'fees:read:own',

  // ─── Exams ───────────────────────────────────────────────
  EXAMS_MANAGE: 'exams:manage',
  EXAMS_MARKS_ENTER: 'exams:marks:enter',
  EXAMS_MARKS_EDIT: 'exams:marks:edit',
  EXAMS_PUBLISH: 'exams:publish',
  EXAMS_READ_ALL: 'exams:read:all',
  EXAMS_READ_OWN: 'exams:read:own',

  // ─── AI ──────────────────────────────────────────────────
  AI_USE: 'ai:use',
  AI_SCHOOL_DATA: 'ai:school:data',
  AI_REPORTS: 'ai:reports',

  // ─── Settings ────────────────────────────────────────────
  SETTINGS_MANAGE: 'settings:manage',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  SUPER_ADMIN: Object.values(PERMISSIONS) as Permission[],

  SCHOOL_ADMIN: [
    PERMISSIONS.USERS_CREATE,
    PERMISSIONS.USERS_READ_ALL,
    PERMISSIONS.USERS_UPDATE_ALL,
    PERMISSIONS.USERS_MANAGE_ROLES,
    PERMISSIONS.STUDENTS_CREATE,
    PERMISSIONS.STUDENTS_READ_ALL,
    PERMISSIONS.STUDENTS_UPDATE,
    PERMISSIONS.STUDENTS_PROMOTE,
    PERMISSIONS.STUDENTS_TRANSFER,
    PERMISSIONS.STAFF_CREATE,
    PERMISSIONS.STAFF_READ,
    PERMISSIONS.STAFF_UPDATE,
    PERMISSIONS.ATTENDANCE_MARK,
    PERMISSIONS.ATTENDANCE_EDIT,
    PERMISSIONS.ATTENDANCE_READ_ALL,
    PERMISSIONS.FEES_MANAGE,
    PERMISSIONS.FEES_COLLECT,
    PERMISSIONS.FEES_DISCOUNT,
    PERMISSIONS.FEES_READ_ALL,
    PERMISSIONS.EXAMS_MANAGE,
    PERMISSIONS.EXAMS_MARKS_ENTER,
    PERMISSIONS.EXAMS_MARKS_EDIT,
    PERMISSIONS.EXAMS_PUBLISH,
    PERMISSIONS.EXAMS_READ_ALL,
    PERMISSIONS.AI_USE,
    PERMISSIONS.AI_SCHOOL_DATA,
    PERMISSIONS.AI_REPORTS,
    PERMISSIONS.SETTINGS_MANAGE,
  ],

  PRINCIPAL: [
    PERMISSIONS.USERS_READ_ALL,
    PERMISSIONS.STUDENTS_CREATE,
    PERMISSIONS.STUDENTS_READ_ALL,
    PERMISSIONS.STUDENTS_UPDATE,
    PERMISSIONS.STUDENTS_PROMOTE,
    PERMISSIONS.STUDENTS_TRANSFER,
    PERMISSIONS.STAFF_READ,
    PERMISSIONS.ATTENDANCE_MARK,
    PERMISSIONS.ATTENDANCE_EDIT,
    PERMISSIONS.ATTENDANCE_READ_ALL,
    PERMISSIONS.FEES_READ_ALL,
    PERMISSIONS.EXAMS_MANAGE,
    PERMISSIONS.EXAMS_MARKS_ENTER,
    PERMISSIONS.EXAMS_MARKS_EDIT,
    PERMISSIONS.EXAMS_PUBLISH,
    PERMISSIONS.EXAMS_READ_ALL,
    PERMISSIONS.AI_USE,
    PERMISSIONS.AI_SCHOOL_DATA,
    PERMISSIONS.AI_REPORTS,
  ],

  TEACHER: [
    PERMISSIONS.USERS_READ_SELF,
    PERMISSIONS.USERS_UPDATE_SELF,
    PERMISSIONS.STUDENTS_READ_CLASS,
    PERMISSIONS.ATTENDANCE_MARK,
    PERMISSIONS.ATTENDANCE_READ_CLASS,
    PERMISSIONS.EXAMS_MARKS_ENTER,
    PERMISSIONS.EXAMS_READ_ALL,
    PERMISSIONS.AI_USE,
  ],

  STUDENT: [
    PERMISSIONS.USERS_READ_SELF,
    PERMISSIONS.USERS_UPDATE_SELF,
    PERMISSIONS.STUDENTS_READ_OWN,
    PERMISSIONS.ATTENDANCE_READ_OWN,
    PERMISSIONS.FEES_READ_OWN,
    PERMISSIONS.EXAMS_READ_OWN,
    PERMISSIONS.AI_USE,
  ],

  PARENT: [
    PERMISSIONS.USERS_READ_SELF,
    PERMISSIONS.USERS_UPDATE_SELF,
    PERMISSIONS.ATTENDANCE_READ_CHILD,
    PERMISSIONS.FEES_READ_OWN,
    PERMISSIONS.EXAMS_READ_OWN,
    PERMISSIONS.AI_USE,
  ],
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}
