import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { requireSchoolId } from '../../core/tenant/tenant.util';

@Injectable()
export class MessagesService {
  constructor(private prisma: PrismaService) {}

  async getInbox(userId: string, schoolId: string) {
    const validSchoolId = requireSchoolId(schoolId);
    const messages = await this.prisma.message.findMany({
      where: { recipientId: userId, schoolId: validSchoolId, parentId: null },
      include: {
        sender: { select: { id: true, firstName: true, lastName: true, role: true, avatarUrl: true } },
        replies: {
          include: {
            sender: { select: { id: true, firstName: true, lastName: true, role: true } },
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

    return Array.from(uniqueMap.values()).map(msg => {
      if (msg.recipientCount > 1) {
        return {
          ...msg,
          recipientId: "Everyone"
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
        sender: { select: { id: true, firstName: true, lastName: true, role: true } },
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
      where: { schoolId: validSchoolId, id: { not: currentUserId }, status: 'ACTIVE' },
      select: { id: true, firstName: true, lastName: true, role: true, avatarUrl: true },
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
    const whereClause: any = { schoolId: validSchoolId, id: { not: data.senderId } };
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
    return { success: true, sent: messages.length };
  }
}
