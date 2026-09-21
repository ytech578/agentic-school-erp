import { Injectable, Logger, MessageEvent, Optional } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { PrismaService } from '../../core/database/prisma.service';
import { SmsWhatsAppService } from './sms-whatsapp.service';
import { EmailService } from '../../services/email/email.service';

export interface NotificationEventPayload {
  userId: string;
  schoolId: string;
  notification: any;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly events$ = new Subject<NotificationEventPayload>();

  constructor(
    private prisma: PrismaService,
    @Optional() private smsWhatsApp?: SmsWhatsAppService,
    @Optional() private emailService?: EmailService,
  ) {}

  emitEvent(userId: string, schoolId: string, notification: any) {
    this.events$.next({ userId, schoolId, notification });
  }

  getEventStream(userId: string, schoolId: string): Observable<MessageEvent> {
    return this.events$.asObservable().pipe(
      filter(
        (event) =>
          event.userId === userId && (!schoolId || event.schoolId === schoolId),
      ),
      map((event) => ({
        data: event.notification,
        type: 'notification',
      })),
    );
  }

  async getNotifications(
    userId: string,
    schoolId: string,
    limit = 20,
    unreadOnly = false,
  ) {
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

  /**
   * Determine whether a notification represents a MAJOR school communication.
   * Major communications (Holidays, Circulars, Emergency Advisories, Exam Results/Schedules, Major Fee Notices)
   * are dispatched to registered student/parent emails.
   * Minor routine alerts (daily check-ins, routine attendance markers) remain strictly in-portal.
   */
  isMajorNotification(type: string, title: string, metadata?: any): boolean {
    if (metadata?.isMajor === true) return true;
    if (metadata?.isMajor === false) return false;

    const cat = (metadata?.category || '').toUpperCase();
    const majorCategories = [
      'HOLIDAY',
      'ANNOUNCEMENT',
      'EMERGENCY',
      'EXAM_SCHEDULE',
      'CIRCULAR',
      'FEE_DUE',
    ];
    if (majorCategories.includes(cat)) return true;

    if (type === 'EXAM_RESULT') return true;

    // Routine attendance alerts are minor routine events unless explicitly marked major
    if (type === 'ATTENDANCE_ALERT') return false;

    // Pattern matching on title for major keywords
    const majorPattern =
      /\b(holiday|vacation|closure|announcement|circular|emergency|urgent|advisory|board exam|date sheet|term exam)\b/i;
    return majorPattern.test(title || '');
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
    const notification = await this.prisma.notification.create({
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

    // Real-time instant event dispatch for live in-portal badge
    this.emitEvent(data.userId, data.schoolId, notification);

    // Multi-channel dispatch if phone number is available in metadata
    if (this.smsWhatsApp && data.metadata?.phone) {
      if (data.type === 'ATTENDANCE_ALERT') {
        this.smsWhatsApp
          .sendWhatsApp(data.metadata.phone, 'attendance_alert', {
            student_name: data.metadata?.studentName || 'Student',
            status: data.metadata?.status || 'ABSENT',
            date: new Date().toLocaleDateString('en-IN'),
          })
          .catch(() => {});
      } else if (data.type === 'FEE_DUE') {
        this.smsWhatsApp
          .sendSMS(
            data.metadata.phone,
            `School ERP: Fee payment reminder. ${data.message}`,
          )
          .catch(() => {});
      }
    }

    // Major Email Notifications for Students & Parents
    if (
      this.emailService &&
      this.isMajorNotification(data.type, data.title, data.metadata)
    ) {
      try {
        const recipient = await this.prisma.user.findUnique({
          where: { id: data.userId },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            student: {
              select: {
                guardians: {
                  where: { email: { not: null } },
                  select: { email: true, firstName: true, isPrimary: true },
                },
              },
            },
          },
        });

        if (
          recipient &&
          (recipient.role === 'STUDENT' || recipient.role === 'PARENT')
        ) {
          const recipientName =
            `${recipient.firstName} ${recipient.lastName}`.trim();
          const category =
            data.metadata?.category ||
            (data.type === 'EXAM_RESULT' ? 'EXAM_RESULT' : 'ANNOUNCEMENT');

          // Send to recipient's email
          if (recipient.email) {
            await this.emailService.sendMajorNotification(
              recipient.email,
              recipientName,
              data.title,
              data.message,
              category,
              { ...data.metadata, actionUrl: data.actionUrl },
            );
            this.logger.log(
              `Major notification email dispatched to ${recipient.email} for [${data.title}]`,
            );
          }

          // If student, also dispatch to primary guardian email so parents stay informed
          if (
            recipient.role === 'STUDENT' &&
            recipient.student?.guardians?.length
          ) {
            for (const guardian of recipient.student.guardians) {
              if (guardian.email && guardian.email !== recipient.email) {
                await this.emailService
                  .sendMajorNotification(
                    guardian.email,
                    guardian.firstName || 'Parent/Guardian',
                    data.title,
                    data.message,
                    category,
                    { ...data.metadata, actionUrl: data.actionUrl },
                  )
                  .catch(() => {});
                this.logger.log(
                  `Major notification email copy dispatched to guardian ${guardian.email}`,
                );
              }
            }
          }
        } else {
          this.logger.debug(
            `Minor or internal-only notification kept in-portal for user ${data.userId}`,
          );
        }
      } catch (err: any) {
        this.logger.error(
          `Failed during major notification email check: ${err.message}`,
        );
      }
    }

    return notification;
  }
}
