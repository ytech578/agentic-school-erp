import { Test, TestingModule } from '@nestjs/testing';
import { AgentControlPlaneService } from './agent-control-plane.service';
import { AgentPolicyService } from './agent-policy.service';
import { AgentToolDispatcher } from './agent-tool-dispatcher';
import { PrismaService } from '../../../core/database/prisma.service';
import { AgentActionStatus } from '@prisma/client';
import { AGENT_ERRORS, ToolHandlerKey } from './agent-types';

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

    controlPlane = module.get<AgentControlPlaneService>(AgentControlPlaneService);
  });

  describe('Control Plane Decoupling & Purity', () => {
    it('does NOT contain private or public domain mutation methods (domain*)', () => {
      const prototype = Object.getOwnPropertyNames(AgentControlPlaneService.prototype);
      const domainMethods = prototype.filter((name) => name.startsWith('domain'));

      expect(domainMethods).toHaveLength(0);
      expect(prototype).not.toContain('domainApproveLeave');
      expect(prototype).not.toContain('domainCreateAssignment');
      expect(prototype).not.toContain('domainSendAnnouncement');
      expect(prototype).not.toContain('domainAutomationMessages');
      expect(prototype).not.toContain('domainAutomationTimetableCover');
    });

    it('does NOT contain dispatchToHandler switch method', () => {
      const prototype = Object.getOwnPropertyNames(AgentControlPlaneService.prototype);
      expect(prototype).not.toContain('dispatchToHandler');
    });

    it('delegates execution and verification to AgentToolDispatcher in confirmAndExecute', async () => {
      const dispatchSpy = jest.spyOn(dispatcher, 'dispatch').mockResolvedValue({
        resourceId: 'res-1',
        status: 'SUCCESS',
      });
      const verifySpy = jest.spyOn(dispatcher, 'verify').mockResolvedValue(undefined);

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
        execute: jest.fn().mockResolvedValue({ resourceId: 'future-1', status: 'DONE' }),
        verify: jest.fn().mockResolvedValue(undefined),
      };

      // Register without touching AgentControlPlaneService
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
});
