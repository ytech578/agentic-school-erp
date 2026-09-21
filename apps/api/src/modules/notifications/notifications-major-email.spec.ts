import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../../core/database/prisma.service';
import { EmailService } from '../../services/email/email.service';

describe('NotificationsService - Major Email Filter & Dispatch', () => {
  let service: NotificationsService;
  let prisma: any;
  let emailService: any;

  beforeEach(async () => {
    prisma = {
      notification: {
        create: jest
          .fn()
          .mockImplementation((args) =>
            Promise.resolve({ id: 'notif-1', ...args.data }),
          ),
      },
      user: {
        findUnique: jest.fn(),
      },
    };

    emailService = {
      sendMajorNotification: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: prisma },
        { provide: EmailService, useValue: emailService },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  describe('isMajorNotification filter', () => {
    it('identifies explicit major notifications', () => {
      expect(
        service.isMajorNotification('GENERAL', 'Notice', { isMajor: true }),
      ).toBe(true);
      expect(
        service.isMajorNotification('GENERAL', 'Notice', { isMajor: false }),
      ).toBe(false);
    });

    it('identifies major categories: HOLIDAY, ANNOUNCEMENT, EMERGENCY, EXAM_SCHEDULE, CIRCULAR, FEE_DUE', () => {
      expect(
        service.isMajorNotification('GENERAL', 'Notice', {
          category: 'HOLIDAY',
        }),
      ).toBe(true);
      expect(
        service.isMajorNotification('GENERAL', 'Circular', {
          category: 'CIRCULAR',
        }),
      ).toBe(true);
      expect(
        service.isMajorNotification('GENERAL', 'Advisory', {
          category: 'EMERGENCY',
        }),
      ).toBe(true);
      expect(
        service.isMajorNotification('GENERAL', 'Fee Bill', {
          category: 'FEE_DUE',
        }),
      ).toBe(true);
    });

    it('identifies EXAM_RESULT as major', () => {
      expect(
        service.isMajorNotification('EXAM_RESULT', 'Final Term Marksheet', {}),
      ).toBe(true);
    });

    it('identifies major keyword titles (holiday, vacation, closure, circular, urgent)', () => {
      expect(
        service.isMajorNotification(
          'GENERAL',
          'Independence Day Holiday Notice',
          {},
        ),
      ).toBe(true);
      expect(
        service.isMajorNotification(
          'GENERAL',
          'Summer Vacation 2026 Guidelines',
          {},
        ),
      ).toBe(true);
      expect(
        service.isMajorNotification(
          'GENERAL',
          'Urgent advisory regarding heavy rainfall closure',
          {},
        ),
      ).toBe(true);
    });

    it('classifies routine daily attendance alerts and room shifts as MINOR (false)', () => {
      expect(
        service.isMajorNotification(
          'ATTENDANCE_ALERT',
          'Student marked Present at 08:05 AM',
          {},
        ),
      ).toBe(false);
      expect(
        service.isMajorNotification(
          'GENERAL',
          'Physics class room shifted to Room 204',
          {},
        ),
      ).toBe(false);
    });
  });

  describe('createNotification email dispatch behavior', () => {
    it('dispatches email to student and guardian when a major holiday/circular notification is created', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'student-user-1',
        email: 'aarav@student.sunriseschool.edu.in',
        firstName: 'Aarav',
        lastName: 'Sharma',
        role: 'STUDENT',
        student: {
          guardians: [
            {
              email: 'parent.sharma@gmail.com',
              firstName: 'Rajesh',
              isPrimary: true,
            },
          ],
        },
      });

      await service.createNotification({
        schoolId: 'school-1',
        userId: 'student-user-1',
        type: 'GENERAL',
        title: 'Diwali Holiday Notice 2026',
        message:
          'The school shall remain closed from Oct 28 to Nov 02 for Diwali vacations.',
        metadata: {
          category: 'HOLIDAY',
          isMajor: true,
        },
      });

      // Recipient student email was sent
      expect(emailService.sendMajorNotification).toHaveBeenCalledWith(
        'aarav@student.sunriseschool.edu.in',
        'Aarav Sharma',
        'Diwali Holiday Notice 2026',
        'The school shall remain closed from Oct 28 to Nov 02 for Diwali vacations.',
        'HOLIDAY',
        expect.objectContaining({ isMajor: true }),
      );

      // Parent/guardian email copy was also dispatched
      expect(emailService.sendMajorNotification).toHaveBeenCalledWith(
        'parent.sharma@gmail.com',
        'Rajesh',
        'Diwali Holiday Notice 2026',
        'The school shall remain closed from Oct 28 to Nov 02 for Diwali vacations.',
        'HOLIDAY',
        expect.objectContaining({ isMajor: true }),
      );
    });

    it('DOES NOT dispatch email for minor routine attendance punches', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'student-user-1',
        email: 'aarav@student.sunriseschool.edu.in',
        firstName: 'Aarav',
        lastName: 'Sharma',
        role: 'STUDENT',
      });

      await service.createNotification({
        schoolId: 'school-1',
        userId: 'student-user-1',
        type: 'ATTENDANCE_ALERT',
        title: 'Morning Check-in Recorded',
        message: 'Aarav Sharma punched in at Gate 1 at 07:58 AM.',
        metadata: {
          status: 'PRESENT',
        },
      });

      expect(emailService.sendMajorNotification).not.toHaveBeenCalled();
    });

    it('DOES NOT dispatch student/parent email for internal admin or teacher notifications', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'teacher-user-1',
        email: 'verma@sunriseschool.edu.in',
        firstName: 'Rahul',
        lastName: 'Verma',
        role: 'TEACHER',
      });

      await service.createNotification({
        schoolId: 'school-1',
        userId: 'teacher-user-1',
        type: 'GENERAL',
        title: 'Staff Meeting at 3 PM',
        message: 'Faculty meeting scheduled in the conference room.',
        metadata: {
          category: 'ANNOUNCEMENT',
        },
      });

      expect(emailService.sendMajorNotification).not.toHaveBeenCalled();
    });
  });
});
