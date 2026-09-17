import { Test, TestingModule } from '@nestjs/testing';
import {
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { AgentControlPlaneService } from './agent-control-plane.service';
import { AgentPolicyService } from './agent-policy.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { AgentActionStatus } from '@prisma/client';
import { HRService } from '../../hr/hr.service';
import { AssignmentsService } from '../../assignments/assignments.service';
import { AGENT_ERRORS } from './agent-types';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const buildPrismaMock = () => ({
  user: {
    findUnique: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
  },
  leaveRequest: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    updateMany: jest.fn(),
  },
  class: {
    findFirst: jest.fn(),
  },
  subject: {
    findFirst: jest.fn(),
  },
  staff: {
    findFirst: jest.fn(),
  },
  assignment: {
    findUnique: jest.fn(),
  },
  message: {
    createMany: jest.fn(),
    create: jest.fn(),
  },
  timetableSlot: {
    updateMany: jest.fn(),
  },
  exam: {
    findFirst: jest.fn(),
  },
  student: {
    findMany: jest.fn().mockResolvedValue([]),
  },
  agentAction: {
    create: jest.fn().mockImplementation((args) =>
      Promise.resolve({
        id: 'action-1',
        status: AgentActionStatus.AWAITING_CONFIRMATION,
        expiresAt: new Date(Date.now() + 15 * 60_000),
        ...args.data,
      }),
    ),
    findUnique: jest.fn(),
    updateMany: jest.fn(),
    update: jest.fn(),
  },
  activityLog: {
    create: jest.fn().mockResolvedValue({}),
  },
  $transaction: jest.fn().mockImplementation(async (cb) => cb(buildPrismaMock())),
});

// Standard admin context
const adminCtx = { userId: 'user-admin', role: 'SCHOOL_ADMIN', schoolId: 'school-1' };

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('AgentControlPlaneService — Hardened Control Plane', () => {
  let service: AgentControlPlaneService;
  let prisma: ReturnType<typeof buildPrismaMock>;
  let policyService: AgentPolicyService;
  let hrService: Partial<HRService>;
  let assignmentsService: Partial<AssignmentsService>;

  beforeEach(async () => {
    prisma = buildPrismaMock();
    hrService = { reviewLeave: jest.fn() };
    assignmentsService = { createAssignment: jest.fn() };

    // Re-wire $transaction so the nested CAS block works
    prisma.$transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => cb(prisma));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentControlPlaneService,
        AgentPolicyService,
        { provide: PrismaService, useValue: prisma },
        { provide: HRService, useValue: hrService },
        { provide: AssignmentsService, useValue: assignmentsService },
      ],
    }).compile();

    service = module.get<AgentControlPlaneService>(AgentControlPlaneService);
    policyService = module.get<AgentPolicyService>(AgentPolicyService);
  });

  // ── proposeAction ──────────────────────────────────────────────────────────

  describe('proposeAction', () => {
    it('throws NotFoundException for unknown tool', async () => {
      await expect(
        service.proposeAction(adminCtx, 'does_not_exist', {}),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException for unauthorized role', async () => {
      const teacherCtx = { ...adminCtx, role: 'TEACHER' };
      await expect(
        service.proposeAction(teacherCtx, 'approve_leave', { staffName: 'Ravi Kumar' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException for missing required field (staffName)', async () => {
      await expect(
        service.proposeAction(adminCtx, 'approve_leave', {}),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException for unknown field in input', async () => {
      await expect(
        service.proposeAction(adminCtx, 'approve_leave', {
          staffName: 'Ravi',
          unknownField: 'boom', // not in schema
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException for too-short staffName', async () => {
      await expect(
        service.proposeAction(adminCtx, 'approve_leave', { staffName: 'X' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('resolves leave and creates action with AWAITING_CONFIRMATION', async () => {
      prisma.leaveRequest.findMany.mockResolvedValue([
        {
          id: 'leave-1',
          schoolId: 'school-1',
          staff: { user: { firstName: 'Ravi', lastName: 'Kumar' } },
        },
      ]);

      const res = await service.proposeAction(adminCtx, 'approve_leave', {
        staffName: 'Ravi Kumar',
      });

      expect(prisma.agentAction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            toolName: 'approve_leave',
            arguments: { leaveId: 'leave-1', reason: undefined },
            status: AgentActionStatus.AWAITING_CONFIRMATION,
          }),
        }),
      );
      expect(res.pendingAction['actionId']).toBe('action-1');
    });

    it('throws NotFoundException for zero matching leaves', async () => {
      prisma.leaveRequest.findMany.mockResolvedValue([]);
      await expect(
        service.proposeAction(adminCtx, 'approve_leave', { staffName: 'Unknown Staff' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException for ambiguous staff name (multiple leaves)', async () => {
      prisma.leaveRequest.findMany.mockResolvedValue([
        { id: 'leave-1', staff: { user: { firstName: 'Ravi', lastName: 'A' } } },
        { id: 'leave-2', staff: { user: { firstName: 'Ravi', lastName: 'B' } } },
      ]);
      await expect(
        service.proposeAction(adminCtx, 'approve_leave', { staffName: 'Ravi' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('requires explicit subjectId for create_assignment — no random findFirst', async () => {
      const teacherCtx = { ...adminCtx, role: 'TEACHER' };
      await expect(
        service.proposeAction(teacherCtx, 'create_assignment', {
          className: 'Class 10-A',
          // subjectId intentionally omitted
          topic: 'Algebra Basics',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates create_assignment with resolved classId and explicit subjectId', async () => {
      const teacherCtx = { ...adminCtx, role: 'TEACHER' };
      prisma.class.findFirst.mockResolvedValue({ id: 'class-1', name: 'Class 10-A' });
      prisma.subject.findFirst.mockResolvedValue({ id: 'sub-1', name: 'Mathematics' });

      const res = await service.proposeAction(teacherCtx, 'create_assignment', {
        className: 'Class 10-A',
        subjectId: 'sub-1',
        topic: 'Algebra Basics',
      });

      expect(res.pendingAction['actionId']).toBe('action-1');
      expect(prisma.agentAction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            toolName: 'create_assignment',
            arguments: expect.objectContaining({
              classId: 'class-1',
              subjectId: 'sub-1',
            }),
          }),
        }),
      );
    });

    // ── Idempotency (Phase 7) ──────────────────────────────────────────────

    it('returns existing SUCCEEDED action when idempotent duplicate detected', async () => {
      prisma.leaveRequest.findMany.mockResolvedValue([
        {
          id: 'leave-1',
          staff: { user: { firstName: 'Ravi', lastName: 'Kumar' } },
        },
      ]);
      prisma.agentAction.findUnique.mockResolvedValue({
        id: 'action-existing',
        status: AgentActionStatus.SUCCEEDED,
        label: 'Approve leave for Ravi Kumar',
        riskLevel: 'HIGH',
        expiresAt: new Date(),
        requiresConfirmation: true,
        result: { leaveId: 'leave-1', approved: true },
      });

      const res = await service.proposeAction(adminCtx, 'approve_leave', {
        staffName: 'Ravi Kumar',
      });

      expect(prisma.agentAction.create).not.toHaveBeenCalled();
      expect(res.pendingAction['actionId']).toBe('action-existing');
      expect(res.pendingAction['idempotent']).toBe(true);
    });

    it('throws ConflictException when duplicate EXECUTING action detected', async () => {
      prisma.leaveRequest.findMany.mockResolvedValue([
        {
          id: 'leave-1',
          staff: { user: { firstName: 'Ravi', lastName: 'Kumar' } },
        },
      ]);
      prisma.agentAction.findUnique.mockResolvedValue({
        id: 'action-in-flight',
        status: AgentActionStatus.EXECUTING,
      });

      await expect(
        service.proposeAction(adminCtx, 'approve_leave', { staffName: 'Ravi Kumar' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ── confirmAndExecute ──────────────────────────────────────────────────────

  describe('confirmAndExecute', () => {
    it('throws NotFoundException for unknown actionId', async () => {
      prisma.agentAction.findUnique.mockResolvedValue(null);
      await expect(
        service.confirmAndExecute('action-1', 'user-admin', 'school-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException if tenant mismatches', async () => {
      prisma.agentAction.findUnique.mockResolvedValue({
        id: 'action-1',
        userId: 'user-admin',
        schoolId: 'school-1',
        status: AgentActionStatus.AWAITING_CONFIRMATION,
        expiresAt: new Date(Date.now() + 60_000),
        toolName: 'approve_leave',
        arguments: { leaveId: 'leave-1' },
        label: 'Approve leave',
        riskLevel: 'HIGH',
      });
      await expect(
        service.confirmAndExecute('action-1', 'user-admin', 'school-OTHER'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException if userId mismatches (cross-user)', async () => {
      prisma.agentAction.findUnique.mockResolvedValue({
        id: 'action-1',
        userId: 'user-admin',
        schoolId: 'school-1',
        status: AgentActionStatus.AWAITING_CONFIRMATION,
        expiresAt: new Date(Date.now() + 60_000),
        toolName: 'approve_leave',
        arguments: { leaveId: 'leave-1' },
        label: 'Approve leave',
        riskLevel: 'HIGH',
      });
      await expect(
        service.confirmAndExecute('action-1', 'user-OTHER', 'school-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException for invalid state transition (already SUCCEEDED)', async () => {
      prisma.agentAction.findUnique.mockResolvedValue({
        id: 'action-1',
        userId: 'user-admin',
        schoolId: 'school-1',
        status: AgentActionStatus.SUCCEEDED, // terminal
        expiresAt: null,
        toolName: 'approve_leave',
        arguments: {},
        label: 'Test',
        riskLevel: 'HIGH',
      });
      await expect(
        service.confirmAndExecute('action-1', 'user-admin', 'school-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('marks action EXPIRED and throws BadRequestException when past expiresAt', async () => {
      prisma.agentAction.findUnique.mockResolvedValue({
        id: 'action-1',
        userId: 'user-admin',
        schoolId: 'school-1',
        status: AgentActionStatus.AWAITING_CONFIRMATION,
        expiresAt: new Date(Date.now() - 5_000), // in the past
        toolName: 'approve_leave',
        arguments: {},
        label: 'Test',
        riskLevel: 'HIGH',
      });
      prisma.agentAction.update.mockResolvedValue({});

      await expect(
        service.confirmAndExecute('action-1', 'user-admin', 'school-1'),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.agentAction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: AgentActionStatus.EXPIRED },
        }),
      );
    });

    it('throws ConflictException when CAS update gets 0 rows (concurrent race)', async () => {
      prisma.agentAction.findUnique.mockResolvedValue({
        id: 'action-1',
        userId: 'user-admin',
        schoolId: 'school-1',
        status: AgentActionStatus.AWAITING_CONFIRMATION,
        expiresAt: new Date(Date.now() + 60_000),
        toolName: 'automation_daily_digest',
        arguments: {},
        label: 'Daily digest',
        riskLevel: 'LOW',
      });
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-admin',
        role: 'SCHOOL_ADMIN',
        schoolId: 'school-1',
        status: 'ACTIVE',
      });
      // Simulate concurrent execution already claimed the row
      prisma.$transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
        const txPrisma = { ...prisma, agentAction: { ...prisma.agentAction, updateMany: jest.fn().mockResolvedValue({ count: 0 }) } };
        return cb(txPrisma);
      });

      await expect(
        service.confirmAndExecute('action-1', 'user-admin', 'school-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('executes approve_leave and records SUCCEEDED + audit log', async () => {
      prisma.agentAction.findUnique.mockResolvedValue({
        id: 'action-1',
        userId: 'user-admin',
        schoolId: 'school-1',
        status: AgentActionStatus.AWAITING_CONFIRMATION,
        expiresAt: new Date(Date.now() + 60_000),
        toolName: 'approve_leave',
        arguments: { leaveId: 'leave-1', reason: 'Approved' },
        label: 'Approve leave for Ravi Kumar',
        riskLevel: 'HIGH',
      });
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-admin',
        role: 'SCHOOL_ADMIN',
        schoolId: 'school-1',
        status: 'ACTIVE',
      });
      prisma.agentAction.updateMany.mockResolvedValue({ count: 1 });
      // domainApproveLeave: stale-safe updateMany
      prisma.leaveRequest.updateMany.mockResolvedValue({ count: 1 });
      // verifyExecution: re-read leave
      prisma.leaveRequest.findUnique.mockResolvedValue({
        id: 'leave-1',
        status: 'APPROVED',
        reviewedBy: 'user-admin',
        schoolId: 'school-1',
      });
      prisma.agentAction.update.mockResolvedValue({});

      const result = await service.confirmAndExecute('action-1', 'user-admin', 'school-1');

      expect(result.status).toBe(AgentActionStatus.SUCCEEDED);
      expect(prisma.leaveRequest.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'leave-1', schoolId: 'school-1', status: 'PENDING' },
          data: expect.objectContaining({ status: 'APPROVED', reviewedBy: 'user-admin' }),
        }),
      );
      expect(prisma.activityLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            schoolId: 'school-1',
            userId: 'user-admin',
            module: 'AI_CONTROL_PLANE',
          }),
        }),
      );
    });

    it('throws error and marks FAILED when leave is stale (already approved)', async () => {
      prisma.agentAction.findUnique.mockResolvedValue({
        id: 'action-1',
        userId: 'user-admin',
        schoolId: 'school-1',
        status: AgentActionStatus.AWAITING_CONFIRMATION,
        expiresAt: new Date(Date.now() + 60_000),
        toolName: 'approve_leave',
        arguments: { leaveId: 'leave-stale' },
        label: 'Approve stale leave',
        riskLevel: 'HIGH',
      });
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-admin', role: 'SCHOOL_ADMIN', schoolId: 'school-1', status: 'ACTIVE',
      });
      prisma.agentAction.updateMany.mockResolvedValue({ count: 1 });
      // stale rejection: updateMany returns 0 rows
      prisma.leaveRequest.updateMany.mockResolvedValue({ count: 0 });
      // re-read shows already APPROVED
      prisma.leaveRequest.findUnique.mockResolvedValue({
        id: 'leave-stale', status: 'APPROVED', schoolId: 'school-1',
      });
      prisma.agentAction.update.mockResolvedValue({});

      const result = await service.confirmAndExecute('action-1', 'user-admin', 'school-1');

      expect(result.status).toBe(AgentActionStatus.FAILED);
      expect(result.failureReason).toContain(AGENT_ERRORS.ACTION_STALE_RESOURCE);
    });

    it('re-evaluates role at confirmation — rejects if role was revoked', async () => {
      prisma.agentAction.findUnique.mockResolvedValue({
        id: 'action-1',
        userId: 'user-demoted',
        schoolId: 'school-1',
        status: AgentActionStatus.AWAITING_CONFIRMATION,
        expiresAt: new Date(Date.now() + 60_000),
        toolName: 'approve_leave',
        arguments: { leaveId: 'leave-1' },
        label: 'Approve leave',
        riskLevel: 'HIGH',
      });
      // User role was demoted to STUDENT since proposal
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-demoted', role: 'STUDENT', schoolId: 'school-1', status: 'ACTIVE',
      });

      await expect(
        service.confirmAndExecute('action-1', 'user-demoted', 'school-1'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ── getActionStatus ────────────────────────────────────────────────────────

  describe('getActionStatus', () => {
    it('returns action status without leaking internal args', async () => {
      prisma.agentAction.findUnique.mockResolvedValue({
        id: 'action-1',
        toolName: 'approve_leave',
        label: 'Approve leave for Ravi Kumar',
        status: AgentActionStatus.AWAITING_CONFIRMATION,
        riskLevel: 'HIGH',
        requiresConfirmation: true,
        expiresAt: new Date(),
        createdAt: new Date(),
        result: null,
        failureReason: null,
        schoolId: 'school-1',
        userId: 'user-admin',
      });

      const result = await service.getActionStatus('action-1', 'user-admin', 'school-1');

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('status');
      // Must NOT expose internal arguments
      expect(result).not.toHaveProperty('arguments');
      expect(result).not.toHaveProperty('userId');
    });

    it('throws ForbiddenException for cross-tenant action status request', async () => {
      prisma.agentAction.findUnique.mockResolvedValue({
        id: 'action-1',
        schoolId: 'school-1',
        userId: 'user-admin',
        status: AgentActionStatus.SUCCEEDED,
      });
      await expect(
        service.getActionStatus('action-1', 'user-admin', 'school-ATTACKER'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ── AgentPolicyService ─────────────────────────────────────────────────────

  describe('AgentPolicyService', () => {
    const { TOOL_REGISTRY } = require('./tool-registry');
    const approveLeave = TOOL_REGISTRY.get('approve_leave');

    it('denies when no schoolId (tenant missing)', () => {
      const ctx = { userId: 'u1', role: 'SCHOOL_ADMIN', schoolId: '' };
      const result = policyService.evaluate(ctx, approveLeave);
      expect(result.decision).toBe('DENY');
    });

    it('denies when role is not in allowedRoles', () => {
      const ctx = { userId: 'u1', role: 'PARENT', schoolId: 'school-1' };
      const result = policyService.evaluate(ctx, approveLeave);
      expect(result.decision).toBe('DENY');
    });

    it('returns CONFIRMATION_REQUIRED for HIGH risk tool', () => {
      const ctx = { userId: 'u1', role: 'SCHOOL_ADMIN', schoolId: 'school-1' };
      const result = policyService.evaluate(ctx, approveLeave);
      expect(result.decision).toBe('CONFIRMATION_REQUIRED');
    });

    it('returns ALLOW for LOW risk, no confirmation tool', () => {
      const dailyDigest = TOOL_REGISTRY.get('automation_daily_digest');
      // Override requiresConfirmation for test
      const tool = { ...dailyDigest, riskLevel: 'LOW', requiresConfirmation: false };
      const ctx = { userId: 'u1', role: 'SCHOOL_ADMIN', schoolId: 'school-1' };
      const result = policyService.evaluate(ctx, tool);
      expect(result.decision).toBe('ALLOW');
    });
  });
});
