import { Injectable } from '@nestjs/common';
import { MessagesService } from '../../../messages/messages.service';
import {
  ToolHandlerKey,
  AgentToolExecutionContext,
  AGENT_ERRORS,
  AgentHandlerResult,
  AutomationInput,
  DailyDigestItem,
  ReconciliationResult,
} from '../agent-types';
import { AgentToolHandler } from './agent-tool-handler.interface';

@Injectable()
export class AutomationDailyDigestHandler implements AgentToolHandler<
  AutomationInput<DailyDigestItem>,
  AgentHandlerResult
> {
  readonly key = ToolHandlerKey.AUTOMATION_DAILY_DIGEST;

  constructor(private readonly messagesService: MessagesService) {}

  async execute(
    context: AgentToolExecutionContext,
    args: AutomationInput<DailyDigestItem>,
  ): Promise<AgentHandlerResult> {
    const items = args.items ?? [];
    const draftMessage = items[0]?.draftMessage;

    if (!draftMessage?.trim()) {
      return {
        resourceType: 'DailyDigest',
        status: 'SKIPPED',
        affectedCount: 0,
        actionsCount: 0,
      };
    }

    const subject =
      args.subject || `Daily School Digest — ${new Date().toDateString()}`;

    const digestResult = await this.messagesService.sendDailyDigest({
      schoolId: context.schoolId,
      senderId: context.userId,
      body: draftMessage,
      subject,
    });

    if (digestResult.sent) {
      return {
        resourceId: digestResult.messageId,
        resourceType: 'DailyDigest',
        status: 'SENT',
        affectedCount: 1,
        actionsCount: 1,
      };
    }

    return {
      resourceType: 'DailyDigest',
      status: 'SKIPPED',
      affectedCount: 0,
      actionsCount: 0,
    };
  }

  async verify(
    context: AgentToolExecutionContext,
    args: AutomationInput<DailyDigestItem>,
    result: AgentHandlerResult,
  ): Promise<void> {
    if (result.status === 'SENT') {
      const subject =
        args.subject || `Daily School Digest — ${new Date().toDateString()}`;
      const check = await this.messagesService.verifyAnnouncement(
        context.schoolId,
        context.userId,
        subject,
        1,
      );
      if (!check.verified) {
        throw new Error(AGENT_ERRORS.ACTION_VERIFICATION_FAILED);
      }
    }
  }

  async reconcile(
    context: AgentToolExecutionContext,
    args: AutomationInput<DailyDigestItem>,
  ): Promise<ReconciliationResult> {
    const subject =
      args.subject || `Daily School Digest — ${new Date().toDateString()}`;
    const found = await this.messagesService.findAnnouncement(
      context.schoolId,
      context.userId,
      subject,
    );

    if (found) {
      return {
        status: 'APPLIED',
        result: {
          resourceType: 'DailyDigest',
          status: 'SENT',
          affectedCount: 1,
          actionsCount: 1,
        },
      };
    }

    return {
      status: 'UNKNOWN',
    };
  }
}
