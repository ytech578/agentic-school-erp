import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionsService } from './subscriptions.service';
import { PrismaService } from '../../core/database/prisma.service';
import { ForbiddenException } from '@nestjs/common';
import { SubscriptionPlanEnum } from './dto/subscription.dto';

describe('SubscriptionsService', () => {
  let service: SubscriptionsService;
  let prisma: jest.Mocked<any>;

  const mockSchoolId = 'school-delhi-01';

  beforeEach(async () => {
    prisma = {
      school: {
        findUnique: jest.fn(),
      },
      schoolSubscription: {
        findUnique: jest.fn(),
        create: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
      },
      student: {
        count: jest.fn(),
      },
      staff: {
        count: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<SubscriptionsService>(SubscriptionsService);
  });

  describe('getSubscription', () => {
    it('should auto-create default FREE_PILOT subscription if not found', async () => {
      prisma.schoolSubscription.findUnique.mockResolvedValue(null);
      prisma.schoolSubscription.create.mockResolvedValue({
        id: 'sub-1',
        schoolId: mockSchoolId,
        plan: 'FREE_PILOT',
        status: 'ACTIVE',
        maxStudents: 200,
        maxStaff: 30,
        maxStorageGb: 5,
        maxAiTokensMonthly: 500000,
        currentAiTokensUsed: 0,
        currentStorageGbUsed: 0,
      });
      prisma.student.count.mockResolvedValue(150);
      prisma.staff.count.mockResolvedValue(20);

      const res = await service.getSubscription(mockSchoolId);

      expect(res.subscription.plan).toBe('FREE_PILOT');
      expect(res.metrics.students.used).toBe(150);
      expect(res.metrics.students.limit).toBe(200);
      expect(res.metrics.students.percent).toBe(75);
    });
  });

  describe('checkQuota', () => {
    it('should throw ForbiddenException if student limit would be exceeded', async () => {
      prisma.schoolSubscription.findUnique.mockResolvedValue({
        id: 'sub-1',
        schoolId: mockSchoolId,
        plan: 'FREE_PILOT',
        status: 'ACTIVE',
        maxStudents: 200,
        maxStaff: 30,
        maxStorageGb: 5,
        maxAiTokensMonthly: 500000,
        currentAiTokensUsed: 0,
        currentStorageGbUsed: 0,
      });
      prisma.student.count.mockResolvedValue(200);
      prisma.staff.count.mockResolvedValue(10);

      await expect(
        service.checkQuota(mockSchoolId, 'STUDENTS', 1),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if subscription status is CANCELLED', async () => {
      prisma.schoolSubscription.findUnique.mockResolvedValue({
        id: 'sub-1',
        schoolId: mockSchoolId,
        plan: 'FREE_PILOT',
        status: 'CANCELLED',
        maxStudents: 200,
        maxStaff: 30,
        maxStorageGb: 5,
        maxAiTokensMonthly: 500000,
        currentAiTokensUsed: 0,
        currentStorageGbUsed: 0,
      });
      prisma.student.count.mockResolvedValue(50);
      prisma.staff.count.mockResolvedValue(5);

      await expect(
        service.checkQuota(mockSchoolId, 'STUDENTS', 1),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should pass quota check when under limits', async () => {
      prisma.schoolSubscription.findUnique.mockResolvedValue({
        id: 'sub-1',
        schoolId: mockSchoolId,
        plan: 'STARTER',
        status: 'ACTIVE',
        maxStudents: 500,
        maxStaff: 60,
        maxStorageGb: 20,
        maxAiTokensMonthly: 1500000,
        currentAiTokensUsed: 10000,
        currentStorageGbUsed: 2.5,
      });
      prisma.student.count.mockResolvedValue(300);
      prisma.staff.count.mockResolvedValue(25);

      const pass = await service.checkQuota(mockSchoolId, 'STUDENTS', 1);
      expect(pass).toBe(true);
    });
  });
});
