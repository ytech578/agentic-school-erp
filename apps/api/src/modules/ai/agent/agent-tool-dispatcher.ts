import {
  Injectable,
  Inject,
  Optional,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import {
  ToolHandlerKey,
  AgentToolExecutionContext,
  AGENT_ERRORS,
  ReconciliationResult,
} from './agent-types';
import {
  AgentToolHandler,
  AGENT_TOOL_HANDLERS,
} from './handlers/agent-tool-handler.interface';

@Injectable()
export class AgentToolDispatcher {
  private readonly logger = new Logger(AgentToolDispatcher.name);
  private readonly handlers = new Map<string, AgentToolHandler>();

  constructor(
    @Optional()
    @Inject(AGENT_TOOL_HANDLERS)
    handlers?: AgentToolHandler[],
  ) {
    if (handlers) {
      for (const handler of handlers) {
        this.register(handler);
      }
    }
  }

  /**
   * Registers a domain handler in the dispatcher registry.
   */
  register(handler: AgentToolHandler): void {
    if (!handler || !handler.key) {
      throw new Error(
        'Invalid handler registration: handler and handler.key are required',
      );
    }
    if (this.handlers.has(handler.key)) {
      throw new Error(`Handler already registered for key: ${handler.key}`);
    }
    this.handlers.set(handler.key, handler);
    this.logger.debug(`Registered agent tool handler for key: ${handler.key}`);
  }

  /**
   * Returns whether a handler is registered for the specified key.
   */
  hasHandler(handlerKey: string): boolean {
    return this.handlers.has(handlerKey);
  }

  /**
   * Resolves a registered handler by key.
   */
  getHandler(handlerKey: string): AgentToolHandler | undefined {
    return this.handlers.get(handlerKey);
  }

  /**
   * Resolves and executes the handler registered for the given handlerKey.
   * Throws NotFoundException(ACTION_HANDLER_NOT_FOUND) if no handler is registered.
   */
  async dispatch(
    handlerKey: ToolHandlerKey | string,
    context: AgentToolExecutionContext,
    args: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const handler = this.handlers.get(handlerKey);
    if (!handler) {
      throw new NotFoundException(
        `${AGENT_ERRORS.ACTION_HANDLER_NOT_FOUND}: No handler registered for key: ${handlerKey}`,
      );
    }
    return handler.execute(context, args);
  }

  /**
   * Orchestrates post-execution domain verification for the given handlerKey.
   * Invokes handler.verify() if provided by the handler implementation.
   */
  async verify(
    handlerKey: ToolHandlerKey | string,
    context: AgentToolExecutionContext,
    args: Record<string, unknown>,
    result: Record<string, unknown>,
  ): Promise<void> {
    const handler = this.handlers.get(handlerKey);
    if (!handler) {
      throw new NotFoundException(
        `${AGENT_ERRORS.ACTION_HANDLER_NOT_FOUND}: No handler registered for key: ${handlerKey}`,
      );
    }
    if (typeof handler.verify === 'function') {
      await handler.verify(context, args, result);
    }
  }

  /**
   * Orchestrates ambiguous execution recovery / reconciliation for the given handlerKey.
   * Invokes handler.reconcile() if implemented; returns null if not implemented.
   */
  async reconcile(
    handlerKey: ToolHandlerKey | string,
    context: AgentToolExecutionContext,
    args: Record<string, unknown>,
  ): Promise<ReconciliationResult | null> {
    const handler = this.handlers.get(handlerKey);
    if (!handler) {
      throw new NotFoundException(
        `${AGENT_ERRORS.ACTION_HANDLER_NOT_FOUND}: No handler registered for key: ${handlerKey}`,
      );
    }
    if (typeof handler.reconcile === 'function') {
      return handler.reconcile(context, args);
    }
    return null;
  }
}

