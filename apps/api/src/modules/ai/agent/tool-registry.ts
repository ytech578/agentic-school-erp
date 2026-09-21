import { RiskLevel } from '@prisma/client';
import {
  PERMISSIONS,
  Permission,
  USER_ROLES,
  UserRole,
  ROLE_PERMISSIONS,
} from '@school-erp/shared';
import {
  ApproveLeaveInput,
  CreateAssignmentInput,
  SendAnnouncementInput,
  AutomationInput,
  ToolHandlerKey,
} from './agent-types';

// ─── Execution mode ────────────────────────────────────────────────────────────
export type ToolExecutionMode = 'READ_ONLY' | 'MUTATING';

// ─── Idempotency strategy ─────────────────────────────────────────────────────
export type IdempotencyStrategy =
  | 'NATURAL_KEY' // business-derived key (e.g. leaveId) — deterministic fingerprint
  | 'CONTENT_HASH' // hash of schoolId + userId + toolName + sorted args JSON
  | 'REQUEST_KEY' // client-supplied request token (HTTP Idempotency-Key header); no operation fingerprint
  | 'NONE'; // deliberately non-idempotent; each call is an independent execution (use sparingly)

// ─── Validated field descriptor (replaces free-form description) ──────────────
export interface ToolFieldSchema {
  type: 'string' | 'number' | 'boolean' | 'string[]';
  required: boolean;
  description: string;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
}

// ─── Tool Definition — full security contract ─────────────────────────────────
export interface ToolDefinition<TInput = unknown> {
  /** Unique tool identifier (matches Gemini function name) */
  name: string;
  /** Human-readable description */
  description: string;
  /** Domain category */
  category: 'HR' | 'ACADEMIC' | 'COMMUNICATION' | 'AUTOMATION';
  /** Structural field schema — validated before proposal is created */
  inputSchema: Record<string, ToolFieldSchema>;
  /** Required input type contract — no `any` */
  _inputType?: TInput; // phantom type reference, never at runtime
  /** Roles permitted to propose this action */
  allowedRoles: string[];
  /** Named permissions beyond role check — server-enforced */
  requiredPermissions: Permission[];
  riskLevel: RiskLevel;
  requiresConfirmation: boolean;
  /** Every mutation must be tenant-scoped */
  tenantScoped: true;
  idempotencyStrategy: IdempotencyStrategy;
  /** Explanation for replay safety if strategy is NONE */
  replayPolicyDoc?: string;
  executionMode: ToolExecutionMode;
  /** Key used to dispatch to the domain handler */
  handlerKey: ToolHandlerKey;
  /** False = stub/unimplemented — control plane will reject execution */
  realHandlerAvailable: boolean;
  /** Minutes until proposed action expires */
  expiryMinutes: number;
}

// ─── Field validator ──────────────────────────────────────────────────────────
/**
 * Validates raw LLM-supplied arguments against the tool's inputSchema.
 * Returns a list of error messages (empty = valid).
 * Unknown fields are rejected.
 */
export function validateToolInput(
  tool: ToolDefinition,
  rawArgs: Record<string, unknown>,
): string[] {
  const errors: string[] = [];
  const knownFields = new Set(Object.keys(tool.inputSchema));

  // Reject unknown fields
  for (const key of Object.keys(rawArgs)) {
    if (!knownFields.has(key)) {
      errors.push(`Unknown field: "${key}"`);
    }
  }

  // Validate required + type for each declared field
  for (const [field, schema] of Object.entries(tool.inputSchema)) {
    const value = rawArgs[field];

    if (
      schema.required &&
      (value === undefined || value === null || value === '')
    ) {
      errors.push(`Missing required field: "${field}"`);
      continue;
    }

    if (value === undefined || value === null) continue;

    // Type checks
    if (schema.type === 'string' && typeof value !== 'string') {
      errors.push(`Field "${field}" must be a string`);
    } else if (schema.type === 'number' && typeof value !== 'number') {
      errors.push(`Field "${field}" must be a number`);
    } else if (schema.type === 'boolean' && typeof value !== 'boolean') {
      errors.push(`Field "${field}" must be a boolean`);
    }

    // String constraints
    if (typeof value === 'string') {
      if (schema.minLength !== undefined && value.length < schema.minLength) {
        errors.push(
          `Field "${field}" must be at least ${schema.minLength} characters`,
        );
      }
      if (schema.maxLength !== undefined && value.length > schema.maxLength) {
        errors.push(
          `Field "${field}" must be at most ${schema.maxLength} characters`,
        );
      }
      if (schema.pattern && !schema.pattern.test(value)) {
        errors.push(`Field "${field}" has invalid format`);
      }
    }

    // Number constraints
    if (typeof value === 'number') {
      if (schema.min !== undefined && value < schema.min) {
        errors.push(`Field "${field}" must be >= ${schema.min}`);
      }
      if (schema.max !== undefined && value > schema.max) {
        errors.push(`Field "${field}" must be <= ${schema.max}`);
      }
    }
  }

  return errors;
}

// ─── Tool Registry ─────────────────────────────────────────────────────────────
export const TOOL_REGISTRY = new Map<string, ToolDefinition>([
  // ── approve_leave ──────────────────────────────────────────────────────────
  [
    'approve_leave',
    {
      name: 'approve_leave',
      description: 'Approves a pending leave request for a staff member',
      category: 'HR',
      inputSchema: {
        staffName: {
          type: 'string',
          required: true,
          description: 'Full or partial name of the staff member',
          minLength: 2,
          maxLength: 100,
        },
        reason: {
          type: 'string',
          required: false,
          description: 'Optional approval note',
          maxLength: 500,
        },
      },
      allowedRoles: ['PRINCIPAL', 'SCHOOL_ADMIN', 'SUPER_ADMIN'],
      requiredPermissions: [PERMISSIONS.LEAVE_APPROVE],
      riskLevel: 'HIGH',
      requiresConfirmation: true,
      tenantScoped: true,
      idempotencyStrategy: 'NATURAL_KEY',
      executionMode: 'MUTATING',
      handlerKey: ToolHandlerKey.APPROVE_LEAVE,
      realHandlerAvailable: true,
      expiryMinutes: 15,
    } satisfies ToolDefinition<ApproveLeaveInput>,
  ],

  // ── create_assignment ──────────────────────────────────────────────────────
  [
    'create_assignment',
    {
      name: 'create_assignment',
      description: 'Creates a new assignment for a specific class',
      category: 'ACADEMIC',
      inputSchema: {
        className: {
          type: 'string',
          required: true,
          description: 'Class name exactly as in the ERP (e.g. "Class 10-A")',
          minLength: 1,
          maxLength: 100,
        },
        subjectId: {
          type: 'string',
          required: true,
          description:
            'Explicit subject UUID — never resolved by random findFirst',
          minLength: 1,
          maxLength: 100,
        },
        topic: {
          type: 'string',
          required: true,
          description: 'Assignment title or topic',
          minLength: 1,
          maxLength: 200,
        },
        description: {
          type: 'string',
          required: false,
          description: 'Optional assignment description',
          maxLength: 1000,
        },
        dueDate: {
          type: 'string',
          required: false,
          description: 'Due date in ISO format YYYY-MM-DD',
          pattern: /^\d{4}-\d{2}-\d{2}$/,
        },
        totalMarks: {
          type: 'number',
          required: false,
          description: 'Maximum marks (defaults to 100)',
          min: 1,
          max: 1000,
        },
      },
      allowedRoles: ['TEACHER', 'PRINCIPAL', 'SCHOOL_ADMIN', 'SUPER_ADMIN'],
      requiredPermissions: [PERMISSIONS.ASSIGNMENTS_CREATE],
      riskLevel: 'MEDIUM',
      requiresConfirmation: true,
      tenantScoped: true,
      idempotencyStrategy: 'CONTENT_HASH',
      executionMode: 'MUTATING',
      handlerKey: ToolHandlerKey.CREATE_ASSIGNMENT,
      realHandlerAvailable: true,
      expiryMinutes: 15,
    } satisfies ToolDefinition<CreateAssignmentInput>,
  ],

  // ── send_announcement ──────────────────────────────────────────────────────
  [
    'send_announcement',
    {
      name: 'send_announcement',
      description: 'Broadcasts an announcement to all active school users',
      category: 'COMMUNICATION',
      inputSchema: {
        title: {
          type: 'string',
          required: true,
          description: 'Announcement headline',
          minLength: 3,
          maxLength: 200,
        },
        message: {
          type: 'string',
          required: false,
          description: 'Body text of the announcement',
          maxLength: 2000,
        },
      },
      allowedRoles: ['PRINCIPAL', 'SCHOOL_ADMIN', 'SUPER_ADMIN'],
      requiredPermissions: [PERMISSIONS.ANNOUNCEMENT_SEND],
      riskLevel: 'HIGH',
      requiresConfirmation: true,
      tenantScoped: true,
      // REQUEST_KEY: each broadcast is a unique event (no content fingerprint);
      // the client-supplied Idempotency-Key header prevents double-blast on HTTP retry.
      idempotencyStrategy: 'REQUEST_KEY',
      executionMode: 'MUTATING',
      handlerKey: ToolHandlerKey.SEND_ANNOUNCEMENT,
      realHandlerAvailable: true,
      expiryMinutes: 15,
    } satisfies ToolDefinition<SendAnnouncementInput>,
  ],

  // ── automation_fee_defaulter ───────────────────────────────────────────────
  [
    'automation_fee_defaulter',
    {
      name: 'automation_fee_defaulter',
      description: 'Sends fee default reminders to parents',
      category: 'AUTOMATION',
      inputSchema: {
        items: {
          type: 'string[]',
          required: false,
          description: 'Preview items from generateFeeDefaulterPreview',
        },
        subject: {
          type: 'string',
          required: false,
          description: 'Message subject override',
          maxLength: 200,
        },
      },
      allowedRoles: ['PRINCIPAL', 'SCHOOL_ADMIN', 'SUPER_ADMIN'],
      requiredPermissions: [
        PERMISSIONS.FEES_READ_ALL,
        PERMISSIONS.MESSAGES_SEND,
      ],
      riskLevel: 'MEDIUM',
      requiresConfirmation: true,
      tenantScoped: true,
      idempotencyStrategy: 'CONTENT_HASH',
      executionMode: 'MUTATING',
      handlerKey: ToolHandlerKey.AUTOMATION_FEE_DEFAULTER,
      realHandlerAvailable: true,
      expiryMinutes: 30,
    } satisfies ToolDefinition<AutomationInput>,
  ],

  // ── automation_absence_alert ───────────────────────────────────────────────
  [
    'automation_absence_alert',
    {
      name: 'automation_absence_alert',
      description: 'Sends absence alerts to parents',
      category: 'AUTOMATION',
      inputSchema: {
        items: {
          type: 'string[]',
          required: false,
          description: 'Preview items',
        },
        subject: {
          type: 'string',
          required: false,
          description: 'Message subject',
          maxLength: 200,
        },
      },
      allowedRoles: ['PRINCIPAL', 'SCHOOL_ADMIN', 'SUPER_ADMIN'],
      requiredPermissions: [
        PERMISSIONS.ATTENDANCE_READ_ALL,
        PERMISSIONS.MESSAGES_SEND,
      ],
      riskLevel: 'MEDIUM',
      requiresConfirmation: true,
      tenantScoped: true,
      idempotencyStrategy: 'CONTENT_HASH',
      executionMode: 'MUTATING',
      handlerKey: ToolHandlerKey.AUTOMATION_ABSENCE_ALERT,
      realHandlerAvailable: true,
      expiryMinutes: 30,
    } satisfies ToolDefinition<AutomationInput>,
  ],

  // ── automation_timetable_cover ─────────────────────────────────────────────
  [
    'automation_timetable_cover',
    {
      name: 'automation_timetable_cover',
      description: 'Applies timetable substitute cover for absent teachers',
      category: 'AUTOMATION',
      inputSchema: {
        items: {
          type: 'string[]',
          required: false,
          description: 'Cover suggestions from preview',
        },
      },
      allowedRoles: ['PRINCIPAL', 'SCHOOL_ADMIN', 'SUPER_ADMIN'],
      requiredPermissions: [PERMISSIONS.ACADEMIC_MANAGE],
      riskLevel: 'HIGH',
      requiresConfirmation: true,
      tenantScoped: true,
      idempotencyStrategy: 'CONTENT_HASH',
      executionMode: 'MUTATING',
      handlerKey: ToolHandlerKey.AUTOMATION_TIMETABLE_COVER,
      realHandlerAvailable: true,
      expiryMinutes: 30,
    } satisfies ToolDefinition<AutomationInput>,
  ],

  // ── automation_attendance_warning ─────────────────────────────────────────
  [
    'automation_attendance_warning',
    {
      name: 'automation_attendance_warning',
      description: 'Sends attendance warning letters to parents',
      category: 'AUTOMATION',
      inputSchema: {
        items: {
          type: 'string[]',
          required: false,
          description: 'Warning items from preview',
        },
        subject: {
          type: 'string',
          required: false,
          description: 'Message subject',
          maxLength: 200,
        },
      },
      allowedRoles: ['PRINCIPAL', 'SCHOOL_ADMIN', 'SUPER_ADMIN'],
      requiredPermissions: [
        PERMISSIONS.ATTENDANCE_READ_ALL,
        PERMISSIONS.MESSAGES_SEND,
      ],
      riskLevel: 'MEDIUM',
      requiresConfirmation: true,
      tenantScoped: true,
      idempotencyStrategy: 'CONTENT_HASH',
      executionMode: 'MUTATING',
      handlerKey: ToolHandlerKey.AUTOMATION_ATTENDANCE_WARNING,
      realHandlerAvailable: true,
      expiryMinutes: 30,
    } satisfies ToolDefinition<AutomationInput>,
  ],

  // ── automation_leave_recommendation ───────────────────────────────────────
  [
    'automation_leave_recommendation',
    {
      name: 'automation_leave_recommendation',
      description: 'Records AI leave approval recommendations',
      category: 'AUTOMATION',
      inputSchema: {
        items: {
          type: 'string[]',
          required: false,
          description: 'Recommendation items from preview',
        },
      },
      allowedRoles: ['PRINCIPAL', 'SCHOOL_ADMIN', 'SUPER_ADMIN'],
      requiredPermissions: [PERMISSIONS.LEAVE_READ],
      riskLevel: 'MEDIUM',
      requiresConfirmation: true,
      tenantScoped: true,
      idempotencyStrategy: 'CONTENT_HASH',
      executionMode: 'MUTATING',
      handlerKey: ToolHandlerKey.AUTOMATION_LEAVE_RECOMMENDATION,
      realHandlerAvailable: true,
      expiryMinutes: 30,
    } satisfies ToolDefinition<AutomationInput>,
  ],

  // ── automation_report_card_publish ────────────────────────────────────────
  [
    'automation_report_card_publish',
    {
      name: 'automation_report_card_publish',
      description: 'Publishes exam report card results to students/parents',
      category: 'AUTOMATION',
      inputSchema: {
        items: {
          type: 'string[]',
          required: false,
          description: 'Ready exam items from preview',
        },
      },
      allowedRoles: ['PRINCIPAL', 'SCHOOL_ADMIN', 'SUPER_ADMIN'],
      requiredPermissions: [
        PERMISSIONS.EXAMS_PUBLISH,
        PERMISSIONS.MESSAGES_SEND,
      ],
      riskLevel: 'HIGH',
      requiresConfirmation: true,
      tenantScoped: true,
      idempotencyStrategy: 'CONTENT_HASH',
      executionMode: 'MUTATING',
      handlerKey: ToolHandlerKey.AUTOMATION_REPORT_CARD_PUBLISH,
      realHandlerAvailable: true,
      expiryMinutes: 30,
    } satisfies ToolDefinition<AutomationInput>,
  ],

  // ── automation_daily_digest ───────────────────────────────────────────────
  [
    'automation_daily_digest',
    {
      name: 'automation_daily_digest',
      description: 'Sends a daily school operations digest to the principal',
      category: 'AUTOMATION',
      inputSchema: {
        items: {
          type: 'string[]',
          required: false,
          description: 'Digest items from preview',
        },
      },
      allowedRoles: ['PRINCIPAL', 'SCHOOL_ADMIN', 'SUPER_ADMIN'],
      requiredPermissions: [PERMISSIONS.AI_REPORTS],
      riskLevel: 'LOW',
      requiresConfirmation: false,
      tenantScoped: true,
      idempotencyStrategy: 'CONTENT_HASH',
      executionMode: 'MUTATING',
      handlerKey: ToolHandlerKey.AUTOMATION_DAILY_DIGEST,
      realHandlerAvailable: true,
      expiryMinutes: 60,
    } satisfies ToolDefinition<AutomationInput>,
  ],
]);

// ─── Tool Registry Consistency Validator ─────────────────────────────────────
/**
 * Validates consistency of the tool registry.
 * Catches:
 *  - Mutating tools with no required permissions
 *  - High-risk tools without confirmation
 *  - Tools with empty allowed roles
 *  - Unknown permissions
 *  - Unknown roles
 *  - Duplicate permission metadata
 *  - Contradictory role/permission configuration (allowed roles that lack declared required permissions)
 *
 * Returns a list of validation error strings (empty = valid).
 */
export function validateToolRegistry(
  tools: Map<string, ToolDefinition>,
): string[] {
  const errors: string[] = [];
  const knownRoles = new Set<string>(Object.values(USER_ROLES));
  const knownPermissions = new Set<string>(Object.values(PERMISSIONS));

  for (const [name, tool] of tools.entries()) {
    // 1. Allowed roles must not be empty
    if (!tool.allowedRoles || tool.allowedRoles.length === 0) {
      errors.push(`Tool "${name}" must declare at least one allowed role`);
    } else {
      // 2. Roles must be known
      for (const role of tool.allowedRoles) {
        if (!knownRoles.has(role)) {
          errors.push(`Tool "${name}" specifies unknown role: "${role}"`);
        }
      }
    }

    // 3. Mutating tools must declare required permissions
    if (
      tool.executionMode === 'MUTATING' &&
      (!tool.requiredPermissions || tool.requiredPermissions.length === 0)
    ) {
      errors.push(
        `Mutating tool "${name}" must declare at least one required permission`,
      );
    }

    // 4. High-risk tools must require confirmation
    if (tool.riskLevel === 'HIGH' && !tool.requiresConfirmation) {
      errors.push(`High-risk tool "${name}" must require confirmation`);
    }

    // 5. Unknown permissions & duplicates
    if (tool.requiredPermissions && tool.requiredPermissions.length > 0) {
      for (const perm of tool.requiredPermissions) {
        if (!knownPermissions.has(perm)) {
          errors.push(`Tool "${name}" specifies unknown permission: "${perm}"`);
        }
      }

      // 6. Duplicate permissions
      const permSet = new Set(tool.requiredPermissions);
      if (permSet.size !== tool.requiredPermissions.length) {
        errors.push(`Tool "${name}" has duplicate permission metadata`);
      }

      // 7. Contradictory role/permission configuration
      // Every role in allowedRoles must possess all requiredPermissions in ROLE_PERMISSIONS
      if (tool.allowedRoles && tool.allowedRoles.length > 0) {
        for (const role of tool.allowedRoles) {
          if (knownRoles.has(role)) {
            const rolePerms = ROLE_PERMISSIONS[role as UserRole] ?? [];
            const missing = tool.requiredPermissions.filter(
              (p) => !rolePerms.includes(p),
            );
            if (missing.length > 0) {
              errors.push(
                `Tool "${name}" allows role "${role}" which lacks required permissions: ${missing.join(', ')}`,
              );
            }
          }
        }
      }
    }

    // 8. Strategy NONE safety validation: mutating tools claiming NONE must have a documented replayPolicyDoc
    if (
      tool.idempotencyStrategy === 'NONE' &&
      tool.executionMode === 'MUTATING' &&
      (!tool.replayPolicyDoc || tool.replayPolicyDoc.trim().length === 0)
    ) {
      errors.push(
        `Mutating tool "${name}" declares idempotencyStrategy 'NONE' but lacks a documented replayPolicyDoc explaining replay safety`,
      );
    }
  }

  return errors;
}

// Startup validation — fail fast if registry is invalid on boot
const registryValidationErrors = validateToolRegistry(TOOL_REGISTRY);
if (registryValidationErrors.length > 0) {
  throw new Error(
    `Tool registry consistency check failed:\n${registryValidationErrors.join('\n')}`,
  );
}
