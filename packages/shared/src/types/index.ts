// ============================================================
// Shared TypeScript Types
// AI School ERP V1.0
// ============================================================

import type { UserRole, Permission } from '../constants/permissions';

// ─── API Response Wrapper ─────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  statusCode: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

// ─── Auth Types ───────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  role: UserRole;
  schoolId: string | null;
  avatarUrl: string | null;
  permissions: Permission[];
}

export interface AuthTokens {
  accessToken: string;
}

export interface LoginResponse {
  user: AuthUser;
  accessToken: string;
}

export interface JwtPayload {
  sub: string;        // userId
  email: string;
  role: UserRole;
  schoolId: string | null;
  sessionId: string;
  iat: number;
  exp: number;
}

// ─── User Types ───────────────────────────────────────────────────────────────

export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  role: UserRole;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'PENDING_VERIFICATION';
  phone: string | null;
  avatarUrl: string | null;
  emailVerified: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  school?: {
    id: string;
    name: string;
    code: string;
  } | null;
}

export interface UserSession {
  id: string;
  deviceInfo: string | null;
  ipAddress: string | null;
  status: 'ACTIVE' | 'EXPIRED' | 'REVOKED';
  expiresAt: string;
  createdAt: string;
  isCurrentSession: boolean;
}

// ─── School Types ─────────────────────────────────────────────────────────────

export interface School {
  id: string;
  name: string;
  code: string;
  address: string | null;
  city: string | null;
  state: string | null;
  pinCode: string | null;
  phone: string | null;
  email: string | null;
  logoUrl: string | null;
  boardType: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface AcademicYear {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  isLocked: boolean;
}

// ─── Student Types ────────────────────────────────────────────────────────────

export interface Student {
  id: string;
  admissionNumber: string;
  rollNumber: string | null;
  dateOfBirth: string | null;
  gender: 'MALE' | 'FEMALE' | 'OTHER' | null;
  bloodGroup: string;
  admissionDate: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    avatarUrl: string | null;
  };
  currentEnrollment?: {
    section: {
      id: string;
      name: string;
      class: {
        id: string;
        name: string;
        numericLevel: number;
      };
    };
    rollNumber: string | null;
    status: string;
  } | null;
  guardians: Guardian[];
}

export interface Guardian {
  id: string;
  relationship: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  isPrimary: boolean;
}

// ─── Staff Types ──────────────────────────────────────────────────────────────

export interface Staff {
  id: string;
  employeeId: string;
  employmentType: string;
  joinDate: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    avatarUrl: string | null;
  };
  department: { id: string; name: string } | null;
  designation: { id: string; name: string } | null;
}

// ─── Attendance Types ─────────────────────────────────────────────────────────

export interface AttendanceRecord {
  id: string;
  date: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED' | 'HOLIDAY';
  method: 'MANUAL' | 'QR_CODE' | 'BIOMETRIC' | 'RFID';
  remarks: string | null;
  student: Pick<Student, 'id' | 'admissionNumber' | 'user'>;
}

export interface AttendanceSummary {
  totalDays: number;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  percentage: number;
  isBelow75: boolean;
}

// ─── Fee Types ────────────────────────────────────────────────────────────────

export interface FeePayment {
  id: string;
  totalAmount: number;
  paidAmount: number;
  discountAmount: number;
  fineAmount: number;
  outstandingAmount: number;
  paymentMode: string;
  paymentStatus: string;
  paymentDate: string;
  receipt?: {
    id: string;
    receiptNumber: string;
  } | null;
}

// ─── Dashboard Types ──────────────────────────────────────────────────────────

export interface DashboardStats {
  totalStudents: number;
  totalStaff: number;
  totalClasses: number;
  todayAttendancePercent: number;
  monthlyFeeCollection: number;
  pendingFees: number;
  upcomingExams: number;
  activeAcademicYear: string;
}

export interface ActivityLogEntry {
  id: string;
  action: string;
  module: string;
  description: string;
  createdAt: string;
  user: {
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
  };
}

// ─── Notification Types ───────────────────────────────────────────────────────

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  actionUrl: string | null;
  createdAt: string;
}

// ─── AI Types ─────────────────────────────────────────────────────────────────

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export interface AIConversation {
  id: string;
  sessionId: string;
  messages: AIMessage[];
}
