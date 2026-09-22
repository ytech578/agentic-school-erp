/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return */
import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ClassesService } from '../classes/classes.service';
import { SchoolsService } from '../schools/schools.service';
import { CurriculumService } from './curriculum.service';
import { AcademicIntegrityService } from './academic-integrity.service';
import { PrismaService } from '../../core/database/prisma.service';

describe('Change #8E — Academic Invariants & Constraints Enforcement', () => {
  let classesService: ClassesService;
  let schoolsService: SchoolsService;
  let curriculumService: CurriculumService;
  let integrityService: AcademicIntegrityService;
  let mockPrisma: any;

  beforeEach(async () => {
    mockPrisma = {
      academicYear: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      class: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      section: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
      school: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      curriculum: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      globalSubject: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
      subject: {
        findFirst: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      schoolSubjectOffering: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        update: jest.fn(),
      },
      student: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      studentEnrollment: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        updateMany: jest.fn(),
        upsert: jest.fn(),
      },
      studentSubjectEnrollment: {
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn(),
        upsert: jest.fn(),
      },
      teacherAssignment: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        upsert: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation((cb: (tx: any) => any) => {
        if (typeof cb === 'function') {
          return cb(mockPrisma);
        }
        return cb;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClassesService,
        SchoolsService,
        CurriculumService,
        AcademicIntegrityService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    classesService = module.get<ClassesService>(ClassesService);
    schoolsService = module.get<SchoolsService>(SchoolsService);
    curriculumService = module.get<CurriculumService>(CurriculumService);
    integrityService = module.get<AcademicIntegrityService>(
      AcademicIntegrityService,
    );
  });

  describe('1. Academic Year Invariants', () => {
    it('rejects academic year when startDate >= endDate', async () => {
      await expect(
        schoolsService.createAcademicYear('school-1', {
          name: '2026-27',
          startDate: '2027-04-01',
          endDate: '2026-03-31',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects invalid date strings for academic year', async () => {
      await expect(
        schoolsService.createAcademicYear('school-1', {
          name: '2026-27',
          startDate: 'invalid-date',
          endDate: '2027-03-31',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('enforces single active academic year atomically in a transaction on creation', async () => {
      mockPrisma.academicYear.create.mockResolvedValue({
        id: 'ay-new',
        schoolId: 'school-1',
        name: '2026-27',
        isActive: true,
      });

      const created = await schoolsService.createAcademicYear('school-1', {
        name: '2026-27',
        startDate: '2026-04-01',
        endDate: '2027-03-31',
      });

      expect(mockPrisma.academicYear.updateMany).toHaveBeenCalledWith({
        where: { schoolId: 'school-1', isActive: true },
        data: { isActive: false },
      });
      expect(mockPrisma.academicYear.create).toHaveBeenCalled();
      expect(created.id).toBe('ay-new');
    });

    it('sets active academic year atomically inside a transaction', async () => {
      mockPrisma.academicYear.findFirst.mockResolvedValue({
        id: 'ay-target',
        schoolId: 'school-1',
      });
      mockPrisma.academicYear.update.mockResolvedValue({
        id: 'ay-target',
        isActive: true,
      });

      const updated = await schoolsService.setActiveAcademicYear(
        'school-1',
        'ay-target',
      );

      expect(mockPrisma.academicYear.updateMany).toHaveBeenCalledWith({
        where: { schoolId: 'school-1', isActive: true },
        data: { isActive: false },
      });
      expect(mockPrisma.academicYear.update).toHaveBeenCalledWith({
        where: { id: 'ay-target' },
        data: { isActive: true },
      });
      expect(updated.isActive).toBe(true);
    });
  });

  describe('2. Class / Grade Invariants', () => {
    it('rejects class creation if academicYearId does not belong to the school', async () => {
      mockPrisma.academicYear.findFirst.mockResolvedValue(null);

      await expect(
        classesService.createClass('school-1', {
          name: 'Class 10',
          academicYearId: 'foreign-year-belonging-to-school-2',
        }),
      ).rejects.toThrow(
        'Specified academic year does not belong to this school',
      );
    });

    it('rejects numericLevel outside 1 to 12 bounds', async () => {
      mockPrisma.academicYear.findFirst.mockResolvedValue({
        id: 'ay-1',
        schoolId: 'school-1',
      });

      await expect(
        classesService.createClass('school-1', {
          name: 'Super Grade 99',
          numericLevel: 99,
          academicYearId: 'ay-1',
        }),
      ).rejects.toThrow('Class numeric level must be between 1 and 12');

      await expect(
        classesService.createClass('school-1', {
          name: 'Zero Grade',
          numericLevel: 0,
          academicYearId: 'ay-1',
        }),
      ).rejects.toThrow('Class numeric level must be between 1 and 12');
    });

    it('rejects duplicate class name within the same school and academic year', async () => {
      mockPrisma.academicYear.findFirst.mockResolvedValue({
        id: 'ay-1',
        schoolId: 'school-1',
      });
      mockPrisma.class.findUnique.mockResolvedValue({ id: 'existing-class' });

      await expect(
        classesService.createClass('school-1', {
          name: 'Class 10',
          academicYearId: 'ay-1',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('allows class creation when name is unique in the session', async () => {
      mockPrisma.academicYear.findFirst.mockResolvedValue({
        id: 'ay-1',
        schoolId: 'school-1',
      });
      mockPrisma.class.findUnique.mockResolvedValue(null);
      mockPrisma.class.create.mockResolvedValue({
        id: 'cls-10',
        name: 'Class 10',
        numericLevel: 10,
      });

      const cls = await classesService.createClass('school-1', {
        name: 'Class 10',
        academicYearId: 'ay-1',
        numericLevel: 10,
      });

      expect(cls.id).toBe('cls-10');
      expect(mockPrisma.class.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            schoolId: 'school-1',
            academicYearId: 'ay-1',
            name: 'Class 10',
            numericLevel: 10,
          }),
        }),
      );
    });
  });

  describe('3. Section Invariants', () => {
    it('rejects section creation if parent class does not belong to school', async () => {
      mockPrisma.class.findFirst.mockResolvedValue(null);

      await expect(
        classesService.createSection('school-1', 'foreign-class-id', {
          name: 'A',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects duplicate section name within the same class', async () => {
      mockPrisma.class.findFirst.mockResolvedValue({
        id: 'class-1',
        name: 'Class 10',
      });
      mockPrisma.section.findUnique.mockResolvedValue({ id: 'existing-sec' });

      await expect(
        classesService.createSection('school-1', 'class-1', {
          name: 'A',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('4. School Subject Offering Invariants', () => {
    it('rejects offering creation if gradeFrom > gradeTo or out of bounds', async () => {
      mockPrisma.academicYear.findFirst.mockResolvedValue({ id: 'ay-1' });
      mockPrisma.school.findUnique.mockResolvedValue({
        id: 'school-1',
        activeCurriculumId: 'curr-1',
      });

      await expect(
        curriculumService.createSchoolOffering('school-1', {
          globalSubjectId: 'sub-eng',
          gradeFrom: 11,
          gradeTo: 9,
        } as any),
      ).rejects.toThrow(
        'Invalid grade range: gradeFrom and gradeTo must be between 1 and 12, and gradeFrom <= gradeTo',
      );

      await expect(
        curriculumService.createSchoolOffering('school-1', {
          globalSubjectId: 'sub-eng',
          gradeFrom: 0,
          gradeTo: 5,
        } as any),
      ).rejects.toThrow(
        'Invalid grade range: gradeFrom and gradeTo must be between 1 and 12, and gradeFrom <= gradeTo',
      );
    });

    it('rejects offering creation if passMarks > maxMarks or maxMarks <= 0', async () => {
      mockPrisma.academicYear.findFirst.mockResolvedValue({ id: 'ay-1' });
      mockPrisma.school.findUnique.mockResolvedValue({
        id: 'school-1',
        activeCurriculumId: 'curr-1',
      });

      await expect(
        curriculumService.createSchoolOffering('school-1', {
          globalSubjectId: 'sub-eng',
          gradeFrom: 9,
          gradeTo: 10,
          maxMarks: 50,
          passMarks: 75,
        } as any),
      ).rejects.toThrow(
        'Invalid marks configuration: passMarks must be between 0 and maxMarks, and maxMarks > 0',
      );
    });

    it('rejects offering creation if periodsPerWeek <= 0', async () => {
      mockPrisma.academicYear.findFirst.mockResolvedValue({ id: 'ay-1' });
      mockPrisma.school.findUnique.mockResolvedValue({
        id: 'school-1',
        activeCurriculumId: 'curr-1',
      });

      await expect(
        curriculumService.createSchoolOffering('school-1', {
          globalSubjectId: 'sub-eng',
          gradeFrom: 9,
          gradeTo: 10,
          periodsPerWeek: 0,
        } as any),
      ).rejects.toThrow('periodsPerWeek must be greater than 0');
    });
  });

  describe('5. Student Subject Enrollment Invariants', () => {
    it('rejects student subject enrollment if student grade is outside offering grade band', async () => {
      mockPrisma.student.findFirst.mockResolvedValue({
        id: 'std-1',
        schoolId: 'school-1',
        enrollments: [
          {
            status: 'ACTIVE',
            section: { class: { name: 'Class 5', numericLevel: 5 } },
          },
        ],
      });
      mockPrisma.academicYear.findFirst.mockResolvedValue({ id: 'ay-1' });
      mockPrisma.schoolSubjectOffering.findMany.mockResolvedValue([
        {
          id: 'off-highschool-physics',
          schoolId: 'school-1',
          academicYearId: 'ay-1',
          gradeFrom: 9,
          gradeTo: 10,
          globalSubject: { name: 'Physics' },
        },
      ]);

      await expect(
        curriculumService.enrollStudentSubjects('school-1', 'std-1', {
          offeringIds: ['off-highschool-physics'],
        }),
      ).rejects.toThrow(
        'is only valid for grades 9 to 10, but student is enrolled in Grade 5',
      );
    });

    it('rejects student subject enrollment if offering belongs to a different academic session', async () => {
      mockPrisma.student.findFirst.mockResolvedValue({
        id: 'std-1',
        schoolId: 'school-1',
        enrollments: [
          {
            status: 'ACTIVE',
            section: { class: { name: 'Class 10', numericLevel: 10 } },
          },
        ],
      });
      mockPrisma.academicYear.findFirst.mockResolvedValue({ id: 'ay-2026' });
      mockPrisma.schoolSubjectOffering.findMany.mockResolvedValue([
        {
          id: 'off-past-year',
          schoolId: 'school-1',
          academicYearId: 'ay-2024-different',
          gradeFrom: 9,
          gradeTo: 10,
          globalSubject: { name: 'English' },
        },
      ]);

      await expect(
        curriculumService.enrollStudentSubjects('school-1', 'std-1', {
          offeringIds: ['off-past-year'],
        }),
      ).rejects.toThrow('belongs to a different academic session');
    });

    it('selects exact academic-year active enrollment when student has active enrollments in multiple years (Area C)', async () => {
      mockPrisma.academicYear.findFirst.mockResolvedValue({
        id: 'ay-2026',
        name: '2026-27',
      });
      mockPrisma.student.findFirst.mockResolvedValue({
        id: 'std-multi',
        schoolId: 'school-1',
        enrollments: [
          {
            academicYearId: 'ay-2025',
            status: 'ACTIVE',
            section: { class: { name: 'Class 9', numericLevel: 9, schoolId: 'school-1' } },
          },
          {
            academicYearId: 'ay-2026',
            status: 'ACTIVE',
            section: { class: { name: 'Class 10', numericLevel: 10, schoolId: 'school-1' } },
          },
        ],
      });
      mockPrisma.schoolSubjectOffering.findMany.mockResolvedValue([
        {
          id: 'off-grade10-math',
          schoolId: 'school-1',
          academicYearId: 'ay-2026',
          gradeFrom: 10,
          gradeTo: 10,
          globalSubject: { name: 'Mathematics' },
        },
      ]);
      mockPrisma.$transaction.mockImplementation(async (cb) => cb({
        studentSubjectEnrollment: {
          updateMany: jest.fn().mockResolvedValue({ count: 0 }),
          upsert: jest.fn().mockResolvedValue({}),
        },
      }));

      // Explicit academicYearId targeting 2026-27
      const res = await curriculumService.enrollStudentSubjects('school-1', 'std-multi', {
        academicYearId: 'ay-2026',
        offeringIds: ['off-grade10-math'],
      });

      expect(res).toBeDefined();
    });

    it('rejects student subject enrollment if student has no active enrollment in the target academic session (Area C)', async () => {
      mockPrisma.academicYear.findFirst.mockResolvedValue({
        id: 'ay-2027',
        name: '2027-28',
      });
      mockPrisma.student.findFirst.mockResolvedValue({
        id: 'std-multi',
        schoolId: 'school-1',
        enrollments: [
          {
            academicYearId: 'ay-2025',
            status: 'ACTIVE',
            section: { class: { name: 'Class 9', numericLevel: 9 } },
          },
        ],
      });
      mockPrisma.studentEnrollment.findFirst.mockResolvedValue(null);

      await expect(
        curriculumService.enrollStudentSubjects('school-1', 'std-multi', {
          academicYearId: 'ay-2027',
          offeringIds: ['off-any'],
        }),
      ).rejects.toThrow('Student has no active class enrollment in academic session "2027-28"');
    });

    it('rejects subject enrollment mutation on locked academic year (Area C)', async () => {
      mockPrisma.academicYear.findFirst.mockResolvedValue({
        id: 'ay-locked',
        name: '2024-25',
        isLocked: true,
      });

      await expect(
        curriculumService.enrollStudentSubjects('school-1', 'std-1', {
          academicYearId: 'ay-locked',
          offeringIds: ['off-1'],
        }),
      ).rejects.toThrow('is locked. Structural changes are not permitted.');
    });
  });

  describe('6. Diagnostic Integrity Validation Service', () => {
    it('reports zero findings on clean academic dataset', async () => {
      mockPrisma.academicYear.findMany.mockResolvedValue([
        {
          id: 'ay-1',
          schoolId: 'school-1',
          startDate: '2026-04-01',
          endDate: '2027-03-31',
          isActive: true,
        },
      ]);
      mockPrisma.class.findMany.mockResolvedValue([
        {
          id: 'c-1',
          schoolId: 'school-1',
          academicYearId: 'ay-1',
          name: 'Class 10',
          numericLevel: 10,
          academicYear: { schoolId: 'school-1' },
        },
      ]);
      mockPrisma.section.findMany.mockResolvedValue([
        {
          id: 's-1',
          classId: 'c-1',
          name: 'A',
          class: { schoolId: 'school-1' },
        },
      ]);
      mockPrisma.schoolSubjectOffering.findMany.mockResolvedValue([]);
      mockPrisma.studentEnrollment.findMany.mockResolvedValue([]);
      mockPrisma.studentSubjectEnrollment.findMany.mockResolvedValue([]);
      mockPrisma.teacherAssignment.findMany.mockResolvedValue([]);

      const report = await integrityService.validateIntegrity('school-1');

      expect(report.clean).toBe(true);
      expect(report.summary.P0_count).toBe(0);
      expect(report.summary.P1_count).toBe(0);
      expect(report.findings).toHaveLength(0);
    });

    it('detects cross-school teacher assignment (P0)', async () => {
      mockPrisma.academicYear.findMany.mockResolvedValue([
        {
          id: 'ay-1',
          schoolId: 'school-1',
          startDate: '2026-01-01',
          endDate: '2026-12-31',
        },
      ]);
      mockPrisma.class.findMany.mockResolvedValue([]);
      mockPrisma.section.findMany.mockResolvedValue([]);
      mockPrisma.schoolSubjectOffering.findMany.mockResolvedValue([]);
      mockPrisma.studentEnrollment.findMany.mockResolvedValue([]);
      mockPrisma.studentSubjectEnrollment.findMany.mockResolvedValue([]);
      mockPrisma.teacherAssignment.findMany.mockResolvedValue([
        {
          id: 'ta-cross',
          schoolId: 'school-1',
          academicYearId: 'ay-1',
          staffId: 'staff-from-school-2',
          sectionId: 'sec-from-school-1',
          staff: { schoolId: 'school-2' },
          section: { class: { schoolId: 'school-1' } },
        },
      ]);

      const report = await integrityService.validateIntegrity();

      expect(report.clean).toBe(false);
      expect(report.summary.P0_count).toBeGreaterThan(0);
      const crossSchoolFinding = report.findings.find((f) =>
        f.issue.includes('Cross-school teacher assignment'),
      );
      expect(crossSchoolFinding).toBeDefined();
    });
  });
});
