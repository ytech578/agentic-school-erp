import {
  ToolHandlerKey,
  AgentToolExecutionContext,
  ReconciliationResult,
} from '../agent-types';

/**
 * Domain handler interface for executing agent actions.
 * Translates server-authoritative context and validated arguments into domain service calls.
 */
export interface AgentToolHandler<
  TArgs = Record<string, unknown>,
  TResult = Record<string, unknown>,
> {
  /** The unique ToolHandlerKey this handler executes */
  readonly key: ToolHandlerKey;

  /**
   * Executes the business mutation via domain services.
   * Handlers must NOT trust client-supplied identity/tenant fields;
   * they must rely strictly on `context.schoolId` and `context.userId`.
   */
  execute(context: AgentToolExecutionContext, args: TArgs): Promise<TResult>;

  /**
   * Optional post-execution domain verification.
   * Verifies that the expected business effect actually occurred in the database.
   * Throws Error with AGENT_ERRORS.ACTION_VERIFICATION_FAILED if state is invalid.
   */
  verify?(
    context: AgentToolExecutionContext,
    args: TArgs,
    result: TResult,
  ): Promise<void>;

  /**
   * Optional ambiguous execution recovery / reconciliation.
   * Inspects domain database to determine whether an in-flight mutation
   * was already applied, definitely not applied, or in an unknown state.
   */
  reconcile?(
    context: AgentToolExecutionContext,
    args: TArgs,
  ): Promise<ReconciliationResult>;
}

export const AGENT_TOOL_HANDLERS = Symbol('AGENT_TOOL_HANDLERS');

