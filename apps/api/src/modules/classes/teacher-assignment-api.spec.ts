import { Test, TestingModule } from '@nestjs/testing';
import { ClassesService } from './classes.service';
import { PrismaService } from '../../core/database/prisma.service';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';

describe('TeacherAssignment API Domain Enforcement', () => {
  let service: ClassesService;
  let prisma: any;

  const schoolId = 'school-alpha';
  const academicYearId = 'ay-2026';
  const sectionId = 'sec-10a';
  const staffId = 'staff-teacher-1';
  const offeringId = 'off-math-10';

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn().mockImplementation((cb) => cb(prisma)),
      academicYear: {
        findFirst: jest.fn().mockResolvedValue({
          id: academicYearId,
          schoolId,
          name: '2026-2027',
          isLocked: false,
          isActive: true,
        }),
      },
      class: {
        findFirst: jest.fn(),
      },
      section: {
        findFirst: jest.fn().mockResolvedValue({
          id: sectionId,
          name: 'Section A',
          class: {
            id: 'class-10',
            name: 'Class 10',
            schoolId,
            academicYearId,
            academicYear: {
              id: academicYearId,
              name: '2026-2027',
              isLocked: false,
            },
          },
        }),
      },
      staff: {
        findFirst: jest.fn().mockResolvedValue({
          id: staffId,
          schoolId,
          isActive: true,
          user: { firstName: 'Jane', lastName: 'Doe' },
        }),
      },
      schoolSubjectOffering: {
        findFirst: jest.fn().mockResolvedValue({
          id: offeringId,
          schoolId,
          academicYearId,
          legacySubjectId: 'sub-legacy-math',
        }),
      },
      subject: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'sub-legacy-math',
          schoolId,
          name: 'Mathematics',
        }),
      },
      teacherAssignment: {
        findFirst: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [ClassesService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<ClassesService>(ClassesService);
  });

  it('allows valid teacher assignment creation', async () => {
    prisma.teacherAssignment.findFirst.mockResolvedValue(null);
    prisma.teacherAssignment.create.mockResolvedValue({
      id: 'ta-1',
      staffId,
      sectionId,
      academicYearId,
      isClassTeacher: false,
      schoolSubjectOfferingId: offeringId,
    });

    const result = await service.createTeacherAssignment(schoolId, {
      staffId,
      sectionId,
      isClassTeacher: false,
      schoolSubjectOfferingId: offeringId,
    });

    expect(result.id).toBe('ta-1');
    expect(prisma.teacherAssignment.create).toHaveBeenCalled();
  });

  it('rejects teacher assignment if teacher belongs to another school', async () => {
    prisma.staff.findFirst.mockResolvedValue(null);

    await expect(
      service.createTeacherAssignment(schoolId, {
        staffId: 'foreign-teacher',
        sectionId,
        isClassTeacher: false,
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects teacher assignment if section belongs to another school', async () => {
    prisma.section.findFirst.mockResolvedValue(null);

    await expect(
      service.createTeacherAssignment(schoolId, {
        staffId,
        sectionId: 'foreign-section',
        isClassTeacher: false,
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects teacher assignment if subject offering belongs to a different academic year or school', async () => {
    prisma.schoolSubjectOffering.findFirst.mockResolvedValue(null);

    await expect(
      service.createTeacherAssignment(schoolId, {
        staffId,
        sectionId,
        isClassTeacher: false,
        schoolSubjectOfferingId: 'mismatched-offering',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('enforces single CLASS_TEACHER constraint per section per academic year', async () => {
    // Existing CLASS_TEACHER already assigned
    prisma.teacherAssignment.findFirst.mockResolvedValue({
      id: 'existing-ct',
      staffId: 'another-teacher',
      sectionId,
      academicYearId,
      isClassTeacher: true,
      staff: { user: { firstName: 'Alice', lastName: 'Wonderland' } },
    });

    await expect(
      service.createTeacherAssignment(schoolId, {
        staffId,
        sectionId,
        isClassTeacher: true,
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('prevents duplicate assignment of same teacher to same section & offering', async () => {
    prisma.teacherAssignment.findFirst.mockResolvedValue({
      id: 'dup-1',
      staffId,
      sectionId,
      academicYearId,
      isClassTeacher: false,
      schoolSubjectOfferingId: offeringId,
    });

    await expect(
      service.createTeacherAssignment(schoolId, {
        staffId,
        sectionId,
        isClassTeacher: false,
        schoolSubjectOfferingId: offeringId,
      }),
    ).rejects.toThrow(ConflictException);
  });
});
