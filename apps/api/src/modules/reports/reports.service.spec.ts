import { Test, TestingModule } from '@nestjs/testing';
import { ReportsService } from './reports.service';
import { PrismaService } from '../../core/database/prisma.service';

const mockPrisma = {
  academicYear: { findFirst: jest.fn() },
  attendanceRecord: {
    groupBy: jest.fn(),
    findMany: jest.fn(),
  },
  student: { count: jest.fn(), findMany: jest.fn() },
  studentEnrollment: { findMany: jest.fn() },
  feePayment: { groupBy: jest.fn(), aggregate: jest.fn(), findMany: jest.fn() },
  examSubjectResult: { findMany: jest.fn(), groupBy: jest.fn() },
  staff: { count: jest.fn() },
  leaveRequest: { count: jest.fn(), findMany: jest.fn() },
};

describe('ReportsService', () => {
  let service: ReportsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<ReportsService>(ReportsService);
    jest.clearAllMocks();
  });

  describe('getDailyAttendance', () => {
    it('should return daily attendance summary with correct fields', async () => {
      mockPrisma.attendanceRecord.groupBy.mockResolvedValue([
        { status: 'PRESENT', _count: { status: 80 } },
        { status: 'ABSENT', _count: { status: 10 } },
      ]);
      mockPrisma.student.count.mockResolvedValue(100);

      const result = await service.getDailyAttendance('school-1');
      expect(result).toHaveProperty('PRESENT', 80);
      expect(result).toHaveProperty('ABSENT', 10);
      expect(result).toHaveProperty('totalStudents', 100);
      expect(result).toHaveProperty('attendanceRate');
    });

    it('should return 0% attendance rate when no students exist', async () => {
      mockPrisma.attendanceRecord.groupBy.mockResolvedValue([]);
      mockPrisma.student.count.mockResolvedValue(0);
      const result = await service.getDailyAttendance('school-1');
      expect(result.attendanceRate).toBe('0');
    });

    it('should throw ForbiddenException for empty schoolId', async () => {
      await expect(service.getDailyAttendance('')).rejects.toThrow();
    });
  });

  describe('getAttendanceRegister', () => {
    it('should return attendance register for a section', async () => {
      // Mock enrollments with correct shape (studentId at top level, student has user)
      mockPrisma.studentEnrollment.findMany.mockResolvedValue([
        {
          studentId: 's1',
          rollNumber: '01',
          student: {
            id: 's1',
            user: { firstName: 'Alice', lastName: 'Smith' },
            admissionNumber: 'A001',
          },
        },
      ]);
      // Mock attendance records (required for the forEach at line 88)
      mockPrisma.attendanceRecord.findMany.mockResolvedValue([
        { studentId: 's1', date: new Date('2024-04-10'), status: 'PRESENT' },
        { studentId: 's1', date: new Date('2024-04-11'), status: 'ABSENT' },
      ]);
      const result = await service.getAttendanceRegister(
        'school-1',
        'section-1',
        4,
        2024,
      );
      expect(result).toBeDefined();
      // Returns {sectionId, month, year, days, students}
      expect(result).toHaveProperty('students');
      expect(result).toHaveProperty('month', 4);
    });
  });
});
