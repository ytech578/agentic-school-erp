import { SendAnnouncementAgentHandler } from './send-announcement.handler';
import { MessagesService } from '../../../messages/messages.service';
import { PrismaService } from '../../../../core/database/prisma.service';
import { ToolHandlerKey, AgentToolExecutionContext } from '../agent-types';

describe('SendAnnouncementAgentHandler', () => {
  let handler: SendAnnouncementAgentHandler;
  let messagesService: jest.Mocked<Partial<MessagesService>>;
  let prisma: any;

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

    prisma = {
      message: {
        findFirst: jest.fn(),
      },
    };

    handler = new SendAnnouncementAgentHandler(
      messagesService as unknown as MessagesService,
      prisma as unknown as PrismaService,
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

  it('reconciles as APPLIED when broadcast message exists', async () => {
    prisma.message.findFirst.mockResolvedValue({
      id: 'msg-1',
      subject: 'School Sports Day',
      schoolId: 'school-1',
    });

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
    prisma.message.findFirst.mockResolvedValue(null);

    const rec = await handler.reconcile(mockContext, {
      title: 'School Sports Day',
    });

    expect(rec.status).toBe('NOT_APPLIED');
    expect(rec.reason).toBeDefined();
  });
});

