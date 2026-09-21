import { NotFoundException } from '@nestjs/common';
import { AgentToolDispatcher } from './agent-tool-dispatcher';
import {
  ToolHandlerKey,
  AgentToolExecutionContext,
  AGENT_ERRORS,
} from './agent-types';
import { AgentToolHandler } from './handlers/agent-tool-handler.interface';

describe('AgentToolDispatcher', () => {
  let dispatcher: AgentToolDispatcher;

  const mockContext: AgentToolExecutionContext = {
    userId: 'user-123',
    schoolId: 'school-456',
    role: 'SCHOOL_ADMIN',
    actionId: 'action-789',
  };

  const mockHandler: AgentToolHandler = {
    key: ToolHandlerKey.APPROVE_LEAVE,
    execute: jest.fn().mockResolvedValue({
      resourceId: 'leave-1',
      resourceType: 'LeaveRequest',
      status: 'APPROVED',
    }),
    verify: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    dispatcher = new AgentToolDispatcher([mockHandler]);
  });

  describe('registration', () => {
    it('initializes with injected handlers', () => {
      expect(dispatcher.hasHandler(ToolHandlerKey.APPROVE_LEAVE)).toBe(true);
      expect(dispatcher.getHandler(ToolHandlerKey.APPROVE_LEAVE)).toBe(mockHandler);
    });

    it('allows registering a new handler dynamically', () => {
      const dynamicHandler: AgentToolHandler = {
        key: ToolHandlerKey.CREATE_ASSIGNMENT,
        execute: jest.fn(),
      };
      dispatcher.register(dynamicHandler);
      expect(dispatcher.hasHandler(ToolHandlerKey.CREATE_ASSIGNMENT)).toBe(true);
    });

    it('throws error when registering handler with duplicate key', () => {
      expect(() => dispatcher.register(mockHandler)).toThrow(
        'Handler already registered for key: approve_leave',
      );
    });

    it('throws error when registering an invalid handler without key', () => {
      expect(() => dispatcher.register({} as any)).toThrow(
        'Invalid handler registration: handler and handler.key are required',
      );
    });
  });

  describe('dispatch', () => {
    it('resolves and executes known registered handler', async () => {
      const args = { leaveId: 'leave-1', reason: 'Medical' };
      const result = await dispatcher.dispatch(
        ToolHandlerKey.APPROVE_LEAVE,
        mockContext,
        args,
      );

      expect(mockHandler.execute).toHaveBeenCalledWith(mockContext, args);
      expect(result).toEqual({
        resourceId: 'leave-1',
        resourceType: 'LeaveRequest',
        status: 'APPROVED',
      });
    });

    it('throws NotFoundException with ACTION_HANDLER_NOT_FOUND for unregistered key', async () => {
      await expect(
        dispatcher.dispatch(
          'non_existent_key' as any,
          mockContext,
          {},
        ),
      ).rejects.toThrow(NotFoundException);

      await expect(
        dispatcher.dispatch(
          'non_existent_key' as any,
          mockContext,
          {},
        ),
      ).rejects.toThrow(
        expect.objectContaining({
          message: expect.stringContaining(
            AGENT_ERRORS.ACTION_HANDLER_NOT_FOUND,
          ),
        }),
      );
    });

    it('propagates handler exceptions without swallowing or converting to generic success', async () => {
      const failingHandler: AgentToolHandler = {
        key: ToolHandlerKey.SEND_ANNOUNCEMENT,
        execute: jest.fn().mockRejectedValue(new Error('Domain network failure')),
      };
      dispatcher.register(failingHandler);

      await expect(
        dispatcher.dispatch(
          ToolHandlerKey.SEND_ANNOUNCEMENT,
          mockContext,
          { title: 'Test' },
        ),
      ).rejects.toThrow('Domain network failure');
    });
  });

  describe('verify', () => {
    it('invokes handler verify method when present', async () => {
      const args = { leaveId: 'leave-1' };
      const result = { resourceId: 'leave-1', status: 'APPROVED' };

      await dispatcher.verify(
        ToolHandlerKey.APPROVE_LEAVE,
        mockContext,
        args,
        result,
      );

      expect(mockHandler.verify).toHaveBeenCalledWith(
        mockContext,
        args,
        result,
      );
    });

    it('succeeds cleanly when handler does not define verify', async () => {
      const handlerWithoutVerify: AgentToolHandler = {
        key: ToolHandlerKey.CREATE_ASSIGNMENT,
        execute: jest.fn().mockResolvedValue({ status: 'CREATED' }),
      };
      dispatcher.register(handlerWithoutVerify);

      await expect(
        dispatcher.verify(
          ToolHandlerKey.CREATE_ASSIGNMENT,
          mockContext,
          {},
          {},
        ),
      ).resolves.toBeUndefined();
    });

    it('throws NotFoundException when verifying an unknown handler', async () => {
      await expect(
        dispatcher.verify(
          'unknown_key' as any,
          mockContext,
          {},
          {},
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
