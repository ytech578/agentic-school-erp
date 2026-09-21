import { ApproveLeaveAgentHandler } from './approve-leave.handler';
import { HRService } from '../../../hr/hr.service';
import { PrismaService } from '../../../../core/database/prisma.service';
import {
  ToolHandlerKey,
  AgentToolExecutionContext,
  AGENT_ERRORS,
} from '../agent-types';

describe('ApproveLeaveAgentHandler', () => {
  let handler: ApproveLeaveAgentHandler;
  let hrService: jest.Mocked<Partial<HRService>>;
  let prisma: any;

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
    };

    prisma = {
      leaveRequest: {
        findUnique: jest.fn(),
      },
    };

    handler = new ApproveLeaveAgentHandler(
      hrService as unknown as HRService,
      prisma,
    );
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

  it('verification succeeds when DB state confirms APPROVED by the correct reviewer in the correct school', async () => {
    prisma.leaveRequest.findUnique.mockResolvedValue({
      id: 'leave-123',
      schoolId: 'school-1',
      status: 'APPROVED',
      reviewedBy: 'user-admin',
    });

    await expect(
      handler.verify(
        mockContext,
        { leaveId: 'leave-123' },
        { status: 'APPROVED' },
      ),
    ).resolves.toBeUndefined();
  });

  it('verification throws ACTION_VERIFICATION_FAILED when leave status is not APPROVED', async () => {
    prisma.leaveRequest.findUnique.mockResolvedValue({
      id: 'leave-123',
      schoolId: 'school-1',
      status: 'PENDING',
      reviewedBy: 'user-admin',
    });

    await expect(
      handler.verify(
        mockContext,
        { leaveId: 'leave-123' },
        { status: 'APPROVED' },
      ),
    ).rejects.toThrow(AGENT_ERRORS.ACTION_VERIFICATION_FAILED);
  });

  it('verification throws ACTION_VERIFICATION_FAILED when school mismatches', async () => {
    prisma.leaveRequest.findUnique.mockResolvedValue({
      id: 'leave-123',
      schoolId: 'school-OTHER',
      status: 'APPROVED',
      reviewedBy: 'user-admin',
    });

    await expect(
      handler.verify(
        mockContext,
        { leaveId: 'leave-123' },
        { status: 'APPROVED' },
      ),
    ).rejects.toThrow(AGENT_ERRORS.ACTION_VERIFICATION_FAILED);
  });

  it('verification throws ACTION_VERIFICATION_FAILED when reviewedBy does not match authenticated user', async () => {
    prisma.leaveRequest.findUnique.mockResolvedValue({
      id: 'leave-123',
      schoolId: 'school-1',
      status: 'APPROVED',
      reviewedBy: 'user-OTHER',
    });

    await expect(
      handler.verify(
        mockContext,
        { leaveId: 'leave-123' },
        { status: 'APPROVED' },
      ),
    ).rejects.toThrow(AGENT_ERRORS.ACTION_VERIFICATION_FAILED);
  });
});
