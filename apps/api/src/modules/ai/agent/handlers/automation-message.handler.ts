import { Injectable } from '@nestjs/common';
import { MessagesService } from '../../../messages/messages.service';
import {
  ToolHandlerKey,
  AgentToolExecutionContext,
  AGENT_ERRORS,
  AgentHandlerResult,
  AutomationInput,
  AutomationMessageItem,
  ReconciliationResult,
} from '../agent-types';
import { AgentToolHandler } from './agent-tool-handler.interface';

export abstract class BaseAutomationMessageHandler implements AgentToolHandler<
  AutomationInput<AutomationMessageItem>,
  AgentHandlerResult
> {
  abstract readonly key: ToolHandlerKey;

  constructor(protected readonly messagesService: MessagesService) {}

  async execute(
    context: AgentToolExecutionContext,
    args: AutomationInput<AutomationMessageItem>,
  ): Promise<AgentHandlerResult> {
    const items = args.items ?? [];
    const messages = items
      .filter((i) => Boolean(i && i.recipientId))
      .map((i) => ({
        recipientId: i.recipientId,
        draftMessage: i.draftMessage || '',
        subject: args.subject,
      }));

    // Delegate batch creation, tenant validation, and recipient filtering to domain service
    const { sentCount, recipientIds } =
      await this.messagesService.sendBatchMessages({
        schoolId: context.schoolId,
        senderId: context.userId,
        subject: args.subject,
        messages,
      });

    return {
      resourceType: 'MessageBatch',
      status: 'SENT',
      affectedCount: sentCount,
      actionsCount: sentCount,
      recipientIds,
    };
  }

  async verify(
    context: AgentToolExecutionContext,
    args: AutomationInput<AutomationMessageItem>,
    result: AgentHandlerResult,
  ): Promise<void> {
    const affectedCount = (result.affectedCount ??
      result.actionsCount ??
      0) as number;
    const items = args.items ?? [];
    const recipientIds = items.map((i) => i.recipientId).filter(Boolean);

    if (affectedCount > 0 && recipientIds.length > 0) {
      const check = await this.messagesService.verifyBatchMessages(
        context.schoolId,
        context.userId,
        recipientIds,
        args.subject,
      );
      if (!check.verified) {
        throw new Error(AGENT_ERRORS.ACTION_VERIFICATION_FAILED);
      }
    }
  }

  async reconcile(
    context: AgentToolExecutionContext,
    args: AutomationInput<AutomationMessageItem>,
  ): Promise<ReconciliationResult> {
    const items = args.items ?? [];
    const recipientIds = items.map((i) => i.recipientId).filter(Boolean);

    if (recipientIds.length === 0) {
      return {
        status: 'NOT_APPLIED',
        reason: 'No recipient items provided in automation input to reconcile',
      };
    }

    const check = await this.messagesService.verifyBatchMessages(
      context.schoolId,
      context.userId,
      recipientIds,
      args.subject,
    );

    if (check.verified && check.sentCount > 0) {
      return {
        status: 'APPLIED',
        result: {
          resourceType: 'MessageBatch',
          status: 'SENT',
          affectedCount: check.sentCount,
          actionsCount: check.sentCount,
        },
      };
    }

    return {
      status: 'NOT_APPLIED',
      reason:
        'No matching batch messages found in database for specified recipients',
    };
  }
}

@Injectable()
export class AutomationFeeDefaulterHandler extends BaseAutomationMessageHandler {
  readonly key = ToolHandlerKey.AUTOMATION_FEE_DEFAULTER;
}

@Injectable()
export class AutomationAbsenceAlertHandler extends BaseAutomationMessageHandler {
  readonly key = ToolHandlerKey.AUTOMATION_ABSENCE_ALERT;
}

@Injectable()
export class AutomationAttendanceWarningHandler extends BaseAutomationMessageHandler {
  readonly key = ToolHandlerKey.AUTOMATION_ATTENDANCE_WARNING;
}
