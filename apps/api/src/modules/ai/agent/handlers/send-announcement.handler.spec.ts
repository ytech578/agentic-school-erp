import { SendAnnouncementAgentHandler } from './send-announcement.handler';
import { MessagesService } from '../../../messages/messages.service';
import { ToolHandlerKey, AgentToolExecutionContext } from '../agent-types';

describe('SendAnnouncementAgentHandler', () => {
  let handler: SendAnnouncementAgentHandler;
  let messagesService: jest.Mocked<Partial<MessagesService>>;

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

  it('verification completes without error', async () => {
    await expect(
      handler.verify(
        mockContext,
        { title: 'Test' },
        { status: 'SENT', sentCount: 10 },
      ),
    ).resolves.toBeUndefined();
  });
});
