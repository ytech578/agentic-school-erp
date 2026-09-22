import { Injectable } from '@nestjs/common';
import { HRService } from '../../../hr/hr.service';
import {
  ToolHandlerKey,
  AgentToolExecutionContext,
  AGENT_ERRORS,
  AgentHandlerResult,
  AutomationInput,
  LeaveRecommendationItem,
  ReconciliationResult,
} from '../agent-types';
import { AgentToolHandler } from './agent-tool-handler.interface';

@Injectable()
export class AutomationLeaveRecommendationHandler implements AgentToolHandler<
  AutomationInput<LeaveRecommendationItem>,
  AgentHandlerResult
> {
  readonly key = ToolHandlerKey.AUTOMATION_LEAVE_RECOMMENDATION;

  constructor(private readonly hrService: HRService) {}

  async execute(
    context: AgentToolExecutionContext,
    args: AutomationInput<LeaveRecommendationItem>,
  ): Promise<AgentHandlerResult> {
    const items = args.items ?? [];
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

  async verify(
    context: AgentToolExecutionContext,
    args: AutomationInput<LeaveRecommendationItem>,
    result: AgentHandlerResult,
  ): Promise<void> {
    const affectedCount = (result.affectedCount ??
      result.actionsCount ??
      0) as number;
    const items = args.items ?? [];

    if (affectedCount === 0 && items.length > 0) {
      return;
    }

    for (const item of items) {
      if (!item.id) continue;
      const check = await this.hrService.verifyLeaveRecommendation(
        context.schoolId,
        item.id,
        item.recommendation,
      );
      if (!check.verified) {
        throw new Error(AGENT_ERRORS.ACTION_VERIFICATION_FAILED);
      }
    }
  }

  async reconcile(
    context: AgentToolExecutionContext,
    args: AutomationInput<LeaveRecommendationItem>,
  ): Promise<ReconciliationResult> {
    const items = args.items ?? [];
    const validItems = items.filter((i) => Boolean(i && i.id));

    if (validItems.length === 0) {
      return {
        status: 'NOT_APPLIED',
        reason: 'No leave recommendation items provided to reconcile',
      };
    }

    let allApplied = true;
    for (const item of validItems) {
      const check = await this.hrService.verifyLeaveRecommendation(
        context.schoolId,
        item.id,
        item.recommendation,
      );
      if (!check.verified) {
        allApplied = false;
        break;
      }
    }

    if (allApplied) {
      return {
        status: 'APPLIED',
        result: {
          resourceType: 'LeaveRequest',
          status: 'UPDATED',
          affectedCount: validItems.length,
          actionsCount: validItems.length,
        },
      };
    }

    return {
      status: 'NOT_APPLIED',
      reason:
        'One or more leave requests do not have the AI recommendation recorded',
    };
  }
}
