import {
  AutomationFeeDefaulterHandler,
  AutomationAbsenceAlertHandler,
  AutomationAttendanceWarningHandler,
} from './automation-message.handler';
import { MessagesService } from '../../../messages/messages.service';
import {
  ToolHandlerKey,
  AgentToolExecutionContext,
  AGENT_ERRORS,
} from '../agent-types';

describe('BaseAutomationMessageHandler & Subclasses', () => {
  let feeHandler: AutomationFeeDefaulterHandler;
  let absenceHandler: AutomationAbsenceAlertHandler;
  let warningHandler: AutomationAttendanceWarningHandler;
  let messagesService: { [K in keyof MessagesService]?: jest.Mock };

  const mockContext: AgentToolExecutionContext = {
    userId: 'user-admin',
    schoolId: 'school-1',
    role: 'SCHOOL_ADMIN',
    actionId: 'action-auto-1',
  };

  beforeEach(() => {
    messagesService = {
      sendBatchMessages: jest.fn().mockResolvedValue({
        sentCount: 3,
        recipientIds: ['rec-1', 'rec-2', 'rec-3'],
      }),
      verifyBatchMessages: jest.fn().mockResolvedValue({
        verified: true,
        sentCount: 3,
      }),
    };

    const ms = messagesService as unknown as MessagesService;
    feeHandler = new AutomationFeeDefaulterHandler(ms);
    absenceHandler = new AutomationAbsenceAlertHandler(ms);
    warningHandler = new AutomationAttendanceWarningHandler(ms);
  });

  it('declares correct keys for each automation subclass', () => {
    expect(feeHandler.key).toBe(ToolHandlerKey.AUTOMATION_FEE_DEFAULTER);
    expect(absenceHandler.key).toBe(ToolHandlerKey.AUTOMATION_ABSENCE_ALERT);
    expect(warningHandler.key).toBe(
      ToolHandlerKey.AUTOMATION_ATTENDANCE_WARNING,
    );
  });

  it('delegates batch message sending to MessagesService.sendBatchMessages', async () => {
    const args = {
      subject: 'Fee Reminder',
      items: [
        { recipientId: 'rec-1', draftMessage: 'Please pay pending fees.' },
        { recipientId: 'rec-2', draftMessage: 'Please pay pending fees.' },
        { recipientId: 'rec-3', draftMessage: 'Please pay pending fees.' },
      ],
    };

    const result = await feeHandler.execute(mockContext, args);

    expect(messagesService.sendBatchMessages).toHaveBeenCalledWith({
      schoolId: 'school-1',
      senderId: 'user-admin',
      subject: 'Fee Reminder',
      messages: [
        {
          recipientId: 'rec-1',
          draftMessage: 'Please pay pending fees.',
          subject: 'Fee Reminder',
        },
        {
          recipientId: 'rec-2',
          draftMessage: 'Please pay pending fees.',
          subject: 'Fee Reminder',
        },
        {
          recipientId: 'rec-3',
          draftMessage: 'Please pay pending fees.',
          subject: 'Fee Reminder',
        },
      ],
    });

    expect(result).toEqual({
      resourceType: 'MessageBatch',
      status: 'SENT',
      affectedCount: 3,
      actionsCount: 3,
      recipientIds: ['rec-1', 'rec-2', 'rec-3'],
    });
  });

  it('verification succeeds when batch messages exist in database', async () => {
    const args = {
      subject: 'Fee Reminder',
      items: [{ recipientId: 'rec-1', draftMessage: 'Msg' }],
    };

    await expect(
      feeHandler.verify(mockContext, args, {
        status: 'SENT',
        affectedCount: 1,
      }),
    ).resolves.toBeUndefined();

    expect(messagesService.verifyBatchMessages).toHaveBeenCalledWith(
      'school-1',
      'user-admin',
      ['rec-1'],
      'Fee Reminder',
    );
  });

  it('verification throws ACTION_VERIFICATION_FAILED when MessagesService verification fails', async () => {
    messagesService.verifyBatchMessages!.mockResolvedValue({
      verified: false,
      sentCount: 0,
    });

    const args = {
      subject: 'Fee Reminder',
      items: [{ recipientId: 'rec-1', draftMessage: 'Msg' }],
    };

    await expect(
      feeHandler.verify(mockContext, args, {
        status: 'SENT',
        affectedCount: 1,
      }),
    ).rejects.toThrow(AGENT_ERRORS.ACTION_VERIFICATION_FAILED);
  });

  it('reconciles as APPLIED when batch messages exist in database', async () => {
    const args = {
      subject: 'Fee Reminder',
      items: [{ recipientId: 'rec-1', draftMessage: 'Msg' }],
    };

    const rec = await feeHandler.reconcile(mockContext, args);

    expect(rec.status).toBe('APPLIED');
    expect(rec.result).toEqual({
      resourceType: 'MessageBatch',
      status: 'SENT',
      affectedCount: 3,
      actionsCount: 3,
    });
  });

  it('reconciles as NOT_APPLIED when batch messages do not exist', async () => {
    messagesService.verifyBatchMessages!.mockResolvedValue({
      verified: false,
      sentCount: 0,
    });

    const args = {
      subject: 'Fee Reminder',
      items: [{ recipientId: 'rec-1', draftMessage: 'Msg' }],
    };

    const rec = await feeHandler.reconcile(mockContext, args);

    expect(rec.status).toBe('NOT_APPLIED');
    expect(rec.reason).toBeDefined();
  });
});
