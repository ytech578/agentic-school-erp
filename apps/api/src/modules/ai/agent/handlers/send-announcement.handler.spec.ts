import { SendAnnouncementAgentHandler } from './send-announcement.handler';
import { MessagesService } from '../../../messages/messages.service';
import {
  ToolHandlerKey,
  AgentToolExecutionContext,
  AGENT_ERRORS,
} from '../agent-types';

describe('SendAnnouncementAgentHandler', () => {
  let handler: SendAnnouncementAgentHandler;
  let messagesService: { [K in keyof MessagesService]?: jest.Mock };

  const mockContext: AgentToolExecutionContext = {
    userId: 'user-admin',
    schoolId: 'school-1',
    role: 'SCHOOL_ADMIN',
    actionId: 'action-3',
  };

  beforeEach(() => {
    messagesService = {
      broadcastAnnouncement: jest.fn().mockResolvedValue({
        success: true,
        sent: 25,
      }),
      verifyAnnouncement: jest.fn().mockResolvedValue({
        verified: true,
        messageCount: 25,
      }),
      findAnnouncement: jest.fn().mockResolvedValue({
        id: 'msg-1',
        subject: 'School Sports Day',
        schoolId: 'school-1',
        senderId: 'user-admin',
      }),
    };

    handler = new SendAnnouncementAgentHandler(
      messagesService as unknown as MessagesService,
    );
  });

  it('declares correct key: send_announcement', () => {
    expect(handler.key).toBe(ToolHandlerKey.SEND_ANNOUNCEMENT);
  });

  it('delegates to MessagesService.broadcastAnnouncement with server-authoritative school and sender', async () => {
    const args = {
      title: 'School Sports Day',
      message: 'Events commence at 9 AM tomorrow.',
    };

    const result = await handler.execute(mockContext, args);

    expect(messagesService.broadcastAnnouncement).toHaveBeenCalledWith({
      schoolId: 'school-1',
      senderId: 'user-admin',
      subject: 'School Sports Day',
      body: 'Events commence at 9 AM tomorrow.',
    });

    expect(result).toEqual({
      resourceType: 'Announcement',
      status: 'SENT',
      affectedCount: 25,
      sentCount: 25,
    });
  });

  it('verification succeeds when messages exist in database', async () => {
    await expect(
      handler.verify(
        mockContext,
        { title: 'School Sports Day' },
        { status: 'SENT', sentCount: 25 },
      ),
    ).resolves.toBeUndefined();

    expect(messagesService.verifyAnnouncement).toHaveBeenCalledWith(
      'school-1',
      'user-admin',
      'School Sports Day',
      25,
    );
  });

  it('verification throws ACTION_VERIFICATION_FAILED when sentCount is 0 (Step 8)', async () => {
    await expect(
      handler.verify(
        mockContext,
        { title: 'Empty Audience' },
        { status: 'SENT', sentCount: 0 },
      ),
    ).rejects.toThrow(AGENT_ERRORS.ACTION_VERIFICATION_FAILED);

    expect(messagesService.verifyAnnouncement).not.toHaveBeenCalled();
  });

  it('verification throws ACTION_VERIFICATION_FAILED when domain message count does not match', async () => {
    messagesService.verifyAnnouncement!.mockResolvedValue({
      verified: false,
      messageCount: 0,
    });

    await expect(
      handler.verify(
        mockContext,
        { title: 'School Sports Day' },
        { status: 'SENT', sentCount: 25 },
      ),
    ).rejects.toThrow(AGENT_ERRORS.ACTION_VERIFICATION_FAILED);
  });

  it('reconciles as APPLIED when broadcast message exists', async () => {
    const rec = await handler.reconcile(mockContext, {
      title: 'School Sports Day',
    });

    expect(rec.status).toBe('APPLIED');
    expect(rec.result).toEqual({
      resourceType: 'Announcement',
      status: 'SENT',
      affectedCount: 1,
      sentCount: 1,
    });
  });

  it('reconciles as NOT_APPLIED when broadcast message does not exist', async () => {
    messagesService.findAnnouncement!.mockResolvedValue(null);

    const rec = await handler.reconcile(mockContext, {
      title: 'School Sports Day',
    });

    expect(rec.status).toBe('NOT_APPLIED');
    expect(rec.reason).toBeDefined();
  });
});
