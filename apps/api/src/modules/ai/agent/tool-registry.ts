import { RiskLevel } from '@prisma/client';

export type ToolExecutionMode = 'READ_ONLY' | 'MUTATING';

export interface ToolDefinition {
  name: string;
  description: string;
  category: string;
  allowedRoles: string[];
  riskLevel: RiskLevel;
  requiresConfirmation: boolean;
  tenantScoped: boolean;
  idempotent: boolean;
  executionMode: ToolExecutionMode;
}

export const TOOL_REGISTRY = new Map<string, ToolDefinition>([
  [
    'approve_leave',
    {
      name: 'approve_leave',
      description: 'Approves a pending leave request for a staff member',
      category: 'HR',
      allowedRoles: ['PRINCIPAL', 'SCHOOL_ADMIN', 'SUPER_ADMIN'],
      riskLevel: 'HIGH',
      requiresConfirmation: true,
      tenantScoped: true,
      idempotent: true,
      executionMode: 'MUTATING',
    },
  ],
  [
    'create_assignment',
    {
      name: 'create_assignment',
      description: 'Creates a new assignment for a specific class',
      category: 'ACADEMIC',
      allowedRoles: ['TEACHER', 'PRINCIPAL', 'SCHOOL_ADMIN', 'SUPER_ADMIN'],
      riskLevel: 'MEDIUM',
      requiresConfirmation: true,
      tenantScoped: true,
      idempotent: false,
      executionMode: 'MUTATING',
    },
  ],
  [
    'send_announcement',
    {
      name: 'send_announcement',
      description: 'Sends a broadcast announcement to users',
      category: 'COMMUNICATION',
      allowedRoles: ['PRINCIPAL', 'SCHOOL_ADMIN', 'SUPER_ADMIN'],
      riskLevel: 'HIGH',
      requiresConfirmation: true,
      tenantScoped: true,
      idempotent: false,
      executionMode: 'MUTATING',
    },
  ],
  [
    'automation_fee_defaulter',
    {
      name: 'automation_fee_defaulter',
      description: 'Sends fee default reminders',
      category: 'AUTOMATION',
      allowedRoles: ['PRINCIPAL', 'SCHOOL_ADMIN', 'SUPER_ADMIN'],
      riskLevel: 'MEDIUM',
      requiresConfirmation: true,
      tenantScoped: true,
      idempotent: true,
      executionMode: 'MUTATING',
    },
  ],
  [
    'automation_absence_alert',
    {
      name: 'automation_absence_alert',
      description: 'Sends absence alerts to parents',
      category: 'AUTOMATION',
      allowedRoles: ['PRINCIPAL', 'SCHOOL_ADMIN', 'SUPER_ADMIN'],
      riskLevel: 'MEDIUM',
      requiresConfirmation: true,
      tenantScoped: true,
      idempotent: true,
      executionMode: 'MUTATING',
    },
  ],
  [
    'automation_timetable_cover',
    {
      name: 'automation_timetable_cover',
      description: 'Suggests and applies timetable covers',
      category: 'AUTOMATION',
      allowedRoles: ['PRINCIPAL', 'SCHOOL_ADMIN', 'SUPER_ADMIN'],
      riskLevel: 'HIGH',
      requiresConfirmation: true,
      tenantScoped: true,
      idempotent: true,
      executionMode: 'MUTATING',
    },
  ],
  [
    'automation_attendance_warning',
    {
      name: 'automation_attendance_warning',
      description: 'Sends attendance warnings',
      category: 'AUTOMATION',
      allowedRoles: ['PRINCIPAL', 'SCHOOL_ADMIN', 'SUPER_ADMIN'],
      riskLevel: 'MEDIUM',
      requiresConfirmation: true,
      tenantScoped: true,
      idempotent: true,
      executionMode: 'MUTATING',
    },
  ],
  [
    'automation_leave_recommendation',
    {
      name: 'automation_leave_recommendation',
      description: 'Provides leave approval recommendations',
      category: 'AUTOMATION',
      allowedRoles: ['PRINCIPAL', 'SCHOOL_ADMIN', 'SUPER_ADMIN'],
      riskLevel: 'MEDIUM',
      requiresConfirmation: true,
      tenantScoped: true,
      idempotent: true,
      executionMode: 'MUTATING',
    },
  ],
  [
    'automation_report_card_publish',
    {
      name: 'automation_report_card_publish',
      description: 'Publishes report cards',
      category: 'AUTOMATION',
      allowedRoles: ['PRINCIPAL', 'SCHOOL_ADMIN', 'SUPER_ADMIN'],
      riskLevel: 'HIGH',
      requiresConfirmation: true,
      tenantScoped: true,
      idempotent: true,
      executionMode: 'MUTATING',
    },
  ],
  [
    'automation_daily_digest',
    {
      name: 'automation_daily_digest',
      description: 'Generates daily digest report',
      category: 'AUTOMATION',
      allowedRoles: ['PRINCIPAL', 'SCHOOL_ADMIN', 'SUPER_ADMIN'],
      riskLevel: 'LOW',
      requiresConfirmation: false,
      tenantScoped: true,
      idempotent: true,
      executionMode: 'MUTATING',
    },
  ],
]);
