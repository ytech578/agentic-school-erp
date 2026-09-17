import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { AgentControlPlaneService } from './agent-control-plane.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { AgentActionStatus } from '@prisma/client';

describe('AgentControlPlaneService (Security & Execution)', () => {
  let service: AgentControlPlaneService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
      },
      leaveRequest: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      class: {
        findFirst: jest.fn(),
      },
      academicYear: {
        findFirst: jest.fn(),
      },
      staff: {
        findFirst: jest.fn(),
      },
      subject: {
        findFirst: jest.fn(),
      },
      assignment: {
        create: jest.fn(),
      },
      message: {
        createMany: jest.fn(),
      },
      agentAction: {
        create: jest.fn().mockImplementation((args) => Promise.resolve({ id: 'action-1', ...args.data })),
        findUnique: jest.fn(),
        updateMany: jest.fn(),
        update: jest.fn(),
      },
      activityLog: {
        create: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation(async (cb) => {
        return cb(prisma);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentControlPlaneService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<AgentControlPlaneService>(AgentControlPlaneService);
  });

  const ctx = { userId: 'user-admin', role: 'SCHOOL_ADMIN', schoolId: 'school-1' };

  describe('proposeAction', () => {
    it('rejects unknown tool', async () => {
      await expect(service.proposeAction(ctx, 'unknown_tool', {})).rejects.toThrow(NotFoundException);
    });

    it('rejects unauthorized role for tool', async () => {
      const teacherCtx = { ...ctx, role: 'TEACHER' };
      await expect(service.proposeAction(teacherCtx, 'approve_leave', {})).rejects.toThrow(ForbiddenException);
    });

    it('resolves leave ID properly and creates action', async () => {
      prisma.leaveRequest.findMany.mockResolvedValue([
        { id: 'leave-1', staff: { user: { firstName: 'Ravi', lastName: 'Kumar' } } }
      ]);
      const res = await service.proposeAction(ctx, 'approve_leave', { staffName: 'Ravi' });
      
      expect(prisma.agentAction.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          toolName: 'approve_leave',
          arguments: { leaveId: 'leave-1' },
          status: AgentActionStatus.AWAITING_CONFIRMATION,
        })
      }));
      expect(res.pendingAction.actionId).toBe('action-1');
    });

    it('rejects ambiguous staff name for leave', async () => {
      prisma.leaveRequest.findMany.mockResolvedValue([
        { id: 'leave-1' }, { id: 'leave-2' }
      ]);
      await expect(service.proposeAction(ctx, 'approve_leave', { staffName: 'Ravi' })).rejects.toThrow(BadRequestException);
    });
  });

  describe('confirmAndExecute', () => {
    it('rejects unknown actionId', async () => {
      prisma.agentAction.findUnique.mockResolvedValue(null);
      await expect(service.confirmAndExecute('action-1', 'user-1', 'school-1')).rejects.toThrow(NotFoundException);
    });

    it('rejects execution if tenant mismatches', async () => {
      prisma.agentAction.findUnique.mockResolvedValue({
        id: 'action-1', userId: 'user-1', schoolId: 'school-1'
      });
      await expect(service.confirmAndExecute('action-1', 'user-1', 'school-2')).rejects.toThrow(ForbiddenException);
    });

    it('rejects execution if status is not AWAITING_CONFIRMATION', async () => {
      prisma.agentAction.findUnique.mockResolvedValue({
        id: 'action-1', userId: 'user-1', schoolId: 'school-1', status: AgentActionStatus.EXECUTING
      });
      await expect(service.confirmAndExecute('action-1', 'user-1', 'school-1')).rejects.toThrow(BadRequestException);
    });

    it('rejects execution if expired', async () => {
      prisma.agentAction.findUnique.mockResolvedValue({
        id: 'action-1', userId: 'user-1', schoolId: 'school-1', status: AgentActionStatus.AWAITING_CONFIRMATION,
        expiresAt: new Date(Date.now() - 1000)
      });
      await expect(service.confirmAndExecute('action-1', 'user-1', 'school-1')).rejects.toThrow(BadRequestException);
    });

    it('enforces atomic CAS state transition', async () => {
      prisma.agentAction.findUnique.mockResolvedValue({
        id: 'action-1', userId: 'user-1', schoolId: 'school-1', status: AgentActionStatus.AWAITING_CONFIRMATION,
        toolName: 'automation_daily_digest', arguments: {}
      });
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1', role: 'SCHOOL_ADMIN' });
      prisma.agentAction.updateMany.mockResolvedValue({ count: 0 }); // Simulate concurrent execution already took it

      await expect(service.confirmAndExecute('action-1', 'user-1', 'school-1')).rejects.toThrow(ConflictException);
    });

    it('executes approve_leave and writes audit log', async () => {
      prisma.agentAction.findUnique.mockResolvedValue({
        id: 'action-1', userId: 'user-1', schoolId: 'school-1', status: AgentActionStatus.AWAITING_CONFIRMATION,
        toolName: 'approve_leave', arguments: { leaveId: 'leave-1' }, label: 'Approve leave', riskLevel: 'HIGH'
      });
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1', role: 'SCHOOL_ADMIN' });
      prisma.agentAction.updateMany.mockResolvedValue({ count: 1 });
      prisma.leaveRequest.findUnique.mockResolvedValue({ id: 'leave-1', schoolId: 'school-1', staffId: 'staff-1' });
      prisma.leaveRequest.update.mockResolvedValue({ id: 'leave-1', staffId: 'staff-1' });

      const result = await service.confirmAndExecute('action-1', 'user-1', 'school-1');

      expect(result.status).toBe(AgentActionStatus.SUCCEEDED);
      expect(prisma.leaveRequest.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'leave-1' },
        data: expect.objectContaining({ status: 'APPROVED', reviewedBy: 'user-1' }),
      }));
      expect(prisma.activityLog.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          schoolId: 'school-1',
          userId: 'user-1',
          resourceType: 'AgentAction',
          resourceId: 'action-1',
        })
      }));
    });
  });
});
