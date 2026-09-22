import { Test, TestingModule } from '@nestjs/testing';
import { ClassesService } from './classes.service';
import { StudentEnrollmentService } from '../students/student-enrollment.service';
import { CurriculumService } from '../curriculum/curriculum.service';
import { AcademicYearsService } from '../schools/academic-years.service';
import { PrismaService } from '../../core/database/prisma.service';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

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
      },
      class: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
      },
      section: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
      },
      teacherAssignment: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      studentEnrollment: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      schoolSubjectOffering: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
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

  describe('Server-authoritative tenant requirement', () => {
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

  describe('Cross-Tenant Data Isolation', () => {
    it('prevents Tenant A from viewing Tenant B class', async () => {
      // prisma findFirst returns null because query filters by tenantA
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
});
