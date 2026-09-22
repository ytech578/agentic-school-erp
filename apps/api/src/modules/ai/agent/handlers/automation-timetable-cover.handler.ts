import { Injectable } from '@nestjs/common';
import { TimetableService } from '../../../timetable/timetable.service';
import {
  ToolHandlerKey,
  AgentToolExecutionContext,
  AGENT_ERRORS,
  AgentHandlerResult,
  AutomationInput,
  TimetableCoverItem,
  ReconciliationResult,
} from '../agent-types';
import { AgentToolHandler } from './agent-tool-handler.interface';

@Injectable()
export class AutomationTimetableCoverHandler implements AgentToolHandler<
  AutomationInput<TimetableCoverItem>,
  AgentHandlerResult
> {
  readonly key = ToolHandlerKey.AUTOMATION_TIMETABLE_COVER;

  constructor(private readonly timetableService: TimetableService) {}

  async execute(
    context: AgentToolExecutionContext,
    args: AutomationInput<TimetableCoverItem>,
  ): Promise<AgentHandlerResult> {
    const items = args.items ?? [];
    let actionsCount = 0;

    for (const item of items) {
      if (
        !item.suggestedSubstituteId ||
        !Array.isArray(item.slots) ||
        item.slots.length === 0
      ) {
        continue;
      }

      const slotIds = item.slots.map((s) => s.id).filter(Boolean);
      const result = await this.timetableService.assignSubstitute(
        context.schoolId,
        slotIds,
        item.suggestedSubstituteId,
      );
      actionsCount += result.actionsCount;
    }

    return {
      resourceType: 'TimetableSlot',
      status: 'UPDATED',
      affectedCount: actionsCount,
      actionsCount,
    };
  }

  async verify(
    context: AgentToolExecutionContext,
    args: AutomationInput<TimetableCoverItem>,
    result: AgentHandlerResult,
  ): Promise<void> {
    const affectedCount = (result.affectedCount ??
      result.actionsCount ??
      0) as number;
    const items = args.items ?? [];

    if (affectedCount === 0 && items.length > 0) {
      // If items had slots but none were updated, or invalid substitute
      return;
    }

    for (const item of items) {
      if (
        !item.suggestedSubstituteId ||
        !Array.isArray(item.slots) ||
        item.slots.length === 0
      ) {
        continue;
      }
      const slotIds = item.slots.map((s) => s.id).filter(Boolean);
      const check = await this.timetableService.verifySubstituteAssignment(
        context.schoolId,
        slotIds,
        item.suggestedSubstituteId,
      );
      if (!check.verified) {
        throw new Error(AGENT_ERRORS.ACTION_VERIFICATION_FAILED);
      }
    }
  }

  async reconcile(
    context: AgentToolExecutionContext,
    args: AutomationInput<TimetableCoverItem>,
  ): Promise<ReconciliationResult> {
    const items = args.items ?? [];
    const validItems = items.filter(
      (item) =>
        item.suggestedSubstituteId &&
        Array.isArray(item.slots) &&
        item.slots.length > 0,
    );

    if (validItems.length === 0) {
      return {
        status: 'NOT_APPLIED',
        reason: 'No valid timetable cover items provided to reconcile',
      };
    }

    let allApplied = true;
    let totalSlots = 0;

    for (const item of validItems) {
      const slotIds = item.slots.map((s) => s.id).filter(Boolean);
      totalSlots += slotIds.length;
      const check = await this.timetableService.verifySubstituteAssignment(
        context.schoolId,
        slotIds,
        item.suggestedSubstituteId,
      );
      if (!check.verified) {
        allApplied = false;
        break;
      }
    }

    if (allApplied && totalSlots > 0) {
      return {
        status: 'APPLIED',
        result: {
          resourceType: 'TimetableSlot',
          status: 'UPDATED',
          affectedCount: totalSlots,
          actionsCount: totalSlots,
        },
      };
    }

    return {
      status: 'NOT_APPLIED',
      reason:
        'One or more timetable slots do not reflect the suggested substitute assignment',
    };
  }
}
