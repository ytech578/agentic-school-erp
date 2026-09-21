/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import { Test, TestingModule } from '@nestjs/testing';
import { CurriculumService } from './curriculum.service';
import { ClassesService } from '../classes/classes.service';
import { PrismaService } from '../../core/database/prisma.service';

describe('Change #8E — Academic Migration & Legacy Compatibility', () => {
  let curriculumService: CurriculumService;
  let classesService: ClassesService;
  let mockPrisma: any;

  beforeEach(async () => {
    mockPrisma = {
      subject: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'subj-1',
            schoolId: 'school-1',
            name: 'English',
            isActive: true,
          },
          {
            id: 'subj-2',
            schoolId: 'school-1',
            name: 'Mathematics',
            isActive: true,
          },
        ]),
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      classSubject: {
        upsert: jest.fn().mockResolvedValue({}),
        findMany: jest.fn().mockResolvedValue([]),
      },
      schoolSubjectOffering: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      class: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      academicYear: {
        findFirst: jest.fn(),
      },
      school: {
        findUnique: jest.fn(),
      },
      globalSubject: {
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CurriculumService,
        ClassesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    curriculumService = module.get<CurriculumService>(CurriculumService);
    classesService = module.get<ClassesService>(ClassesService);
  });

  describe('Legacy Subject Read Compatibility', () => {
    it('preserves classesService.findAllSubjects returning legacy Subject entities', async () => {
      const subjects = await classesService.findAllSubjects('school-1');

      expect(subjects).toHaveLength(2);
      expect(subjects[0].name).toBe('English');
      expect(subjects[1].name).toBe('Mathematics');
      expect(mockPrisma.subject.findMany).toHaveBeenCalledWith({
        where: { schoolId: 'school-1', isActive: true },
        orderBy: { name: 'asc' },
      });
    });

    it('bridges SchoolSubjectOffering to legacy Subject without breaking existing timetable or exam readers', async () => {
      mockPrisma.class.findFirst.mockResolvedValue({
        id: 'cls-10',
        name: 'Class 10',
        numericLevel: 12, // 10th grade
      });
      mockPrisma.academicYear.findFirst.mockResolvedValue({
        id: 'ay-2026',
        schoolId: 'school-1',
      });
      mockPrisma.schoolSubjectOffering.findMany.mockResolvedValue([
        {
          id: 'off-1',
          schoolId: 'school-1',
          academicYearId: 'ay-2026',
          legacySubjectId: 'subj-1',
          gradeFrom: 9,
          gradeTo: 10,
          globalSubject: { name: 'English' },
          legacySubject: { id: 'subj-1', name: 'English' },
        },
      ]);

      const offerings = await curriculumService.getClassOfferings(
        'school-1',
        'cls-10',
      );

      expect(offerings).toHaveLength(1);
      expect(offerings[0].legacySubjectId).toBe('subj-1');
      expect(offerings[0].legacySubject?.name).toBe('English');
    });

    it('syncClassSubjects synchronizes offerings into legacy ClassSubject bridge table', async () => {
      mockPrisma.class.findFirst.mockResolvedValue({
        id: 'cls-10',
        name: 'Class 10',
        numericLevel: 10,
      });
      mockPrisma.academicYear.findFirst.mockResolvedValue({
        id: 'ay-2026',
        schoolId: 'school-1',
      });
      mockPrisma.schoolSubjectOffering.findMany.mockResolvedValue([
        {
          id: 'off-1',
          legacySubjectId: 'subj-1',
          gradeFrom: 9,
          gradeTo: 10,
          globalSubject: { name: 'English' },
        },
        {
          id: 'off-2',
          legacySubjectId: 'subj-2',
          gradeFrom: 9,
          gradeTo: 10,
          globalSubject: { name: 'Math' },
        },
      ]);

      const syncResult = await curriculumService.syncClassSubjects(
        'school-1',
        'cls-10',
      );

      expect(syncResult.syncedCount).toBe(2);
      expect(mockPrisma.classSubject.upsert).toHaveBeenCalledTimes(2);
      expect(mockPrisma.classSubject.upsert).toHaveBeenCalledWith({
        where: {
          classId_subjectId: {
            classId: 'cls-10',
            subjectId: 'subj-1',
          },
        },
        update: {},
        create: {
          classId: 'cls-10',
          subjectId: 'subj-1',
        },
      });
    });
  });
});
