import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';

@Injectable()
export class MessagesService {
  constructor(private prisma: PrismaService) {}

  async getInbox(userId: string, schoolId: string) {
    const messages = await this.prisma.message.findMany({
      where: { recipientId: userId, schoolId, parentId: null },
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
    const rawMessages = await this.prisma.message.findMany({
      where: { senderId: userId, schoolId, parentId: null },
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
    return this.prisma.message.create({
      data: {
        schoolId: data.schoolId,
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
      where: { id: messageId },
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
    // Only sender can delete
    if (message.senderId !== userId && message.recipientId !== userId) {
      throw new NotFoundException('Message not found');
    }
    await this.prisma.message.delete({ where: { id: messageId } });
    return { success: true };
  }

  async getUsers(schoolId: string, currentUserId: string) {
    // Return list of users they can message
    return this.prisma.user.findMany({
      where: { schoolId, id: { not: currentUserId }, status: 'ACTIVE' },
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
    const whereClause: any = { schoolId: data.schoolId, id: { not: data.senderId } };
    if (data.targetRole) whereClause.role = data.targetRole;

    const recipients = await this.prisma.user.findMany({
      where: whereClause,
      select: { id: true },
    });

    const messages = recipients.map((r) => ({
      schoolId: data.schoolId,
      senderId: data.senderId,
      recipientId: r.id,
      subject: data.subject,
      body: data.body,
    }));

    await this.prisma.message.createMany({ data: messages });
    console.log(`Broadcasted to ${messages.length} recipients for school ${data.schoolId} and role ${data.targetRole}`);
    return { success: true, sent: messages.length };
  }
}
