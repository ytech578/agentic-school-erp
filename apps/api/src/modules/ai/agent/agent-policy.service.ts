import { Injectable } from '@nestjs/common';
import { Permission, ROLE_PERMISSIONS } from '@school-erp/shared';
import { ToolDefinition } from './tool-registry';
import { AgentExecutionContext, PolicyEvaluationResult } from './agent-types';

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
   * Evaluate whether the given context is permitted to execute or propose the tool.
   *
   * Decision chain:
   *   1. Tenant context check (tool.tenantScoped requires valid schoolId)
   *   2. Role check (ctx.role in tool.allowedRoles)
   *   3. Fine-grained permission check (user possesses all tool.requiredPermissions)
   *   4. Risk policy & confirmation check:
   *      - HIGH risk tool with requiresConfirmation → CONFIRMATION_REQUIRED
   *      - requiresConfirmation flag → CONFIRMATION_REQUIRED
   *   5. All checks pass → ALLOW
   */
  evaluate(
    ctx: AgentExecutionContext,
    tool: ToolDefinition,
  ): PolicyEvaluationResult {
    // 1. Tenant check — all tools are tenantScoped
    if (tool.tenantScoped && !ctx.schoolId) {
      return {
        decision: 'DENY',
        reason: 'School context is required for this action',
      };
    }

    // 2. Role check — server-authoritative, never trusts client
    if (!tool.allowedRoles.includes(ctx.role)) {
      return {
        decision: 'DENY',
        reason: `Role "${ctx.role}" is not permitted to execute "${tool.name}"`,
      };
    }

    // 3. Permission check — server-derived from role-permission matrix
    // If ctx.permissions is provided (e.g. customized user permissions),
    // it is strictly intersected with server-authoritative role permissions
    // so that client-injected / spoofed permissions are discarded.
    const rolePermissions =
      (ROLE_PERMISSIONS as Record<string, Permission[]>)[ctx.role] ?? [];
    const effectivePermissions = ctx.permissions
      ? ctx.permissions.filter((p) => rolePermissions.includes(p as Permission))
      : rolePermissions;

    if (tool.requiredPermissions && tool.requiredPermissions.length > 0) {
      const hasAllPermissions = tool.requiredPermissions.every((p) =>
        effectivePermissions.includes(p),
      );

      if (!hasAllPermissions) {
        return {
          decision: 'DENY',
          reason: `User lacks required permissions to execute "${tool.name}"`,
        };
      }
    }

    // 4. Risk policy & confirmation requirement (permission grant does not bypass confirmation)
    if (tool.riskLevel === 'HIGH' && tool.requiresConfirmation) {
      return {
        decision: 'CONFIRMATION_REQUIRED',
        reason: 'High-risk action requires explicit confirmation',
      };
    }

    if (tool.requiresConfirmation) {
      return {
        decision: 'CONFIRMATION_REQUIRED',
        reason: 'This action requires explicit confirmation',
      };
    }

    return { decision: 'ALLOW' };
  }

  /**
   * Re-evaluate policy at confirmation time.
   * Must be called with the CURRENT user context, not the original proposer's context.
   * Ensures revoked/changed roles or permissions are rejected before execution.
   */
  evaluateAtConfirmation(
    currentCtx: AgentExecutionContext,
    tool: ToolDefinition,
  ): PolicyEvaluationResult {
    // 1. Tenant check
    if (tool.tenantScoped && !currentCtx.schoolId) {
      return {
        decision: 'DENY',
        reason: 'School context is required for this action',
      };
    }

    // 2. Role check — re-evaluates current role from DB
    if (!tool.allowedRoles.includes(currentCtx.role)) {
      return {
        decision: 'DENY',
        reason: `Role "${currentCtx.role}" is not permitted to execute "${tool.name}"`,
      };
    }

    // 3. Permission check — re-evaluates current permissions
    const rolePermissions =
      (ROLE_PERMISSIONS as Record<string, Permission[]>)[currentCtx.role] ?? [];
    const effectivePermissions = currentCtx.permissions
      ? currentCtx.permissions.filter((p) =>
          rolePermissions.includes(p as Permission),
        )
      : rolePermissions;

    if (tool.requiredPermissions && tool.requiredPermissions.length > 0) {
      const hasAllPermissions = tool.requiredPermissions.every((p) =>
        effectivePermissions.includes(p),
      );

      if (!hasAllPermissions) {
        return {
          decision: 'DENY',
          reason: `User lacks required permissions to execute "${tool.name}"`,
        };
      }
    }

    // Confirmation requirement is fulfilled by the confirm action itself
    return { decision: 'ALLOW' };
  }
}
