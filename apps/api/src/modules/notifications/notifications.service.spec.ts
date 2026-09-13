import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../../core/database/prisma.service';

describe('NotificationsService (FIX-05)', () => {
  let service: NotificationsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      notification: {
        findMany: jest.fn(),
        count: jest.fn(),
        updateMany: jest.fn(),
        create: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  it('emits and streams notification events to the matching user', (done) => {
    const userId = 'user-1';
    const schoolId = 'school-1';
    const notification = {
      id: 'notif-123',
      userId,
      schoolId,
      title: 'Fee Payment Received',
      message: 'Payment of ₹15,000 received for Receipt RCT-2026-001.',
    };

    service.getEventStream(userId, schoolId).subscribe({
      next: (event) => {
        expect(event.type).toBe('notification');
        expect(event.data).toEqual(notification);
        done();
      },
    });

    service.emitEvent(userId, schoolId, notification);
  });

  it('filters out notifications destined for other users', (done) => {
    const subscriberId = 'user-alice';
    const otherUserId = 'user-bob';
    let received = false;

    service.getEventStream(subscriberId, 'school-1').subscribe({
      next: () => {
        received = true;
      },
    });

    service.emitEvent(otherUserId, 'school-1', { id: 'bob-notif', title: 'For Bob only' });

    setTimeout(() => {
      expect(received).toBe(false);
      done();
    }, 20);
  });

  it('creates notification and immediately dispatches real-time event', async () => {
    const createdNotif = {
      id: 'notif-999',
      userId: 'user-2',
      schoolId: 'school-2',
      title: 'New Circular',
      message: 'School holiday on Friday.',
      type: 'GENERAL',
    };
    prisma.notification.create.mockResolvedValue(createdNotif);

    const emitSpy = jest.spyOn(service, 'emitEvent');

    const result = await service.createNotification({
      userId: 'user-2',
      schoolId: 'school-2',
      type: 'GENERAL',
      title: 'New Circular',
      message: 'School holiday on Friday.',
    });

    expect(result).toEqual(createdNotif);
    expect(emitSpy).toHaveBeenCalledWith('user-2', 'school-2', createdNotif);
  });
});
