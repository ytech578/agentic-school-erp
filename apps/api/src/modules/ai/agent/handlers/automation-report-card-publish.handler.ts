import { Injectable } from '@nestjs/common';
import { ExamsService } from '../../../exams/exams.service';
import {
  ToolHandlerKey,
  AgentToolExecutionContext,
  AGENT_ERRORS,
  AgentHandlerResult,
  AutomationInput,
  ReportPublishItem,
  ReconciliationResult,
} from '../agent-types';
import { AgentToolHandler } from './agent-tool-handler.interface';

@Injectable()
export class AutomationReportCardPublishHandler implements AgentToolHandler<
  AutomationInput<ReportPublishItem>,
  AgentHandlerResult
> {
  readonly key = ToolHandlerKey.AUTOMATION_REPORT_CARD_PUBLISH;

  constructor(private readonly examsService: ExamsService) {}

  async execute(
    context: AgentToolExecutionContext,
    args: AutomationInput<ReportPublishItem>,
  ): Promise<AgentHandlerResult> {
    const items = args.items ?? [];
    const readyExams = items.filter((i) => i.isComplete && i.id);
    let totalNotified = 0;
    let lastExamId: string | undefined;

    for (const exam of readyExams) {
      const res = await this.examsService.publishAndNotifyExamResults({
        schoolId: context.schoolId,
        examId: exam.id,
        senderId: context.userId,
        customMessage: exam.draftMessage,
      });
      totalNotified += res.notifiedCount;
      lastExamId = res.examId;
    }

    return {
      resourceId: lastExamId,
      resourceType: 'ExamReport',
      status: 'PUBLISHED',
      affectedCount: totalNotified,
      actionsCount: totalNotified,
    };
  }

  async verify(
    context: AgentToolExecutionContext,
    args: AutomationInput<ReportPublishItem>,
    result?: AgentHandlerResult,
  ): Promise<void> {
    void result;
    const items = args.items ?? [];
    const readyExams = items.filter((i) => i.isComplete && i.id);

    for (const exam of readyExams) {
      const status = await this.examsService.getExamPublishStatus(
        context.schoolId,
        exam.id,
      );
      if (!status || !status.isPublished) {
        throw new Error(AGENT_ERRORS.ACTION_VERIFICATION_FAILED);
      }
    }
  }

  async reconcile(
    context: AgentToolExecutionContext,
    args: AutomationInput<ReportPublishItem>,
  ): Promise<ReconciliationResult> {
    const items = args.items ?? [];
    const readyExams = items.filter((i) => i.isComplete && i.id);

    if (readyExams.length === 0) {
      return {
        status: 'NOT_APPLIED',
        reason:
          'No completed exam items provided in automation input to reconcile',
      };
    }

    let allPublished = true;
    for (const exam of readyExams) {
      const status = await this.examsService.getExamPublishStatus(
        context.schoolId,
        exam.id,
      );
      if (!status || !status.isPublished) {
        allPublished = false;
        break;
      }
    }

    if (allPublished) {
      return {
        status: 'APPLIED',
        result: {
          resourceType: 'ExamReport',
          status: 'PUBLISHED',
          affectedCount: readyExams.length,
          actionsCount: readyExams.length,
        },
      };
    }

    return {
      status: 'NOT_APPLIED',
      reason: 'One or more exams have not been published in the database',
    };
  }
}
