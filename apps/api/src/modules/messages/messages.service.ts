import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { requireSchoolId } from '../../core/tenant/tenant.util';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class MessagesService {
  constructor(
    private prisma: PrismaService,
    @Optional() private notificationsService?: NotificationsService,
  ) {}

  async getInbox(userId: string, schoolId: string) {
    const validSchoolId = requireSchoolId(schoolId);
    const messages = await this.prisma.message.findMany({
      where: { recipientId: userId, schoolId: validSchoolId, parentId: null },
      include: {
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
            avatarUrl: true,
          },
        },
        replies: {
          include: {
            sender: {
              select: { id: true, firstName: true, lastName: true, role: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return messages;
  }

  async getSent(userId: string, schoolId: string) {
    const validSchoolId = requireSchoolId(schoolId);
    const rawMessages = await this.prisma.message.findMany({
      where: { senderId: userId, schoolId: validSchoolId, parentId: null },
      include: {
        replies: { select: { id: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const uniqueMap = new Map();
    for (const msg of rawMessages) {
      const dateKey = msg.createdAt.toISOString().slice(0, 13);
      const key = `${dateKey}_${msg.subject}_${msg.body}`;

      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, { ...msg, recipientCount: 1 });
      } else {
        uniqueMap.get(key).recipientCount++;
      }
    }

    return Array.from(uniqueMap.values()).map((msg) => {
      if (msg.recipientCount > 1) {
        return {
          ...msg,
          recipientId: 'Everyone',
        };
      }
      return msg;
    });
  }

  async sendMessage(data: {
    schoolId: string;
    senderId: string;
    recipientId: string;
    subject?: string;
    body: string;
    parentId?: string;
  }) {
    const validSchoolId = requireSchoolId(data.schoolId);

    // Validate that recipient belongs to this school
    const recipient = await this.prisma.user.findFirst({
      where: { id: data.recipientId, schoolId: validSchoolId },
    });
    if (!recipient) {
      throw new NotFoundException('Recipient not found');
    }

    // Validate parent message belongs to this school if provided
    if (data.parentId) {
      const parent = await this.prisma.message.findFirst({
        where: { id: data.parentId, schoolId: validSchoolId },
      });
      if (!parent) {
        throw new NotFoundException('Parent message not found');
      }
    }

    return this.prisma.message.create({
      data: {
        schoolId: validSchoolId,
        senderId: data.senderId,
        recipientId: data.recipientId,
        subject: data.subject,
        body: data.body,
        parentId: data.parentId,
      },
      include: {
        sender: {
          select: { id: true, firstName: true, lastName: true, role: true },
        },
      },
    });
  }

  async markAsRead(messageId: string, userId: string) {
    const message = await this.prisma.message.findFirst({
      where: { id: messageId, recipientId: userId },
    });
    if (!message) throw new NotFoundException('Message not found');
    return this.prisma.message.update({
      where: { id: message.id },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async markAllRead(userId: string) {
    return this.prisma.message.updateMany({
      where: { recipientId: userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async getUnreadCount(userId: string) {
    const count = await this.prisma.message.count({
      where: { recipientId: userId, isRead: false },
    });
    return { count };
  }

  async deleteMessage(messageId: string, userId: string) {
    const message = await this.prisma.message.findFirst({
      where: { id: messageId },
    });
    if (!message) throw new NotFoundException('Message not found');
    // Only sender or recipient can delete
    if (message.senderId !== userId && message.recipientId !== userId) {
      throw new NotFoundException('Message not found');
    }
    await this.prisma.message.delete({ where: { id: message.id } });
    return { success: true };
  }

  async getUsers(schoolId: string, currentUserId: string) {
    const validSchoolId = requireSchoolId(schoolId);
    return this.prisma.user.findMany({
      where: {
        schoolId: validSchoolId,
        id: { not: currentUserId },
        status: 'ACTIVE',
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        role: true,
        avatarUrl: true,
      },
      orderBy: [{ role: 'asc' }, { firstName: 'asc' }],
    });
  }

  async broadcastAnnouncement(data: {
    schoolId: string;
    senderId: string;
    subject: string;
    body: string;
    targetRole?: string;
  }) {
    const validSchoolId = requireSchoolId(data.schoolId);
    const whereClause: any = {
      schoolId: validSchoolId,
      id: { not: data.senderId },
    };
    if (data.targetRole) whereClause.role = data.targetRole;

    const recipients = await this.prisma.user.findMany({
      where: whereClause,
      select: { id: true },
    });

    const messages = recipients.map((r) => ({
      schoolId: validSchoolId,
      senderId: data.senderId,
      recipientId: r.id,
      subject: data.subject,
      body: data.body,
    }));

    await this.prisma.message.createMany({ data: messages });

    // Dispatches major notification and triggers email delivery for students/parents
    if (this.notificationsService) {
      for (const r of recipients) {
        await this.notificationsService
          .createNotification({
            schoolId: validSchoolId,
            userId: r.id,
            type: 'GENERAL',
            title: data.subject,
            message: data.body,
            metadata: {
              isMajor: true,
              category: 'ANNOUNCEMENT',
            },
          })
          .catch(() => {});
      }
    }

    return { success: true, sent: messages.length };
  }

  /**
   * Sends batch messages to specified recipients within a school.
   * Authoritative domain operation ensuring tenant boundary, recipient validation, batching, and creation.
   */
  async sendBatchMessages(data: {
    schoolId: string;
    senderId: string;
    subject?: string;
    messages: Array<{
      recipientId: string;
      draftMessage: string;
      subject?: string;
    }>;
  }): Promise<{ sentCount: number; recipientIds: string[] }> {
    const validSchoolId = requireSchoolId(data.schoolId);
    const rawItems = data.messages || [];
    const candidateRecipientIds = Array.from(
      new Set(rawItems.map((m) => m.recipientId).filter(Boolean)),
    );

    if (candidateRecipientIds.length === 0) {
      return { sentCount: 0, recipientIds: [] };
    }

    const validUsers = await this.prisma.user.findMany({
      where: {
        id: { in: candidateRecipientIds },
        schoolId: validSchoolId,
        status: 'ACTIVE',
      },
      select: { id: true },
    });
    const validUserIdSet = new Set(validUsers.map((u) => u.id));

    const validMessages = rawItems
      .filter((m) => m.recipientId && validUserIdSet.has(m.recipientId))
      .map((m) => ({
        schoolId: validSchoolId,
        senderId: data.senderId,
        recipientId: m.recipientId,
        subject: (m.subject ?? data.subject ?? 'Notification').substring(
          0,
          255,
        ),
        body: m.draftMessage || '',
      }));

    const BATCH_SIZE = 50;
    let sentCount = 0;
    const sentRecipientIds: string[] = [];

    for (let i = 0; i < validMessages.length; i += BATCH_SIZE) {
      const batch = validMessages.slice(i, i + BATCH_SIZE);
      if (batch.length > 0) {
        await this.prisma.message.createMany({ data: batch });
        sentCount += batch.length;
        sentRecipientIds.push(...batch.map((b) => b.recipientId));
      }
    }

    return { sentCount, recipientIds: sentRecipientIds };
  }

  /**
   * Sends the daily operations digest to school administrators/principals.
   */
  async sendDailyDigest(data: {
    schoolId: string;
    senderId: string;
    body: string;
    subject?: string;
  }): Promise<{ sent: boolean; messageId?: string; recipientId?: string }> {
    const validSchoolId = requireSchoolId(data.schoolId);
    const principal = await this.prisma.user.findFirst({
      where: {
        schoolId: validSchoolId,
        role: { in: ['PRINCIPAL', 'SCHOOL_ADMIN'] },
        status: 'ACTIVE',
      },
    });

    if (!principal || !data.body?.trim()) {
      return { sent: false };
    }

    const message = await this.prisma.message.create({
      data: {
        schoolId: validSchoolId,
        senderId: data.senderId,
        recipientId: principal.id,
        subject:
          data.subject || `Daily School Digest — ${new Date().toDateString()}`,
        body: data.body,
      },
    });

    return { sent: true, messageId: message.id, recipientId: principal.id };
  }

  /**
   * Domain query: verifies whether a broadcast announcement was recorded in the database.
   */
  async verifyAnnouncement(
    schoolId: string,
    senderId: string,
    subject: string,
    expectedCount?: number,
  ): Promise<{ verified: boolean; messageCount: number }> {
    const validSchoolId = requireSchoolId(schoolId);
    const count = await this.prisma.message.count({
      where: {
        schoolId: validSchoolId,
        senderId,
        subject,
      },
    });

    if (count === 0) {
      return { verified: false, messageCount: 0 };
    }

    if (expectedCount !== undefined && count < expectedCount) {
      return { verified: false, messageCount: count };
    }

    return { verified: true, messageCount: count };
  }

  /**
   * Domain query: finds an announcement matching criteria for reconciliation.
   */
  async findAnnouncement(
    schoolId: string,
    senderId: string,
    subject: string,
  ): Promise<{
    id: string;
    schoolId: string;
    senderId: string;
    subject: string | null;
  } | null> {
    const validSchoolId = requireSchoolId(schoolId);
    return this.prisma.message.findFirst({
      where: {
        schoolId: validSchoolId,
        senderId,
        subject,
      },
      select: {
        id: true,
        schoolId: true,
        senderId: true,
        subject: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Domain query: verifies whether batch messages were created.
   */
  async verifyBatchMessages(
    schoolId: string,
    senderId: string,
    recipientIds: string[],
    subject?: string,
  ): Promise<{ verified: boolean; sentCount: number }> {
    const validSchoolId = requireSchoolId(schoolId);
    if (!recipientIds || recipientIds.length === 0) {
      return { verified: true, sentCount: 0 };
    }

    const whereClause: any = {
      schoolId: validSchoolId,
      senderId,
      recipientId: { in: recipientIds },
    };
    if (subject) {
      whereClause.subject = subject;
    }

    const count = await this.prisma.message.count({
      where: whereClause,
    });

    return { verified: count > 0, sentCount: count };
  }
}
