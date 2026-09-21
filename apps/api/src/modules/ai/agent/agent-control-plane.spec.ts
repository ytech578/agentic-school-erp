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
    update: jest.fn().mockResolvedValue({}),
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
      // No fingerprint collision
      prisma.agentAction.findUnique.mockResolvedValue(null);

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
      expect(res.pendingAction['idempotent']).toBe(false);
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
      // No fingerprint collision
      prisma.agentAction.findUnique.mockResolvedValue(null);

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

    // ── Idempotency: Operation Fingerprint (existing behaviour preserved) ────

    it('returns existing SUCCEEDED action when operation fingerprint collision detected', async () => {
      prisma.leaveRequest.findMany.mockResolvedValue([
        {
          id: 'leave-1',
          staff: { user: { firstName: 'Ravi', lastName: 'Kumar' } },
        },
      ]);
      // fingerprint lookup returns a SUCCEEDED action
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
      expect(res.pendingAction['result']).toEqual({ leaveId: 'leave-1', approved: true });
    });

    it('throws ConflictException when operation fingerprint collision on EXECUTING action', async () => {
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

    // ─── Hardening Test 1: clientRequestKey dedup ─────────────────────────────

    it('[H1] clientRequestKey dedup: returns cached proposal without creating a new row', async () => {
      const cachedAction = {
        id: 'action-cached',
        status: AgentActionStatus.AWAITING_CONFIRMATION,
        label: 'Approve leave for Ravi Kumar',
        riskLevel: 'HIGH',
        expiresAt: new Date(Date.now() + 15 * 60_000),
        requiresConfirmation: true,
        result: null,
      };
      // First findUnique call (request key lookup) returns cached action
      prisma.agentAction.findUnique.mockResolvedValueOnce(cachedAction);

      const res = await service.proposeAction(
        adminCtx,
        'approve_leave',
        { staffName: 'Ravi Kumar' },
        'client-uuid-abc123', // clientRequestKey
      );

      // Must NOT create a new DB row
      expect(prisma.agentAction.create).not.toHaveBeenCalled();
      // Must NOT perform identity resolution (leave lookup skipped)
      expect(prisma.leaveRequest.findMany).not.toHaveBeenCalled();
      expect(res.pendingAction['actionId']).toBe('action-cached');
      expect(res.pendingAction['idempotent']).toBe(true);
    });

    // ─── Hardening Test 2: fingerprint on AWAITING_CONFIRMATION ──────────────

    it('[H2] operationFingerprint collision on AWAITING_CONFIRMATION: returns existing pending action (no new row)', async () => {
      prisma.leaveRequest.findMany.mockResolvedValue([
        {
          id: 'leave-1',
          staff: { user: { firstName: 'Ravi', lastName: 'Kumar' } },
        },
      ]);
      // fingerprint lookup finds an already-pending action
      prisma.agentAction.findUnique.mockResolvedValue({
        id: 'action-pending',
        status: AgentActionStatus.AWAITING_CONFIRMATION,
        label: 'Approve leave for Ravi Kumar',
        riskLevel: 'HIGH',
        expiresAt: new Date(Date.now() + 10 * 60_000),
        requiresConfirmation: true,
        result: null,
      });

      const res = await service.proposeAction(adminCtx, 'approve_leave', {
        staffName: 'Ravi Kumar',
      });

      expect(prisma.agentAction.create).not.toHaveBeenCalled();
      expect(res.pendingAction['actionId']).toBe('action-pending');
      expect(res.pendingAction['idempotent']).toBe(false);
    });

    // ─── Hardening Test 3: FAILED re-submission clears old keys ──────────────

    it('[H3] FAILED action re-submission: clears old fingerprint and creates a fresh row', async () => {
      prisma.leaveRequest.findMany.mockResolvedValue([
        {
          id: 'leave-1',
          staff: { user: { firstName: 'Ravi', lastName: 'Kumar' } },
        },
      ]);
      // fingerprint lookup finds a FAILED action
      prisma.agentAction.findUnique.mockResolvedValue({
        id: 'action-failed',
        status: AgentActionStatus.FAILED,
        operationFingerprint: 'old-fp',
        idempotencyKey: 'old-req-key',
      });

      const res = await service.proposeAction(adminCtx, 'approve_leave', {
        staffName: 'Ravi Kumar',
      });

      // Must clear both keys on the old failed row
      expect(prisma.agentAction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'action-failed' },
          data: expect.objectContaining({
            operationFingerprint: null,
            idempotencyKey: null,
          }),
        }),
      );
      // Must create a brand-new row
      expect(prisma.agentAction.create).toHaveBeenCalled();
      expect(res.pendingAction['actionId']).toBe('action-1');
    });

    // ─── Hardening Test 4: EXPIRED re-submission clears old keys ─────────────

    it('[H4] EXPIRED action re-submission: clears old fingerprint and creates a fresh row', async () => {
      prisma.leaveRequest.findMany.mockResolvedValue([
        {
          id: 'leave-1',
          staff: { user: { firstName: 'Ravi', lastName: 'Kumar' } },
        },
      ]);
      prisma.agentAction.findUnique.mockResolvedValue({
        id: 'action-expired',
        status: AgentActionStatus.EXPIRED,
        operationFingerprint: 'old-fp-2',
        idempotencyKey: null,
      });

      const res = await service.proposeAction(adminCtx, 'approve_leave', {
        staffName: 'Ravi Kumar',
      });

      expect(prisma.agentAction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'action-expired' },
          data: expect.objectContaining({
            operationFingerprint: null,
            idempotencyKey: null,
          }),
        }),
      );
      expect(prisma.agentAction.create).toHaveBeenCalled();
      expect(res.pendingAction['actionId']).toBe('action-1');
    });

    // ─── Hardening Test 5: REQUEST_KEY strategy — no operation fingerprint ────

    it('[H5] REQUEST_KEY strategy (send_announcement): stores clientRequestKey, no operation fingerprint', async () => {
      // No clientRequestKey passed — no request key dedup; fingerprint is null for REQUEST_KEY
      // So findUnique is NOT called for fingerprint (fingerprint = null → skipped)
      // agentAction.findUnique should not be called at all
      const res = await service.proposeAction(
        adminCtx,
        'send_announcement',
        { title: 'School Holiday Announcement' },
      );

      // No findUnique call for fingerprint (REQUEST_KEY → fingerprint = null)
      expect(prisma.agentAction.findUnique).not.toHaveBeenCalled();
      expect(prisma.agentAction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            toolName: 'send_announcement',
            operationFingerprint: undefined,
          }),
        }),
      );
      expect(res.pendingAction['actionId']).toBe('action-1');
    });

    // ─── Hardening Test 6: clientRequestKey stored in DB row ─────────────────

    it('[H6] clientRequestKey is persisted as idempotencyKey in the DB row', async () => {
      prisma.leaveRequest.findMany.mockResolvedValue([
        {
          id: 'leave-2',
          staff: { user: { firstName: 'Priya', lastName: 'Sharma' } },
        },
      ]);
      // No prior row for this request key
      prisma.agentAction.findUnique.mockResolvedValueOnce(null); // request key lookup
      prisma.agentAction.findUnique.mockResolvedValueOnce(null); // fingerprint lookup

      await service.proposeAction(
        adminCtx,
        'approve_leave',
        { staffName: 'Priya Sharma' },
        'my-client-uuid-xyz',
      );

      expect(prisma.agentAction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            idempotencyKey: 'my-client-uuid-xyz',
          }),
        }),
      );
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

      await expect(
        service.confirmAndExecute('action-1', 'user-admin', 'school-1'),
      ).rejects.toThrow(BadRequestException);

      // ─── Hardening Test 7: expiry path clears BOTH idempotency keys ──────
      expect(prisma.agentAction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: AgentActionStatus.EXPIRED,
            idempotencyKey: null,
            operationFingerprint: null,
          }),
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

      const result = await service.confirmAndExecute('action-1', 'user-admin', 'school-1');

      expect(result.status).toBe(AgentActionStatus.FAILED);
      expect(result.failureReason).toContain(AGENT_ERRORS.ACTION_STALE_RESOURCE);
    });

    // ─── Hardening Test 8: FAILED path clears both idempotency keys ──────────

    it('[H8] FAILED execution path clears idempotencyKey and operationFingerprint on DB row', async () => {
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
      prisma.leaveRequest.updateMany.mockResolvedValue({ count: 0 });
      prisma.leaveRequest.findUnique.mockResolvedValue({
        id: 'leave-stale', status: 'APPROVED', schoolId: 'school-1',
      });

      await service.confirmAndExecute('action-1', 'user-admin', 'school-1');

      expect(prisma.agentAction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'action-1' },
          data: expect.objectContaining({
            status: AgentActionStatus.FAILED,
            idempotencyKey: null,
            operationFingerprint: null,
          }),
        }),
      );
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

  // ── expireStaleActions ─────────────────────────────────────────────────────

  describe('expireStaleActions', () => {
    // ─── Hardening Test 9: CONFIRMED rows are also expired ───────────────────

    it('[H9] expires both AWAITING_CONFIRMATION and CONFIRMED stale rows', async () => {
      prisma.agentAction.updateMany.mockResolvedValue({ count: 3 });

      const result = await service.expireStaleActions();

      expect(result).toEqual({ count: 3 });
      expect(prisma.agentAction.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { in: [AgentActionStatus.AWAITING_CONFIRMATION, AgentActionStatus.CONFIRMED] },
            expiresAt: expect.objectContaining({ lt: expect.any(Date) }),
          }),
        }),
      );
    });

    // ─── Hardening Test 10: expiry clears both idempotency keys ──────────────

    it('[H10] expireStaleActions clears idempotencyKey and operationFingerprint on expired rows', async () => {
      prisma.agentAction.updateMany.mockResolvedValue({ count: 2 });

      await service.expireStaleActions();

      expect(prisma.agentAction.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: AgentActionStatus.EXPIRED,
            idempotencyKey: null,
            operationFingerprint: null,
          }),
        }),
      );
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

    // ─── Hardening Test: send_announcement is REQUEST_KEY, not NONE ──────────

    it('[H-registry] send_announcement uses REQUEST_KEY strategy (not NONE)', () => {
      const sendAnnouncement = TOOL_REGISTRY.get('send_announcement');
      expect(sendAnnouncement.idempotencyStrategy).toBe('REQUEST_KEY');
    });

    it('[H-registry] all mutating tools declare an explicit idempotency strategy (no undefined)', () => {
      const validStrategies = new Set(['NATURAL_KEY', 'CONTENT_HASH', 'REQUEST_KEY', 'NONE']);
      for (const [name, tool] of TOOL_REGISTRY.entries()) {
        if (!validStrategies.has(tool.idempotencyStrategy)) {
          throw new Error(
            `Tool "${name}" has invalid idempotencyStrategy: ${tool.idempotencyStrategy}`,
          );
        }
      }
    });
  });
});
