import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async getNotifications(userId: string, schoolId: string, limit = 20, unreadOnly = false) {
    return this.prisma.notification.findMany({
      where: {
        userId,
        schoolId,
        ...(unreadOnly ? { isRead: false } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async getUnreadCount(userId: string, schoolId: string) {
    return this.prisma.notification.count({
      where: { userId, schoolId, isRead: false },
    });
  }

  async markAsRead(notificationId: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async markAllRead(userId: string, schoolId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, schoolId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async createNotification(data: {
    schoolId: string;
    userId: string;
    type: string;
    title: string;
    message: string;
    actionUrl?: string;
    metadata?: any;
  }) {
    return this.prisma.notification.create({
      data: {
        schoolId: data.schoolId,
        userId: data.userId,
        type: data.type as any,
        title: data.title,
        message: data.message,
        actionUrl: data.actionUrl,
        metadata: data.metadata,
      },
    });
  }
}
