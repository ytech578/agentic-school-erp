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
import {
  TOOL_REGISTRY,
  ToolDefinition,
  validateToolInput,
} from './tool-registry';
import { AgentPolicyService } from './agent-policy.service';
import { AgentStateMachine } from './agent-state-machine';
import { AgentToolDispatcher } from './agent-tool-dispatcher';
import {
  validateIdempotencyKey,
  deriveIdempotencyScope,
  computeRequestFingerprint,
  canonicalJson,
} from './idempotency.util';
import { ROLE_PERMISSIONS, type UserRole } from '@school-erp/shared';
import {
  AgentExecutionContext,
  AgentToolExecutionContext,
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

/**
 * AgentControlPlaneService — Security & Orchestration Boundary
 *
 * Architecture:
 *   AI / Agent
 *       ↓
 *   AgentControlPlaneService  (authentication, tenant, policy, idempotency, state CAS, audit)
 *       ↓
 *   AgentToolDispatcher       (registry-based resolution & dispatch)
 *       ↓
 *   AgentToolHandler          (adapter translating agent arguments into domain calls)
 *       ↓
 *   Existing Domain Services  (HRService, AssignmentsService, MessagesService, TimetableService)
 *       ↓
 *   Prisma / Database
 *
 * AgentControlPlaneService is an orchestration and security boundary, NOT an ERP business-logic container.
 * Business validation, mutations, and domain rules live inside domain services and handlers.
 */
@Injectable()
export class AgentControlPlaneService {
  private readonly logger = new Logger(AgentControlPlaneService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: AgentPolicyService,
    private readonly dispatcher: AgentToolDispatcher,
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
      throw new BadRequestException(
        `${AGENT_ERRORS.ACTION_EXECUTION_FAILED}: No real handler registered for "${toolName}"`,
      );
    }

    // 3. Input schema validation — reject unknown / malformed fields
    const validationErrors = validateToolInput(tool, rawArgs);
    if (validationErrors.length > 0) {
      throw new BadRequestException(
        `${AGENT_ERRORS.ACTION_INVALID_ARGUMENTS}: ${validationErrors.join('; ')}`,
      );
    }

    // 4. Validate client-supplied request idempotency key format if provided
    validateIdempotencyKey(clientRequestKey);

    // 5. Policy evaluation — server-authoritative, never trusts client
    const policyResult = this.policy.evaluate(ctx, tool);
    if (policyResult.decision === 'DENY') {
      throw new ForbiddenException(
        `${AGENT_ERRORS.ACTION_POLICY_DENIED}: ${policyResult.reason}`,
      );
    }

    // 6. Compute server-derived scope and request payload fingerprint
    const idempotencyScope = clientRequestKey
      ? deriveIdempotencyScope(ctx.schoolId, ctx.userId, tool.name)
      : undefined;
    const requestFingerprint = computeRequestFingerprint(
      ctx.schoolId,
      ctx.userId,
      tool.name,
      rawArgs,
    );

    // 7. REQUEST-LEVEL idempotency check (scoped by tenant, user, tool)
    if (clientRequestKey && idempotencyScope) {
      const existingByRequestKey = await this.prisma.agentAction.findFirst({
        where: { idempotencyScope, idempotencyKey: clientRequestKey },
      });
      if (existingByRequestKey) {
        // Enforce Step 4: same key + different request MUST conflict
        if (
          existingByRequestKey.requestFingerprint &&
          existingByRequestKey.requestFingerprint !== requestFingerprint
        ) {
          throw new ConflictException(
            `${AGENT_ERRORS.ACTION_IDEMPOTENCY_KEY_REUSE}: Idempotency-Key "${clientRequestKey}" was previously used for a different request payload`,
          );
        }

        if (existingByRequestKey.status === AgentActionStatus.EXECUTING) {
          const rec = await this.reconcileAction(
            existingByRequestKey,
            ctx.role,
          );
          if (rec.status === 'SUCCEEDED') {
            return this.buildProposalResponse(
              {
                ...existingByRequestKey,
                status: AgentActionStatus.SUCCEEDED,
                result: rec.result,
              },
              tool,
              true,
            );
          }
          return this.buildProposalResponse(
            { ...existingByRequestKey, status: AgentActionStatus.FAILED },
            tool,
            true,
          );
        }

        this.logger.debug(
          `Request key "${clientRequestKey}" already processed with identical payload — returning cached action`,
        );
        return this.buildProposalResponse(existingByRequestKey, tool, true);
      }
    }

    // 8. Domain-level identity resolution (no guessing)
    const { resolvedArgs, label, resourceId } = await this.resolveIdentity(
      ctx,
      toolName,
      rawArgs,
    );

    // 9. Compute operation fingerprint (business-mutation hash)
    //    Distinct from the client request key — guards against double-execution.
    const operationFingerprint = this.computeOperationFingerprint(
      tool,
      ctx,
      resolvedArgs,
    );

    // 10. OPERATION-LEVEL idempotency check (fingerprint of the logical mutation)
    if (operationFingerprint) {
      const existingByFingerprint = await this.prisma.agentAction.findFirst({
        where: { operationFingerprint },
        orderBy: { createdAt: 'desc' },
      });

      if (existingByFingerprint) {
        if (existingByFingerprint.status === AgentActionStatus.SUCCEEDED) {
          // Already completed successfully — return idempotent cached result
          this.logger.debug(
            `Operation fingerprint collision: action ${existingByFingerprint.id} already SUCCEEDED`,
          );
          return this.buildProposalResponse(existingByFingerprint, tool, true);
        }

        if (
          existingByFingerprint.status ===
            AgentActionStatus.AWAITING_CONFIRMATION ||
          existingByFingerprint.status === AgentActionStatus.CONFIRMED
        ) {
          // Return the existing pending action — client can confirm or let it expire
          this.logger.debug(
            `Operation fingerprint collision: action ${existingByFingerprint.id} is ${existingByFingerprint.status}`,
          );
          return this.buildProposalResponse(existingByFingerprint, tool, false);
        }

        if (existingByFingerprint.status === AgentActionStatus.EXECUTING) {
          // Ambiguous execution state: attempt handler-level reconciliation
          const rec = await this.reconcileAction(
            existingByFingerprint,
            ctx.role,
          );
          if (rec.status === 'SUCCEEDED') {
            return this.buildProposalResponse(
              {
                ...existingByFingerprint,
                status: AgentActionStatus.SUCCEEDED,
                result: rec.result,
              },
              tool,
              true,
            );
          }
          this.logger.debug(
            `Reconciled action ${existingByFingerprint.id} as NOT_APPLIED — allowing fresh proposal`,
          );
          // Fall through to allow creating fresh row
        }

        // If FAILED or EXPIRED:
        // Do NOT clear keys on historical row! The historical row remains intact.
        // A fresh proposal with new clientRequestKey can proceed.
      }
    }

    // 11. Compute expiry
    const expiresAt = new Date(Date.now() + tool.expiryMinutes * 60_000);

    // 12. Determine initial status from policy decision
    const initialStatus =
      policyResult.decision === 'CONFIRMATION_REQUIRED'
        ? AgentActionStatus.AWAITING_CONFIRMATION
        : AgentActionStatus.CONFIRMED;

    // 13. Build deterministic correlationId (traceable in logs, unique per call)
    const correlationId = createHash('sha256')
      .update(`${ctx.userId}:${toolName}:${Date.now()}`)
      .digest('hex')
      .slice(0, 32);

    // 14. Persist AgentAction with concurrent proposal race handling
    let action: any;
    try {
      action = await this.prisma.agentAction.create({
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
          idempotencyScope: idempotencyScope ?? undefined,
          idempotencyKey: clientRequestKey ?? undefined,
          requestFingerprint,
          operationFingerprint: operationFingerprint ?? undefined,
          correlationId,
        },
      });
    } catch (err: any) {
      // Step 6: Safe concurrent proposal race handling for Prisma P2002 error
      if (
        err?.code === 'P2002' ||
        err?.message?.includes('Unique constraint failed')
      ) {
        // Race on scoped idempotency key
        if (clientRequestKey && idempotencyScope) {
          const existing = await this.prisma.agentAction.findFirst({
            where: { idempotencyScope, idempotencyKey: clientRequestKey },
          });
          if (existing) {
            if (
              existing.requestFingerprint &&
              existing.requestFingerprint !== requestFingerprint
            ) {
              throw new ConflictException(
                `${AGENT_ERRORS.ACTION_IDEMPOTENCY_KEY_REUSE}: Idempotency-Key "${clientRequestKey}" was previously used for a different request payload`,
              );
            }
            return this.buildProposalResponse(existing, tool, true);
          }
        }

        // Race on operation fingerprint
        if (operationFingerprint) {
          const existing = await this.prisma.agentAction.findFirst({
            where: { operationFingerprint },
            orderBy: { createdAt: 'desc' },
          });
          if (existing) {
            if (existing.status === AgentActionStatus.SUCCEEDED) {
              return this.buildProposalResponse(existing, tool, true);
            }
            if (
              existing.status === AgentActionStatus.AWAITING_CONFIRMATION ||
              existing.status === AgentActionStatus.CONFIRMED
            ) {
              return this.buildProposalResponse(existing, tool, false);
            }
            throw new ConflictException(
              AGENT_ERRORS.ACTION_FINGERPRINT_CONFLICT,
            );
          }
        }
      }
      throw err;
    }

    // 15. Audit proposal
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
    //    Never null out idempotency keys — preserves historical audit trail.
    if (
      action.status === AgentActionStatus.EXPIRED ||
      (action.expiresAt && action.expiresAt < new Date())
    ) {
      if (action.status !== AgentActionStatus.EXPIRED) {
        await this.prisma.agentAction.update({
          where: { id: actionId },
          data: {
            status: AgentActionStatus.EXPIRED,
          },
        });
      }
      throw new BadRequestException(AGENT_ERRORS.ACTION_EXPIRED);
    }

    // 4. State machine check (validate transition to EXECUTING before doing external lookups)
    // If already in EXECUTING state, allow through for handler reconciliation below.
    if (action.status !== AgentActionStatus.EXECUTING) {
      AgentStateMachine.assertTransition(
        action.status,
        AgentActionStatus.EXECUTING,
      );
    }

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

    // 7. Reconcile if already in EXECUTING state
    if (action.status === AgentActionStatus.EXECUTING) {
      const rec = await this.reconcileAction(action, currentUser.role);
      if (rec.status === 'SUCCEEDED') {
        return {
          actionId,
          status: AgentActionStatus.SUCCEEDED,
          result: rec.result,
        };
      }
      return {
        actionId,
        status: AgentActionStatus.FAILED,
        failureReason: rec.failureReason,
      };
    }

    // 8. Re-run policy with current role (catches revoked/changed roles)
    const currentCtx: AgentExecutionContext = {
      userId,
      role: currentUser.role,
      schoolId,
      permissions: ROLE_PERMISSIONS[currentUser.role] ?? [],
    };
    const policyResult = this.policy.evaluateAtConfirmation(currentCtx, tool);
    if (policyResult.decision === 'DENY') {
      throw new ForbiddenException(
        `${AGENT_ERRORS.ACTION_POLICY_DENIED}: ${policyResult.reason}`,
      );
    }

    // 9. Atomic CAS — prevent concurrent double execution and race conditions
    const casResult = await this.prisma.agentAction.updateMany({
      where: {
        id: actionId,
        status: {
          in: [
            AgentActionStatus.AWAITING_CONFIRMATION,
            AgentActionStatus.CONFIRMED,
          ],
        },
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      data: {
        status: AgentActionStatus.EXECUTING,
        executedAt: new Date(),
        confirmedBy: userId,
        confirmedAt: new Date(),
      },
    });

    if (!casResult || casResult.count === 0) {
      const latest = await this.prisma.agentAction.findUnique({
        where: { id: actionId },
      });
      if (!latest) {
        throw new NotFoundException(AGENT_ERRORS.ACTION_NOT_FOUND);
      }
      if (latest.status === AgentActionStatus.SUCCEEDED) {
        return {
          actionId,
          status: AgentActionStatus.SUCCEEDED,
          result: latest.result,
        };
      }
      if (latest.status === AgentActionStatus.EXECUTING) {
        const rec = await this.reconcileAction(latest, currentUser.role);
        if (rec.status === 'SUCCEEDED') {
          return {
            actionId,
            status: AgentActionStatus.SUCCEEDED,
            result: rec.result,
          };
        }
        return {
          actionId,
          status: AgentActionStatus.FAILED,
          failureReason: rec.failureReason,
        };
      }
      if (
        latest.status === AgentActionStatus.EXPIRED ||
        (latest.expiresAt && latest.expiresAt <= new Date())
      ) {
        throw new BadRequestException(AGENT_ERRORS.ACTION_EXPIRED);
      }
      throw new ConflictException(AGENT_ERRORS.ACTION_ALREADY_EXECUTED);
    }

    // 10. Execute via domain handler through dispatcher
    try {
      const toolCtx: AgentToolExecutionContext = {
        userId,
        schoolId,
        role: currentUser.role,
        actionId,
      };
      const args = action.arguments as Record<string, unknown>;

      const resultData = await this.dispatcher.dispatch(
        tool.handlerKey,
        toolCtx,
        args,
      );

      // 11. Post-execution domain verification via dispatcher
      await this.dispatcher.verify(tool.handlerKey, toolCtx, args, resultData);

      // 12. Mark SUCCEEDED
      await this.prisma.agentAction.update({
        where: { id: actionId },
        data: {
          status: AgentActionStatus.SUCCEEDED,
          result: resultData as Prisma.InputJsonValue,
        },
      });

      // 13. Audit success
      await this.writeAudit({
        schoolId,
        userId,
        actionId,
        toolName: action.toolName,
        riskLevel: action.riskLevel,
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

      // Mark FAILED — historical keys are preserved
      await this.prisma.agentAction.update({
        where: { id: actionId },
        data: {
          status: AgentActionStatus.FAILED,
          failureReason: msg,
        },
      });

      // Audit failure
      await this.writeAudit({
        schoolId,
        userId,
        actionId,
        toolName: action.toolName,
        riskLevel: action.riskLevel,
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
  ): Promise<{
    resolvedArgs: Record<string, unknown>;
    label: string;
    resourceId: string | null;
  }> {
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
        include: {
          staff: {
            include: { user: { select: { firstName: true, lastName: true } } },
          },
        },
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
        where: {
          name: { equals: args.className, mode: 'insensitive' },
          schoolId: ctx.schoolId,
        },
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
  // RECONCILIATION FOR AMBIGUOUS EXECUTING STATES
  // ═══════════════════════════════════════════════════════════════════════════

  private async reconcileAction(
    action: {
      id: string;
      userId: string;
      schoolId: string;
      toolName: string;
      riskLevel: RiskLevel;
      label: string;
      arguments: unknown;
    },
    role: string,
  ): Promise<{
    status: 'SUCCEEDED' | 'FAILED';
    result?: unknown;
    failureReason?: string;
  }> {
    const tool = TOOL_REGISTRY.get(action.toolName);
    if (!tool) {
      throw new NotFoundException(AGENT_ERRORS.ACTION_UNKNOWN_TOOL);
    }
    const toolCtx: AgentToolExecutionContext = {
      userId: action.userId,
      schoolId: action.schoolId,
      role: role,
      actionId: action.id,
    };
    const reconciled = await this.dispatcher.reconcile(
      tool.handlerKey,
      toolCtx,
      action.arguments as Record<string, unknown>,
    );

    if (reconciled?.status === 'APPLIED') {
      await this.prisma.agentAction.update({
        where: { id: action.id },
        data: {
          status: AgentActionStatus.SUCCEEDED,
          result: (reconciled.result ?? {}) as Prisma.InputJsonValue,
        },
      });
      await this.writeAudit({
        schoolId: action.schoolId,
        userId: action.userId,
        actionId: action.id,
        toolName: action.toolName,
        riskLevel: action.riskLevel,
        status: 'SUCCEEDED',
        resourceType: 'AgentAction',
        resourceId: action.id,
        label: `RECONCILED: ${action.label}`,
      }).catch((e) => this.logger.warn(`Audit write failed: ${e.message}`));
      return { status: 'SUCCEEDED', result: reconciled.result };
    }

    if (reconciled?.status === 'NOT_APPLIED') {
      const failureReason =
        reconciled.reason ?? 'Execution interrupted, reconciled as not applied';
      await this.prisma.agentAction.update({
        where: { id: action.id },
        data: {
          status: AgentActionStatus.FAILED,
          failureReason,
        },
      });
      return { status: 'FAILED', failureReason };
    }

    // UNKNOWN outcome or no reconciliation handler
    throw new ConflictException(
      `${AGENT_ERRORS.ACTION_RECOVERY_REQUIRED}: Action ${action.id} is in-flight and could not be verified. Manual recovery required.`,
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // OPERATION FINGERPRINT (replaces old computeIdempotencyKey)
  //
  // Computes a deterministic, content-addressable hash that uniquely
  // identifies the _business mutation_ — not the HTTP request.
  //
  // Strategy dispatch is exhaustive — every case is explicit:
  //   NATURAL_KEY  → hash(schoolId:toolName:<natural-key-field>)
  //   CONTENT_HASH → hash(schoolId:[userId:]toolName:<canonical-args-json>)
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
        const naturalKeyValue = (resolvedArgs['leaveId'] ??
          resolvedArgs['leaveRequestId']) as string | undefined;
        if (!naturalKeyValue) {
          this.logger.warn(
            `Tool "${tool.name}" declares NATURAL_KEY but no natural key field found in resolvedArgs; falling back to CONTENT_HASH`,
          );
          const stableArgs = canonicalJson(resolvedArgs);
          return createHash('sha256')
            .update(`${ctx.schoolId}:${tool.name}:${stableArgs}`)
            .digest('hex');
        }
        // Actor-independent business mutation fingerprint
        return createHash('sha256')
          .update(`${ctx.schoolId}:${tool.name}:${naturalKeyValue}`)
          .digest('hex');
      }

      case 'CONTENT_HASH': {
        // For shared mutations like create_assignment, make fingerprint actor-independent (exclude userId).
        if (tool.name === ToolHandlerKey.CREATE_ASSIGNMENT) {
          const classId = (resolvedArgs['classId'] as string) ?? '';
          const subjectId = (resolvedArgs['subjectId'] as string) ?? '';
          const normalizedDetails = {
            topic: (resolvedArgs['topic'] ?? resolvedArgs['title']) as
              string | undefined,
            description: resolvedArgs['description'] ?? null,
            dueDate: resolvedArgs['dueDate'] ?? null,
            totalMarks: resolvedArgs['totalMarks'] ?? 100,
          };
          return createHash('sha256')
            .update(
              `${ctx.schoolId}:${tool.name}:${classId}:${subjectId}:${canonicalJson(normalizedDetails)}`,
            )
            .digest('hex');
        }

        // Deterministic hash of the full resolved argument payload
        const stableArgs = canonicalJson(resolvedArgs);
        return createHash('sha256')
          .update(`${ctx.schoolId}:${ctx.userId}:${tool.name}:${stableArgs}`)
          .digest('hex');
      }

      case 'REQUEST_KEY':
        // No operation fingerprint — deduplication is entirely at the request level.
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
        ...(idempotent && action.result !== undefined
          ? { result: action.result }
          : {}),
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
          ...(payload.failureReason
            ? { failureReason: payload.failureReason }
            : {}),
        },
      },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SCHEDULER: Expire stale AWAITING_CONFIRMATION and CONFIRMED actions
  //
  // Covers both states so a CONFIRMED-but-never-executed action does not
  // hold its idempotency slot indefinitely.
  // Historical keys are preserved on expired rows.
  // ═══════════════════════════════════════════════════════════════════════════

  async expireStaleActions(): Promise<{ count: number }> {
    const result = await this.prisma.agentAction.updateMany({
      where: {
        status: {
          in: [
            AgentActionStatus.AWAITING_CONFIRMATION,
            AgentActionStatus.CONFIRMED,
          ],
        },
        expiresAt: { lt: new Date() },
      },
      data: {
        status: AgentActionStatus.EXPIRED,
      },
    });
    return { count: result.count };
  }
}
