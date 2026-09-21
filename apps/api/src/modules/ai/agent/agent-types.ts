// ─── Execution Context (server-resolved, never client-provided) ───────────────
export interface AgentExecutionContext {
  userId: string;
  /** Server-authoritative role from JWT payload — never trust client input */
  role: string;
  schoolId: string;
  isGlobal?: boolean;
  /** Server-derived fine-grained permissions — never client-provided */
  permissions?: string[];
}

// ─── Action Result ────────────────────────────────────────────────────────────
export interface AgentActionResult {
  actionId: string;
  status: string;
  result?: unknown;
  failureReason?: string;
  explanation?: string;
}

// ─── Policy Decision ──────────────────────────────────────────────────────────
export type PolicyDecision = 'ALLOW' | 'DENY' | 'CONFIRMATION_REQUIRED';

export interface PolicyEvaluationResult {
  decision: PolicyDecision;
  reason?: string;
}

// ─── Tool input schema contract ────────────────────────────────────────────────
/** Structural shape of a validated tool input. No `any` allowed. */
export interface ApproveLeaveInput {
  /** Staff member name — used only for resolution at proposal time */
  staffName: string;
  reason?: string;
}

export interface CreateAssignmentInput {
  className: string;
  subjectId: string; // REQUIRED — prevents random subject selection
  topic: string;
  description?: string;
  dueDate?: string; // ISO date string YYYY-MM-DD
  totalMarks?: number;
}

export interface SendAnnouncementInput {
  title: string;
  message?: string;
}

export interface AutomationInput {
  /** Payload forwarded from the preview step — already validated upstream */
  items?: unknown[];
  subject?: string;
}

// Union of all known tool input shapes
export type ToolInput =
  | ApproveLeaveInput
  | CreateAssignmentInput
  | SendAnnouncementInput
  | AutomationInput;

// ─── State Machine Transitions ────────────────────────────────────────────────
export const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  PROPOSED: ['AWAITING_CONFIRMATION', 'CONFIRMED', 'CANCELLED'],
  AWAITING_CONFIRMATION: [
    'CONFIRMED',
    'EXECUTING',
    'REJECTED',
    'EXPIRED',
    'CANCELLED',
  ],
  CONFIRMED: ['EXECUTING', 'CANCELLED'],
  EXECUTING: ['SUCCEEDED', 'FAILED'],
  SUCCEEDED: [], // terminal
  FAILED: [], // terminal
  REJECTED: [], // terminal
  EXPIRED: [], // terminal
  CANCELLED: [], // terminal
};

// ─── Machine-readable error codes ─────────────────────────────────────────────
export const AGENT_ERRORS = {
  // Resource errors
  ACTION_NOT_FOUND: 'ACTION_NOT_FOUND',
  ACTION_NOT_AUTHORIZED: 'ACTION_NOT_AUTHORIZED',
  ACTION_TENANT_MISMATCH: 'ACTION_TENANT_MISMATCH',
  ACTION_RESOURCE_FORBIDDEN: 'ACTION_RESOURCE_FORBIDDEN',
  // Policy errors
  ACTION_CONFIRMATION_REQUIRED: 'ACTION_CONFIRMATION_REQUIRED',
  ACTION_POLICY_DENIED: 'ACTION_POLICY_DENIED',
  // State errors
  ACTION_EXPIRED: 'ACTION_EXPIRED',
  ACTION_ALREADY_EXECUTED: 'ACTION_ALREADY_EXECUTED',
  ACTION_INVALID_STATE_TRANSITION: 'ACTION_INVALID_STATE_TRANSITION',
  // Validation errors
  ACTION_INVALID_ARGUMENTS: 'ACTION_INVALID_ARGUMENTS',
  ACTION_AMBIGUOUS_RESOURCE: 'ACTION_AMBIGUOUS_RESOURCE',
  ACTION_STALE_RESOURCE: 'ACTION_STALE_RESOURCE',
  ACTION_UNKNOWN_TOOL: 'ACTION_UNKNOWN_TOOL',
  // Execution errors
  ACTION_EXECUTION_FAILED: 'ACTION_EXECUTION_FAILED',
  ACTION_VERIFICATION_FAILED: 'ACTION_VERIFICATION_FAILED',
  ACTION_HANDLER_NOT_FOUND: 'ACTION_HANDLER_NOT_FOUND',
  // Multi-call errors
  ACTION_MULTI_CALL_REJECTED: 'ACTION_MULTI_CALL_REJECTED',
  // Idempotency
  ACTION_DUPLICATE_REQUEST: 'ACTION_DUPLICATE_REQUEST',
  // Business mutation fingerprint matches an existing EXECUTING or SUCCEEDED action
  ACTION_FINGERPRINT_CONFLICT: 'ACTION_FINGERPRINT_CONFLICT',
  // Client request key already resolved to a completed/in-flight action
  ACTION_REQUEST_ALREADY_PROCESSED: 'ACTION_REQUEST_ALREADY_PROCESSED',
  // Same idempotency key reused with a materially different request payload
  ACTION_IDEMPOTENCY_KEY_REUSE: 'ACTION_IDEMPOTENCY_KEY_REUSE',
  // Client-supplied idempotency key does not conform to format/character/length requirements
  ACTION_IDEMPOTENCY_KEY_INVALID: 'ACTION_IDEMPOTENCY_KEY_INVALID',
  // Execution outcome is ambiguous and cannot be automatically reconciled; manual recovery required
  ACTION_RECOVERY_REQUIRED: 'ACTION_RECOVERY_REQUIRED',
} as const;

export type AgentErrorCode = (typeof AGENT_ERRORS)[keyof typeof AGENT_ERRORS];

// ─── Handler key enum ─────────────────────────────────────────────────────────
export enum ToolHandlerKey {
  APPROVE_LEAVE = 'approve_leave',
  CREATE_ASSIGNMENT = 'create_assignment',
  SEND_ANNOUNCEMENT = 'send_announcement',
  AUTOMATION_FEE_DEFAULTER = 'automation_fee_defaulter',
  AUTOMATION_ABSENCE_ALERT = 'automation_absence_alert',
  AUTOMATION_TIMETABLE_COVER = 'automation_timetable_cover',
  AUTOMATION_ATTENDANCE_WARNING = 'automation_attendance_warning',
  AUTOMATION_LEAVE_RECOMMENDATION = 'automation_leave_recommendation',
  AUTOMATION_REPORT_CARD_PUBLISH = 'automation_report_card_publish',
  AUTOMATION_DAILY_DIGEST = 'automation_daily_digest',
}

// ─── Server-authoritative context provided to domain handlers ─────────────────
export interface AgentToolExecutionContext {
  userId: string;
  schoolId: string;
  role: string;
  actionId?: string;
  correlationId?: string;
}

// ─── Standard structured result returned by domain handlers ────────────────────
export interface AgentHandlerResult {
  resourceId?: string;
  resourceType?: string;
  affectedCount?: number;
  status: string;
  [key: string]: unknown;
}

// ─── Handler Reconciliation Result (Ambiguous Execution Recovery) ──────────────
export interface ReconciliationResult {
  /**
   * 'APPLIED': The mutation was definitely completed in the domain database.
   * 'NOT_APPLIED': The mutation definitely did NOT take place; safe to retry.
   * 'UNKNOWN': State cannot be determined with certainty; human/admin recovery required.
   */
  status: 'APPLIED' | 'NOT_APPLIED' | 'UNKNOWN';
  result?: AgentHandlerResult;
  reason?: string;
}

