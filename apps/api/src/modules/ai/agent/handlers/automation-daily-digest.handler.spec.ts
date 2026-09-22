import { AutomationDailyDigestHandler } from './automation-daily-digest.handler';
import { MessagesService } from '../../../messages/messages.service';
import {
  ToolHandlerKey,
  AgentToolExecutionContext,
  AGENT_ERRORS,
} from '../agent-types';

describe('AutomationDailyDigestHandler', () => {
  let handler: AutomationDailyDigestHandler;
  let messagesService: jest.Mocked<Partial<MessagesService>>;

  const mockContext: AgentToolExecutionContext = {
    userId: 'user-admin',
    schoolId: 'school-1',
    role: 'SCHOOL_ADMIN',
    actionId: 'action-digest-1',
  };

  beforeEach(() => {
    messagesService = {
      sendDailyDigest: jest.fn().mockResolvedValue({
        sent: true,
        messageId: 'digest-msg-1',
        recipientId: 'principal-1',
      }),
      verifyAnnouncement: jest.fn().mockResolvedValue({
        verified: true,
        messageCount: 1,
      }),
      findAnnouncement: jest.fn().mockResolvedValue({
        id: 'digest-msg-1',
        subject: 'Daily Operations Digest',
        schoolId: 'school-1',
        senderId: 'user-admin',
      }),
    };

    handler = new AutomationDailyDigestHandler(
      messagesService as unknown as MessagesService,
    );
  });

  it('declares correct key: automation_daily_digest', () => {
    expect(handler.key).toBe(ToolHandlerKey.AUTOMATION_DAILY_DIGEST);
  });

  it('delegates sending daily digest to MessagesService.sendDailyDigest', async () => {
    const args = {
      subject: 'Daily Operations Digest',
      items: [{ draftMessage: 'All systems operating normally today.' }],
    };

    const result = await handler.execute(mockContext, args);

    expect(messagesService.sendDailyDigest).toHaveBeenCalledWith({
      schoolId: 'school-1',
      senderId: 'user-admin',
      body: 'All systems operating normally today.',
      subject: 'Daily Operations Digest',
    });

    expect(result).toEqual({
      resourceId: 'digest-msg-1',
      resourceType: 'DailyDigest',
      status: 'SENT',
      affectedCount: 1,
      actionsCount: 1,
    });
  });

  it('skips sending when draft message is empty', async () => {
    const args = {
      items: [{ draftMessage: '' }],
    };

    const result = await handler.execute(mockContext, args);

    expect(messagesService.sendDailyDigest).not.toHaveBeenCalled();
    expect(result).toEqual({
      resourceType: 'DailyDigest',
      status: 'SKIPPED',
      affectedCount: 0,
      actionsCount: 0,
    });
  });

  it('verification succeeds when digest message is verified in database', async () => {
    const args = {
      subject: 'Daily Operations Digest',
      items: [{ draftMessage: 'Operations report' }],
    };

    await expect(
      handler.verify(mockContext, args, { status: 'SENT' }),
    ).resolves.toBeUndefined();

    expect(messagesService.verifyAnnouncement).toHaveBeenCalledWith(
      'school-1',
      'user-admin',
      'Daily Operations Digest',
      1,
    );
  });

  it('verification throws ACTION_VERIFICATION_FAILED when digest message verification fails', async () => {
    messagesService.verifyAnnouncement!.mockResolvedValue({
      verified: false,
      messageCount: 0,
    });

    const args = {
      subject: 'Daily Operations Digest',
      items: [{ draftMessage: 'Operations report' }],
    };

    await expect(
      handler.verify(mockContext, args, { status: 'SENT' }),
    ).rejects.toThrow(AGENT_ERRORS.ACTION_VERIFICATION_FAILED);
  });

  it('reconciles as APPLIED when digest message exists', async () => {
    const args = {
      subject: 'Daily Operations Digest',
      items: [{ draftMessage: 'Operations report' }],
    };

    const rec = await handler.reconcile(mockContext, args);

    expect(rec.status).toBe('APPLIED');
    expect(rec.result).toEqual({
      resourceType: 'DailyDigest',
      status: 'SENT',
      affectedCount: 1,
      actionsCount: 1,
    });
  });

  it('reconciles as UNKNOWN when digest message does not exist', async () => {
    messagesService.findAnnouncement!.mockResolvedValue(null);

    const args = {
      subject: 'Daily Operations Digest',
      items: [{ draftMessage: 'Operations report' }],
    };

    const rec = await handler.reconcile(mockContext, args);

    expect(rec.status).toBe('UNKNOWN');
  });
});
