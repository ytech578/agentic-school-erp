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
export class AutomationReportCardPublishHandler
  implements AgentToolHandler<AutomationInput, AgentHandlerResult>
{
  readonly key = ToolHandlerKey.AUTOMATION_REPORT_CARD_PUBLISH;

  constructor(private readonly prisma: PrismaService) {}

  async execute(
    context: AgentToolExecutionContext,
    args: AutomationInput,
  ): Promise<AgentHandlerResult> {
    const items = (args.items ?? []) as Array<{
      id?: string;
      isComplete?: boolean;
      examName?: string;
      draftMessage?: string;
    }>;
    const readyExams = items.filter((i) => i.isComplete && i.id);
    let actionsCount = 0;

    for (const exam of readyExams) {
      const examRecord = await this.prisma.exam.findFirst({
        where: { id: exam.id!, schoolId: context.schoolId },
      });
      if (!examRecord) continue;

      const students = await this.prisma.student.findMany({
        where: { schoolId: context.schoolId, isActive: true },
        include: { user: { select: { id: true } } },
        take: 500,
      });

      const messages = students.map((s) => ({
        schoolId: context.schoolId,
        senderId: context.userId,
        recipientId: s.user.id,
        subject: `Results Ready: ${exam.examName ?? examRecord.name}`,
        body:
          exam.draftMessage ??
          `Results for ${examRecord.name} are now available.`,
      }));

      if (messages.length > 0) {
        await this.prisma.message.createMany({ data: messages });
        actionsCount += messages.length;
      }
    }

    return {
      resourceType: 'ExamReport',
      status: 'PUBLISHED',
      affectedCount: actionsCount,
      actionsCount,
    };
  }
}
