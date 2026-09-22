import { AutomationTimetableCoverHandler } from './automation-timetable-cover.handler';
import { TimetableService } from '../../../timetable/timetable.service';
import {
  ToolHandlerKey,
  AgentToolExecutionContext,
  AGENT_ERRORS,
} from '../agent-types';

describe('AutomationTimetableCoverHandler', () => {
  let handler: AutomationTimetableCoverHandler;
  let timetableService: { [K in keyof TimetableService]?: jest.Mock };

  const mockContext: AgentToolExecutionContext = {
    userId: 'user-admin',
    schoolId: 'school-1',
    role: 'SCHOOL_ADMIN',
    actionId: 'action-tt-1',
  };

  beforeEach(() => {
    timetableService = {
      assignSubstitute: jest.fn().mockResolvedValue({ actionsCount: 2 }),
      verifySubstituteAssignment: jest.fn().mockResolvedValue({
        verified: true,
        matchedCount: 2,
      }),
    };

    handler = new AutomationTimetableCoverHandler(
      timetableService as unknown as TimetableService,
    );
  });

  it('declares correct key: automation_timetable_cover', () => {
    expect(handler.key).toBe(ToolHandlerKey.AUTOMATION_TIMETABLE_COVER);
  });

  it('delegates substitute assignment to TimetableService.assignSubstitute', async () => {
    const args = {
      items: [
        {
          suggestedSubstituteId: 'staff-sub-1',
          slots: [{ id: 'slot-1' }, { id: 'slot-2' }],
        },
      ],
    };

    const result = await handler.execute(mockContext, args);

    expect(timetableService.assignSubstitute).toHaveBeenCalledWith(
      'school-1',
      ['slot-1', 'slot-2'],
      'staff-sub-1',
    );

    expect(result).toEqual({
      resourceType: 'TimetableSlot',
      status: 'UPDATED',
      affectedCount: 2,
      actionsCount: 2,
    });
  });

  it('verification succeeds when slots match the assigned substitute', async () => {
    const args = {
      items: [
        {
          suggestedSubstituteId: 'staff-sub-1',
          slots: [{ id: 'slot-1' }, { id: 'slot-2' }],
        },
      ],
    };

    await expect(
      handler.verify(mockContext, args, {
        status: 'UPDATED',
        affectedCount: 2,
      }),
    ).resolves.toBeUndefined();

    expect(timetableService.verifySubstituteAssignment).toHaveBeenCalledWith(
      'school-1',
      ['slot-1', 'slot-2'],
      'staff-sub-1',
    );
  });

  it('verification throws ACTION_VERIFICATION_FAILED when substitution is not confirmed in DB', async () => {
    timetableService.verifySubstituteAssignment!.mockResolvedValue({
      verified: false,
      matchedCount: 1,
    });

    const args = {
      items: [
        {
          suggestedSubstituteId: 'staff-sub-1',
          slots: [{ id: 'slot-1' }, { id: 'slot-2' }],
        },
      ],
    };

    await expect(
      handler.verify(mockContext, args, {
        status: 'UPDATED',
        affectedCount: 2,
      }),
    ).rejects.toThrow(AGENT_ERRORS.ACTION_VERIFICATION_FAILED);
  });

  it('reconciles as APPLIED when slots already have the substitute assigned', async () => {
    const args = {
      items: [
        {
          suggestedSubstituteId: 'staff-sub-1',
          slots: [{ id: 'slot-1' }, { id: 'slot-2' }],
        },
      ],
    };

    const rec = await handler.reconcile(mockContext, args);

    expect(rec.status).toBe('APPLIED');
    expect(rec.result).toEqual({
      resourceType: 'TimetableSlot',
      status: 'UPDATED',
      affectedCount: 2,
      actionsCount: 2,
    });
  });

  it('reconciles as NOT_APPLIED when slots do not have the substitute assigned', async () => {
    timetableService.verifySubstituteAssignment!.mockResolvedValue({
      verified: false,
      matchedCount: 0,
    });

    const args = {
      items: [
        {
          suggestedSubstituteId: 'staff-sub-1',
          slots: [{ id: 'slot-1' }, { id: 'slot-2' }],
        },
      ],
    };

    const rec = await handler.reconcile(mockContext, args);

    expect(rec.status).toBe('NOT_APPLIED');
    expect(rec.reason).toBeDefined();
  });
});
