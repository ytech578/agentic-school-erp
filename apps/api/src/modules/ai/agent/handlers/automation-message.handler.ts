import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../core/database/prisma.service';
import {
  ToolHandlerKey,
  AgentToolExecutionContext,
  AgentHandlerResult,
  AutomationInput,
} from '../agent-types';
import { AgentToolHandler } from './agent-tool-handler.interface';

export abstract class BaseAutomationMessageHandler implements AgentToolHandler<
  AutomationInput,
  AgentHandlerResult
> {
  abstract readonly key: ToolHandlerKey;

  constructor(protected readonly prisma: PrismaService) {}

  async execute(
    context: AgentToolExecutionContext,
    args: AutomationInput,
  ): Promise<AgentHandlerResult> {
    const items = (args.items ?? []) as Array<{
      recipientId?: string;
      draftMessage?: string;
    }>;
    const recipientIds = items
      .map((i) => i.recipientId)
      .filter(Boolean) as string[];

    const validUsers = await this.prisma.user.findMany({
      where: { id: { in: recipientIds }, schoolId: context.schoolId },
      select: { id: true },
    });
    const validUserIdSet = new Set(validUsers.map((u) => u.id));

    const BATCH_SIZE = 50;
    let actionsCount = 0;

    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE);
      const messages = batch
        .filter(
          (item) => item.recipientId && validUserIdSet.has(item.recipientId),
        )
        .map((item) => ({
          schoolId: context.schoolId,
          senderId: context.userId,
          recipientId: item.recipientId!,
          subject: (args.subject ?? 'AI Notification').substring(0, 255),
          body: item.draftMessage ?? '',
        }));
      if (messages.length > 0) {
        await this.prisma.message.createMany({ data: messages });
        actionsCount += messages.length;
      }
    }

    return {
      resourceType: 'MessageBatch',
      status: 'SENT',
      affectedCount: actionsCount,
      actionsCount,
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
