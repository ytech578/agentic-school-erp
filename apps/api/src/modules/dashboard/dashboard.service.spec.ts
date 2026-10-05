import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../../core/database/prisma.service';
import { RedisService } from '../../core/cache/redis.service';

describe('DashboardService (Audit Verification & Zero-Mock Guarantee)', () => {
  let service: DashboardService;
  let prisma: jest.Mocked<any>;
  let redisService: jest.Mocked<any>;

  const mockSchoolId = 'school-delhi-01';

  beforeEach(async () => {
    prisma = {
      school: {
        count: jest.fn(),
        findMany: jest.fn(),
      },
      user: {
        count: jest.fn(),
        findMany: jest.fn(),
      },
      class: {
        count: jest.fn(),
      },
      feePayment: {
        aggregate: jest.fn(),
        findMany: jest.fn(),
      },
      staffAttendance: {
        count: jest.fn(),
      },
      leaveRequest: {
        count: jest.fn(),
      },
      attendanceRecord: {
        findMany: jest.fn(),
      },
      admissionEnquiry: {
        count: jest.fn(),
      },
      admissionApplication: {
        count: jest.fn(),
      },
      activityLog: {
        findMany: jest.fn(),
      },
      notification: {
        findMany: jest.fn(),
      },
      task: {
        findMany: jest.fn(),
      },
    };

    redisService = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      getStatus: jest.fn().mockReturnValue({ connected: true }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: redisService },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
  });

  describe('getSuperAdminDashboard', () => {
    it('should aggregate platform fleet statistics from database without mocks', async () => {
      prisma.school.count.mockResolvedValueOnce(5).mockResolvedValueOnce(4);
      prisma.user.count
        .mockResolvedValueOnce(1200) // students
        .mockResolvedValueOnce(80) // teachers
        .mockResolvedValueOnce(95) // total staff
        .mockResolvedValueOnce(1100); // parents
      prisma.school.findMany.mockResolvedValueOnce([
        { id: 'sch-1', name: 'Delhi Public Academy', code: 'DPA' },
      ]);
      prisma.activityLog.findMany.mockResolvedValueOnce([]);

      const result = await service.getSuperAdminDashboard();

      expect(result.fleet.totalSchools).toBe(5);
      expect(result.fleet.activeSchools).toBe(4);
      expect(result.fleet.inactiveSchools).toBe(1);
      expect(result.fleet.totalStudents).toBe(1200);
      expect(result.fleet.totalStaff).toBe(95);
      expect(redisService.set).toHaveBeenCalledWith(
        'dashboard:superadmin',
        expect.any(String),
        60,
      );
    });

    it('should return cached result if present in Redis', async () => {
      const cachedData = {
        fleet: { totalSchools: 10, activeSchools: 10 },
      };
      redisService.get.mockResolvedValueOnce(JSON.stringify(cachedData));

      const result = await service.getSuperAdminDashboard();

      expect(result).toEqual(cachedData);
      expect(prisma.school.count).not.toHaveBeenCalled();
    });
  });

  describe('getSchoolAdminDashboard (Section 4.7 Option C: Honest Reporting without Target)', () => {
    it('should report null monthlyTarget and null collectionRate (Option C)', async () => {
      // Setup counts
      prisma.user.count
        .mockResolvedValueOnce(500) // students
        .mockResolvedValueOnce(40); // staff
      prisma.class.count.mockResolvedValueOnce(12);

      // Fee collections
      prisma.feePayment.aggregate
        .mockResolvedValueOnce({ _sum: { paidAmount: 350000 } }) // collectedThisMonth
        .mockResolvedValueOnce({ _sum: { outstandingAmount: 50000 } }); // overdueDues

      // Staff attendance
      prisma.staffAttendance.count
        .mockResolvedValueOnce(38) // present
        .mockResolvedValueOnce(1); // absent
      prisma.leaveRequest.count
        .mockResolvedValueOnce(1) // approved leave
        .mockResolvedValueOnce(2); // pending leave

      // Student attendance records: 9 out of 10 present
      prisma.attendanceRecord.findMany.mockResolvedValueOnce([
        { status: 'PRESENT' },
        { status: 'PRESENT' },
        { status: 'PRESENT' },
        { status: 'PRESENT' },
        { status: 'PRESENT' },
        { status: 'PRESENT' },
        { status: 'PRESENT' },
        { status: 'PRESENT' },
        { status: 'PRESENT' },
        { status: 'ABSENT' },
      ]);

      prisma.admissionEnquiry.count.mockResolvedValueOnce(15);
      prisma.admissionApplication.count.mockResolvedValueOnce(8);
      prisma.user.findMany.mockResolvedValueOnce([]); // recentEnrollments
      prisma.feePayment.findMany.mockResolvedValueOnce([]); // 7-day trend payments

      const result = await service.getSchoolAdminDashboard(mockSchoolId);

      expect(result.kpis.collectedThisMonth).toBe(350000);
      expect(result.kpis.overdueDues).toBe(50000);

      // CRITICAL AUDIT ASSERTIONS: Option C eliminates synthetic targets & artificial percentages
      expect(result.kpis.monthlyTarget).toBeNull();
      expect(result.kpis.collectionRate).toBeNull();

      // Attendance percentage calculated directly from real records (9/10 = 90%)
      expect(result.kpis.studentAttendancePct).toBe(90);
      expect(result.kpis.staffAttendance.present).toBe(38);
      expect(result.kpis.staffAttendance.onLeave).toBe(1);
    });

    it('should compute real 7-day collection trends without mock numbers', async () => {
      prisma.user.count.mockResolvedValue(0);
      prisma.class.count.mockResolvedValue(0);
      prisma.feePayment.aggregate.mockResolvedValue({
        _sum: { paidAmount: 0, outstandingAmount: 0 },
      });
      prisma.staffAttendance.count.mockResolvedValue(0);
      prisma.leaveRequest.count.mockResolvedValue(0);
      prisma.attendanceRecord.findMany.mockResolvedValue([]);
      prisma.admissionEnquiry.count.mockResolvedValue(0);
      prisma.admissionApplication.count.mockResolvedValue(0);
      prisma.user.findMany.mockResolvedValue([]);

      const today = new Date();
      const y = today.getFullYear();
      const m = String(today.getMonth() + 1).padStart(2, '0');
      const d = String(today.getDate()).padStart(2, '0');
      const todayStr = `${y}-${m}-${d}`;

      prisma.feePayment.findMany.mockResolvedValueOnce([
        { paidAmount: 25000, paymentDate: today },
      ]);

      const result = await service.getSchoolAdminDashboard(mockSchoolId);

      expect(result.collectionTrend).toBeDefined();
      expect(result.collectionTrend.length).toBe(7);

      const todayTrend = result.collectionTrend.find(
        (t: any) => t.date === todayStr,
      );
      expect(todayTrend).toBeDefined();
      expect(todayTrend.collection).toBe(25000);

      // Verify other days without payments default strictly to 0 (no mock random numbers)
      const otherDays = result.collectionTrend.filter(
        (t: any) => t.date !== todayStr,
      );
      for (const day of otherDays) {
        expect(day.collection).toBe(0);
      }
    });
  });
});
