import { Injectable } from '@nestjs/common';
import { HRService } from '../../../hr/hr.service';
import {
  ToolHandlerKey,
  AgentToolExecutionContext,
  AgentHandlerResult,
  AutomationInput,
} from '../agent-types';
import { AgentToolHandler } from './agent-tool-handler.interface';

@Injectable()
export class AutomationLeaveRecommendationHandler
  implements AgentToolHandler<AutomationInput, AgentHandlerResult>
{
  readonly key = ToolHandlerKey.AUTOMATION_LEAVE_RECOMMENDATION;

  constructor(private readonly hrService: HRService) {}

  async execute(
    context: AgentToolExecutionContext,
    args: AutomationInput,
  ): Promise<AgentHandlerResult> {
    const items = (args.items ?? []) as Array<{
      id?: string;
      recommendation?: string;
      reasoning?: string;
    }>;
    let actionsCount = 0;

    for (const item of items) {
      if (!item.id) continue;
      const updated = await this.hrService.addLeaveRecommendation(
        context.schoolId,
        item.id,
        item.recommendation ?? 'REVIEW',
        item.reasoning ?? '',
      );
      if (updated) {
        actionsCount++;
      }
    }

    return {
      resourceType: 'LeaveRequest',
      status: 'UPDATED',
      affectedCount: actionsCount,
      actionsCount,
    };
  }
}
