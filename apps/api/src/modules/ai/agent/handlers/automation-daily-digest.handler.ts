import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../core/database/prisma.service';
import {
  ToolHandlerKey,
  AgentToolExecutionContext,
  AgentHandlerResult,
  AutomationInput,
} from '../agent-types';
import { AgentToolHandler } from './agent-tool-handler.interface';

@Injectable()
export class AutomationDailyDigestHandler implements AgentToolHandler<
  AutomationInput,
  AgentHandlerResult
> {
  readonly key = ToolHandlerKey.AUTOMATION_DAILY_DIGEST;

  constructor(private readonly prisma: PrismaService) {}

  async execute(
    context: AgentToolExecutionContext,
    args: AutomationInput,
  ): Promise<AgentHandlerResult> {
    const items = (args.items ?? []) as Array<{ draftMessage?: string }>;
    const principal = await this.prisma.user.findFirst({
      where: {
        schoolId: context.schoolId,
        role: { in: ['PRINCIPAL', 'SCHOOL_ADMIN'] },
        status: 'ACTIVE',
      },
    });

    if (principal && items[0]?.draftMessage) {
      await this.prisma.message.create({
        data: {
          schoolId: context.schoolId,
          senderId: context.userId,
          recipientId: principal.id,
          subject: `Daily School Digest — ${new Date().toDateString()}`,
          body: items[0].draftMessage,
        },
      });
      return {
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
}
