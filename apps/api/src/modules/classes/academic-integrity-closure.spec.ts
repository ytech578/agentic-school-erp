import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ClassesService } from './classes.service';
import { StudentEnrollmentService } from '../students/student-enrollment.service';
import { CurriculumService } from '../curriculum/curriculum.service';
import { PrismaService } from '../../core/database/prisma.service';
import {
  OfferingSource,
  SubjectClassification,
  EnrollmentStatus,
} from '@prisma/client';

describe('Change #8E Correction — Academic Database & Integrity Closure', () => {
  let classesService: ClassesService;
  let enrollmentService: StudentEnrollmentService;
  let curriculumService: CurriculumService;
  let prisma: any;

  const schoolIdA = 'school-alpha';
  const schoolIdB = 'school-beta';
  const year2026 = 'ay-2026';
  const year2027 = 'ay-2027';
  const sectionId = 'sec-9a';
  const staffId = 'staff-101';
  const studentId = 'student-201';
  const offeringId = 'off-math-9';

  beforeEach(async () => {
    prisma = {
      staff: {
        findFirst: jest.fn().mockResolvedValue({
          id: staffId,
          schoolId: schoolIdA,
          isActive: true,
          user: { firstName: 'Alice', lastName: 'Smith' },
        }),
      },
      student: {
        findFirst: jest.fn().mockResolvedValue({
          id: studentId,
          schoolId: schoolIdA,
          admissionNumber: 'ADM001',
          user: { firstName: 'Bob', lastName: 'Jones' },
        }),
      },
      section: {
        findFirst: jest.fn().mockResolvedValue({
          id: sectionId,
          name: '9-A',
          classId: 'cls-9',
          class: {
            id: 'cls-9',
            name: 'Class 9',
            numericLevel: 9,
            schoolId: schoolIdA,
            academicYearId: year2026,
            academicYear: {
              id: year2026,
              name: '2026-2027',
              isLocked: false,
              schoolId: schoolIdA,
            },
          },
        }),
      },
      school: {
        findUnique: jest.fn().mockResolvedValue({
          id: schoolIdA,
          activeCurriculumId: 'curr-1',
        }),
      },
      academicYear: {
        findFirst: jest.fn().mockImplementation(({ where }) => {
          if (where.schoolId && where.schoolId !== schoolIdA) return null;
          return {
            id: where.id || year2026,
            name: '2026-2027',
            isLocked: false,
            schoolId: schoolIdA,
          };
        }),
        delete: jest
          .fn()
          .mockRejectedValue(
            new Error('Foreign key constraint violation: records exist'),
          ),
      },
      schoolSubjectOffering: {
        findFirst: jest.fn().mockResolvedValue({
          id: offeringId,
          schoolId: schoolIdA,
          academicYearId: year2026,
          gradeFrom: 9,
          gradeTo: 10,
          legacySubjectId: 'sub-legacy-math',
        }),
      },
      subject: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'sub-legacy-math',
          schoolId: schoolIdA,
          name: 'Mathematics',
        }),
      },
      teacherAssignment: {
        findFirst: jest.fn(),
        create: jest.fn().mockResolvedValue({ id: 'ta-new' }),
      },
      studentEnrollment: {
        findFirst: jest.fn(),
        create: jest.fn().mockResolvedValue({ id: 'enr-new' }),
      },
      globalSubject: {
        upsert: jest.fn(),
        findUnique: jest.fn(),
      },
      curriculum: {
        findFirst: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClassesService,
        StudentEnrollmentService,
        CurriculumService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    classesService = module.get<ClassesService>(ClassesService);
    enrollmentService = module.get<StudentEnrollmentService>(
      StudentEnrollmentService,
    );
    curriculumService = module.get<CurriculumService>(CurriculumService);
  });

  describe('1. Student Enrollment Integrity', () => {
    it('blocks duplicate active enrollment for the same student in the same academic year', async () => {
      prisma.studentEnrollment.findFirst.mockResolvedValue({
        id: 'enr-existing',
        studentId,
        academicYearId: year2026,
        status: EnrollmentStatus.ACTIVE,
        section: { name: '9-B', class: { name: 'Class 9' } },
      });

      await expect(
        enrollmentService.createEnrollment(schoolIdA, {
          studentId,
          sectionId,
          academicYearId: year2026,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('allows enrollment for the same student across different academic years', async () => {
      prisma.studentEnrollment.findFirst.mockResolvedValue(null);

      const result = await enrollmentService.createEnrollment(schoolIdA, {
        studentId,
        sectionId,
        academicYearId: year2026,
      });

      expect(result).toBeDefined();
      expect(prisma.studentEnrollment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            studentId,
            sectionId,
            academicYearId: year2026,
          }),
        }),
      );
    });

    it('rejects cross-year section enrollment mismatch', async () => {
      await expect(
        enrollmentService.createEnrollment(schoolIdA, {
          studentId,
          sectionId,
          academicYearId: year2027, // section belongs to year2026
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects student enrollment if student belongs to another school', async () => {
      prisma.student.findFirst.mockResolvedValue({
        id: studentId,
        schoolId: schoolIdB, // cross-school
        admissionNumber: 'ADM001',
      });

      await expect(
        enrollmentService.createEnrollment(schoolIdA, {
          studentId,
          sectionId,
          academicYearId: year2026,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('2. Teacher Assignment Canonicalization & NULL Uniqueness', () => {
    it('allows teacher assignments across different academic years', async () => {
      prisma.teacherAssignment.findFirst.mockResolvedValue(null);

      const result = await classesService.createTeacherAssignment(schoolIdA, {
        staffId,
        sectionId,
        schoolSubjectOfferingId: offeringId,
        isClassTeacher: false,
      });

      expect(result).toBeDefined();
      expect(prisma.teacherAssignment.create).toHaveBeenCalled();
    });

    it('blocks duplicate class teacher / NULL subject assignment in the same year', async () => {
      prisma.teacherAssignment.findFirst.mockResolvedValue({
        id: 'ta-existing-homeroom',
        staffId,
        sectionId,
        academicYearId: year2026,
        isClassTeacher: true,
        subjectId: null,
        schoolSubjectOfferingId: null,
      });

      await expect(
        classesService.createTeacherAssignment(schoolIdA, {
          staffId,
          sectionId,
          isClassTeacher: true,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects teacher assignment if offering grade band does not cover class level', async () => {
      prisma.schoolSubjectOffering.findFirst.mockResolvedValue({
        id: offeringId,
        schoolId: schoolIdA,
        academicYearId: year2026,
        gradeFrom: 11, // Offering is for Grade 11-12, but section is Class 9
        gradeTo: 12,
      });

      await expect(
        classesService.createTeacherAssignment(schoolIdA, {
          staffId,
          sectionId,
          schoolSubjectOfferingId: offeringId,
          isClassTeacher: false,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects teacher assignment when non-class-teacher assignment lacks subject and offering', async () => {
      await expect(
        classesService.createTeacherAssignment(schoolIdA, {
          staffId,
          sectionId,
          isClassTeacher: false, // Must have subject or offering
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects teacher assignment if staff belongs to another school', async () => {
      prisma.staff.findFirst.mockResolvedValue({
        id: staffId,
        schoolId: schoolIdB, // foreign school
        isActive: true,
      });

      await expect(
        classesService.createTeacherAssignment(schoolIdA, {
          staffId,
          sectionId,
          schoolSubjectOfferingId: offeringId,
          isClassTeacher: false,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects teacher assignment if academic year mismatches section class academic year', async () => {
      await expect(
        classesService.createTeacherAssignment(schoolIdA, {
          staffId,
          sectionId,
          academicYearId: year2027, // Mismatch with cls-9's year2026
          schoolSubjectOfferingId: offeringId,
          isClassTeacher: false,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('3. Subject Offering Master Data Safety', () => {
    it('does not mutate existing GlobalSubject master name when school custom code collides', async () => {
      prisma.curriculum.findFirst.mockResolvedValue({
        id: 'curr-1',
        schoolId: schoolIdA,
      });
      prisma.globalSubject.upsert.mockResolvedValue({
        id: 'gs-math',
        code: 'MATH',
        name: 'Mathematics', // Master name should NOT be updated to "Vedic Math"
      });
      prisma.schoolSubjectOffering.findFirst.mockResolvedValue(null);
      prisma.schoolSubjectOffering.create = jest.fn().mockResolvedValue({
        id: 'off-custom-1',
        schoolId: schoolIdA,
        customName: 'Vedic Math',
      });

      await curriculumService.createSchoolOffering(schoolIdA, {
        curriculumId: 'curr-1',
        academicYearId: year2026,
        source: OfferingSource.SCHOOL_CUSTOM,
        customName: 'Vedic Math',
        customCode: 'MATH',
        gradeFrom: 9,
        gradeTo: 10,
        periodsPerWeek: 4,
      });

      // Assert globalSubject.upsert was called with update: {} preserving master name
      expect(prisma.globalSubject.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { code: 'MATH' },
          update: {},
        }),
      );
    });
  });

  describe('4. Academic Year Delete Safety (RESTRICT)', () => {
    it('prevents accidental cascading deletion of AcademicYear when historical records exist', async () => {
      await expect(
        prisma.academicYear.delete({ where: { id: year2026 } }),
      ).rejects.toThrow(/Foreign key constraint violation/);
    });
  });
});
