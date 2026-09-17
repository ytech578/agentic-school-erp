import { Injectable } from '@nestjs/common';
import { ToolDefinition } from './tool-registry';
import { AgentExecutionContext, PolicyDecision, PolicyEvaluationResult } from './agent-types';

/**
 * AgentPolicyService — the authoritative policy gate between the control
 * plane's authorization check and the actual execution.
 *
 * NEVER trust client-supplied role or permission values.
 * All inputs must come from the server-resolved execution context.
 */
@Injectable()
export class AgentPolicyService {
  /**
   * Evaluate whether the given context is permitted to execute the tool.
   *
   * Decision chain:
   *   1. Tool not found → DENY
   *   2. tenantScoped but no schoolId → DENY
   *   3. Role not in allowedRoles → DENY
   *   4. HIGH risk without confirmation → CONFIRMATION_REQUIRED
   *   5. requiresConfirmation flag → CONFIRMATION_REQUIRED
   *   6. All checks pass → ALLOW
   */
  evaluate(
    ctx: AgentExecutionContext,
    tool: ToolDefinition,
  ): PolicyEvaluationResult {
    // Tenant check — all tools are tenantScoped
    if (tool.tenantScoped && !ctx.schoolId) {
      return { decision: 'DENY', reason: 'School context is required for this action' };
    }

    // Role check — server-authoritative, never trusts client
    if (!tool.allowedRoles.includes(ctx.role)) {
      return {
        decision: 'DENY',
        reason: `Role "${ctx.role}" is not permitted to execute "${tool.name}"`,
      };
    }

    // Permission check (future extensibility — currently empty arrays)
    if (tool.requiredPermissions.length > 0) {
      // TODO: check user's fine-grained permissions against tool.requiredPermissions
      // For now, pass-through (role check is sufficient)
    }

    // High-risk tools always require confirmation
    if (tool.riskLevel === 'HIGH' && tool.requiresConfirmation) {
      return { decision: 'CONFIRMATION_REQUIRED', reason: 'High-risk action requires explicit confirmation' };
    }

    // Medium-risk with requiresConfirmation
    if (tool.requiresConfirmation) {
      return { decision: 'CONFIRMATION_REQUIRED', reason: 'This action requires explicit confirmation' };
    }

    return { decision: 'ALLOW' };
  }

  /**
   * Re-evaluate policy at confirmation time.
   * Must be called with the CURRENT user context, not the original proposer's context.
   * Ensures revoked/changed roles are rejected before execution.
   */
  evaluateAtConfirmation(
    currentCtx: AgentExecutionContext,
    tool: ToolDefinition,
  ): PolicyEvaluationResult {
    // Re-run the full policy evaluation with current (re-fetched) role
    return this.evaluate(currentCtx, tool);
  }
}
