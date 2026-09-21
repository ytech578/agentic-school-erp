import { Injectable } from '@nestjs/common';
import { TimetableService } from '../../../timetable/timetable.service';
import {
  ToolHandlerKey,
  AgentToolExecutionContext,
  AgentHandlerResult,
  AutomationInput,
} from '../agent-types';
import { AgentToolHandler } from './agent-tool-handler.interface';

@Injectable()
export class AutomationTimetableCoverHandler
  implements AgentToolHandler<AutomationInput, AgentHandlerResult>
{
  readonly key = ToolHandlerKey.AUTOMATION_TIMETABLE_COVER;

  constructor(private readonly timetableService: TimetableService) {}

  async execute(
    context: AgentToolExecutionContext,
    args: AutomationInput,
  ): Promise<AgentHandlerResult> {
    const items = (args.items ?? []) as Array<{
      suggestedSubstituteId?: string;
      slots?: Array<{ id: string }>;
    }>;
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
}
