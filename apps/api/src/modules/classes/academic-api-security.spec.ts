import { Test, TestingModule } from '@nestjs/testing';
import { ClassesService } from './classes.service';
import { StudentEnrollmentService } from '../students/student-enrollment.service';
import { CurriculumService } from '../curriculum/curriculum.service';
import { AcademicYearsService } from '../schools/academic-years.service';
import { PrismaService } from '../../core/database/prisma.service';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { EnrollmentStatus } from '@prisma/client';

describe('Academic API Tenant Security & Boundary Isolation', () => {
  let classesService: ClassesService;
  let enrollmentService: StudentEnrollmentService;
  let curriculumService: CurriculumService;
  let academicYearsService: AcademicYearsService;
  let prisma: any;

  const tenantA = 'school-alpha';
  const tenantB = 'school-beta';

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn().mockImplementation((cb) => cb(prisma)),
      academicYear: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        delete: jest.fn(),
      },
      class: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      section: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      staff: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
      },
      subject: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      teacherAssignment: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      student: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
      },
      studentEnrollment: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      school: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      board: {
        findUnique: jest.fn(),
      },
      curriculum: {
        findUnique: jest.fn(),
      },
      curriculumSubject: {
        findUnique: jest.fn(),
      },
      globalSubject: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
      schoolSubjectOffering: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      studentSubjectEnrollment: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        upsert: jest.fn(),
        delete: jest.fn(),
      },
      classSubject: {
        upsert: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClassesService,
        StudentEnrollmentService,
        CurriculumService,
        AcademicYearsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    classesService = module.get<ClassesService>(ClassesService);
    enrollmentService = module.get<StudentEnrollmentService>(
      StudentEnrollmentService,
    );
    curriculumService = module.get<CurriculumService>(CurriculumService);
    academicYearsService =
      module.get<AcademicYearsService>(AcademicYearsService);
  });

  describe('1. Server-Authoritative Tenant Requirement (Step 2)', () => {
    it('rejects unauthenticated/empty schoolId with ForbiddenException (fail-closed)', async () => {
      await expect(classesService.findAll('')).rejects.toThrow(
        ForbiddenException,
      );
      await expect(enrollmentService.listEnrollments('', {})).rejects.toThrow(
        ForbiddenException,
      );
      await expect(curriculumService.getSchoolOfferings('')).rejects.toThrow(
        ForbiddenException,
      );
      await expect(academicYearsService.getAcademicYears('')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('2. Cross-Tenant Data Isolation (Step 23)', () => {
    it('prevents Tenant A from viewing Tenant B class', async () => {
      prisma.class.findFirst.mockResolvedValue(null);

      await expect(
        classesService.getClassById(tenantA, 'class-belonging-to-tenant-b'),
      ).rejects.toThrow(NotFoundException);

      expect(prisma.class.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: 'class-belonging-to-tenant-b',
            schoolId: tenantA,
          }),
        }),
      );
    });

    it('prevents Tenant A from viewing Tenant B section', async () => {
      prisma.section.findFirst.mockResolvedValue(null);

      await expect(
        classesService.getSectionById(tenantA, 'sec-belonging-to-tenant-b'),
      ).rejects.toThrow(NotFoundException);

      expect(prisma.section.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: 'sec-belonging-to-tenant-b',
            class: { schoolId: tenantA },
          }),
        }),
      );
    });

    it('prevents Tenant A from accessing Tenant B teacher assignment', async () => {
      prisma.teacherAssignment.findFirst.mockResolvedValue(null);

      await expect(
        classesService.getTeacherAssignmentById(tenantA, 'ta-tenant-b'),
      ).rejects.toThrow(NotFoundException);

      expect(prisma.teacherAssignment.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: 'ta-tenant-b',
            schoolId: tenantA,
          }),
        }),
      );
    });

    it('prevents Tenant A from accessing Tenant B student enrollment', async () => {
      prisma.studentEnrollment.findFirst.mockResolvedValue(null);

      await expect(
        enrollmentService.getEnrollmentById(tenantA, 'enr-tenant-b'),
      ).rejects.toThrow(NotFoundException);

      expect(prisma.studentEnrollment.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: 'enr-tenant-b',
            section: { class: { schoolId: tenantA } },
          }),
        }),
      );
    });

    it('prevents Tenant A from accessing Tenant B school offering', async () => {
      prisma.schoolSubjectOffering.findFirst.mockResolvedValue(null);

      await expect(
        curriculumService.getSchoolOfferingById(tenantA, 'offering-tenant-b'),
      ).rejects.toThrow(NotFoundException);

      expect(prisma.schoolSubjectOffering.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: 'offering-tenant-b',
            schoolId: tenantA,
          }),
        }),
      );
    });
  });

  describe('3. Cross-Relationship Gaps & Foreign Key Tampering (Step 3, 6, 23)', () => {
    it('rejects teacher assignment when staff belongs to School B and section belongs to School A', async () => {
      prisma.staff.findFirst.mockResolvedValue(null); // Staff not found for School A

      await expect(
        classesService.createTeacherAssignment(tenantA, {
          staffId: 'staff-from-school-b',
          sectionId: 'sec-school-a',
          isClassTeacher: true,
        }),
      ).rejects.toThrow('Faculty / Staff member not found in this school');
    });

    it('rejects student enrollment when student belongs to School B and section belongs to School A', async () => {
      prisma.student.findFirst.mockResolvedValue(null); // Student not found for School A

      await expect(
        enrollmentService.createEnrollment(tenantA, {
          studentId: 'student-from-school-b',
          sectionId: 'sec-school-a',
        }),
      ).rejects.toThrow('Student not found in this school');
    });
  });

  describe('4. Cross-Year Invariant Mismatches (Step 3, 6, 23)', () => {
    it('rejects student enrollment if requested academic year mismatches section class academic year', async () => {
      prisma.student.findFirst.mockResolvedValue({
        id: 'std-1',
        schoolId: tenantA,
        isActive: true,
      });
      prisma.section.findFirst.mockResolvedValue({
        id: 'sec-1',
        class: {
          id: 'cls-1',
          schoolId: tenantA,
          academicYearId: 'year-2025',
          academicYear: { id: 'year-2025', isLocked: false },
        },
      });

      await expect(
        enrollmentService.createEnrollment(tenantA, {
          studentId: 'std-1',
          sectionId: 'sec-1',
          academicYearId: 'year-2026', // Mismatch!
        }),
      ).rejects.toThrow(
        'Specified academic year does not match section class academic year',
      );
    });

    it('rejects teacher assignment if requested academic year mismatches section class academic year', async () => {
      prisma.staff.findFirst.mockResolvedValue({
        id: 'staff-1',
        schoolId: tenantA,
        isActive: true,
      });
      prisma.section.findFirst.mockResolvedValue({
        id: 'sec-1',
        class: {
          id: 'cls-1',
          schoolId: tenantA,
          academicYearId: 'year-2025',
          academicYear: { id: 'year-2025', isLocked: false },
        },
      });

      await expect(
        classesService.createTeacherAssignment(tenantA, {
          staffId: 'staff-1',
          sectionId: 'sec-1',
          academicYearId: 'year-2026', // Mismatch!
          isClassTeacher: true,
        }),
      ).rejects.toThrow(
        'Specified academic year does not match section class academic year',
      );
    });
  });

  describe('5. Teacher Assignment Update Tampering (Step 7 & 8)', () => {
    it('rejects updating teacher assignment with a cross-school staff ID', async () => {
      prisma.teacherAssignment.findFirst.mockResolvedValue({
        id: 'ta-1',
        schoolId: tenantA,
        academicYearId: 'year-2025',
        staffId: 'staff-old',
        sectionId: 'sec-1',
        academicYear: { name: '2025-2026', isLocked: false },
        section: {
          class: {
            schoolId: tenantA,
            academicYearId: 'year-2025',
            numericLevel: 10,
          },
        },
      });
      // Target new staffId belongs to School B, so findFirst returns null
      prisma.staff.findFirst.mockResolvedValue(null);

      await expect(
        classesService.updateTeacherAssignment(tenantA, 'ta-1', {
          staffId: 'staff-from-school-b',
        }),
      ).rejects.toThrow('Faculty / Staff member not found in this school');
    });

    it('rejects updating teacher assignment with contradictory subject and offering IDs', async () => {
      prisma.teacherAssignment.findFirst.mockResolvedValue({
        id: 'ta-1',
        schoolId: tenantA,
        academicYearId: 'year-2025',
        staffId: 'staff-1',
        sectionId: 'sec-1',
        academicYear: { name: '2025-2026', isLocked: false },
        section: {
          class: {
            schoolId: tenantA,
            academicYearId: 'year-2025',
            numericLevel: 10,
          },
        },
      });
      prisma.staff.findFirst.mockResolvedValue({
        id: 'staff-1',
        schoolId: tenantA,
        isActive: true,
      });
      prisma.schoolSubjectOffering.findFirst.mockResolvedValue({
        id: 'off-physics',
        schoolId: tenantA,
        academicYearId: 'year-2025',
        legacySubjectId: 'sub-physics-legacy',
        gradeFrom: 9,
        gradeTo: 10,
      });

      await expect(
        classesService.updateTeacherAssignment(tenantA, 'ta-1', {
          schoolSubjectOfferingId: 'off-physics',
          subjectId: 'sub-history-contradictory', // Contradicts offering!
        }),
      ).rejects.toThrow(
        'Subject ID contradicts the legacy subject mapped to the specified subject offering',
      );
    });

    it('rejects updating teacher assignment if offering grade band does not cover class level', async () => {
      prisma.teacherAssignment.findFirst.mockResolvedValue({
        id: 'ta-1',
        schoolId: tenantA,
        academicYearId: 'year-2025',
        staffId: 'staff-1',
        sectionId: 'sec-1',
        academicYear: { name: '2025-2026', isLocked: false },
        section: {
          class: {
            schoolId: tenantA,
            academicYearId: 'year-2025',
            numericLevel: 5, // 5th Grade
          },
        },
      });
      prisma.staff.findFirst.mockResolvedValue({
        id: 'staff-1',
        schoolId: tenantA,
        isActive: true,
      });
      prisma.schoolSubjectOffering.findFirst.mockResolvedValue({
        id: 'off-senior-chemistry',
        schoolId: tenantA,
        academicYearId: 'year-2025',
        gradeFrom: 11,
        gradeTo: 12, // Grades 11-12
      });

      await expect(
        classesService.updateTeacherAssignment(tenantA, 'ta-1', {
          schoolSubjectOfferingId: 'off-senior-chemistry',
        }),
      ).rejects.toThrow(
        'Subject offering grade band (11-12) does not cover class level (5)',
      );
    });
  });

  describe('6. Class & Academic Year Update Uniqueness (Step 14 & 16)', () => {
    it('rejects renaming a class if duplicate name exists in same academic session', async () => {
      prisma.class.findFirst
        .mockResolvedValueOnce({
          id: 'cls-1',
          schoolId: tenantA,
          academicYearId: 'year-2025',
          name: 'Class 10-A',
          academicYear: { name: '2025-2026', isLocked: false },
        })
        .mockResolvedValueOnce({
          id: 'cls-duplicate',
          name: 'Class 10-B',
        });

      await expect(
        classesService.updateClass(tenantA, 'cls-1', {
          name: 'Class 10-B',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects renaming an academic year if duplicate name exists for school', async () => {
      prisma.academicYear.findFirst
        .mockResolvedValueOnce({
          id: 'ay-1',
          schoolId: tenantA,
          name: '2025-2026',
          startDate: new Date('2025-06-01'),
          endDate: new Date('2026-04-30'),
          isLocked: false,
        })
        .mockResolvedValueOnce({
          id: 'ay-dup',
          name: '2026-2027',
        });

      await expect(
        academicYearsService.updateAcademicYear(tenantA, 'ay-1', {
          name: '2026-2027',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('7. Locked Year Enforcement Across All Academic Mutations (Step 17)', () => {
    it('rejects class update on locked academic year', async () => {
      prisma.class.findFirst.mockResolvedValue({
        id: 'cls-locked',
        schoolId: tenantA,
        academicYear: { name: '2024-2025 (Locked)', isLocked: true },
      });

      await expect(
        classesService.updateClass(tenantA, 'cls-locked', { name: 'New Name' }),
      ).rejects.toThrow('is locked. Structural changes are not permitted.');
    });

    it('rejects teacher assignment update on locked academic year', async () => {
      prisma.teacherAssignment.findFirst.mockResolvedValue({
        id: 'ta-locked',
        schoolId: tenantA,
        academicYear: { name: '2024-2025 (Locked)', isLocked: true },
      });

      await expect(
        classesService.updateTeacherAssignment(tenantA, 'ta-locked', {
          isClassTeacher: true,
        }),
      ).rejects.toThrow('is locked. Structural changes are not permitted.');
    });

    it('rejects student enrollment status update on locked academic year', async () => {
      prisma.studentEnrollment.findFirst.mockResolvedValue({
        id: 'enr-locked',
        section: { class: { schoolId: tenantA } },
        academicYear: { name: '2024-2025 (Locked)', isLocked: true },
      });

      await expect(
        enrollmentService.updateEnrollmentStatus(tenantA, 'enr-locked', {
          status: EnrollmentStatus.TRANSFERRED,
        }),
      ).rejects.toThrow('is locked. Structural changes are not permitted.');
    });

    it('rejects school subject offering update on locked academic year', async () => {
      prisma.schoolSubjectOffering.findFirst.mockResolvedValue({
        id: 'off-locked',
        schoolId: tenantA,
        academicYear: { name: '2024-2025 (Locked)', isLocked: true },
      });

      await expect(
        curriculumService.updateSchoolOffering(tenantA, 'off-locked', {
          periodsPerWeek: 6,
        }),
      ).rejects.toThrow('is locked. Structural changes are not permitted.');
    });

    it('rejects syncing class subjects on locked academic year', async () => {
      prisma.class.findFirst.mockResolvedValue({
        id: 'cls-locked',
        schoolId: tenantA,
        academicYear: { name: '2024-2025 (Locked)', isLocked: true },
      });

      await expect(
        curriculumService.syncClassSubjects(tenantA, 'cls-locked'),
      ).rejects.toThrow('is locked. Structural changes are not permitted.');
    });
  });
});
