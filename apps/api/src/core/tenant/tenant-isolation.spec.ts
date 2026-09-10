/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

import {
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { requireSchoolId } from './tenant.util';
import { UsersService } from '../../modules/users/users.service';
import { StudentsService } from '../../modules/students/students.service';
import { FeesService } from '../../modules/fees/fees.service';
import { AssignmentsService } from '../../modules/assignments/assignments.service';
import { ExamsService } from '../../modules/exams/exams.service';
import { DashboardController } from '../../modules/dashboard/dashboard.controller';
import { DashboardService } from '../../modules/dashboard/dashboard.service';
import { UserRole } from '@school-erp/shared';

describe('Multi-Tenant Systematic Data Isolation (Change #4)', () => {
  const SCHOOL_1 = 'school_alpha_111';
  const SCHOOL_2 = 'school_beta_222';

  // ────────────────────────────────────────────────────────────────────────────
  // Test 10: requireSchoolId fail-closed enforcement
  // ────────────────────────────────────────────────────────────────────────────
  describe('Test 10: requireSchoolId fail-closed enforcement', () => {
    it('throws ForbiddenException when schoolId is undefined', () => {
      expect(() => requireSchoolId(undefined)).toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when schoolId is null', () => {
      expect(() => requireSchoolId(null)).toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when schoolId is empty string or whitespace', () => {
      expect(() => requireSchoolId('')).toThrow(ForbiddenException);
      expect(() => requireSchoolId('   ')).toThrow(ForbiddenException);
    });

    it('returns trimmed schoolId when valid', () => {
      expect(requireSchoolId('  school_123  ')).toBe('school_123');
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Test 1: UsersService cross-tenant isolation
  // ────────────────────────────────────────────────────────────────────────────
  describe('Test 1: UsersService cross-tenant boundary', () => {
    let usersService: UsersService;
    let mockPrisma: any;

    beforeEach(() => {
      mockPrisma = {
        user: {
          findFirst: jest.fn(),
          findUnique: jest.fn(),
          update: jest.fn(),
        },
      };
      usersService = new UsersService(mockPrisma);
    });

    it('School 1 admin requesting School 2 user returns 404 (NotFoundException), preventing enumeration', async () => {
      // User exists in DB, but belongs to SCHOOL_2
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user_beta',
        schoolId: SCHOOL_2,
        role: 'TEACHER',
      });

      await expect(
        usersService.findById('user_beta', SCHOOL_1, false),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user_beta' },
        select: expect.any(Object),
      });
    });

    it('School 1 admin updating a user belonging to School 2 throws NotFoundException', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user_beta',
        schoolId: SCHOOL_2,
        role: 'TEACHER',
      });

      await expect(
        usersService.updateUser(
          'user_beta',
          { firstName: 'Attacker' },
          { id: 'admin_1', schoolId: SCHOOL_1, role: 'SCHOOL_ADMIN' },
        ),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('Super Admin (global) can access across schools', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user_beta',
        schoolId: SCHOOL_2,
        firstName: 'Bob',
      });

      const result = await usersService.findById('user_beta', undefined, true);
      expect(result).toBeDefined();
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user_beta' },
        select: expect.any(Object),
      });
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Test 2 & 3: StudentsService cross-tenant isolation
  // ────────────────────────────────────────────────────────────────────────────
  describe('Test 2 & 3: StudentsService cross-tenant read & update boundaries', () => {
    let studentsService: StudentsService;
    let mockPrisma: any;

    beforeEach(() => {
      mockPrisma = {
        student: {
          findFirst: jest.fn(),
          findMany: jest.fn(),
          update: jest.fn(),
        },
      };
      studentsService = new StudentsService(mockPrisma);
    });

    it('Test 2: School 1 user requesting School 2 student returns 404', async () => {
      mockPrisma.student.findFirst.mockResolvedValue(null);

      await expect(
        studentsService.getStudentById(SCHOOL_1, 'student_beta'),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrisma.student.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'student_beta', schoolId: SCHOOL_1 },
        }),
      );
    });

    it('Test 3: School 1 user attempting to update School 2 student returns 404 and does not mutate', async () => {
      mockPrisma.student.findFirst.mockResolvedValue(null);

      await expect(
        studentsService.updateStudent(SCHOOL_1, 'student_beta', {
          bloodGroup: 'O+',
        } as any),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrisma.student.update).not.toHaveBeenCalled();
    });

    it('Missing schoolId in getStudents fails closed (ForbiddenException)', async () => {
      await expect(studentsService.getStudents('', 1, 10)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Test 4 & 5: FeesService cross-tenant fee collection & parent dues
  // ────────────────────────────────────────────────────────────────────────────
  describe('Test 4 & 5: FeesService cross-tenant isolation', () => {
    let feesService: FeesService;
    let mockPrisma: any;

    beforeEach(() => {
      mockPrisma = {
        academicYear: {
          findFirst: jest.fn(),
        },
        student: {
          findFirst: jest.fn(),
        },
        guardian: {
          findMany: jest.fn(),
        },
        feeStructure: {
          findMany: jest.fn(),
        },
        feePayment: {
          findMany: jest.fn(),
          create: jest.fn(),
        },
        $transaction: jest.fn(),
      };
      feesService = new FeesService(mockPrisma);
    });

    it('Test 4: School 1 user attempting to collect fee for School 2 student fails (NotFoundException)', async () => {
      mockPrisma.academicYear.findFirst.mockResolvedValue({
        id: 'ay_1',
        schoolId: SCHOOL_1,
      });
      // Student does not belong to SCHOOL_1
      mockPrisma.student.findFirst.mockResolvedValue(null);

      await expect(
        feesService.collectFee(SCHOOL_1, 'staff_1', {
          studentId: 'student_beta',
          academicYearId: 'ay_1',
          amountPaid: 5000,
          paymentMode: 'CASH',
        } as any),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('Test 5: getParentDues scopes guardian query strictly to caller schoolId', async () => {
      mockPrisma.guardian.findMany.mockResolvedValue([]);

      await feesService.getParentDues(SCHOOL_1, 'parent_user_1');

      expect(mockPrisma.guardian.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'parent_user_1',
          student: { schoolId: SCHOOL_1 },
        },
        include: expect.any(Object),
      });
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Test 6 & 7: AssignmentsService foreign-key validation & submission scoping
  // ────────────────────────────────────────────────────────────────────────────
  describe('Test 6 & 7: AssignmentsService cross-tenant isolation', () => {
    let assignmentsService: AssignmentsService;
    let mockPrisma: any;

    beforeEach(() => {
      mockPrisma = {
        academicYear: {
          findFirst: jest.fn(),
        },
        class: {
          findFirst: jest.fn(),
        },
        section: {
          findFirst: jest.fn(),
        },
        subject: {
          findFirst: jest.fn(),
        },
        staff: {
          findFirst: jest.fn(),
        },
        assignment: {
          findFirst: jest.fn(),
          create: jest.fn(),
        },
      };
      assignmentsService = new AssignmentsService(mockPrisma);
    });

    it('Test 6: createAssignment validates that classId belongs to caller school', async () => {
      mockPrisma.academicYear.findFirst.mockResolvedValue({ id: 'ay_1' });
      // Class belongs to another school
      mockPrisma.class.findFirst.mockResolvedValue(null);

      await expect(
        assignmentsService.createAssignment(
          SCHOOL_1,
          {
            classId: 'class_beta',
            subjectId: 'subj_1',
            title: 'Homework 1',
            dueDate: new Date().toISOString(),
          },
          'staff_1',
        ),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrisma.assignment.create).not.toHaveBeenCalled();
    });

    it('Test 7: getSubmissions for an assignment from another school returns 404', async () => {
      mockPrisma.assignment.findFirst.mockResolvedValue(null);

      await expect(
        assignmentsService.getSubmissions(SCHOOL_1, 'assignment_beta'),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrisma.assignment.findFirst).toHaveBeenCalledWith({
        where: { id: 'assignment_beta', schoolId: SCHOOL_1 },
        include: expect.any(Object),
      });
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Test 8 & 9: ExamsService student cross-school boundary enforcement
  // ────────────────────────────────────────────────────────────────────────────
  describe('Test 8 & 9: ExamsService student & marks cross-tenant boundaries', () => {
    let examsService: ExamsService;
    let mockPrisma: any;

    beforeEach(() => {
      mockPrisma = {
        examSubject: {
          findFirst: jest.fn(),
        },
        student: {
          findFirst: jest.fn(),
          findMany: jest.fn(),
        },
        reportCard: {
          findMany: jest.fn(),
        },
        studentMark: {
          findMany: jest.fn(),
        },
        $transaction: jest.fn(),
      };
      examsService = new ExamsService(mockPrisma);
    });

    it('Test 8: enterMarks fails if a student does not belong to caller school', async () => {
      mockPrisma.examSubject.findFirst.mockResolvedValue({
        id: 'es_1',
        maxMarks: 100,
        exam: { schoolId: SCHOOL_1 },
      });
      // One student belongs to another school
      mockPrisma.student.findMany.mockResolvedValue([
        { id: 'student_alpha' }, // 1 returned out of 2 requested
      ]);

      await expect(
        examsService.enterMarks(
          'es_1',
          SCHOOL_1,
          [
            { studentId: 'student_alpha', marksObtained: 85 },
            { studentId: 'student_beta_foreign', marksObtained: 70 },
          ],
          'teacher_1',
        ),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('Test 9: getStudentResults returns 404 if student does not belong to caller school', async () => {
      mockPrisma.student.findFirst.mockResolvedValue(null);

      await expect(
        examsService.getStudentResults('student_beta', SCHOOL_1),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrisma.reportCard.findMany).not.toHaveBeenCalled();
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // SUPER_ADMIN Global-Access Path & Dashboard Business Semantics
  // ────────────────────────────────────────────────────────────────────────────
  describe('SUPER_ADMIN Global-Access Path & Dashboard Business Semantics', () => {
    let dashboardController: DashboardController;
    let dashboardService: DashboardService;
    let mockPrisma: any;

    const superAdminReq = {
      user: {
        id: 'super_admin_user',
        role: 'SUPER_ADMIN' as UserRole,
        schoolId: null,
      },
    };

    const schoolAdminReq = {
      user: {
        id: 'school_admin_user',
        role: 'SCHOOL_ADMIN' as UserRole,
        schoolId: SCHOOL_1,
      },
    };

    const schoolAdminNoSchoolReq = {
      user: {
        id: 'school_admin_bad',
        role: 'SCHOOL_ADMIN' as UserRole,
        schoolId: null,
      },
    };

    beforeEach(() => {
      mockPrisma = {
        school: {
          count: jest.fn().mockResolvedValue(5),
          findMany: jest.fn().mockResolvedValue([]),
        },
        user: {
          count: jest.fn().mockResolvedValue(100),
          findMany: jest.fn().mockResolvedValue([]),
        },
        class: {
          count: jest.fn().mockResolvedValue(12),
        },
        feePayment: {
          aggregate: jest.fn().mockResolvedValue({
            _sum: { paidAmount: 500000, outstandingAmount: 50000 },
          }),
        },
        staffAttendance: {
          count: jest.fn().mockResolvedValue(20),
        },
        leaveRequest: {
          count: jest.fn().mockResolvedValue(2),
        },
        attendanceRecord: {
          findMany: jest.fn().mockResolvedValue([{ status: 'PRESENT' }]),
        },
        admissionEnquiry: {
          count: jest.fn().mockResolvedValue(10),
        },
        admissionApplication: {
          count: jest.fn().mockResolvedValue(5),
        },
        activityLog: {
          findMany: jest.fn().mockResolvedValue([]),
        },
      };
      dashboardService = new DashboardService(mockPrisma);
      dashboardController = new DashboardController(dashboardService);
    });

    it('SUPER_ADMIN can access global fleet dashboard (GET /dashboard/super-admin)', async () => {
      const result = await dashboardController.getSuperAdminDashboard();
      expect(result).toHaveProperty('fleet');
      expect(result).toHaveProperty('systemHealth');
    });

    it('SUPER_ADMIN receives legitimate global stats (GET /dashboard/stats)', async () => {
      const result = await dashboardController.getStats(superAdminReq);
      expect(result).toHaveProperty('stats');
      expect(result.stats.length).toBeGreaterThan(0);
      expect(mockPrisma.user.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({ schoolId: expect.anything() }),
        }),
      );
    });

    it('SUPER_ADMIN receives fleet-wide campus operations (GET /dashboard/school-admin)', async () => {
      const result =
        await dashboardController.getSchoolAdminDashboard(superAdminReq);
      expect(result).toHaveProperty('kpis');
      expect(mockPrisma.class.count).toHaveBeenCalledWith({ where: {} });
    });

    it('SUPER_ADMIN without schoolId is rejected from inherently school-scoped GET /dashboard/principal', async () => {
      await expect(
        dashboardController.getPrincipalDashboard(superAdminReq),
      ).rejects.toThrow(ForbiddenException);
    });

    it('SUPER_ADMIN without schoolId is rejected from inherently school-scoped GET /dashboard/teacher', async () => {
      await expect(
        dashboardController.getTeacherDashboard(superAdminReq),
      ).rejects.toThrow(ForbiddenException);
    });

    it('SUPER_ADMIN without schoolId is rejected from inherently school-scoped GET /dashboard/student', async () => {
      await expect(
        dashboardController.getStudentDashboard(superAdminReq),
      ).rejects.toThrow(ForbiddenException);
    });

    it('SUPER_ADMIN without schoolId is rejected from inherently school-scoped GET /dashboard/parent', async () => {
      await expect(
        dashboardController.getParentDashboard(superAdminReq),
      ).rejects.toThrow(ForbiddenException);
    });

    it('SUPER_ADMIN without schoolId is rejected from inherently school-scoped GET /dashboard/parent-detail', async () => {
      await expect(
        dashboardController.getParentDetail(superAdminReq),
      ).rejects.toThrow(ForbiddenException);
    });

    it('School-scoped user without schoolId fails closed on GET /dashboard/stats', async () => {
      await expect(
        dashboardController.getStats(schoolAdminNoSchoolReq),
      ).rejects.toThrow(ForbiddenException);
    });

    it('School-scoped user with valid schoolId accesses their scoped GET /dashboard/school-admin', async () => {
      const result =
        await dashboardController.getSchoolAdminDashboard(schoolAdminReq);
      expect(result).toHaveProperty('kpis');
      expect(mockPrisma.class.count).toHaveBeenCalledWith({
        where: { schoolId: SCHOOL_1 },
      });
    });

    it('SUPER_ADMIN can list all users globally without schoolId filter', async () => {
      const usersService = new UsersService(mockPrisma);
      mockPrisma.user.findMany.mockResolvedValue([]);
      mockPrisma.user.count.mockResolvedValue(0);

      await usersService.findAll(
        null as any,
        { page: 1, limit: 10 },
        superAdminReq.user,
      );

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({ schoolId: expect.anything() }),
        }),
      );
    });

    it('School-scoped user listing users is strictly scoped to their schoolId', async () => {
      const usersService = new UsersService(mockPrisma);
      mockPrisma.user.findMany.mockResolvedValue([]);
      mockPrisma.user.count.mockResolvedValue(0);

      await usersService.findAll(
        SCHOOL_1,
        { page: 1, limit: 10 },
        schoolAdminReq.user,
      );

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ schoolId: SCHOOL_1 }),
        }),
      );
    });
  });
});
