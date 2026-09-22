import { Test, TestingModule } from '@nestjs/testing';
import * as fs from 'fs';
import * as path from 'path';
import { AgentControlPlaneService } from './agent-control-plane.service';
import { AgentPolicyService } from './agent-policy.service';
import { AgentToolDispatcher } from './agent-tool-dispatcher';
import { PrismaService } from '../../../core/database/prisma.service';
import { AgentActionStatus } from '@prisma/client';
import { AGENT_ERRORS, ToolHandlerKey } from './agent-types';
import { TOOL_REGISTRY, validateToolRegistry } from './tool-registry';
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
} from './handlers';

describe('Change #8C — Agent Architecture & Decoupling Enforcement', () => {
  let controlPlane: AgentControlPlaneService;
  let dispatcher: AgentToolDispatcher;
  let mockPrisma: any;

  beforeEach(async () => {
    mockPrisma = {
      agentAction: {
        findUnique: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockResolvedValue({}),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'user-admin',
          role: 'SCHOOL_ADMIN',
          schoolId: 'school-1',
          status: 'ACTIVE',
        }),
      },
      activityLog: {
        create: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn().mockImplementation(async (cb) => cb(mockPrisma)),
    };

    dispatcher = new AgentToolDispatcher();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentControlPlaneService,
        AgentPolicyService,
        { provide: AgentToolDispatcher, useValue: dispatcher },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    controlPlane = module.get<AgentControlPlaneService>(
      AgentControlPlaneService,
    );
  });

  describe('Control Plane Decoupling & Purity (Step 14 & 15)', () => {
    it('does NOT contain private or public domain mutation methods (domain*)', () => {
      const prototype = Object.getOwnPropertyNames(
        AgentControlPlaneService.prototype,
      );
      const domainMethods = prototype.filter((name) =>
        name.startsWith('domain'),
      );

      expect(domainMethods).toHaveLength(0);
      expect(prototype).not.toContain('domainApproveLeave');
      expect(prototype).not.toContain('domainCreateAssignment');
      expect(prototype).not.toContain('domainSendAnnouncement');
      expect(prototype).not.toContain('domainAutomationMessages');
      expect(prototype).not.toContain('domainAutomationTimetableCover');
    });

    it('does NOT contain dispatch switch statements in source code', () => {
      const filePath = path.join(__dirname, 'agent-control-plane.service.ts');
      const source = fs.readFileSync(filePath, 'utf-8');

      // Ensure no dispatch switch statement on tools or handlers exists in control plane
      expect(source).not.toMatch(
        /\bswitch\s*\([^)]*(tool\.handlerKey|tool\.name|action\.toolName|toolKey|handlerKey)/i,
      );
      // Ensure no dispatchToHandler method exists
      const prototype = Object.getOwnPropertyNames(
        AgentControlPlaneService.prototype,
      );
      expect(prototype).not.toContain('dispatchToHandler');
    });

    it('delegates execution and verification to AgentToolDispatcher in confirmAndExecute', async () => {
      const dispatchSpy = jest.spyOn(dispatcher, 'dispatch').mockResolvedValue({
        resourceId: 'res-1',
        status: 'SUCCESS',
      });
      const verifySpy = jest
        .spyOn(dispatcher, 'verify')
        .mockResolvedValue(undefined);

      mockPrisma.agentAction.findUnique.mockResolvedValue({
        id: 'action-test',
        userId: 'user-admin',
        schoolId: 'school-1',
        status: AgentActionStatus.AWAITING_CONFIRMATION,
        expiresAt: new Date(Date.now() + 60_000),
        toolName: 'approve_leave',
        arguments: { leaveId: 'leave-1' },
        label: 'Approve leave',
        riskLevel: 'HIGH',
      });

      const result = await controlPlane.confirmAndExecute(
        'action-test',
        'user-admin',
        'school-1',
      );

      expect(result.status).toBe(AgentActionStatus.SUCCEEDED);
      expect(dispatchSpy).toHaveBeenCalledWith(
        ToolHandlerKey.APPROVE_LEAVE,
        expect.objectContaining({
          userId: 'user-admin',
          schoolId: 'school-1',
          role: 'SCHOOL_ADMIN',
        }),
        { leaveId: 'leave-1' },
      );
      expect(verifySpy).toHaveBeenCalledWith(
        ToolHandlerKey.APPROVE_LEAVE,
        expect.objectContaining({
          userId: 'user-admin',
          schoolId: 'school-1',
        }),
        { leaveId: 'leave-1' },
        { resourceId: 'res-1', status: 'SUCCESS' },
      );
    });

    it('future tools can be added and executed without modifying AgentControlPlaneService', async () => {
      const customKey = 'custom_future_tool' as ToolHandlerKey;
      const customHandler = {
        key: customKey,
        execute: jest
          .fn()
          .mockResolvedValue({ resourceId: 'future-1', status: 'DONE' }),
        verify: jest.fn().mockResolvedValue(undefined),
      };

      dispatcher.register(customHandler);

      expect(dispatcher.hasHandler(customKey)).toBe(true);
      const execResult = await dispatcher.dispatch(
        customKey,
        { userId: 'u1', schoolId: 's1', role: 'ADMIN' },
        { param: 'val' },
      );
      expect(execResult).toEqual({ resourceId: 'future-1', status: 'DONE' });
      expect(customHandler.execute).toHaveBeenCalledWith(
        { userId: 'u1', schoolId: 's1', role: 'ADMIN' },
        { param: 'val' },
      );
    });
  });

  describe('Dispatcher & Handler Parity (Step 13 & 15)', () => {
    it('every tool marked realHandlerAvailable=true in TOOL_REGISTRY has an active registered handler', () => {
      const mockHR = {} as any;
      const mockAssignments = {} as any;
      const mockMessages = {} as any;
      const mockTimetable = {} as any;
      const mockExams = {} as any;

      const handlers = [
        new ApproveLeaveAgentHandler(mockHR),
        new CreateAssignmentAgentHandler(mockAssignments),
        new SendAnnouncementAgentHandler(mockMessages),
        new AutomationFeeDefaulterHandler(mockMessages),
        new AutomationAbsenceAlertHandler(mockMessages),
        new AutomationAttendanceWarningHandler(mockMessages),
        new AutomationTimetableCoverHandler(mockTimetable),
        new AutomationLeaveRecommendationHandler(mockHR),
        new AutomationReportCardPublishHandler(mockExams),
        new AutomationDailyDigestHandler(mockMessages),
      ];

      const fullDispatcher = new AgentToolDispatcher(handlers);
      const errors = fullDispatcher.validateAgainstRegistry(TOOL_REGISTRY);

      expect(errors).toHaveLength(0);

      // Validate registry consistency with dispatcher keys
      const registryErrors = validateToolRegistry(
        TOOL_REGISTRY,
        fullDispatcher.getRegisteredKeys(),
      );
      expect(registryErrors).toHaveLength(0);
    });

    it('detects missing handlers when registry claims realHandlerAvailable=true', () => {
      const emptyDispatcher = new AgentToolDispatcher([]);
      const errors = emptyDispatcher.validateAgainstRegistry(TOOL_REGISTRY);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.includes('approve_leave'))).toBe(true);
    });
  });

  describe('Zero Direct Prisma Business Mutations in Handlers (Step 2, 3, 10, 15)', () => {
    const handlerFiles = [
      'approve-leave.handler.ts',
      'create-assignment.handler.ts',
      'send-announcement.handler.ts',
      'automation-message.handler.ts',
      'automation-timetable-cover.handler.ts',
      'automation-leave-recommendation.handler.ts',
      'automation-report-card-publish.handler.ts',
      'automation-daily-digest.handler.ts',
    ];

    it.each(handlerFiles)(
      'handler %s does not inject PrismaService or perform direct Prisma mutations',
      (filename) => {
        const handlerPath = path.join(__dirname, 'handlers', filename);
        const source = fs.readFileSync(handlerPath, 'utf-8');

        // Handlers must not import PrismaService
        expect(source).not.toContain('PrismaService');

        // Handlers must not call direct Prisma mutations
        expect(source).not.toMatch(/this\.prisma\./);
        expect(source).not.toMatch(/\.createMany\s*\(/);
        expect(source).not.toMatch(/\.create\s*\(/);
        expect(source).not.toMatch(/\.updateMany\s*\(/);
        expect(source).not.toMatch(/\.update\s*\(/);
        expect(source).not.toMatch(/\.deleteMany\s*\(/);
        expect(source).not.toMatch(/\.delete\s*\(/);
      },
    );
  });
});
