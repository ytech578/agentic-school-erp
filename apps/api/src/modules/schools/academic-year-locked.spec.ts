import { Test, TestingModule } from '@nestjs/testing';
import { AcademicYearsService } from './academic-years.service';
import { ClassesService } from '../classes/classes.service';
import { StudentEnrollmentService } from '../students/student-enrollment.service';
import { CurriculumService } from '../curriculum/curriculum.service';
import { PrismaService } from '../../core/database/prisma.service';
import { BadRequestException } from '@nestjs/common';

describe('Academic Year Locking & Integrity Enforcement', () => {
  let academicYearsService: AcademicYearsService;
  let classesService: ClassesService;
  let enrollmentService: StudentEnrollmentService;
  let curriculumService: CurriculumService;
  let prisma: any;

  const schoolId = 'school-alpha';
  const lockedYearId = 'ay-locked-2025';
  const openYearId = 'ay-open-2026';

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn().mockImplementation((cb) => cb(prisma)),
      academicYear: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      class: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      section: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      teacherAssignment: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      schoolSubjectOffering: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      student: {
        findFirst: jest.fn(),
      },
      studentEnrollment: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      staff: {
        findFirst: jest.fn(),
      },
      school: {
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AcademicYearsService,
        ClassesService,
        StudentEnrollmentService,
        CurriculumService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    academicYearsService =
      module.get<AcademicYearsService>(AcademicYearsService);
    classesService = module.get<ClassesService>(ClassesService);
    enrollmentService = module.get<StudentEnrollmentService>(
      StudentEnrollmentService,
    );
    curriculumService = module.get<CurriculumService>(CurriculumService);
  });

  describe('AcademicYearsService - Date Validation & Activation', () => {
    it('throws BadRequestException if startDate >= endDate', async () => {
      await expect(
        academicYearsService.createAcademicYear(schoolId, {
          name: '2026-2027',
          startDate: '2026-06-01',
          endDate: '2026-05-01', // End before start
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('atomically deactivates previous active years when setting new active year', async () => {
      prisma.academicYear.findFirst.mockResolvedValue({
        id: openYearId,
        schoolId,
        name: '2026-2027',
        isActive: false,
        isLocked: false,
      });
      prisma.academicYear.update.mockResolvedValue({
        id: openYearId,
        schoolId,
        name: '2026-2027',
        isActive: true,
      });

      const result = await academicYearsService.setActiveAcademicYear(
        schoolId,
        openYearId,
      );

      expect(prisma.academicYear.updateMany).toHaveBeenCalledWith({
        where: { schoolId, isActive: true },
        data: { isActive: false },
      });
      expect(prisma.academicYear.update).toHaveBeenCalledWith({
        where: { id: openYearId },
        data: { isActive: true },
      });
      expect(result.isActive).toBe(true);
    });
  });

  describe('Locked Academic Year Mutation Enforcement', () => {
    beforeEach(() => {
      prisma.academicYear.findFirst.mockImplementation(({ where }: any) => {
        if (
          where.id === lockedYearId ||
          (where.isActive && where.schoolId === schoolId)
        ) {
          return Promise.resolve({
            id: lockedYearId,
            schoolId,
            name: '2024-2025 (Locked)',
            isLocked: true,
            isActive: true,
          });
        }
        return Promise.resolve({
          id: openYearId,
          schoolId,
          name: '2025-2026 (Active)',
          isLocked: false,
          isActive: false,
        });
      });
    });

    it('rejects creating class in locked academic year', async () => {
      await expect(
        classesService.createClass(schoolId, {
          name: 'Class 10',
          academicYearId: lockedYearId,
          numericLevel: 10,
        }),
      ).rejects.toThrow(/is locked/i);
    });

    it('rejects creating section in locked academic year', async () => {
      prisma.class.findFirst.mockResolvedValue({
        id: 'class-1',
        schoolId,
        name: 'Class 10',
        academicYearId: lockedYearId,
        academicYear: { id: lockedYearId, name: '2024-2025', isLocked: true },
      });

      await expect(
        classesService.createSection(schoolId, 'class-1', {
          name: 'B',
        }),
      ).rejects.toThrow(/is locked/i);
    });

    it('rejects assigning teacher in locked academic year', async () => {
      prisma.staff.findFirst.mockResolvedValue({
        id: 'staff-1',
        schoolId,
        isActive: true,
        user: { firstName: 'John', lastName: 'Doe' },
      });
      prisma.section.findFirst.mockResolvedValue({
        id: 'sec-1',
        name: 'A',
        class: {
          id: 'class-1',
          schoolId,
          academicYearId: lockedYearId,
          academicYear: { id: lockedYearId, name: '2024-2025', isLocked: true },
        },
      });

      await expect(
        classesService.createTeacherAssignment(schoolId, {
          staffId: 'staff-1',
          sectionId: 'sec-1',
          isClassTeacher: true,
        }),
      ).rejects.toThrow(/is locked/i);
    });

    it('rejects student homeroom enrollment in locked academic year', async () => {
      prisma.student.findFirst.mockResolvedValue({
        id: 'std-1',
        schoolId,
        admissionNumber: 'ADM001',
        user: { firstName: 'Alice', lastName: 'Smith' },
      });
      prisma.section.findFirst.mockResolvedValue({
        id: 'sec-1',
        class: { schoolId, academicYearId: lockedYearId },
      });

      await expect(
        enrollmentService.createEnrollment(schoolId, {
          studentId: 'std-1',
          sectionId: 'sec-1',
          academicYearId: lockedYearId,
        }),
      ).rejects.toThrow(/is locked/i);
    });

    it('rejects school subject offering creation in locked active academic year', async () => {
      prisma.school.findUnique.mockResolvedValue({
        id: schoolId,
        activeCurriculumId: 'curr-1',
      });

      await expect(
        curriculumService.createSchoolOffering(schoolId, {
          gradeFrom: 1,
          gradeTo: 5,
          globalSubjectId: 'gsub-1',
        }),
      ).rejects.toThrow(/is locked/i);
    });
  });
});
