import { BadRequestException } from '@nestjs/common';
import { AgentActionStatus } from '@prisma/client';
import { ALLOWED_TRANSITIONS, AGENT_ERRORS } from './agent-types';

/**
 * AgentStateMachine — enforces the authoritative lifecycle of AgentAction.
 *
 * Supported states and transitions:
 *
 *   PROPOSED              → AWAITING_CONFIRMATION | CONFIRMED | CANCELLED
 *   AWAITING_CONFIRMATION → CONFIRMED | REJECTED | EXPIRED | CANCELLED
 *   CONFIRMED             → EXECUTING
 *   EXECUTING             → SUCCEEDED | FAILED
 *   SUCCEEDED             (terminal)
 *   FAILED                (terminal)
 *   REJECTED              (terminal)
 *   EXPIRED               (terminal)
 *   CANCELLED             (terminal)
 */
export class AgentStateMachine {
  /**
   * Assert that the transition from `from` → `to` is valid.
   * Throws a machine-readable BadRequestException if not.
   */
  static assertTransition(from: AgentActionStatus, to: AgentActionStatus): void {
    const allowed = ALLOWED_TRANSITIONS[from] ?? [];
    if (!allowed.includes(to)) {
      throw new BadRequestException(
        `${AGENT_ERRORS.ACTION_INVALID_STATE_TRANSITION}: cannot transition from ${from} to ${to}`,
      );
    }
  }

  /**
   * Returns true if the given status is a terminal state.
   */
  static isTerminal(status: AgentActionStatus): boolean {
    return ['SUCCEEDED', 'FAILED', 'REJECTED', 'EXPIRED', 'CANCELLED'].includes(status);
  }

  /**
   * Returns true if the action can still be confirmed (not expired, not terminal).
   */
  static canConfirm(status: AgentActionStatus): boolean {
    return status === AgentActionStatus.AWAITING_CONFIRMATION ||
           status === AgentActionStatus.CONFIRMED;
  }
}
