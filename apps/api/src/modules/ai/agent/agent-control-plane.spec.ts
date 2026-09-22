import { Test, TestingModule } from '@nestjs/testing';
import {
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { AgentControlPlaneService } from './agent-control-plane.service';
import { AgentPolicyService } from './agent-policy.service';
import { AgentToolDispatcher } from './agent-tool-dispatcher';
import {
  ApproveLeaveAgentHandler,
  CreateAssignmentAgentHandler,
  SendAnnouncementAgentHandler,
  AutomationFeeDefaulterHandler,
  AutomationAbsenceAlertHandler,
  AutomationAttendanceWarningHandler,
  AutomationTimetableCoverHandler,
  AutomationLeaveRecommendationHandler,
  AutomationReportCardPublishHandler,
  AutomationDailyDigestHandler,
  AGENT_TOOL_HANDLERS,
} from './handlers';
import { PrismaService } from '../../../core/database/prisma.service';
import { AgentActionStatus } from '@prisma/client';
import { HRService } from '../../hr/hr.service';
import { AssignmentsService } from '../../assignments/assignments.service';
import { MessagesService } from '../../messages/messages.service';
import { TimetableService } from '../../timetable/timetable.service';
import { ExamsService } from '../../exams/exams.service';
import { AGENT_ERRORS } from './agent-types';
import {
  PERMISSIONS,
  Permission,
  USER_ROLES,
  UserRole,
  ROLE_PERMISSIONS,
} from '@school-erp/shared';
import {
  TOOL_REGISTRY,
  ToolDefinition,
  validateToolRegistry,
} from './tool-registry';
import {
  validateIdempotencyKey,
  deriveIdempotencyScope,
  computeRequestFingerprint,
  canonicalJson,
} from './idempotency.util';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const buildPrismaMock = () => {
  const mockLeaveRequest: any = {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    updateMany: jest.fn(),
  };
  mockLeaveRequest.findFirst = jest
    .fn()
    .mockImplementation((args?: any) => mockLeaveRequest.findUnique(args));

  const mockClass: {
    findFirst: jest.Mock;
    findMany: jest.Mock;
  } = {
    findFirst: jest.fn(),
    findMany: jest.fn(),
  };
  mockClass.findMany.mockImplementation(async (args?: any) => {
    const first = await mockClass.findFirst(args);
    return first ? [first] : [];
  });

  return {
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
    leaveRequest: mockLeaveRequest,
    class: mockClass,
    subject: {
      findFirst: jest.fn(),
    },
    staff: {
      findFirst: jest.fn(),
    },
    academicYear: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    school: {
      findUnique: jest.fn().mockResolvedValue({ id: 'school-1', isActive: true }),
    },
    assignment: {
      findUnique: jest.fn(),
    },
    message: {
      createMany: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
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
      findFirst: jest.fn().mockResolvedValue(null),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest.fn().mockResolvedValue({}),
    },
    activityLog: {
      create: jest.fn().mockResolvedValue({}),
    },
    $transaction: jest
      .fn()
      .mockImplementation(async (cb: any) => cb(buildPrismaMock())),
  };
};

// Standard admin context
const adminCtx = {
  userId: 'user-admin',
  role: 'SCHOOL_ADMIN',
  schoolId: 'school-1',
};

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('AgentControlPlaneService — Hardened Control Plane', () => {
  let service: AgentControlPlaneService;
  let prisma: ReturnType<typeof buildPrismaMock>;
  let policyService: AgentPolicyService;
  let hrService: Partial<HRService>;
  let assignmentsService: Partial<AssignmentsService>;

  beforeEach(async () => {
    prisma = buildPrismaMock();
    assignmentsService = {
      createAssignment: jest.fn().mockResolvedValue({
        id: 'assign-1',
        title: 'Assignment',
        schoolId: 'school-1',
        classId: 'class-1',
        subjectId: 'sub-1',
        teacherId: 'staff-1',
        status: 'PUBLISHED',
      }),
      getStaffProfileByUserId: jest.fn().mockResolvedValue({ id: 'staff-1' }),
      getAssignmentById: jest.fn().mockResolvedValue({
        id: 'assign-1',
        title: 'Assignment',
        schoolId: 'school-1',
        classId: 'class-1',
        subjectId: 'sub-1',
        teacherId: 'staff-1',
        status: 'PUBLISHED',
      }),
      findAssignmentByDetails: jest.fn().mockResolvedValue({
        id: 'assign-1',
        title: 'Assignment',
        schoolId: 'school-1',
        classId: 'class-1',
        subjectId: 'sub-1',
        teacherId: 'staff-1',
        status: 'PUBLISHED',
      }),
    };

    // Re-wire $transaction so the nested CAS block works
    prisma.$transaction.mockImplementation(
      async (cb: (tx: unknown) => Promise<unknown>) => cb(prisma),
    );

    const toolHandlers = [
      ApproveLeaveAgentHandler,
      CreateAssignmentAgentHandler,
      SendAnnouncementAgentHandler,
      AutomationFeeDefaulterHandler,
      AutomationAbsenceAlertHandler,
      AutomationAttendanceWarningHandler,
      AutomationTimetableCoverHandler,
      AutomationLeaveRecommendationHandler,
      AutomationReportCardPublishHandler,
      AutomationDailyDigestHandler,
    ];

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentControlPlaneService,
        AgentPolicyService,
        AgentToolDispatcher,
        ...toolHandlers,
        {
          provide: AGENT_TOOL_HANDLERS,
          useFactory: (...handlers: any[]) => handlers,
          inject: toolHandlers,
        },
        { provide: PrismaService, useValue: prisma },
        {
          provide: HRService,
          useValue: new HRService(prisma as any),
        },
        { provide: AssignmentsService, useValue: assignmentsService },
        {
          provide: MessagesService,
          useValue: {
            broadcastAnnouncement: jest
              .fn()
              .mockImplementation(async (data) => {
                // Replicate the broadcast message creation for mock Prisma
                const users = await prisma.user.findMany();
                const recipients = users.filter(
                  (u: any) => u.id !== data.senderId,
                );
                if (recipients.length > 0) {
                  await prisma.message.createMany({
                    data: recipients.map((r: any) => ({
                      schoolId: data.schoolId,
                      senderId: data.senderId,
                      recipientId: r.id,
                      subject: data.subject,
                      body: data.body,
                    })),
                  });
                }
                return { success: true, sent: recipients.length };
              }),
            sendMessage: jest.fn(),
            sendBatchMessages: jest.fn().mockImplementation(async (data) => {
              return {
                sentCount: data.items.length,
                failedCount: 0,
                recipients: data.items.map((i: any) => i.recipientId),
              };
            }),
            sendDailyDigest: jest.fn().mockResolvedValue({
              sentCount: 1,
              failedCount: 0,
              recipients: ['user-1'],
            }),
            verifyAnnouncement: jest.fn().mockResolvedValue({
              verified: true,
              recipientCount: 1,
            }),
            findAnnouncement: jest
              .fn()
              .mockImplementation(async (schoolId, ...rest) => {
                const title = rest.length === 1 ? rest[0] : rest[1];
                const msg = await prisma.message.findFirst({
                  where: { schoolId, subject: title },
                });
                if (!msg) return null;
                return { id: msg.id, title: msg.subject, recipientCount: 1 };
              }),
            verifyBatchMessages: jest.fn().mockResolvedValue({
              verified: true,
              recipientCount: 1,
            }),
          },
        },
        {
          provide: TimetableService,
          useValue: new TimetableService(prisma as any),
        },
        {
          provide: ExamsService,
          useValue: {
            publishAndNotifyExamResults: jest.fn().mockResolvedValue({
              examId: 'exam-1',
              examName: 'Final Exam',
              published: true,
              notifiedCount: 10,
            }),
            getExamPublishStatus: jest.fn().mockResolvedValue({
              examId: 'exam-1',
              examName: 'Final Exam',
              isPublished: true,
              notifiedCount: 10,
            }),
          },
        },
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
        service.proposeAction(teacherCtx, 'approve_leave', {
          staffName: 'Ravi Kumar',
        }),
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
        service.proposeAction(adminCtx, 'approve_leave', {
          staffName: 'Unknown Staff',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException for ambiguous staff name (multiple leaves)', async () => {
      prisma.leaveRequest.findMany.mockResolvedValue([
        {
          id: 'leave-1',
          staff: { user: { firstName: 'Ravi', lastName: 'A' } },
        },
        {
          id: 'leave-2',
          staff: { user: { firstName: 'Ravi', lastName: 'B' } },
        },
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
      prisma.class.findFirst.mockResolvedValue({
        id: 'class-1',
        name: 'Class 10-A',
      });
      prisma.subject.findFirst.mockResolvedValue({
        id: 'sub-1',
        name: 'Mathematics',
      });
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
      prisma.agentAction.findFirst.mockResolvedValue({
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
      expect(res.pendingAction['result']).toEqual({
        leaveId: 'leave-1',
        approved: true,
      });
    });

    it('throws ConflictException when operation fingerprint collision on EXECUTING action', async () => {
      prisma.leaveRequest.findMany.mockResolvedValue([
        {
          id: 'leave-1',
          staff: { user: { firstName: 'Ravi', lastName: 'Kumar' } },
        },
      ]);
      prisma.agentAction.findFirst.mockResolvedValue({
        id: 'action-in-flight',
        userId: 'user-admin',
        schoolId: 'school-1',
        toolName: 'approve_leave',
        riskLevel: 'HIGH',
        label: 'Approve leave',
        arguments: { leaveId: 'leave-1' },
        status: AgentActionStatus.EXECUTING,
      });

      await expect(
        service.proposeAction(adminCtx, 'approve_leave', {
          staffName: 'Ravi Kumar',
        }),
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
      // First findFirst call (request key lookup) returns cached action
      prisma.agentAction.findFirst.mockResolvedValueOnce(cachedAction);

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
      prisma.agentAction.findFirst.mockResolvedValue({
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

    // ─── Hardening Test 3: FAILED re-submission preserves historical keys ──────────────

    it('[H3] FAILED action re-submission: preserves old keys and creates a fresh row', async () => {
      prisma.leaveRequest.findMany.mockResolvedValue([
        {
          id: 'leave-1',
          staff: { user: { firstName: 'Ravi', lastName: 'Kumar' } },
        },
      ]);
      // fingerprint lookup finds a FAILED action
      prisma.agentAction.findFirst.mockResolvedValue({
        id: 'action-failed',
        status: AgentActionStatus.FAILED,
        operationFingerprint: 'old-fp',
        idempotencyKey: 'old-req-key',
      });

      const res = await service.proposeAction(adminCtx, 'approve_leave', {
        staffName: 'Ravi Kumar',
      });

      // Must NOT clear keys on the old failed row
      expect(prisma.agentAction.update).not.toHaveBeenCalledWith(
        expect.objectContaining({
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

    // ─── Hardening Test 4: EXPIRED re-submission preserves historical keys ─────────────

    it('[H4] EXPIRED action re-submission: preserves old keys and creates a fresh row', async () => {
      prisma.leaveRequest.findMany.mockResolvedValue([
        {
          id: 'leave-1',
          staff: { user: { firstName: 'Ravi', lastName: 'Kumar' } },
        },
      ]);
      prisma.agentAction.findFirst.mockResolvedValue({
        id: 'action-expired',
        status: AgentActionStatus.EXPIRED,
        operationFingerprint: 'old-fp-2',
        idempotencyKey: null,
      });

      const res = await service.proposeAction(adminCtx, 'approve_leave', {
        staffName: 'Ravi Kumar',
      });

      expect(prisma.agentAction.update).not.toHaveBeenCalledWith(
        expect.objectContaining({
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
      // So findFirst is NOT called for fingerprint (fingerprint = null → skipped)
      const res = await service.proposeAction(adminCtx, 'send_announcement', {
        title: 'School Holiday Announcement',
      });

      // No findFirst call for fingerprint (REQUEST_KEY → fingerprint = null)
      expect(prisma.agentAction.findFirst).not.toHaveBeenCalled();
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
      // No prior row for this request key or fingerprint
      prisma.agentAction.findFirst.mockResolvedValue(null);

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

  // ── CHANGE #8A Correction: Idempotency Closure & Recovery (Step 18) ────────

  describe('CHANGE #8A Correction: Idempotency Closure & Recovery', () => {
    describe('Idempotency Key Validation', () => {
      it('rejects keys with whitespace, illegal characters, or excessive length', async () => {
        await expect(
          service.proposeAction(
            adminCtx,
            'send_announcement',
            { title: 'Test' },
            'key with spaces',
          ),
        ).rejects.toThrow(BadRequestException);

        await expect(
          service.proposeAction(
            adminCtx,
            'send_announcement',
            { title: 'Test' },
            'key$invalid!',
          ),
        ).rejects.toThrow(BadRequestException);

        await expect(
          service.proposeAction(
            adminCtx,
            'send_announcement',
            { title: 'Test' },
            'a'.repeat(129),
          ),
        ).rejects.toThrow(BadRequestException);

        await expect(
          service.proposeAction(
            adminCtx,
            'send_announcement',
            { title: 'Test' },
            '   ',
          ),
        ).rejects.toThrow(BadRequestException);
      });

      it('accepts valid alphanumeric, hyphen, dot, colon, and underscore keys up to 128 chars', async () => {
        prisma.agentAction.findFirst.mockResolvedValue(null);
        const validKey = 'req_123.ABC-456:789';
        const res = await service.proposeAction(
          adminCtx,
          'send_announcement',
          { title: 'Valid Key Announcement' },
          validKey,
        );
        expect(res.pendingAction).toBeDefined();
        expect(prisma.agentAction.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              idempotencyKey: validKey,
              idempotencyScope: 'school-1:user-admin:send_announcement',
            }),
          }),
        );
      });
    });

    describe('Scoped Idempotency Key Lookup', () => {
      it('queries existing proposals using both idempotencyScope and idempotencyKey', async () => {
        const key = 'scoped-key-001';
        prisma.agentAction.findFirst.mockResolvedValue(null);

        await service.proposeAction(
          adminCtx,
          'send_announcement',
          { title: 'Notice' },
          key,
        );

        expect(prisma.agentAction.findFirst).toHaveBeenCalledWith({
          where: {
            idempotencyScope: 'school-1:user-admin:send_announcement',
            idempotencyKey: key,
          },
        });
      });

      it('allows identical idempotency keys across different users or schools without collision', async () => {
        const scopeUser1 = deriveIdempotencyScope(
          'school-1',
          'user-1',
          'send_announcement',
        );
        const scopeUser2 = deriveIdempotencyScope(
          'school-1',
          'user-2',
          'send_announcement',
        );
        const scopeSchool2 = deriveIdempotencyScope(
          'school-2',
          'user-1',
          'send_announcement',
        );

        expect(scopeUser1).toBe('school-1:user-1:send_announcement');
        expect(scopeUser2).toBe('school-1:user-2:send_announcement');
        expect(scopeSchool2).toBe('school-2:user-1:send_announcement');
        expect(scopeUser1).not.toBe(scopeUser2);
        expect(scopeUser1).not.toBe(scopeSchool2);
      });
    });

    describe('Same-Key / Different-Request Conflict (409)', () => {
      it('throws ConflictException with ACTION_IDEMPOTENCY_KEY_REUSE when key is reused with different payload', async () => {
        const key = 'reused-key-1';
        const scope = 'school-1:user-admin:send_announcement';
        const existingFingerprint = computeRequestFingerprint(
          'school-1',
          'user-admin',
          'send_announcement',
          { title: 'Original Announcement Title' },
        );

        prisma.agentAction.findFirst.mockResolvedValueOnce({
          id: 'action-original',
          idempotencyScope: scope,
          idempotencyKey: key,
          requestFingerprint: existingFingerprint,
          status: AgentActionStatus.AWAITING_CONFIRMATION,
          label: 'Original Announcement',
          riskLevel: 'LOW',
        });

        await expect(
          service.proposeAction(
            adminCtx,
            'send_announcement',
            { title: 'Tampered or Different Announcement Title' },
            key,
          ),
        ).rejects.toThrow(ConflictException);

        try {
          await service.proposeAction(
            adminCtx,
            'send_announcement',
            { title: 'Tampered or Different Announcement Title' },
            key,
          );
        } catch (err: any) {
          expect(err.message).toContain(
            AGENT_ERRORS.ACTION_IDEMPOTENCY_KEY_REUSE,
          );
        }
      });
    });

    describe('Concurrent Proposal Race Handling (Prisma P2002)', () => {
      it('recovers safely on P2002 race when winning row has identical request payload', async () => {
        const key = 'concurrent-race-key';
        const rawArgs = { title: 'Concurrent Announcement' };
        const reqFp = computeRequestFingerprint(
          'school-1',
          'user-admin',
          'send_announcement',
          rawArgs,
        );

        // First findFirst before create returns null (simulating concurrent gap)
        prisma.agentAction.findFirst.mockResolvedValueOnce(null);

        // create() throws Prisma P2002 unique constraint error
        const p2002Error: any = new Error(
          'Unique constraint failed on the fields: (`idempotencyScope`,`idempotencyKey`)',
        );
        p2002Error.code = 'P2002';
        prisma.agentAction.create.mockRejectedValueOnce(p2002Error);

        // findFirst in catch block finds the row committed by the concurrent winner
        prisma.agentAction.findFirst.mockResolvedValueOnce({
          id: 'action-winner',
          idempotencyScope: 'school-1:user-admin:send_announcement',
          idempotencyKey: key,
          requestFingerprint: reqFp,
          status: AgentActionStatus.AWAITING_CONFIRMATION,
          label: 'Execute Send announcement',
          riskLevel: 'LOW',
          expiresAt: new Date(Date.now() + 15 * 60_000),
          requiresConfirmation: false,
        });

        const res = await service.proposeAction(
          adminCtx,
          'send_announcement',
          rawArgs,
          key,
        );

        expect(res.pendingAction['actionId']).toBe('action-winner');
        expect(res.pendingAction['idempotent']).toBe(true);
      });

      it('throws ACTION_IDEMPOTENCY_KEY_REUSE on P2002 race when winning row has different request payload', async () => {
        const key = 'concurrent-race-conflict';
        const rawArgs = { title: 'New Announcement' };

        prisma.agentAction.findFirst.mockResolvedValueOnce(null);

        const p2002Error: any = new Error('Unique constraint failed');
        p2002Error.code = 'P2002';
        prisma.agentAction.create.mockRejectedValueOnce(p2002Error);

        // findFirst in catch finds existing row with DIFFERENT fingerprint
        prisma.agentAction.findFirst.mockResolvedValueOnce({
          id: 'action-winner',
          idempotencyScope: 'school-1:user-admin:send_announcement',
          idempotencyKey: key,
          requestFingerprint: 'different-fingerprint-xyz',
          status: AgentActionStatus.AWAITING_CONFIRMATION,
        });

        await expect(
          service.proposeAction(adminCtx, 'send_announcement', rawArgs, key),
        ).rejects.toThrow(ConflictException);
      });
    });

    describe('Ambiguous Execution Reconciliation', () => {
      it('reconciles EXECUTING action as APPLIED and marks SUCCEEDED', async () => {
        prisma.leaveRequest.findMany.mockResolvedValue([
          {
            id: 'leave-10',
            staff: { user: { firstName: 'Ravi', lastName: 'Kumar' } },
          },
        ]);
        prisma.agentAction.findFirst.mockResolvedValueOnce({
          id: 'action-executing',
          userId: 'user-admin',
          schoolId: 'school-1',
          toolName: 'approve_leave',
          riskLevel: 'HIGH',
          label: 'Approve leave for Ravi Kumar',
          arguments: { leaveId: 'leave-10' },
          status: AgentActionStatus.EXECUTING,
        });

        // Domain check confirms leave request was actually APPROVED in DB
        prisma.leaveRequest.findUnique.mockResolvedValueOnce({
          id: 'leave-10',
          status: 'APPROVED',
          schoolId: 'school-1',
        });

        const res = await service.proposeAction(adminCtx, 'approve_leave', {
          staffName: 'Ravi Kumar',
        });

        expect(prisma.agentAction.update).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: 'action-executing' },
            data: expect.objectContaining({
              status: AgentActionStatus.SUCCEEDED,
            }),
          }),
        );
        expect(res.pendingAction['actionId']).toBe('action-executing');
        expect(res.pendingAction['status']).toBe(AgentActionStatus.SUCCEEDED);
        expect(res.pendingAction['idempotent']).toBe(true);
      });

      it('reconciles EXECUTING action as NOT_APPLIED, marks FAILED, and allows fresh proposal', async () => {
        prisma.leaveRequest.findMany.mockResolvedValue([
          {
            id: 'leave-11',
            staff: { user: { firstName: 'Ravi', lastName: 'Kumar' } },
          },
        ]);
        prisma.agentAction.findFirst.mockResolvedValueOnce({
          id: 'action-executing-stalled',
          userId: 'user-admin',
          schoolId: 'school-1',
          toolName: 'approve_leave',
          riskLevel: 'HIGH',
          label: 'Approve leave for Ravi Kumar',
          arguments: { leaveId: 'leave-11' },
          status: AgentActionStatus.EXECUTING,
        });

        // Domain check confirms leave request is still PENDING in DB
        prisma.leaveRequest.findUnique.mockResolvedValueOnce({
          id: 'leave-11',
          status: 'PENDING',
          schoolId: 'school-1',
        });

        const res = await service.proposeAction(adminCtx, 'approve_leave', {
          staffName: 'Ravi Kumar',
        });

        // Marks stalled row FAILED
        expect(prisma.agentAction.update).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: 'action-executing-stalled' },
            data: expect.objectContaining({
              status: AgentActionStatus.FAILED,
            }),
          }),
        );
        // Allows creating fresh proposal
        expect(prisma.agentAction.create).toHaveBeenCalled();
        expect(res.pendingAction['actionId']).toBe('action-1');
      });

      it('throws ACTION_RECOVERY_REQUIRED when reconciliation outcome is UNKNOWN', async () => {
        prisma.leaveRequest.findMany.mockResolvedValue([
          {
            id: 'leave-12',
            staff: { user: { firstName: 'Ravi', lastName: 'Kumar' } },
          },
        ]);
        prisma.agentAction.findFirst.mockResolvedValueOnce({
          id: 'action-executing-unknown',
          userId: 'user-admin',
          schoolId: 'school-1',
          toolName: 'approve_leave',
          riskLevel: 'HIGH',
          label: 'Approve leave for Ravi Kumar',
          arguments: { leaveId: 'leave-12' },
          status: AgentActionStatus.EXECUTING,
        });

        // Domain check returns REJECTED (ambiguous in approve_leave context -> UNKNOWN)
        prisma.leaveRequest.findUnique.mockResolvedValueOnce({
          id: 'leave-12',
          status: 'REJECTED',
          schoolId: 'school-1',
        });

        await expect(
          service.proposeAction(adminCtx, 'approve_leave', {
            staffName: 'Ravi Kumar',
          }),
        ).rejects.toThrow(ConflictException);

        try {
          await service.proposeAction(adminCtx, 'approve_leave', {
            staffName: 'Ravi Kumar',
          });
        } catch (err: any) {
          expect(err.message).toContain(AGENT_ERRORS.ACTION_RECOVERY_REQUIRED);
        }
      });
    });

    describe('Actor-Independent Shared Business Fingerprints', () => {
      it('computes identical operationFingerprint for approve_leave across different admin users', async () => {
        const leaveId = 'leave-shared-123';
        const fp1 = (service as any).computeOperationFingerprint(
          TOOL_REGISTRY.get('approve_leave')!,
          {
            schoolId: 'school-1',
            userId: 'admin-alpha',
            role: 'SCHOOL_ADMIN',
            permissions: [],
          },
          { leaveId },
        );
        const fp2 = (service as any).computeOperationFingerprint(
          TOOL_REGISTRY.get('approve_leave')!,
          {
            schoolId: 'school-1',
            userId: 'admin-beta',
            role: 'SCHOOL_ADMIN',
            permissions: [],
          },
          { leaveId },
        );

        expect(fp1).toBeDefined();
        expect(fp1).toBe(fp2);
      });

      it('computes identical operationFingerprint for create_assignment across different teachers', async () => {
        const resolvedArgs = {
          classId: 'class-1',
          subjectId: 'sub-1',
          topic: 'Algebra Basics',
          description: 'Chapter 1 exercises',
          dueDate: '2026-10-01',
          totalMarks: 50,
        };
        const fp1 = (service as any).computeOperationFingerprint(
          TOOL_REGISTRY.get('create_assignment')!,
          {
            schoolId: 'school-1',
            userId: 'teacher-1',
            role: 'TEACHER',
            permissions: [],
          },
          resolvedArgs,
        );
        const fp2 = (service as any).computeOperationFingerprint(
          TOOL_REGISTRY.get('create_assignment')!,
          {
            schoolId: 'school-1',
            userId: 'teacher-2',
            role: 'TEACHER',
            permissions: [],
          },
          resolvedArgs,
        );

        expect(fp1).toBeDefined();
        expect(fp1).toBe(fp2);
      });
    });

    describe('Race-Safe CAS Confirmation & Recovery', () => {
      it('returns cached result when CAS returns 0 and action already completed (SUCCEEDED)', async () => {
        prisma.agentAction.findUnique
          .mockResolvedValueOnce({
            id: 'action-cas-race',
            userId: 'user-admin',
            schoolId: 'school-1',
            status: AgentActionStatus.AWAITING_CONFIRMATION,
            expiresAt: new Date(Date.now() + 60_000),
            toolName: 'send_announcement',
            arguments: { title: 'Test' },
            label: 'Test Announcement',
            riskLevel: 'LOW',
          })
          .mockResolvedValueOnce({
            id: 'action-cas-race',
            userId: 'user-admin',
            schoolId: 'school-1',
            status: AgentActionStatus.SUCCEEDED,
            result: { sentCount: 42 },
          });

        prisma.user.findUnique.mockResolvedValue({
          id: 'user-admin',
          role: 'SCHOOL_ADMIN',
          schoolId: 'school-1',
          status: 'ACTIVE',
        });
        prisma.agentAction.updateMany.mockResolvedValue({ count: 0 });

        const result = await service.confirmAndExecute(
          'action-cas-race',
          'user-admin',
          'school-1',
        );

        expect(result.status).toBe(AgentActionStatus.SUCCEEDED);
        expect(result.result).toEqual({ sentCount: 42 });
      });

      it('throws ACTION_EXPIRED when CAS returns 0 and action expired concurrently', async () => {
        prisma.agentAction.findUnique
          .mockResolvedValueOnce({
            id: 'action-cas-expired',
            userId: 'user-admin',
            schoolId: 'school-1',
            status: AgentActionStatus.AWAITING_CONFIRMATION,
            expiresAt: new Date(Date.now() + 60_000),
            toolName: 'send_announcement',
            arguments: { title: 'Test' },
            label: 'Test Announcement',
            riskLevel: 'LOW',
          })
          .mockResolvedValueOnce({
            id: 'action-cas-expired',
            userId: 'user-admin',
            schoolId: 'school-1',
            status: AgentActionStatus.EXPIRED,
            expiresAt: new Date(Date.now() - 1000),
          });

        prisma.user.findUnique.mockResolvedValue({
          id: 'user-admin',
          role: 'SCHOOL_ADMIN',
          schoolId: 'school-1',
          status: 'ACTIVE',
        });
        prisma.agentAction.updateMany.mockResolvedValue({ count: 0 });

        await expect(
          service.confirmAndExecute(
            'action-cas-expired',
            'user-admin',
            'school-1',
          ),
        ).rejects.toThrow(BadRequestException);
      });
    });
  });

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
        schoolId: 'other-school',
        userId: 'user-admin',
      });
      await expect(
        service.confirmAndExecute('action-1', 'user-admin', 'school-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException if ownership mismatches', async () => {
      prisma.agentAction.findUnique.mockResolvedValue({
        id: 'action-1',
        schoolId: 'school-1',
        userId: 'other-user',
      });
      await expect(
        service.confirmAndExecute('action-1', 'user-admin', 'school-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException if user is inactive at confirmation time', async () => {
      prisma.agentAction.findUnique.mockResolvedValue({
        id: 'action-1',
        userId: 'user-inactive',
        schoolId: 'school-1',
        status: AgentActionStatus.AWAITING_CONFIRMATION,
        expiresAt: new Date(Date.now() + 60_000),
        toolName: 'approve_leave',
        arguments: { leaveId: 'leave-1' },
      });
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-inactive',
        role: 'SCHOOL_ADMIN',
        schoolId: 'school-1',
        status: 'SUSPENDED',
      });
      await expect(
        service.confirmAndExecute('action-1', 'user-inactive', 'school-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException for invalid state transition (already SUCCEEDED)', async () => {
      prisma.agentAction.findUnique.mockResolvedValue({
        id: 'action-1',
        userId: 'user-admin',
        schoolId: 'school-1',
        status: AgentActionStatus.SUCCEEDED,
        expiresAt: new Date(Date.now() + 60_000),
        toolName: 'approve_leave',
        arguments: { leaveId: 'leave-1' },
        label: 'Approve leave',
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
        expiresAt: new Date(Date.now() - 1000), // in the past
        toolName: 'approve_leave',
        arguments: { leaveId: 'leave-1' },
        label: 'Approve leave',
        riskLevel: 'HIGH',
      });

      await expect(
        service.confirmAndExecute('action-1', 'user-admin', 'school-1'),
      ).rejects.toThrow(BadRequestException);

      // ─── Hardening Test 7: expiry path preserves historical idempotency keys ──────
      expect(prisma.agentAction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: AgentActionStatus.EXPIRED,
          }),
        }),
      );
      expect(prisma.agentAction.update).not.toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            idempotencyKey: null,
          }),
        }),
      );
    });

    it('throws ConflictException when CAS update gets 0 rows (concurrent race)', async () => {
      prisma.agentAction.findUnique
        .mockResolvedValueOnce({
          id: 'action-1',
          userId: 'user-admin',
          schoolId: 'school-1',
          status: AgentActionStatus.AWAITING_CONFIRMATION,
          expiresAt: new Date(Date.now() + 60_000),
          toolName: 'automation_daily_digest',
          arguments: {},
          label: 'Daily digest',
          riskLevel: 'LOW',
        })
        .mockResolvedValueOnce({
          id: 'action-1',
          userId: 'user-admin',
          schoolId: 'school-1',
          status: AgentActionStatus.EXECUTING,
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
      prisma.agentAction.updateMany.mockResolvedValue({ count: 0 });

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

      const result = await service.confirmAndExecute(
        'action-1',
        'user-admin',
        'school-1',
      );

      expect(result.status).toBe(AgentActionStatus.SUCCEEDED);
      expect(prisma.leaveRequest.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'leave-1', schoolId: 'school-1', status: 'PENDING' },
          data: expect.objectContaining({
            status: 'APPROVED',
            reviewedBy: 'user-admin',
          }),
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
        id: 'user-admin',
        role: 'SCHOOL_ADMIN',
        schoolId: 'school-1',
        status: 'ACTIVE',
      });
      prisma.agentAction.updateMany.mockResolvedValue({ count: 1 });
      // stale rejection: updateMany returns 0 rows
      prisma.leaveRequest.updateMany.mockResolvedValue({ count: 0 });
      // re-read shows already APPROVED
      prisma.leaveRequest.findUnique.mockResolvedValue({
        id: 'leave-stale',
        status: 'APPROVED',
        schoolId: 'school-1',
      });

      const result = await service.confirmAndExecute(
        'action-1',
        'user-admin',
        'school-1',
      );

      expect(result.status).toBe(AgentActionStatus.FAILED);
      expect(result.failureReason).toContain(
        AGENT_ERRORS.ACTION_STALE_RESOURCE,
      );
    });

    // ─── Hardening Test 8: FAILED path preserves historical idempotency keys ──────────

    it('[H8] FAILED execution path preserves idempotencyKey and operationFingerprint on DB row', async () => {
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
        id: 'user-admin',
        role: 'SCHOOL_ADMIN',
        schoolId: 'school-1',
        status: 'ACTIVE',
      });
      prisma.agentAction.updateMany.mockResolvedValue({ count: 1 });
      prisma.leaveRequest.updateMany.mockResolvedValue({ count: 0 });
      prisma.leaveRequest.findUnique.mockResolvedValue({
        id: 'leave-stale',
        status: 'APPROVED',
        schoolId: 'school-1',
      });

      await service.confirmAndExecute('action-1', 'user-admin', 'school-1');

      expect(prisma.agentAction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'action-1' },
          data: expect.objectContaining({
            status: AgentActionStatus.FAILED,
          }),
        }),
      );
      expect(prisma.agentAction.update).not.toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            idempotencyKey: null,
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
        id: 'user-demoted',
        role: 'STUDENT',
        schoolId: 'school-1',
        status: 'ACTIVE',
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

      const result = await service.getActionStatus(
        'action-1',
        'user-admin',
        'school-1',
      );

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
            status: {
              in: [
                AgentActionStatus.AWAITING_CONFIRMATION,
                AgentActionStatus.CONFIRMED,
              ],
            },
            expiresAt: expect.objectContaining({ lt: expect.any(Date) }),
          }),
        }),
      );
    });

    // ─── Hardening Test 10: expiry preserves historical idempotency keys ──────────────

    it('[H10] expireStaleActions preserves idempotencyKey and operationFingerprint on expired rows', async () => {
      prisma.agentAction.updateMany.mockResolvedValue({ count: 2 });

      await service.expireStaleActions();

      expect(prisma.agentAction.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            status: AgentActionStatus.EXPIRED,
          },
        }),
      );
      expect(prisma.agentAction.updateMany).not.toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            idempotencyKey: null,
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
      const tool = {
        ...dailyDigest,
        riskLevel: 'LOW',
        requiresConfirmation: false,
      };
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
      const validStrategies = new Set([
        'NATURAL_KEY',
        'CONTENT_HASH',
        'REQUEST_KEY',
        'NONE',
      ]);
      for (const [name, tool] of TOOL_REGISTRY.entries()) {
        if (!validStrategies.has(tool.idempotencyStrategy)) {
          throw new Error(
            `Tool "${name}" has invalid idempotencyStrategy: ${tool.idempotencyStrategy}`,
          );
        }
      }
    });

    // ─── Change #8B: Fine-Grained Authorization Matrix & Security Enforcement ──

    describe('Role Tests', () => {
      it('Allowed role + correct permission → evaluates to CONFIRMATION_REQUIRED for high-risk action', () => {
        const principalCtx = {
          userId: 'p1',
          role: 'PRINCIPAL',
          schoolId: 'school-1',
        };
        const result = policyService.evaluate(principalCtx, approveLeave);
        expect(result.decision).toBe('CONFIRMATION_REQUIRED');
      });

      it('Allowed role + correct permission → evaluates to ALLOW for low-risk, non-confirm tool', () => {
        const principalCtx = {
          userId: 'p1',
          role: 'PRINCIPAL',
          schoolId: 'school-1',
        };
        const dailyDigest = TOOL_REGISTRY.get('automation_daily_digest')!;
        const result = policyService.evaluate(principalCtx, dailyDigest);
        expect(result.decision).toBe('ALLOW');
      });

      it('Wrong role + correct permission → DENY', () => {
        // Teacher has MESSAGES_SEND, but send_announcement only allows PRINCIPAL, SCHOOL_ADMIN, SUPER_ADMIN
        const teacherCtx = {
          userId: 't1',
          role: 'TEACHER',
          schoolId: 'school-1',
        };
        const sendAnnouncement = TOOL_REGISTRY.get('send_announcement')!;
        const result = policyService.evaluate(teacherCtx, sendAnnouncement);
        expect(result.decision).toBe('DENY');
        expect(result.reason).toContain(
          'Role "TEACHER" is not permitted to execute "send_announcement"',
        );
      });

      it('Wrong role (STUDENT) attempting create_assignment → DENY', () => {
        const studentCtx = {
          userId: 's1',
          role: 'STUDENT',
          schoolId: 'school-1',
        };
        const createAssignment = TOOL_REGISTRY.get('create_assignment')!;
        const result = policyService.evaluate(studentCtx, createAssignment);
        expect(result.decision).toBe('DENY');
        expect(result.reason).toContain(
          'Role "STUDENT" is not permitted to execute "create_assignment"',
        );
      });
    });

    describe('Permission Tests', () => {
      it('Correct role + missing permission → DENY', () => {
        // User has PRINCIPAL role, but their fine-grained permissions explicitly omit LEAVE_APPROVE
        const restrictedPrincipal = {
          userId: 'p-restricted',
          role: 'PRINCIPAL',
          schoolId: 'school-1',
          permissions: [PERMISSIONS.ACADEMIC_READ, PERMISSIONS.MESSAGES_SEND],
        };
        const result = policyService.evaluate(
          restrictedPrincipal,
          approveLeave,
        );
        expect(result.decision).toBe('DENY');
        expect(result.reason).toContain(
          'User lacks required permissions to execute "approve_leave"',
        );
      });

      it('Correct role + required permission → ALLOW / CONFIRMATION_REQUIRED', () => {
        const teacherCtx = {
          userId: 't1',
          role: 'TEACHER',
          schoolId: 'school-1',
        };
        const createAssignment = TOOL_REGISTRY.get('create_assignment')!;
        const result = policyService.evaluate(teacherCtx, createAssignment);
        expect(result.decision).toBe('CONFIRMATION_REQUIRED');
      });

      it('Multi-permission tool requires all declared permissions to pass', () => {
        const feeDefaulter = TOOL_REGISTRY.get('automation_fee_defaulter')!;
        // User has FEES_READ_ALL but lacks MESSAGES_SEND
        const partialCtx = {
          userId: 'sa-partial',
          role: 'SCHOOL_ADMIN',
          schoolId: 'school-1',
          permissions: [PERMISSIONS.FEES_READ_ALL],
        };
        const result = policyService.evaluate(partialCtx, feeDefaulter);
        expect(result.decision).toBe('DENY');
        expect(result.reason).toContain(
          'User lacks required permissions to execute "automation_fee_defaulter"',
        );
      });
    });

    describe('Client Identity & Permission Spoofing Tests', () => {
      it('Client request cannot elevate role: server derives role and rejects unauthorized proposal', async () => {
        const teacherCtx = {
          userId: 't1',
          role: 'TEACHER',
          schoolId: 'school-1',
        };
        // Attacker attempts to inject role into arguments or body
        await expect(
          service.proposeAction(teacherCtx, 'approve_leave', {
            staffName: 'Ravi Kumar',
            role: 'SUPER_ADMIN',
          }),
        ).rejects.toThrow(BadRequestException); // rejected by input validation as unknown field
      });

      it('Fake permission spoofing: client supplies AGENT_HIGH_RISK_EXECUTE but user does not have it → DENY', () => {
        // Attacker passes permissions on context
        const spoofedCtx = {
          userId: 't1',
          role: 'TEACHER',
          schoolId: 'school-1',
          permissions: [
            PERMISSIONS.AGENT_HIGH_RISK_EXECUTE,
            PERMISSIONS.LEAVE_APPROVE,
          ],
        };
        // evaluate discards unearned permissions via intersection with ROLE_PERMISSIONS['TEACHER']
        const result = policyService.evaluate(spoofedCtx, approveLeave);
        expect(result.decision).toBe('DENY');
      });
    });

    describe('Confirmation Re-check & Revoked Access', () => {
      it('rejects confirmation if user permission was revoked between proposal and execution', async () => {
        prisma.agentAction.findUnique.mockResolvedValue({
          id: 'action-revoked',
          toolName: 'approve_leave',
          arguments: { leaveId: 'leave-1' },
          status: AgentActionStatus.AWAITING_CONFIRMATION,
          schoolId: 'school-1',
          userId: 'user-revoked',
          expiresAt: new Date(Date.now() + 60_000),
          riskLevel: 'HIGH',
        });

        // User role was demoted to TEACHER in the DB (TEACHER lacks LEAVE_APPROVE)
        prisma.user.findUnique.mockResolvedValue({
          id: 'user-revoked',
          role: 'TEACHER',
          schoolId: 'school-1',
          status: 'ACTIVE',
        });

        await expect(
          service.confirmAndExecute(
            'action-revoked',
            'user-revoked',
            'school-1',
          ),
        ).rejects.toThrow(ForbiddenException);
      });

      it('evaluateAtConfirmation re-evaluates current role and required permissions', () => {
        const currentCtx = {
          userId: 'user-1',
          role: 'TEACHER',
          schoolId: 'school-1',
        };
        const result = policyService.evaluateAtConfirmation(
          currentCtx,
          approveLeave,
        );
        expect(result.decision).toBe('DENY');
      });

      it('evaluateAtConfirmation returns ALLOW when current role and permissions are valid', () => {
        const currentCtx = {
          userId: 'user-1',
          role: 'PRINCIPAL',
          schoolId: 'school-1',
        };
        const result = policyService.evaluateAtConfirmation(
          currentCtx,
          approveLeave,
        );
        expect(result.decision).toBe('ALLOW');
      });
    });

    describe('SUPER_ADMIN Policy Pipeline', () => {
      it('SUPER_ADMIN succeeds through normal pipeline (role, permission, risk checks)', () => {
        const superAdminCtx = {
          userId: 'sa-1',
          role: 'SUPER_ADMIN',
          schoolId: 'school-1',
        };
        // For high-risk tool, SUPER_ADMIN still requires confirmation (no bypass)
        const highRiskResult = policyService.evaluate(
          superAdminCtx,
          approveLeave,
        );
        expect(highRiskResult.decision).toBe('CONFIRMATION_REQUIRED');

        // For low-risk tool, SUPER_ADMIN succeeds
        const dailyDigest = TOOL_REGISTRY.get('automation_daily_digest')!;
        const lowRiskResult = policyService.evaluate(
          superAdminCtx,
          dailyDigest,
        );
        expect(lowRiskResult.decision).toBe('ALLOW');
      });

      it('SUPER_ADMIN without schoolId on tenant-scoped tool is DENIED (no global bypass)', () => {
        const superAdminNoSchool = {
          userId: 'sa-1',
          role: 'SUPER_ADMIN',
          schoolId: '',
        };
        const result = policyService.evaluate(superAdminNoSchool, approveLeave);
        expect(result.decision).toBe('DENY');
        expect(result.reason).toContain(
          'School context is required for this action',
        );
      });
    });

    describe('High-Risk Action Enforcement', () => {
      it('High-risk action returns CONFIRMATION_REQUIRED even when all permissions are present', () => {
        const adminCtx = {
          userId: 'admin-1',
          role: 'SCHOOL_ADMIN',
          schoolId: 'school-1',
        };
        const sendAnnouncement = TOOL_REGISTRY.get('send_announcement')!;
        const result = policyService.evaluate(adminCtx, sendAnnouncement);
        expect(result.decision).toBe('CONFIRMATION_REQUIRED');
      });
    });

    describe('Negative Security Tests (Step 18)', () => {
      it('Client cannot bypass authorization by modifying tool arguments at confirmation time', async () => {
        // confirmAndExecute accepts no client argument payload — uses immutable DB args
        prisma.agentAction.findUnique.mockResolvedValue({
          id: 'action-immutable',
          toolName: 'approve_leave',
          arguments: { leaveId: 'persisted-leave-id' },
          status: AgentActionStatus.AWAITING_CONFIRMATION,
          schoolId: 'school-1',
          userId: 'user-admin',
          expiresAt: new Date(Date.now() + 60_000),
          riskLevel: 'HIGH',
        });
        prisma.user.findUnique.mockResolvedValue({
          id: 'user-admin',
          role: 'SCHOOL_ADMIN',
          schoolId: 'school-1',
          status: 'ACTIVE',
        });
        prisma.agentAction.updateMany.mockResolvedValue({ count: 1 });
        prisma.leaveRequest.updateMany.mockResolvedValue({ count: 1 });
        prisma.leaveRequest.findUnique.mockResolvedValue({
          id: 'persisted-leave-id',
          status: 'APPROVED',
          reviewedBy: 'user-admin',
          schoolId: 'school-1',
        });

        const result = await service.confirmAndExecute(
          'action-immutable',
          'user-admin',
          'school-1',
        );
        expect(result.status).toBe(AgentActionStatus.SUCCEEDED);
        // Persisted argument was executed, not any caller argument
        expect(prisma.leaveRequest.updateMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({ id: 'persisted-leave-id' }),
          }),
        );
      });

      it('Client cannot bypass tenant isolation by modifying schoolId at confirmation time', async () => {
        prisma.agentAction.findUnique.mockResolvedValue({
          id: 'action-tenant',
          toolName: 'approve_leave',
          arguments: { leaveId: 'l-1' },
          status: AgentActionStatus.AWAITING_CONFIRMATION,
          schoolId: 'school-1',
          userId: 'user-admin',
          expiresAt: new Date(Date.now() + 60_000),
        });

        await expect(
          service.confirmAndExecute(
            'action-tenant',
            'user-admin',
            'school-ATTACKER',
          ),
        ).rejects.toThrow(ForbiddenException);
      });

      it('Client cannot confirm an action directly when in terminal state (SUCCEEDED)', async () => {
        prisma.agentAction.findUnique.mockResolvedValue({
          id: 'action-already-done',
          toolName: 'approve_leave',
          status: AgentActionStatus.SUCCEEDED,
          schoolId: 'school-1',
          userId: 'user-admin',
        });

        await expect(
          service.confirmAndExecute(
            'action-already-done',
            'user-admin',
            'school-1',
          ),
        ).rejects.toThrow(BadRequestException);
      });

      it('Client cannot view status of an action belonging to another school', async () => {
        prisma.agentAction.findUnique.mockResolvedValue({
          id: 'action-foreign',
          toolName: 'approve_leave',
          status: AgentActionStatus.AWAITING_CONFIRMATION,
          schoolId: 'school-TARGET',
          userId: 'user-target',
        });

        await expect(
          service.getActionStatus(
            'action-foreign',
            'user-admin',
            'school-ATTACKER',
          ),
        ).rejects.toThrow(ForbiddenException);
      });
    });

    describe('Tool Registry Consistency Validation (Step 15)', () => {
      it('Production TOOL_REGISTRY passes consistency validation with zero errors', () => {
        const errors = validateToolRegistry(TOOL_REGISTRY);
        expect(errors).toEqual([]);
      });

      it('Every mutating tool in TOOL_REGISTRY declares requiredPermissions', () => {
        for (const [name, tool] of TOOL_REGISTRY.entries()) {
          if (tool.executionMode === 'MUTATING') {
            expect(tool.requiredPermissions.length).toBeGreaterThan(0);
          }
        }
      });

      it('Every high-risk tool in TOOL_REGISTRY requires confirmation', () => {
        for (const [name, tool] of TOOL_REGISTRY.entries()) {
          if (tool.riskLevel === 'HIGH') {
            expect(tool.requiresConfirmation).toBe(true);
          }
        }
      });

      it('Catches mutating tool with empty requiredPermissions', () => {
        const corruptRegistry = new Map<string, ToolDefinition>([
          [
            'corrupt_tool',
            {
              name: 'corrupt_tool',
              description: 'Test corrupt tool',
              category: 'HR',
              inputSchema: {},
              allowedRoles: ['PRINCIPAL'],
              requiredPermissions: [],
              riskLevel: 'LOW',
              requiresConfirmation: false,
              tenantScoped: true,
              idempotencyStrategy: 'NONE',
              executionMode: 'MUTATING',
              handlerKey: 'approve_leave' as any,
              realHandlerAvailable: true,
              expiryMinutes: 15,
            },
          ],
        ]);
        const errors = validateToolRegistry(corruptRegistry);
        expect(errors).toContain(
          'Mutating tool "corrupt_tool" must declare at least one required permission',
        );
      });

      it('Catches high-risk tool without confirmation', () => {
        const corruptRegistry = new Map<string, ToolDefinition>([
          [
            'unconfirmed_high_risk',
            {
              name: 'unconfirmed_high_risk',
              description: 'Test high risk no confirm',
              category: 'HR',
              inputSchema: {},
              allowedRoles: ['PRINCIPAL'],
              requiredPermissions: [PERMISSIONS.LEAVE_APPROVE],
              riskLevel: 'HIGH',
              requiresConfirmation: false,
              tenantScoped: true,
              idempotencyStrategy: 'NONE',
              executionMode: 'MUTATING',
              handlerKey: 'approve_leave' as any,
              realHandlerAvailable: true,
              expiryMinutes: 15,
            },
          ],
        ]);
        const errors = validateToolRegistry(corruptRegistry);
        expect(errors).toContain(
          'High-risk tool "unconfirmed_high_risk" must require confirmation',
        );
      });

      it('Catches tool with empty allowedRoles', () => {
        const corruptRegistry = new Map<string, ToolDefinition>([
          [
            'no_roles_tool',
            {
              name: 'no_roles_tool',
              description: 'Test no roles',
              category: 'HR',
              inputSchema: {},
              allowedRoles: [],
              requiredPermissions: [PERMISSIONS.LEAVE_APPROVE],
              riskLevel: 'LOW',
              requiresConfirmation: false,
              tenantScoped: true,
              idempotencyStrategy: 'NONE',
              executionMode: 'MUTATING',
              handlerKey: 'approve_leave' as any,
              realHandlerAvailable: true,
              expiryMinutes: 15,
            },
          ],
        ]);
        const errors = validateToolRegistry(corruptRegistry);
        expect(errors).toContain(
          'Tool "no_roles_tool" must declare at least one allowed role',
        );
      });

      it('Catches tool with unknown role', () => {
        const corruptRegistry = new Map<string, ToolDefinition>([
          [
            'bad_role_tool',
            {
              name: 'bad_role_tool',
              description: 'Test bad role',
              category: 'HR',
              inputSchema: {},
              allowedRoles: ['NON_EXISTENT_ROLE'],
              requiredPermissions: [PERMISSIONS.LEAVE_APPROVE],
              riskLevel: 'LOW',
              requiresConfirmation: false,
              tenantScoped: true,
              idempotencyStrategy: 'NONE',
              executionMode: 'MUTATING',
              handlerKey: 'approve_leave' as any,
              realHandlerAvailable: true,
              expiryMinutes: 15,
            },
          ],
        ]);
        const errors = validateToolRegistry(corruptRegistry);
        expect(errors).toContain(
          'Tool "bad_role_tool" specifies unknown role: "NON_EXISTENT_ROLE"',
        );
      });

      it('Catches tool with unknown permission', () => {
        const corruptRegistry = new Map<string, ToolDefinition>([
          [
            'bad_perm_tool',
            {
              name: 'bad_perm_tool',
              description: 'Test bad perm',
              category: 'HR',
              inputSchema: {},
              allowedRoles: ['PRINCIPAL'],
              requiredPermissions: ['unknown:permission:claim' as any],
              riskLevel: 'LOW',
              requiresConfirmation: false,
              tenantScoped: true,
              idempotencyStrategy: 'NONE',
              executionMode: 'MUTATING',
              handlerKey: 'approve_leave' as any,
              realHandlerAvailable: true,
              expiryMinutes: 15,
            },
          ],
        ]);
        const errors = validateToolRegistry(corruptRegistry);
        expect(errors).toContain(
          'Tool "bad_perm_tool" specifies unknown permission: "unknown:permission:claim"',
        );
      });

      it('Catches tool with duplicate permission metadata', () => {
        const corruptRegistry = new Map<string, ToolDefinition>([
          [
            'duplicate_perm_tool',
            {
              name: 'duplicate_perm_tool',
              description: 'Test duplicate perms',
              category: 'HR',
              inputSchema: {},
              allowedRoles: ['PRINCIPAL'],
              requiredPermissions: [
                PERMISSIONS.LEAVE_APPROVE,
                PERMISSIONS.LEAVE_APPROVE,
              ],
              riskLevel: 'HIGH',
              requiresConfirmation: true,
              tenantScoped: true,
              idempotencyStrategy: 'NONE',
              executionMode: 'MUTATING',
              handlerKey: 'approve_leave' as any,
              realHandlerAvailable: true,
              expiryMinutes: 15,
            },
          ],
        ]);
        const errors = validateToolRegistry(corruptRegistry);
        expect(errors).toContain(
          'Tool "duplicate_perm_tool" has duplicate permission metadata',
        );
      });

      it('Catches contradictory role/permission configuration', () => {
        // TEACHER does not have LEAVE_APPROVE in ROLE_PERMISSIONS
        const corruptRegistry = new Map<string, ToolDefinition>([
          [
            'contradictory_tool',
            {
              name: 'contradictory_tool',
              description: 'Teacher allowed but requires leave approval',
              category: 'HR',
              inputSchema: {},
              allowedRoles: ['TEACHER'],
              requiredPermissions: [PERMISSIONS.LEAVE_APPROVE],
              riskLevel: 'LOW',
              requiresConfirmation: false,
              tenantScoped: true,
              idempotencyStrategy: 'NONE',
              executionMode: 'MUTATING',
              handlerKey: 'approve_leave' as any,
              realHandlerAvailable: true,
              expiryMinutes: 15,
            },
          ],
        ]);
        const errors = validateToolRegistry(corruptRegistry);
        expect(
          errors.some((e) =>
            e.includes('lacks required permissions: leave:approve'),
          ),
        ).toBe(true);
      });
    });
  });

  // ─── Change #8G: Final Hardening & Closure Tests ─────────────────────────────
  describe('Change #8G: Final Hardening & Closure Tests', () => {
    describe('Area A2: Academic-Year Deterministic Class Resolution', () => {
      it('rejects ambiguous class resolution when multiple classes match across sessions and no explicit year is provided', async () => {
        prisma.class.findMany = jest.fn().mockResolvedValue([
          {
            id: 'class-2025',
            name: 'Class 10',
            schoolId: 'school-1',
            academicYearId: 'ay-2025',
            academicYear: { id: 'ay-2025', name: '2025-26' },
          },
          {
            id: 'class-2026',
            name: 'Class 10',
            schoolId: 'school-1',
            academicYearId: 'ay-2026',
            academicYear: { id: 'ay-2026', name: '2026-27' },
          },
        ]);
        prisma.academicYear.findMany = jest.fn().mockResolvedValue([]); // No single active year
        prisma.subject.findFirst.mockResolvedValue({
          id: 'sub-math',
          schoolId: 'school-1',
        });

        await expect(
          service.proposeAction(
            adminCtx,
            'create_assignment',
            {
              className: 'Class 10',
              subjectId: 'sub-math',
              topic: 'Trigonometry',
            },
            'test-req-1',
          ),
        ).rejects.toThrow(BadRequestException);
      });

      it('resolves exact class when explicit academicYearName is provided', async () => {
        prisma.class.findMany = jest.fn().mockResolvedValue([
          {
            id: 'class-2025',
            name: 'Class 10',
            schoolId: 'school-1',
            academicYearId: 'ay-2025',
            academicYear: { id: 'ay-2025', name: '2025-26' },
          },
          {
            id: 'class-2026',
            name: 'Class 10',
            schoolId: 'school-1',
            academicYearId: 'ay-2026',
            academicYear: { id: 'ay-2026', name: '2026-27' },
          },
        ]);
        prisma.subject.findFirst.mockResolvedValue({
          id: 'sub-math',
          schoolId: 'school-1',
        });

        const res = await service.proposeAction(
          adminCtx,
          'create_assignment',
          {
            className: 'Class 10',
            academicYearName: '2026-27',
            subjectId: 'sub-math',
            topic: 'Trigonometry',
          },
          'test-req-2',
        );

        expect(res.pendingAction).toBeDefined();
        expect(prisma.agentAction.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              arguments: expect.objectContaining({
                classId: 'class-2026',
                subjectId: 'sub-math',
              }),
            }),
          }),
        );
      });

      it('resolves exact class in active session when no year is specified and single active year exists', async () => {
        prisma.class.findMany = jest.fn().mockResolvedValue([
          {
            id: 'class-2025',
            name: 'Class 10',
            schoolId: 'school-1',
            academicYearId: 'ay-2025',
            academicYear: { id: 'ay-2025', name: '2025-26' },
          },
          {
            id: 'class-2026',
            name: 'Class 10',
            schoolId: 'school-1',
            academicYearId: 'ay-2026',
            academicYear: { id: 'ay-2026', name: '2026-27' },
          },
        ]);
        prisma.academicYear.findMany = jest.fn().mockResolvedValue([
          { id: 'ay-2026', name: '2026-27', isActive: true },
        ]);
        prisma.subject.findFirst.mockResolvedValue({
          id: 'sub-math',
          schoolId: 'school-1',
        });

        const res = await service.proposeAction(
          adminCtx,
          'create_assignment',
          {
            className: 'Class 10',
            subjectId: 'sub-math',
            topic: 'Algebra',
          },
          'test-req-3',
        );

        expect(res.pendingAction).toBeDefined();
        expect(prisma.agentAction.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              arguments: expect.objectContaining({
                classId: 'class-2026',
              }),
            }),
          }),
        );
      });
    });

    describe('Area A3: EXECUTING vs Expiration Semantics', () => {
      it('reconciles expired EXECUTING action as APPLIED and returns SUCCEEDED (never blindly expired)', async () => {
        prisma.agentAction.findUnique.mockResolvedValue({
          id: 'action-exec-1',
          userId: 'user-admin',
          schoolId: 'school-1',
          status: AgentActionStatus.EXECUTING,
          expiresAt: new Date(Date.now() - 10_000), // Stale / expired timestamp
          toolName: 'approve_leave',
          arguments: { leaveId: 'leave-1' },
          label: 'Approve leave',
          riskLevel: 'HIGH',
        });
        prisma.user.findUnique.mockResolvedValue({
          id: 'user-admin',
          role: 'SCHOOL_ADMIN',
          schoolId: 'school-1',
          status: 'ACTIVE',
        });
        (service as any).dispatcher = {
          reconcile: jest.fn().mockResolvedValue({
            status: 'APPLIED',
            result: { approved: true },
          }),
        };

        const result = await service.confirmAndExecute(
          'action-exec-1',
          'user-admin',
          'school-1',
        );

        expect(result.status).toBe(AgentActionStatus.SUCCEEDED);
        expect(result.result).toEqual({ approved: true });
        // Action was NOT marked EXPIRED
        expect(prisma.agentAction.update).not.toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({ status: AgentActionStatus.EXPIRED }),
          }),
        );
      });

      it('reconciles expired EXECUTING action as NOT_APPLIED and returns FAILED', async () => {
        prisma.agentAction.findUnique.mockResolvedValue({
          id: 'action-exec-2',
          userId: 'user-admin',
          schoolId: 'school-1',
          status: AgentActionStatus.EXECUTING,
          expiresAt: new Date(Date.now() - 10_000),
          toolName: 'approve_leave',
          arguments: { leaveId: 'leave-1' },
          label: 'Approve leave',
          riskLevel: 'HIGH',
        });
        prisma.user.findUnique.mockResolvedValue({
          id: 'user-admin',
          role: 'SCHOOL_ADMIN',
          schoolId: 'school-1',
          status: 'ACTIVE',
        });
        (service as any).dispatcher = {
          reconcile: jest.fn().mockResolvedValue({
            status: 'NOT_APPLIED',
            reason: 'Transaction cancelled downstream',
          }),
        };

        const result = await service.confirmAndExecute(
          'action-exec-2',
          'user-admin',
          'school-1',
        );

        expect(result.status).toBe(AgentActionStatus.FAILED);
        expect(result.failureReason).toBe('Transaction cancelled downstream');
      });

      it('throws ACTION_RECOVERY_REQUIRED when reconciliation outcome is UNKNOWN', async () => {
        prisma.agentAction.findUnique.mockResolvedValue({
          id: 'action-exec-3',
          userId: 'user-admin',
          schoolId: 'school-1',
          status: AgentActionStatus.EXECUTING,
          expiresAt: new Date(Date.now() - 10_000),
          toolName: 'approve_leave',
          arguments: { leaveId: 'leave-1' },
          label: 'Approve leave',
          riskLevel: 'HIGH',
        });
        prisma.user.findUnique.mockResolvedValue({
          id: 'user-admin',
          role: 'SCHOOL_ADMIN',
          schoolId: 'school-1',
          status: 'ACTIVE',
        });
        (service as any).dispatcher = {
          reconcile: jest.fn().mockResolvedValue({
            status: 'UNKNOWN',
          }),
        };

        await expect(
          service.confirmAndExecute('action-exec-3', 'user-admin', 'school-1'),
        ).rejects.toThrow(ConflictException);
      });
    });

    describe('Area A4: Live Tenant & Ownership Validation at Confirmation', () => {
      it('rejects confirmation if user moved to another school after proposal', async () => {
        prisma.agentAction.findUnique.mockResolvedValue({
          id: 'action-user-moved',
          userId: 'user-admin',
          schoolId: 'school-1',
          status: AgentActionStatus.AWAITING_CONFIRMATION,
          expiresAt: new Date(Date.now() + 60_000),
          toolName: 'approve_leave',
          arguments: { leaveId: 'leave-1' },
          label: 'Approve leave',
          riskLevel: 'HIGH',
        });
        // User's DB record currently belongs to school-2 (transferred/moved)
        prisma.user.findUnique.mockResolvedValue({
          id: 'user-admin',
          role: 'SCHOOL_ADMIN',
          schoolId: 'school-2',
          status: 'ACTIVE',
        });

        await expect(
          service.confirmAndExecute(
            'action-user-moved',
            'user-admin',
            'school-1',
          ),
        ).rejects.toThrow(ForbiddenException);
      });

      it('rejects confirmation if user became INACTIVE after proposal', async () => {
        prisma.agentAction.findUnique.mockResolvedValue({
          id: 'action-user-inactive',
          userId: 'user-admin',
          schoolId: 'school-1',
          status: AgentActionStatus.AWAITING_CONFIRMATION,
          expiresAt: new Date(Date.now() + 60_000),
          toolName: 'approve_leave',
          arguments: { leaveId: 'leave-1' },
          label: 'Approve leave',
          riskLevel: 'HIGH',
        });
        prisma.user.findUnique.mockResolvedValue({
          id: 'user-admin',
          role: 'SCHOOL_ADMIN',
          schoolId: 'school-1',
          status: 'INACTIVE',
        });

        await expect(
          service.confirmAndExecute(
            'action-user-inactive',
            'user-admin',
            'school-1',
          ),
        ).rejects.toThrow(ForbiddenException);
      });

      it('rejects SUPER_ADMIN when requested target school mismatches action school', async () => {
        prisma.agentAction.findUnique.mockResolvedValue({
          id: 'action-super-target',
          userId: 'user-super',
          schoolId: 'school-1',
          status: AgentActionStatus.AWAITING_CONFIRMATION,
          expiresAt: new Date(Date.now() + 60_000),
          toolName: 'approve_leave',
          arguments: { leaveId: 'leave-1' },
          label: 'Approve leave',
          riskLevel: 'HIGH',
        });
        prisma.user.findUnique.mockResolvedValue({
          id: 'user-super',
          role: 'SUPER_ADMIN',
          schoolId: 'school-global',
          status: 'ACTIVE',
        });

        await expect(
          service.confirmAndExecute(
            'action-super-target',
            'user-super',
            'school-2', // Mismatched target
          ),
        ).rejects.toThrow(ForbiddenException);
      });
    });
  });
});
