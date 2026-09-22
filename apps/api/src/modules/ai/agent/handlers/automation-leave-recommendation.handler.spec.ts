import { AutomationLeaveRecommendationHandler } from './automation-leave-recommendation.handler';
import { HRService } from '../../../hr/hr.service';
import {
  ToolHandlerKey,
  AgentToolExecutionContext,
  AGENT_ERRORS,
} from '../agent-types';

describe('AutomationLeaveRecommendationHandler', () => {
  let handler: AutomationLeaveRecommendationHandler;
  let hrService: { [K in keyof HRService]?: jest.Mock };

  const mockContext: AgentToolExecutionContext = {
    userId: 'user-admin',
    schoolId: 'school-1',
    role: 'SCHOOL_ADMIN',
    actionId: 'action-rec-1',
  };

  beforeEach(() => {
    hrService = {
      addLeaveRecommendation: jest.fn().mockResolvedValue(true),
      verifyLeaveRecommendation: jest.fn().mockResolvedValue({
        verified: true,
        leave: { id: 'leave-1', reviewNote: '[AI Recommendation: APPROVE]' },
      }),
    };

    handler = new AutomationLeaveRecommendationHandler(
      hrService as unknown as HRService,
    );
  });

  it('declares correct key: automation_leave_recommendation', () => {
    expect(handler.key).toBe(ToolHandlerKey.AUTOMATION_LEAVE_RECOMMENDATION);
  });

  it('delegates leave recommendation to HRService.addLeaveRecommendation', async () => {
    const args = {
      items: [
        {
          id: 'leave-1',
          recommendation: 'APPROVE',
          reasoning: 'Staff has sufficient leave balance',
        },
      ],
    };

    const result = await handler.execute(mockContext, args);

    expect(hrService.addLeaveRecommendation).toHaveBeenCalledWith(
      'school-1',
      'leave-1',
      'APPROVE',
      'Staff has sufficient leave balance',
    );

    expect(result).toEqual({
      resourceType: 'LeaveRequest',
      status: 'UPDATED',
      affectedCount: 1,
      actionsCount: 1,
    });
  });

  it('verification succeeds when recommendation is recorded in leave request', async () => {
    const args = {
      items: [{ id: 'leave-1', recommendation: 'APPROVE' }],
    };

    await expect(
      handler.verify(mockContext, args, {
        status: 'UPDATED',
        affectedCount: 1,
      }),
    ).resolves.toBeUndefined();

    expect(hrService.verifyLeaveRecommendation).toHaveBeenCalledWith(
      'school-1',
      'leave-1',
      'APPROVE',
    );
  });

  it('verification throws ACTION_VERIFICATION_FAILED when recommendation is missing', async () => {
    hrService.verifyLeaveRecommendation!.mockResolvedValue({
      verified: false,
      leave: null,
    });

    const args = {
      items: [{ id: 'leave-1', recommendation: 'APPROVE' }],
    };

    await expect(
      handler.verify(mockContext, args, {
        status: 'UPDATED',
        affectedCount: 1,
      }),
    ).rejects.toThrow(AGENT_ERRORS.ACTION_VERIFICATION_FAILED);
  });

  it('reconciles as APPLIED when recommendation is present on all items', async () => {
    const args = {
      items: [{ id: 'leave-1', recommendation: 'APPROVE' }],
    };

    const rec = await handler.reconcile(mockContext, args);

    expect(rec.status).toBe('APPLIED');
    expect(rec.result).toEqual({
      resourceType: 'LeaveRequest',
      status: 'UPDATED',
      affectedCount: 1,
      actionsCount: 1,
    });
  });

  it('reconciles as NOT_APPLIED when recommendation is missing', async () => {
    hrService.verifyLeaveRecommendation!.mockResolvedValue({
      verified: false,
      leave: null,
    });

    const args = {
      items: [{ id: 'leave-1', recommendation: 'APPROVE' }],
    };

    const rec = await handler.reconcile(mockContext, args);

    expect(rec.status).toBe('NOT_APPLIED');
    expect(rec.reason).toBeDefined();
  });
});
