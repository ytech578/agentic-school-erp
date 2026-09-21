import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../../../core/database/prisma.service';
import { TOOL_REGISTRY, ToolDefinition, validateToolInput } from './tool-registry';
import { AgentPolicyService } from './agent-policy.service';
import { AgentStateMachine } from './agent-state-machine';
import { HRService } from '../../hr/hr.service';
import { AssignmentsService } from '../../assignments/assignments.service';
import {
  AgentExecutionContext,
  AgentActionResult,
  AGENT_ERRORS,
  ToolHandlerKey,
  ApproveLeaveInput,
  CreateAssignmentInput,
  SendAnnouncementInput,
  AutomationInput,
} from './agent-types';
import { AgentActionStatus, Prisma, RiskLevel } from '@prisma/client';

// ─── Inline audit helper ───────────────────────────────────────────────────────
interface AuditPayload {
  schoolId: string;
  userId: string;
  actionId: string;
  toolName: string;
  riskLevel: RiskLevel;
  status: string;
  resourceType: string;
  resourceId?: string;
  correlationId?: string;
  label: string;
  failureReason?: string;
}

@Injectable()
export class AgentControlPlaneService {
  private readonly logger = new Logger(AgentControlPlaneService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: AgentPolicyService,
    private readonly hrService: HRService,
    private readonly assignmentsService: AssignmentsService,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 1: PROPOSE ACTION
  // Validate → Authorize → Policy → Resolve Identity → Idempotency → Persist
  // ═══════════════════════════════════════════════════════════════════════════

  async proposeAction(
    ctx: AgentExecutionContext,
    toolName: string,
    rawArgs: Record<string, unknown>,
    /**
     * Optional client-supplied request idempotency token
     * (value of the HTTP `Idempotency-Key` header).
     *
     * When provided:
     *  - Stored in the `idempotencyKey` column.
     *  - If the same token is seen again, the original response is returned
     *    without creating a new row — regardless of action status.
     *
     * This is distinct from `operationFingerprint` which guards against
     * double-execution of the same logical business mutation.
     */
    clientRequestKey?: string,
  ): Promise<{ pendingAction: Record<string, unknown> }> {
    // 1. Resolve tool
    const tool = TOOL_REGISTRY.get(toolName);
    if (!tool) {
      throw new NotFoundException(AGENT_ERRORS.ACTION_UNKNOWN_TOOL);
    }

    // 2. Check realHandlerAvailable — reject stubs
    if (!tool.realHandlerAvailable) {
      throw new BadRequestException(`${AGENT_ERRORS.ACTION_EXECUTION_FAILED}: No real handler registered for "${toolName}"`);
    }

    // 3. Input schema validation — reject unknown / malformed fields
    const validationErrors = validateToolInput(tool, rawArgs);
    if (validationErrors.length > 0) {
      throw new BadRequestException(
        `${AGENT_ERRORS.ACTION_INVALID_ARGUMENTS}: ${validationErrors.join('; ')}`,
      );
    }

    // 4. Policy evaluation — server-authoritative, never trusts client
    const policyResult = this.policy.evaluate(ctx, tool);
    if (policyResult.decision === 'DENY') {
      throw new ForbiddenException(
        `${AGENT_ERRORS.ACTION_POLICY_DENIED}: ${policyResult.reason}`,
      );
    }

    // 5. REQUEST-LEVEL idempotency check (client request key, checked BEFORE identity resolution
    //    to short-circuit expensive DB lookups on duplicate HTTP submissions).
    if (clientRequestKey) {
      const existingByRequestKey = await this.prisma.agentAction.findUnique({
        where: { idempotencyKey: clientRequestKey },
      });
      if (existingByRequestKey) {
        this.logger.debug(
          `Request key "${clientRequestKey}" already processed — returning cached proposal`,
        );
        return this.buildProposalResponse(existingByRequestKey, tool, true);
      }
    }

    // 6. Domain-level identity resolution (no guessing)
    const { resolvedArgs, label, resourceId } = await this.resolveIdentity(
      ctx,
      toolName,
      rawArgs,
    );

    // 7. Compute operation fingerprint (business-mutation hash)
    //    Distinct from the client request key — guards against double-execution.
    const operationFingerprint = this.computeOperationFingerprint(tool, ctx, resolvedArgs);

    // 8. OPERATION-LEVEL idempotency check (fingerprint of the logical mutation)
    if (operationFingerprint) {
      const existingByFingerprint = await this.prisma.agentAction.findUnique({
        where: { operationFingerprint },
      });

      if (existingByFingerprint) {
        if (existingByFingerprint.status === AgentActionStatus.SUCCEEDED) {
          // Already completed successfully — return idempotent cached result
          this.logger.debug(
            `Operation fingerprint collision: action ${existingByFingerprint.id} already SUCCEEDED`,
          );
          return this.buildProposalResponse(existingByFingerprint, tool, true);
        }

        if (existingByFingerprint.status === AgentActionStatus.EXECUTING) {
          // Currently in-flight — reject duplicate to prevent concurrent double-mutation
          throw new ConflictException(AGENT_ERRORS.ACTION_FINGERPRINT_CONFLICT);
        }

        if (
          existingByFingerprint.status === AgentActionStatus.AWAITING_CONFIRMATION ||
          existingByFingerprint.status === AgentActionStatus.CONFIRMED
        ) {
          // Return the existing pending action — client can confirm or let it expire
          this.logger.debug(
            `Operation fingerprint collision: action ${existingByFingerprint.id} is ${existingByFingerprint.status}`,
          );
          return this.buildProposalResponse(existingByFingerprint, tool, false);
        }

        // FAILED or EXPIRED — clear both keys on old row so fresh row can claim the slot
        await this.prisma.agentAction.update({
          where: { id: existingByFingerprint.id },
          data: {
            operationFingerprint: null,
            idempotencyKey: null,
          },
        });
        this.logger.debug(
          `Cleared fingerprint on ${existingByFingerprint.status} action ${existingByFingerprint.id} — allowing re-submission`,
        );
        // Fall through to create fresh row
      }
    }

    // 9. Compute expiry
    const expiresAt = new Date(Date.now() + tool.expiryMinutes * 60_000);

    // 10. Determine initial status from policy decision
    const initialStatus =
      policyResult.decision === 'CONFIRMATION_REQUIRED'
        ? AgentActionStatus.AWAITING_CONFIRMATION
        : AgentActionStatus.CONFIRMED;

    // 11. Build deterministic correlationId (traceable in logs, unique per call)
    const correlationId = createHash('sha256')
      .update(`${ctx.userId}:${toolName}:${Date.now()}`)
      .digest('hex')
      .slice(0, 32);

    // 12. Persist AgentAction
    const action = await this.prisma.agentAction.create({
      data: {
        schoolId: ctx.schoolId,
        userId: ctx.userId,
        toolName: tool.name,
        arguments: resolvedArgs as Prisma.InputJsonValue,
        riskLevel: tool.riskLevel,
        status: initialStatus,
        requiresConfirmation: tool.requiresConfirmation,
        label,
        expiresAt,
        // Request-level dedup token — may be undefined when caller provides no header
        idempotencyKey:       clientRequestKey ?? undefined,
        // Business-mutation fingerprint — null for REQUEST_KEY and NONE strategies
        operationFingerprint: operationFingerprint ?? undefined,
        correlationId,
      },
    });

    // 13. Audit proposal
    await this.writeAudit({
      schoolId: ctx.schoolId,
      userId: ctx.userId,
      actionId: action.id,
      toolName: tool.name,
      riskLevel: tool.riskLevel,
      status: initialStatus,
      resourceType: 'AgentAction',
      resourceId: resourceId ?? undefined,
      correlationId,
      label: `PROPOSED: ${label}`,
    }).catch((e) => this.logger.warn(`Audit write failed: ${e.message}`));

    return this.buildProposalResponse(action, tool, false);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 2: CONFIRM AND EXECUTE
  // Load → Validate → Re-auth → Re-policy → CAS → Execute → Verify → Audit
  // ═══════════════════════════════════════════════════════════════════════════

  async confirmAndExecute(
    actionId: string,
    userId: string,
    schoolId: string,
  ): Promise<AgentActionResult> {
    // 1. Load action (no client payload accepted — immutable persisted args)
    const action = await this.prisma.agentAction.findUnique({
      where: { id: actionId },
    });

    if (!action) {
      throw new NotFoundException(AGENT_ERRORS.ACTION_NOT_FOUND);
    }

    // 2. Tenant + ownership validation
    if (action.schoolId !== schoolId || action.userId !== userId) {
      throw new ForbiddenException(AGENT_ERRORS.ACTION_TENANT_MISMATCH);
    }

    // 3. Expiry check (must precede execution and state checks).
    //    Clears both idempotency keys so the client can re-propose after expiry.
    if (action.expiresAt && action.expiresAt < new Date()) {
      await this.prisma.agentAction.update({
        where: { id: actionId },
        data: {
          status: AgentActionStatus.EXPIRED,
          idempotencyKey: null,
          operationFingerprint: null,
        },
      });
      throw new BadRequestException(AGENT_ERRORS.ACTION_EXPIRED);
    }

    // 4. State machine check (validate transition to EXECUTING before doing external lookups)
    AgentStateMachine.assertTransition(action.status, AgentActionStatus.EXECUTING);

    // 5. Re-resolve tool
    const tool = TOOL_REGISTRY.get(action.toolName);
    if (!tool) {
      throw new NotFoundException(AGENT_ERRORS.ACTION_UNKNOWN_TOOL);
    }

    // 6. Re-fetch current user role — NEVER trust cached/old context
    const currentUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, schoolId: true, status: true },
    });
    if (!currentUser || currentUser.status !== 'ACTIVE') {
      throw new ForbiddenException(AGENT_ERRORS.ACTION_NOT_AUTHORIZED);
    }

    // 7. Re-run policy with current role (catches revoked/changed roles)
    const currentCtx: AgentExecutionContext = {
      userId,
      role: currentUser.role,
      schoolId,
    };
    const policyResult = this.policy.evaluateAtConfirmation(currentCtx, tool);
    if (policyResult.decision === 'DENY') {
      throw new ForbiddenException(
        `${AGENT_ERRORS.ACTION_POLICY_DENIED}: ${policyResult.reason}`,
      );
    }

    // 8. Atomic CAS — prevent concurrent double execution
    await this.prisma.$transaction(async (tx) => {
      const result = await tx.agentAction.updateMany({
        where: {
          id: actionId,
          status: { in: [AgentActionStatus.AWAITING_CONFIRMATION, AgentActionStatus.CONFIRMED] },
        },
        data: {
          status: AgentActionStatus.EXECUTING,
          executedAt: new Date(),
          confirmedBy: userId,
          confirmedAt: new Date(),
        },
      });
      if (result.count === 0) {
        throw new ConflictException(AGENT_ERRORS.ACTION_ALREADY_EXECUTED);
      }
      return result;
    });

    // 9. Execute via domain handler
    try {
      const args = action.arguments as Record<string, unknown>;
      const resultData = await this.dispatchToHandler(
        tool.handlerKey,
        args,
        userId,
        schoolId,
      );

      // 10. Post-execution verification
      await this.verifyExecution(tool.handlerKey, args, userId, schoolId, resultData);

      // 11. Mark SUCCEEDED
      await this.prisma.agentAction.update({
        where: { id: actionId },
        data: {
          status: AgentActionStatus.SUCCEEDED,
          result: resultData as Prisma.InputJsonValue,
        },
      });

      // 12. Audit success
      await this.writeAudit({
        schoolId,
        userId,
        actionId,
        toolName: action.toolName,
        riskLevel: action.riskLevel as RiskLevel,
        status: 'SUCCEEDED',
        resourceType: 'AgentAction',
        resourceId: actionId,
        label: action.label,
      }).catch((e) => this.logger.warn(`Audit write failed: ${e.message}`));

      return {
        actionId,
        status: AgentActionStatus.SUCCEEDED,
        result: resultData,
      };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);

      // Mark FAILED — clear both keys so the client can re-propose and retry
      await this.prisma.agentAction.update({
        where: { id: actionId },
        data: {
          status: AgentActionStatus.FAILED,
          failureReason: msg,
          idempotencyKey: null,
          operationFingerprint: null,
        },
      });

      // Audit failure
      await this.writeAudit({
        schoolId,
        userId,
        actionId,
        toolName: action.toolName,
        riskLevel: action.riskLevel as RiskLevel,
        status: 'FAILED',
        resourceType: 'AgentAction',
        resourceId: actionId,
        label: action.label,
        failureReason: msg,
      }).catch((e) => this.logger.warn(`Audit write failed: ${e.message}`));

      return {
        actionId,
        status: AgentActionStatus.FAILED,
        failureReason: msg,
      };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 2B: GET ACTION STATUS (Phase 15)
  // ═══════════════════════════════════════════════════════════════════════════

  async getActionStatus(actionId: string, userId: string, schoolId: string) {
    const action = await this.prisma.agentAction.findUnique({
      where: { id: actionId },
      select: {
        id: true,
        toolName: true,
        label: true,
        status: true,
        riskLevel: true,
        requiresConfirmation: true,
        expiresAt: true,
        createdAt: true,
        result: true,
        failureReason: true,
        schoolId: true,
        userId: true,
      },
    });

    if (!action) throw new NotFoundException(AGENT_ERRORS.ACTION_NOT_FOUND);
    if (action.schoolId !== schoolId || action.userId !== userId) {
      throw new ForbiddenException(AGENT_ERRORS.ACTION_TENANT_MISMATCH);
    }

    // Return only safe fields — no internal args or DB IDs
    return {
      id: action.id,
      toolName: action.toolName,
      label: action.label,
      status: action.status,
      riskLevel: action.riskLevel,
      requiresConfirmation: action.requiresConfirmation,
      expiresAt: action.expiresAt,
      createdAt: action.createdAt,
      result: action.result,
      failureReason: action.failureReason,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // IDENTITY RESOLUTION — No guessing, no random findFirst
  // ═══════════════════════════════════════════════════════════════════════════

  private async resolveIdentity(
    ctx: AgentExecutionContext,
    toolName: string,
    rawArgs: Record<string, unknown>,
  ): Promise<{ resolvedArgs: Record<string, unknown>; label: string; resourceId: string | null }> {
    const tool = TOOL_REGISTRY.get(toolName)!;

    if (toolName === ToolHandlerKey.APPROVE_LEAVE) {
      const args = rawArgs as unknown as ApproveLeaveInput;
      const staffName = args.staffName.trim();

      const leaves = await this.prisma.leaveRequest.findMany({
        where: {
          schoolId: ctx.schoolId,
          status: 'PENDING',
          staff: {
            user: {
              OR: [
                { firstName: { contains: staffName, mode: 'insensitive' } },
                { lastName: { contains: staffName, mode: 'insensitive' } },
              ],
            },
          },
        },
        include: { staff: { include: { user: { select: { firstName: true, lastName: true } } } } },
      });

      if (leaves.length === 0) {
        throw new NotFoundException(
          `${AGENT_ERRORS.ACTION_RESOURCE_FORBIDDEN}: No pending leave found for staff member "${args.staffName}"`,
        );
      }
      if (leaves.length > 1) {
        const names = leaves.map(
          (l) => `${l.staff.user.firstName} ${l.staff.user.lastName}`,
        );
        throw new BadRequestException(
          `${AGENT_ERRORS.ACTION_AMBIGUOUS_RESOURCE}: Multiple pending leaves match "${staffName}": ${names.join(', ')}. Provide a more specific name.`,
        );
      }

      const leave = leaves[0];
      const fullName = `${leave.staff.user.firstName} ${leave.staff.user.lastName}`;
      return {
        resolvedArgs: { leaveId: leave.id, reason: args.reason },
        label: `Approve leave for ${fullName}`,
        resourceId: leave.id,
      };
    }

    if (toolName === ToolHandlerKey.CREATE_ASSIGNMENT) {
      const args = rawArgs as unknown as CreateAssignmentInput;

      // Resolve class by name (exact, school-scoped)
      const foundClass = await this.prisma.class.findFirst({
        where: { name: { equals: args.className, mode: 'insensitive' }, schoolId: ctx.schoolId },
      });
      if (!foundClass) {
        throw new NotFoundException(
          `${AGENT_ERRORS.ACTION_RESOURCE_FORBIDDEN}: Class "${args.className}" not found`,
        );
      }

      // Validate subjectId is explicit and school-scoped — NEVER pick at random
      const subject = await this.prisma.subject.findFirst({
        where: { id: args.subjectId, schoolId: ctx.schoolId },
      });
      if (!subject) {
        throw new NotFoundException(
          `${AGENT_ERRORS.ACTION_RESOURCE_FORBIDDEN}: Subject "${args.subjectId}" not found in this school`,
        );
      }

      return {
        resolvedArgs: {
          classId: foundClass.id,
          subjectId: subject.id,
          topic: args.topic,
          description: args.description,
          dueDate: args.dueDate,
          totalMarks: args.totalMarks ?? 100,
        },
        label: `Create assignment "${args.topic}" for ${foundClass.name}`,
        resourceId: foundClass.id,
      };
    }

    // For all other tools — pass args through as-is
    const tool_label = `Execute ${tool.description}`;
    return { resolvedArgs: rawArgs, label: tool_label, resourceId: null };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DOMAIN HANDLER DISPATCH
  // Business logic lives in domain services — control plane only orchestrates
  // ═══════════════════════════════════════════════════════════════════════════

  private async dispatchToHandler(
    handlerKey: ToolHandlerKey,
    args: Record<string, unknown>,
    userId: string,
    schoolId: string,
  ): Promise<Record<string, unknown>> {
    switch (handlerKey) {
      case ToolHandlerKey.APPROVE_LEAVE:
        return this.domainApproveLeave(args as unknown as { leaveId: string; reason?: string }, userId, schoolId);

      case ToolHandlerKey.CREATE_ASSIGNMENT:
        return this.domainCreateAssignment(
          args as unknown as {
            classId: string; subjectId: string; topic: string;
            description?: string; dueDate?: string; totalMarks?: number;
          },
          userId, schoolId,
        );

      case ToolHandlerKey.SEND_ANNOUNCEMENT:
        return this.domainSendAnnouncement(args as unknown as SendAnnouncementInput, userId, schoolId);

      // ── Automation tools: delegate to the internal domain op injected from AIService ──
      case ToolHandlerKey.AUTOMATION_FEE_DEFAULTER:
      case ToolHandlerKey.AUTOMATION_ABSENCE_ALERT:
      case ToolHandlerKey.AUTOMATION_ATTENDANCE_WARNING:
        return this.domainAutomationMessages(args as unknown as AutomationInput, userId, schoolId);

      case ToolHandlerKey.AUTOMATION_TIMETABLE_COVER:
        return this.domainAutomationTimetableCover(args as unknown as AutomationInput, userId, schoolId);

      case ToolHandlerKey.AUTOMATION_LEAVE_RECOMMENDATION:
        return this.domainAutomationLeaveRecommendation(args as unknown as AutomationInput, userId, schoolId);

      case ToolHandlerKey.AUTOMATION_REPORT_CARD_PUBLISH:
        return this.domainAutomationReportCardPublish(args as unknown as AutomationInput, userId, schoolId);

      case ToolHandlerKey.AUTOMATION_DAILY_DIGEST:
        return this.domainAutomationDailyDigest(args as unknown as AutomationInput, userId, schoolId);

      default:
        throw new InternalServerErrorException(`No handler registered for key: ${handlerKey}`);
    }
  }

  // ─── Domain: Approve Leave ────────────────────────────────────────────────
  private async domainApproveLeave(
    args: { leaveId: string; reason?: string },
    userId: string,
    schoolId: string,
  ): Promise<Record<string, unknown>> {
    // PHASE 6: Stale rejection — use conditional update (only PENDING)
    const updated = await this.prisma.leaveRequest.updateMany({
      where: { id: args.leaveId, schoolId, status: 'PENDING' },
      data: {
        status: 'APPROVED',
        reviewedBy: userId,
        reviewNote: `[Approved via AI Assistant] ${args.reason ?? ''}`.trim(),
        reviewedAt: new Date(),
      },
    });

    if (updated.count === 0) {
      // Re-read to determine whether it's stale, tenant mismatch, or not found
      const leave = await this.prisma.leaveRequest.findUnique({ where: { id: args.leaveId } });
      if (!leave || leave.schoolId !== schoolId) {
        throw new Error(AGENT_ERRORS.ACTION_TENANT_MISMATCH);
      }
      throw new Error(
        `${AGENT_ERRORS.ACTION_STALE_RESOURCE}: Leave request is no longer PENDING (current status: ${leave.status})`,
      );
    }

    return { leaveId: args.leaveId, approved: true };
  }

  // ─── Domain: Create Assignment ────────────────────────────────────────────
  private async domainCreateAssignment(
    args: {
      classId: string;
      subjectId: string;
      topic: string;
      description?: string;
      dueDate?: string;
      totalMarks?: number;
    },
    userId: string,
    schoolId: string,
  ): Promise<Record<string, unknown>> {
    // Resolve staff from userId — required for AssignmentsService
    const staff = await this.prisma.staff.findFirst({
      where: { userId, schoolId, isActive: true },
    });
    if (!staff) {
      throw new Error('Teacher staff profile not found in this school');
    }

    // Compute dueDate — default 7 days from now if not provided
    const dueDateObj = args.dueDate
      ? new Date(args.dueDate)
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // Delegate to AssignmentsService — it handles tenant isolation + validation
    const assignment = await this.assignmentsService.createAssignment(
      schoolId,
      {
        classId: args.classId,
        subjectId: args.subjectId,
        title: args.topic,
        description: args.description ?? 'Generated by AI Assistant',
        dueDate: dueDateObj.toISOString(),
        maxMarks: args.totalMarks ?? 100,
        staffId: staff.id,
      },
      staff.id,
    );

    return { assignmentId: assignment.id, classId: args.classId, subjectId: args.subjectId };
  }

  // ─── Domain: Send Announcement ────────────────────────────────────────────
  private async domainSendAnnouncement(
    args: SendAnnouncementInput,
    userId: string,
    schoolId: string,
  ): Promise<Record<string, unknown>> {
    const allUsers = await this.prisma.user.findMany({
      where: { schoolId, status: 'ACTIVE' },
      select: { id: true },
    });
    const recipients = allUsers.filter((u) => u.id !== userId);

    if (recipients.length > 0) {
      await this.prisma.message.createMany({
        data: recipients.map((r) => ({
          schoolId,
          senderId: userId,
          recipientId: r.id,
          subject: args.title,
          body: args.message ?? 'Sent via AI Assistant.',
        })),
      });
    }

    return { sentCount: recipients.length };
  }

  // ─── Domain: Automation — message-based tasks ─────────────────────────────
  private async domainAutomationMessages(
    args: AutomationInput,
    userId: string,
    schoolId: string,
  ): Promise<Record<string, unknown>> {
    const items = (args.items ?? []) as Array<{ recipientId?: string; draftMessage?: string }>;
    const recipientIds = items.map((i) => i.recipientId).filter(Boolean) as string[];

    const validUsers = await this.prisma.user.findMany({
      where: { id: { in: recipientIds }, schoolId },
      select: { id: true },
    });
    const validUserIdSet = new Set(validUsers.map((u) => u.id));

    const BATCH_SIZE = 50;
    let actionsCount = 0;

    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE);
      const messages = batch
        .filter((item) => item.recipientId && validUserIdSet.has(item.recipientId))
        .map((item) => ({
          schoolId,
          senderId: userId,
          recipientId: item.recipientId!,
          subject: (args.subject ?? 'AI Notification').substring(0, 255),
          body: item.draftMessage ?? '',
        }));
      if (messages.length > 0) {
        await this.prisma.message.createMany({ data: messages });
        actionsCount += messages.length;
      }
    }

    return { actionsCount };
  }

  // ─── Domain: Automation — Timetable Cover ────────────────────────────────
  private async domainAutomationTimetableCover(
    args: AutomationInput,
    userId: string,
    schoolId: string,
  ): Promise<Record<string, unknown>> {
    const items = (args.items ?? []) as Array<{
      suggestedSubstituteId?: string;
      slots?: Array<{ id: string }>;
    }>;
    let actionsCount = 0;

    for (const item of items) {
      if (!item.suggestedSubstituteId || !Array.isArray(item.slots) || item.slots.length === 0) continue;

      const substituteStaff = await this.prisma.staff.findFirst({
        where: { id: item.suggestedSubstituteId, schoolId },
      });
      if (!substituteStaff) continue;

      const slotIds = item.slots.map((s) => s.id).filter(Boolean);
      const result = await this.prisma.timetableSlot.updateMany({
        where: { id: { in: slotIds }, schoolId },
        data: { staffId: item.suggestedSubstituteId },
      });
      actionsCount += result.count;
    }

    return { actionsCount };
  }

  // ─── Domain: Automation — Leave Recommendation ───────────────────────────
  private async domainAutomationLeaveRecommendation(
    args: AutomationInput,
    userId: string,
    schoolId: string,
  ): Promise<Record<string, unknown>> {
    const items = (args.items ?? []) as Array<{
      id?: string;
      recommendation?: string;
      reasoning?: string;
    }>;
    let actionsCount = 0;

    for (const item of items) {
      if (!item.id) continue;
      const leave = await this.prisma.leaveRequest.findFirst({
        where: { id: item.id, schoolId },
      });
      if (!leave) continue;
      await this.prisma.leaveRequest.update({
        where: { id: item.id },
        data: { reviewNote: `[AI Recommendation: ${item.recommendation ?? 'REVIEW'}] ${item.reasoning ?? ''}` },
      });
      actionsCount++;
    }

    return { actionsCount };
  }

  // ─── Domain: Automation — Report Card Publish ────────────────────────────
  private async domainAutomationReportCardPublish(
    args: AutomationInput,
    userId: string,
    schoolId: string,
  ): Promise<Record<string, unknown>> {
    const items = (args.items ?? []) as Array<{
      id?: string;
      isComplete?: boolean;
      examName?: string;
      draftMessage?: string;
    }>;
    const readyExams = items.filter((i) => i.isComplete && i.id);
    let actionsCount = 0;

    for (const exam of readyExams) {
      const examRecord = await this.prisma.exam.findFirst({
        where: { id: exam.id!, schoolId },
      });
      if (!examRecord) continue;

      const students = await this.prisma.student.findMany({
        where: { schoolId, isActive: true },
        include: { user: { select: { id: true } } },
        take: 500,
      });

      const messages = students.map((s) => ({
        schoolId,
        senderId: userId,
        recipientId: s.user.id,
        subject: `Results Ready: ${exam.examName ?? examRecord.name}`,
        body: exam.draftMessage ?? `Results for ${examRecord.name} are now available.`,
      }));

      if (messages.length > 0) {
        await this.prisma.message.createMany({ data: messages });
        actionsCount += messages.length;
      }
    }

    return { actionsCount };
  }

  // ─── Domain: Automation — Daily Digest ───────────────────────────────────
  private async domainAutomationDailyDigest(
    args: AutomationInput,
    userId: string,
    schoolId: string,
  ): Promise<Record<string, unknown>> {
    const items = (args.items ?? []) as Array<{ draftMessage?: string }>;
    const principal = await this.prisma.user.findFirst({
      where: { schoolId, role: { in: ['PRINCIPAL', 'SCHOOL_ADMIN'] }, status: 'ACTIVE' },
    });

    if (principal && items[0]?.draftMessage) {
      await this.prisma.message.create({
        data: {
          schoolId,
          senderId: userId,
          recipientId: principal.id,
          subject: `Daily School Digest — ${new Date().toDateString()}`,
          body: items[0].draftMessage,
        },
      });
      return { actionsCount: 1 };
    }

    return { actionsCount: 0 };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // POST-EXECUTION VERIFICATION (Phase 10)
  // ═══════════════════════════════════════════════════════════════════════════

  private async verifyExecution(
    handlerKey: ToolHandlerKey,
    args: Record<string, unknown>,
    userId: string,
    schoolId: string,
    resultData: Record<string, unknown>,
  ): Promise<void> {
    if (handlerKey === ToolHandlerKey.APPROVE_LEAVE) {
      const leaveId = args['leaveId'] as string;
      const leave = await this.prisma.leaveRequest.findUnique({ where: { id: leaveId } });
      if (!leave || leave.status !== 'APPROVED' || leave.reviewedBy !== userId) {
        throw new Error(AGENT_ERRORS.ACTION_VERIFICATION_FAILED);
      }
    }

    if (handlerKey === ToolHandlerKey.CREATE_ASSIGNMENT) {
      const assignmentId = (resultData as { assignmentId?: string }).assignmentId;
      if (!assignmentId) throw new Error(AGENT_ERRORS.ACTION_VERIFICATION_FAILED);
      const assignment = await this.prisma.assignment.findUnique({ where: { id: assignmentId } });
      if (
        !assignment ||
        assignment.schoolId !== schoolId ||
        assignment.classId !== (args['classId'] as string) ||
        assignment.subjectId !== (args['subjectId'] as string)
      ) {
        throw new Error(AGENT_ERRORS.ACTION_VERIFICATION_FAILED);
      }
    }

    if (handlerKey === ToolHandlerKey.SEND_ANNOUNCEMENT) {
      const sentCount = (resultData as { sentCount?: number }).sentCount ?? 0;
      if (sentCount === 0) {
        this.logger.warn('Announcement sent to 0 recipients — no active users found');
        // Not a hard failure — school may have no other active users
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // OPERATION FINGERPRINT (replaces old computeIdempotencyKey)
  //
  // Computes a deterministic, content-addressable hash that uniquely
  // identifies the _business mutation_ — not the HTTP request.
  //
  // Strategy dispatch is exhaustive — every case is explicit:
  //   NATURAL_KEY  → hash(schoolId:userId:toolName:<natural-key-field>)
  //   CONTENT_HASH → hash(schoolId:userId:toolName:<sorted-args-json>)
  //   REQUEST_KEY  → null (no operation fingerprint; client request key guards)
  //   NONE         → null (deliberately non-idempotent)
  // ═══════════════════════════════════════════════════════════════════════════

  private computeOperationFingerprint(
    tool: ToolDefinition,
    ctx: AgentExecutionContext,
    resolvedArgs: Record<string, unknown>,
  ): string | null {
    switch (tool.idempotencyStrategy) {
      case 'NATURAL_KEY': {
        // For approve_leave: the natural key is the resolved leaveId.
        // For any future NATURAL_KEY tool, add its key field here explicitly.
        const naturalKeyValue = resolvedArgs['leaveId'] as string | undefined;
        if (!naturalKeyValue) {
          // Defensive: fall back to content hash if natural key field is absent
          this.logger.warn(
            `Tool "${tool.name}" declares NATURAL_KEY but no natural key field found in resolvedArgs; falling back to CONTENT_HASH`,
          );
          const stableArgs = JSON.stringify(resolvedArgs, Object.keys(resolvedArgs).sort());
          return createHash('sha256')
            .update(`${ctx.schoolId}:${ctx.userId}:${tool.name}:${stableArgs}`)
            .digest('hex');
        }
        return createHash('sha256')
          .update(`${ctx.schoolId}:${ctx.userId}:${tool.name}:${naturalKeyValue}`)
          .digest('hex');
      }

      case 'CONTENT_HASH': {
        // Deterministic hash of the full, resolved argument payload.
        const stableArgs = JSON.stringify(resolvedArgs, Object.keys(resolvedArgs).sort());
        return createHash('sha256')
          .update(`${ctx.schoolId}:${ctx.userId}:${tool.name}:${stableArgs}`)
          .digest('hex');
      }

      case 'REQUEST_KEY':
        // No operation fingerprint — deduplication is entirely at the request level.
        // The client must supply an Idempotency-Key header; without one, each call
        // is treated as independent (intentional for broadcast-style tools).
        return null;

      case 'NONE':
        // Deliberately non-idempotent — no fingerprint computed, no dedup applied.
        return null;

      default: {
        // TypeScript exhaustiveness guard — will fail at compile time if a new strategy
        // is added to IdempotencyStrategy without a corresponding case here.
        const _exhaustive: never = tool.idempotencyStrategy;
        throw new InternalServerErrorException(
          `Unknown idempotency strategy: ${String(_exhaustive)}`,
        );
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PROPOSAL RESPONSE BUILDER
  // Centralised so both the idempotent short-circuit and the normal path
  // produce identical response shapes.
  // ═══════════════════════════════════════════════════════════════════════════

  private buildProposalResponse(
    action: {
      id: string;
      toolName: string;
      label: string;
      riskLevel: string;
      status: string;
      expiresAt: Date | null;
      requiresConfirmation: boolean;
      result?: unknown;
    },
    tool: ToolDefinition,
    idempotent: boolean,
  ): { pendingAction: Record<string, unknown> } {
    return {
      pendingAction: {
        actionId: action.id,
        type: tool.name,
        label: action.label,
        riskLevel: action.riskLevel,
        status: action.status,
        expiresAt: action.expiresAt,
        requiresConfirmation: action.requiresConfirmation,
        idempotent,
        ...(idempotent && action.result !== undefined ? { result: action.result } : {}),
      },
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // AUDIT (Phase 14)
  // ═══════════════════════════════════════════════════════════════════════════

  private async writeAudit(payload: AuditPayload): Promise<void> {
    await this.prisma.activityLog.create({
      data: {
        schoolId: payload.schoolId,
        userId: payload.userId,
        action: 'UPDATE',
        module: 'AI_CONTROL_PLANE',
        resourceId: payload.resourceId ?? payload.actionId,
        resourceType: payload.resourceType,
        description: payload.label,
        after: {
          actionId: payload.actionId,
          toolName: payload.toolName,
          riskLevel: payload.riskLevel,
          status: payload.status,
          correlationId: payload.correlationId,
          ...(payload.failureReason ? { failureReason: payload.failureReason } : {}),
        } as Prisma.InputJsonValue,
      },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SCHEDULER: Expire stale AWAITING_CONFIRMATION and CONFIRMED actions
  //
  // Covers both states so a CONFIRMED-but-never-executed action does not
  // hold its idempotency slot indefinitely.
  // Both keys are cleared on expiry so clients can re-propose.
  // ═══════════════════════════════════════════════════════════════════════════

  async expireStaleActions(): Promise<{ count: number }> {
    const result = await this.prisma.agentAction.updateMany({
      where: {
        status: { in: [AgentActionStatus.AWAITING_CONFIRMATION, AgentActionStatus.CONFIRMED] },
        expiresAt: { lt: new Date() },
      },
      data: {
        status: AgentActionStatus.EXPIRED,
        idempotencyKey: null,
        operationFingerprint: null,
      },
    });
    return { count: result.count };
  }
}
