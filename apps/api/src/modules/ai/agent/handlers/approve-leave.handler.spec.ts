import { ApproveLeaveAgentHandler } from './approve-leave.handler';
import { HRService } from '../../../hr/hr.service';
import {
  ToolHandlerKey,
  AgentToolExecutionContext,
  AGENT_ERRORS,
} from '../agent-types';

describe('ApproveLeaveAgentHandler', () => {
  let handler: ApproveLeaveAgentHandler;
  let hrService: jest.Mocked<Partial<HRService>>;

  const mockContext: AgentToolExecutionContext = {
    userId: 'user-admin',
    schoolId: 'school-1',
    role: 'SCHOOL_ADMIN',
    actionId: 'action-1',
  };

  beforeEach(() => {
    hrService = {
      approveLeaveRequest: jest.fn().mockResolvedValue({
        leaveId: 'leave-123',
        approved: true,
      }),
      verifyLeaveApproval: jest.fn().mockResolvedValue({
        verified: true,
        leave: {
          id: 'leave-123',
          status: 'APPROVED',
          reviewedBy: 'user-admin',
        },
      }),
      getLeaveRequestById: jest.fn().mockResolvedValue({
        id: 'leave-123',
        schoolId: 'school-1',
        status: 'APPROVED',
        reviewedBy: 'user-admin',
      }),
    };

    handler = new ApproveLeaveAgentHandler(hrService as unknown as HRService);
  });

  it('declares correct key: approve_leave', () => {
    expect(handler.key).toBe(ToolHandlerKey.APPROVE_LEAVE);
  });

  it('calls HRService.approveLeaveRequest with server-authoritative schoolId and userId', async () => {
    const args = { leaveId: 'leave-123', reason: 'Approved by principal' };
    const result = await handler.execute(mockContext, args);

    expect(hrService.approveLeaveRequest).toHaveBeenCalledWith(
      'school-1',
      'leave-123',
      {
        reviewedBy: 'user-admin',
        reviewNote: '[Approved via AI Assistant] Approved by principal',
      },
    );

    expect(result).toEqual({
      resourceId: 'leave-123',
      resourceType: 'LeaveRequest',
      status: 'APPROVED',
      leaveId: 'leave-123',
      approved: true,
    });
  });

  it('does not mutate unrelated schools (strict tenant context propagation)', async () => {
    const foreignContext: AgentToolExecutionContext = {
      userId: 'attacker',
      schoolId: 'school-ATTACKER',
      role: 'SCHOOL_ADMIN',
    };

    await handler.execute(foreignContext, { leaveId: 'leave-victim' });

    expect(hrService.approveLeaveRequest).toHaveBeenCalledWith(
      'school-ATTACKER',
      'leave-victim',
      expect.any(Object),
    );
  });

  it('verification succeeds when domain service confirms APPROVED by the correct reviewer', async () => {
    await expect(
      handler.verify(
        mockContext,
        { leaveId: 'leave-123' },
        { status: 'APPROVED' },
      ),
    ).resolves.toBeUndefined();

    expect(hrService.verifyLeaveApproval).toHaveBeenCalledWith(
      'school-1',
      'leave-123',
      'user-admin',
    );
  });

  it('verification throws ACTION_VERIFICATION_FAILED when domain service verification fails', async () => {
    hrService.verifyLeaveApproval!.mockResolvedValue({
      verified: false,
      leave: null,
    });

    await expect(
      handler.verify(
        mockContext,
        { leaveId: 'leave-123' },
        { status: 'APPROVED' },
      ),
    ).rejects.toThrow(AGENT_ERRORS.ACTION_VERIFICATION_FAILED);
  });

  it('reconciles as APPLIED when leave request is in APPROVED status', async () => {
    hrService.getLeaveRequestById!.mockResolvedValue({
      id: 'leave-123',
      schoolId: 'school-1',
      status: 'APPROVED',
      reviewedBy: 'user-admin',
    } as any);

    const rec = await handler.reconcile(mockContext, { leaveId: 'leave-123' });

    expect(rec.status).toBe('APPLIED');
    expect(rec.result).toEqual({
      resourceId: 'leave-123',
      resourceType: 'LeaveRequest',
      status: 'APPROVED',
      leaveId: 'leave-123',
      approved: true,
    });
  });

  it('reconciles as NOT_APPLIED when leave request is still PENDING', async () => {
    hrService.getLeaveRequestById!.mockResolvedValue({
      id: 'leave-123',
      schoolId: 'school-1',
      status: 'PENDING',
    } as any);

    const rec = await handler.reconcile(mockContext, { leaveId: 'leave-123' });

    expect(rec.status).toBe('NOT_APPLIED');
    expect(rec.reason).toBeDefined();
  });

  it('reconciles as UNKNOWN when leave request is not found', async () => {
    hrService.getLeaveRequestById!.mockResolvedValue(null);

    const rec = await handler.reconcile(mockContext, {
      leaveId: 'leave-missing',
    });

    expect(rec.status).toBe('UNKNOWN');
    expect(rec.reason).toBeDefined();
  });
});
