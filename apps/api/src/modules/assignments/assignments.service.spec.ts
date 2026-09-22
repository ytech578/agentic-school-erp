import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { AssignmentsService } from './assignments.service';
import { PrismaService } from '../../core/database/prisma.service';

describe('AssignmentsService — Change #9A Hardened Academic Context', () => {
  let service: AssignmentsService;
  let prisma: {
    assignment: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    assignmentSubmission: { findMany: jest.Mock; upsert: jest.Mock };
    studentEnrollment: { findMany: jest.Mock };
    student: { findFirst: jest.Mock };
    academicYear: { findFirst: jest.Mock; findMany: jest.Mock };
    class: { findFirst: jest.Mock };
    section: { findFirst: jest.Mock };
    subject: { findFirst: jest.Mock };
    schoolSubjectOffering: { findFirst: jest.Mock; findMany: jest.Mock };
    staff: { findFirst: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      assignment: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      assignmentSubmission: {
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn(),
      },
      studentEnrollment: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      student: {
        findFirst: jest.fn(),
      },
      academicYear: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
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
      schoolSubjectOffering: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      staff: {
        findFirst: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssignmentsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<AssignmentsService>(AssignmentsService);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 9A-1 & 9A-2: ACADEMIC YEAR DETERMINISM & CLASS/YEAR INTEGRITY
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Academic Year Determinism & Class/Year Integrity', () => {
    const schoolId = 'school-1';

    it('1. succeeds when same school, same academic year, and matching class', async () => {
      prisma.academicYear.findFirst.mockResolvedValue({
        id: 'ay-2026',
        schoolId,
        name: '2026-27',
        isLocked: false,
      });
      prisma.staff.findFirst.mockResolvedValue({
        id: 'staff-1',
        schoolId,
        isActive: true,
      });
      prisma.class.findFirst.mockResolvedValue({
        id: 'class-10',
        schoolId,
        academicYearId: 'ay-2026',
        name: 'Class 10',
        numericLevel: 10,
      });
      prisma.subject.findFirst.mockResolvedValue({
        id: 'sub-math',
        schoolId,
        name: 'Mathematics',
      });
      prisma.assignment.create.mockImplementation((args) =>
        Promise.resolve({ id: 'assign-1', ...args.data }),
      );

      const res = await service.createAssignment(
        schoolId,
        {
          title: 'Quadratic Equations',
          classId: 'class-10',
          academicYearId: 'ay-2026',
          subjectId: 'sub-math',
          dueDate: new Date(Date.now() + 86400000).toISOString(),
        },
        'user-teacher-1',
      );

      expect(res.id).toBe('assign-1');
      expect(prisma.assignment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            schoolId,
            academicYearId: 'ay-2026',
            classId: 'class-10',
          }),
        }),
      );
    });

    it('2. rejects when class belongs to a different academic year', async () => {
      prisma.academicYear.findFirst.mockResolvedValue({
        id: 'ay-2026',
        schoolId,
        name: '2026-27',
        isLocked: false,
      });
      prisma.staff.findFirst.mockResolvedValue({
        id: 'staff-1',
        schoolId,
        isActive: true,
      });
      prisma.class.findFirst.mockResolvedValue({
        id: 'class-10-old',
        schoolId,
        academicYearId: 'ay-2025', // Mismatch!
        name: 'Class 10',
        numericLevel: 10,
      });

      await expect(
        service.createAssignment(
          schoolId,
          {
            title: 'Algebra',
            classId: 'class-10-old',
            academicYearId: 'ay-2026',
            subjectId: 'sub-math',
            dueDate: new Date(Date.now() + 86400000).toISOString(),
          },
          'user-teacher-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('3. rejects when class belongs to a different school', async () => {
      prisma.academicYear.findFirst.mockResolvedValue({
        id: 'ay-2026',
        schoolId,
        name: '2026-27',
        isLocked: false,
      });
      prisma.staff.findFirst.mockResolvedValue({
        id: 'staff-1',
        schoolId,
        isActive: true,
      });
      prisma.class.findFirst.mockResolvedValue(null); // Not found in school-1

      await expect(
        service.createAssignment(
          schoolId,
          {
            title: 'Algebra',
            classId: 'class-foreign',
            academicYearId: 'ay-2026',
            subjectId: 'sub-math',
            dueDate: new Date(Date.now() + 86400000).toISOString(),
          },
          'user-teacher-1',
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 9A-3: SECTION / CLASS / YEAR INTEGRITY
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Section / Class / Year Integrity', () => {
    const schoolId = 'school-1';

    beforeEach(() => {
      prisma.academicYear.findFirst.mockResolvedValue({
        id: 'ay-2026',
        schoolId,
        name: '2026-27',
        isLocked: false,
      });
      prisma.staff.findFirst.mockResolvedValue({
        id: 'staff-1',
        schoolId,
        isActive: true,
      });
      prisma.class.findFirst.mockResolvedValue({
        id: 'class-10',
        schoolId,
        academicYearId: 'ay-2026',
        name: 'Class 10',
        numericLevel: 10,
      });
      prisma.subject.findFirst.mockResolvedValue({
        id: 'sub-math',
        schoolId,
        name: 'Mathematics',
      });
    });

    it('4. succeeds when section belongs to target class, school, and academic year', async () => {
      prisma.section.findFirst.mockResolvedValue({
        id: 'sec-10-A',
        classId: 'class-10',
        class: {
          id: 'class-10',
          schoolId,
          academicYearId: 'ay-2026',
        },
      });
      prisma.assignment.create.mockImplementation((args) =>
        Promise.resolve({ id: 'assign-sec', ...args.data }),
      );

      const res = await service.createAssignment(
        schoolId,
        {
          title: 'Section Homework',
          classId: 'class-10',
          sectionId: 'sec-10-A',
          academicYearId: 'ay-2026',
          subjectId: 'sub-math',
          dueDate: new Date(Date.now() + 86400000).toISOString(),
        },
        'user-teacher-1',
      );

      expect(res.sectionId).toBe('sec-10-A');
    });

    it('5. rejects when section belongs to another class', async () => {
      prisma.section.findFirst.mockResolvedValue({
        id: 'sec-9-A',
        classId: 'class-9', // Mismatch!
        class: {
          id: 'class-9',
          schoolId,
          academicYearId: 'ay-2026',
        },
      });

      await expect(
        service.createAssignment(
          schoolId,
          {
            title: 'Section Homework',
            classId: 'class-10',
            sectionId: 'sec-9-A',
            academicYearId: 'ay-2026',
            subjectId: 'sub-math',
            dueDate: new Date(Date.now() + 86400000).toISOString(),
          },
          'user-teacher-1',
        ),
      ).rejects.toThrow('Section does not belong to specified Class');
    });

    it('6. rejects when section class belongs to another academic year', async () => {
      prisma.section.findFirst.mockResolvedValue({
        id: 'sec-10-old',
        classId: 'class-10',
        class: {
          id: 'class-10',
          schoolId,
          academicYearId: 'ay-2025', // Wrong year!
        },
      });

      await expect(
        service.createAssignment(
          schoolId,
          {
            title: 'Section Homework',
            classId: 'class-10',
            sectionId: 'sec-10-old',
            academicYearId: 'ay-2026',
            subjectId: 'sub-math',
            dueDate: new Date(Date.now() + 86400000).toISOString(),
          },
          'user-teacher-1',
        ),
      ).rejects.toThrow('Section belongs to a different academic session');
    });

    it('7. rejects when section belongs to another school', async () => {
      prisma.section.findFirst.mockResolvedValue({
        id: 'sec-foreign',
        classId: 'class-10',
        class: {
          id: 'class-10',
          schoolId: 'school-2', // Foreign school!
          academicYearId: 'ay-2026',
        },
      });

      await expect(
        service.createAssignment(
          schoolId,
          {
            title: 'Section Homework',
            classId: 'class-10',
            sectionId: 'sec-foreign',
            academicYearId: 'ay-2026',
            subjectId: 'sub-math',
            dueDate: new Date(Date.now() + 86400000).toISOString(),
          },
          'user-teacher-1',
        ),
      ).rejects.toThrow('Section does not belong to this school');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 9A-4 & 9A-5: SCHOOL SUBJECT OFFERING & GRADE INTEGRITY
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Canonical Offering & Grade Integrity', () => {
    const schoolId = 'school-1';

    beforeEach(() => {
      prisma.academicYear.findFirst.mockResolvedValue({
        id: 'ay-2026',
        schoolId,
        name: '2026-27',
        isLocked: false,
      });
      prisma.staff.findFirst.mockResolvedValue({
        id: 'staff-1',
        schoolId,
        isActive: true,
      });
      prisma.class.findFirst.mockResolvedValue({
        id: 'class-10',
        schoolId,
        academicYearId: 'ay-2026',
        name: 'Class 10',
        numericLevel: 10,
      });
    });

    it('8. succeeds when compatible canonical offering is provided for same school and year', async () => {
      prisma.schoolSubjectOffering.findFirst.mockResolvedValue({
        id: 'off-math-10',
        schoolId,
        academicYearId: 'ay-2026',
        gradeFrom: 9,
        gradeTo: 10,
        legacySubjectId: 'sub-math',
      });
      prisma.assignment.create.mockImplementation((args) =>
        Promise.resolve({ id: 'assign-off', ...args.data }),
      );

      const res = await service.createAssignment(
        schoolId,
        {
          title: 'Maths Offering Assignment',
          classId: 'class-10',
          academicYearId: 'ay-2026',
          schoolSubjectOfferingId: 'off-math-10',
          dueDate: new Date(Date.now() + 86400000).toISOString(),
        },
        'user-teacher-1',
      );

      expect(res.schoolSubjectOfferingId).toBe('off-math-10');
      expect(res.subjectId).toBe('sub-math');
    });

    it('9. rejects when offering belongs to another school', async () => {
      prisma.schoolSubjectOffering.findFirst.mockResolvedValue(null); // Not found in school-1

      await expect(
        service.createAssignment(
          schoolId,
          {
            title: 'Maths Offering Assignment',
            classId: 'class-10',
            academicYearId: 'ay-2026',
            schoolSubjectOfferingId: 'off-foreign',
            dueDate: new Date(Date.now() + 86400000).toISOString(),
          },
          'user-teacher-1',
        ),
      ).rejects.toThrow('School subject offering not found in this school');
    });

    it('10. rejects when offering belongs to another academic year', async () => {
      prisma.schoolSubjectOffering.findFirst.mockResolvedValue({
        id: 'off-math-old',
        schoolId,
        academicYearId: 'ay-2025', // Wrong session!
        gradeFrom: 9,
        gradeTo: 10,
      });

      await expect(
        service.createAssignment(
          schoolId,
          {
            title: 'Maths Offering Assignment',
            classId: 'class-10',
            academicYearId: 'ay-2026',
            schoolSubjectOfferingId: 'off-math-old',
            dueDate: new Date(Date.now() + 86400000).toISOString(),
          },
          'user-teacher-1',
        ),
      ).rejects.toThrow('School subject offering belongs to a different academic session');
    });

    it('11. rejects when offering grade band does not cover class numeric level', async () => {
      prisma.schoolSubjectOffering.findFirst.mockResolvedValue({
        id: 'off-primary-math',
        schoolId,
        academicYearId: 'ay-2026',
        gradeFrom: 1,
        gradeTo: 5, // Grade 10 is outside band!
      });

      await expect(
        service.createAssignment(
          schoolId,
          {
            title: 'Maths Offering Assignment',
            classId: 'class-10',
            academicYearId: 'ay-2026',
            schoolSubjectOfferingId: 'off-primary-math',
            dueDate: new Date(Date.now() + 86400000).toISOString(),
          },
          'user-teacher-1',
        ),
      ).rejects.toThrow('is not compatible with class grade 10');
    });

    it('12. rejects contradictory legacy subject and canonical offering', async () => {
      prisma.schoolSubjectOffering.findFirst.mockResolvedValue({
        id: 'off-math-10',
        schoolId,
        academicYearId: 'ay-2026',
        gradeFrom: 9,
        gradeTo: 10,
        legacySubjectId: 'sub-math',
      });

      await expect(
        service.createAssignment(
          schoolId,
          {
            title: 'Contradictory Assignment',
            classId: 'class-10',
            academicYearId: 'ay-2026',
            schoolSubjectOfferingId: 'off-math-10',
            subjectId: 'sub-physics', // Contradicts sub-math!
            dueDate: new Date(Date.now() + 86400000).toISOString(),
          },
          'user-teacher-1',
        ),
      ).rejects.toThrow('contradicts canonical offering legacySubjectId');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 9A-6: STAFF VALIDATION & ELIMINATION OF ARBITRARY FALLBACK
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Staff Validation & Fallback Elimination', () => {
    const schoolId = 'school-1';

    beforeEach(() => {
      prisma.academicYear.findFirst.mockResolvedValue({
        id: 'ay-2026',
        schoolId,
        name: '2026-27',
        isLocked: false,
      });
      prisma.class.findFirst.mockResolvedValue({
        id: 'class-10',
        schoolId,
        academicYearId: 'ay-2026',
        name: 'Class 10',
        numericLevel: 10,
      });
      prisma.subject.findFirst.mockResolvedValue({
        id: 'sub-math',
        schoolId,
        name: 'Mathematics',
      });
    });

    it('13. succeeds when explicit active staff in school is provided', async () => {
      prisma.staff.findFirst.mockResolvedValue({
        id: 'staff-explicit',
        schoolId,
        isActive: true,
      });
      prisma.assignment.create.mockImplementation((args) =>
        Promise.resolve({ id: 'assign-staff', ...args.data }),
      );

      const res = await service.createAssignment(
        schoolId,
        {
          title: 'Assignment by explicit staff',
          classId: 'class-10',
          staffId: 'staff-explicit',
          subjectId: 'sub-math',
          dueDate: new Date(Date.now() + 86400000).toISOString(),
        },
        'user-admin',
      );

      expect(res.staffId).toBe('staff-explicit');
    });

    it('14. rejects when explicit staff belongs to another school', async () => {
      prisma.staff.findFirst.mockResolvedValue(null); // Not found in school-1

      await expect(
        service.createAssignment(
          schoolId,
          {
            title: 'Assignment by foreign staff',
            classId: 'class-10',
            staffId: 'staff-foreign',
            subjectId: 'sub-math',
            dueDate: new Date(Date.now() + 86400000).toISOString(),
          },
          'user-admin',
        ),
      ).rejects.toThrow('Active staff record not found for this school');
    });

    it('15. rejects when explicit staff is inactive', async () => {
      prisma.staff.findFirst.mockResolvedValue(null); // findFirst filters isActive: true

      await expect(
        service.createAssignment(
          schoolId,
          {
            title: 'Assignment by inactive staff',
            classId: 'class-10',
            staffId: 'staff-inactive',
            subjectId: 'sub-math',
            dueDate: new Date(Date.now() + 86400000).toISOString(),
          },
          'user-admin',
        ),
      ).rejects.toThrow('Active staff record not found for this school');
    });

    it('16. rejects when staff identity cannot be resolved from user profile', async () => {
      prisma.staff.findFirst.mockResolvedValue(null); // User has no staff profile

      await expect(
        service.createAssignment(
          schoolId,
          {
            title: 'Assignment without staff profile',
            classId: 'class-10',
            subjectId: 'sub-math',
            dueDate: new Date(Date.now() + 86400000).toISOString(),
          },
          'user-without-staff-profile',
        ),
      ).rejects.toThrow('Authenticated user has no active staff profile in this school');
    });

    it('17. verifies there is NO "first staff in school" fallback behavior', async () => {
      prisma.staff.findFirst.mockResolvedValue(null);

      await expect(
        service.createAssignment(
          schoolId,
          {
            title: 'Assignment with arbitrary fallback attempt',
            classId: 'class-10',
            subjectId: 'sub-math',
            dueDate: new Date(Date.now() + 86400000).toISOString(),
          },
          'user-without-staff-profile',
        ),
      ).rejects.toThrow(BadRequestException);

      // Verify prisma.staff.findFirst was NOT called with only { schoolId }
      expect(prisma.staff.findFirst).not.toHaveBeenCalledWith({
        where: { schoolId },
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 9A-7 & 9A-8: TENANT SECURITY & LOCKED ACADEMIC YEAR
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Tenant Security & Locked Academic Year', () => {
    const schoolId = 'school-1';

    it('18. prevents User from School A from creating Assignment in School B', async () => {
      await expect(
        service.createAssignment(
          '', // Empty/tampered schoolId
          {
            title: 'Tampered Assignment',
            classId: 'class-10',
            subjectId: 'sub-math',
            dueDate: new Date(Date.now() + 86400000).toISOString(),
          },
          'user-1',
        ),
      ).rejects.toThrow();
    });

    it('19. rejects assignment creation against a locked academic year', async () => {
      prisma.academicYear.findFirst.mockResolvedValue({
        id: 'ay-locked',
        schoolId,
        name: '2024-25',
        isLocked: true, // Locked!
      });

      await expect(
        service.createAssignment(
          schoolId,
          {
            title: 'Assignment in Locked Year',
            classId: 'class-10',
            academicYearId: 'ay-locked',
            subjectId: 'sub-math',
            dueDate: new Date(Date.now() + 86400000).toISOString(),
          },
          'user-teacher-1',
        ),
      ).rejects.toThrow('is locked. Structural changes are not permitted.');
    });

    it('19b. rejects assignment deletion on a locked academic year', async () => {
      prisma.assignment.findFirst.mockResolvedValue({
        id: 'assign-locked',
        schoolId,
        academicYear: { id: 'ay-locked', name: '2024-25', isLocked: true },
      });

      await expect(
        service.deleteAssignment(schoolId, 'assign-locked'),
      ).rejects.toThrow('is locked. Structural changes are not permitted.');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 9A-9: UPDATE ASSIGNMENT COMPLETE CONTEXT REVALIDATION
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Update Assignment Complete Context Revalidation', () => {
    const schoolId = 'school-1';
    const assignmentId = 'assign-1';

    beforeEach(() => {
      prisma.assignment.findFirst.mockResolvedValue({
        id: assignmentId,
        schoolId,
        academicYearId: 'ay-2026',
        classId: 'class-10',
        sectionId: null,
        subjectId: 'sub-math',
        schoolSubjectOfferingId: 'off-math-10',
        staffId: 'staff-1',
        title: 'Original Title',
        academicYear: { id: 'ay-2026', name: '2026-27', isLocked: false },
        class: { id: 'class-10', numericLevel: 10, academicYearId: 'ay-2026' },
      });
      prisma.academicYear.findFirst.mockResolvedValue({
        id: 'ay-2026',
        schoolId,
        name: '2026-27',
        isLocked: false,
      });
      prisma.class.findFirst.mockResolvedValue({
        id: 'class-10',
        schoolId,
        academicYearId: 'ay-2026',
        name: 'Class 10',
        numericLevel: 10,
      });
      prisma.schoolSubjectOffering.findFirst.mockResolvedValue({
        id: 'off-math-10',
        schoolId,
        academicYearId: 'ay-2026',
        gradeFrom: 9,
        gradeTo: 10,
        legacySubjectId: 'sub-math',
      });
    });

    it('20. cannot change class without revalidating academic year', async () => {
      // Trying to update class to class-9-old which belongs to ay-2025
      prisma.class.findFirst.mockResolvedValue({
        id: 'class-9-old',
        schoolId,
        academicYearId: 'ay-2025',
        numericLevel: 9,
      });

      await expect(
        service.updateAssignment(schoolId, assignmentId, {
          classId: 'class-9-old',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('21. cannot change section to another class', async () => {
      prisma.section.findFirst.mockResolvedValue({
        id: 'sec-wrong-class',
        classId: 'class-other',
        class: { id: 'class-other', schoolId, academicYearId: 'ay-2026' },
      });

      await expect(
        service.updateAssignment(schoolId, assignmentId, {
          sectionId: 'sec-wrong-class',
        }),
      ).rejects.toThrow('Section does not belong to specified Class');
    });

    it('22. cannot change offering to another year', async () => {
      prisma.schoolSubjectOffering.findFirst.mockResolvedValue({
        id: 'off-other-year',
        schoolId,
        academicYearId: 'ay-2025', // Mismatch!
        gradeFrom: 9,
        gradeTo: 10,
      });

      await expect(
        service.updateAssignment(schoolId, assignmentId, {
          schoolSubjectOfferingId: 'off-other-year',
        }),
      ).rejects.toThrow('School subject offering belongs to a different academic session');
    });

    it('23. cannot change staff to another school', async () => {
      prisma.staff.findFirst.mockResolvedValue(null); // Not found in school-1

      await expect(
        service.updateAssignment(schoolId, assignmentId, {
          staffId: 'staff-foreign',
        }),
      ).rejects.toThrow('Active staff record not found for this school');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 9A-11: LEGACY COMPATIBILITY & AUTO-LINKING
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Legacy Compatibility & Offering Auto-Linking', () => {
    const schoolId = 'school-1';

    it('24. existing legacy subject-based assignment remains readable and listable', async () => {
      prisma.assignment.findMany.mockResolvedValue([
        {
          id: 'assign-legacy',
          schoolId,
          academicYearId: 'ay-2026',
          classId: 'class-10',
          subjectId: 'sub-legacy',
          schoolSubjectOfferingId: null, // Legacy record
          title: 'Legacy Assignment',
        },
      ]);

      const list = await service.listAssignments(schoolId);
      expect(list).toHaveLength(1);
      expect(list[0].id).toBe('assign-legacy');
      expect(list[0].schoolSubjectOfferingId).toBeNull();
    });

    it('25. auto-links canonical offering when a unique match exists for legacy subject and class grade', async () => {
      prisma.academicYear.findFirst.mockResolvedValue({
        id: 'ay-2026',
        schoolId,
        name: '2026-27',
        isLocked: false,
      });
      prisma.staff.findFirst.mockResolvedValue({
        id: 'staff-1',
        schoolId,
        isActive: true,
      });
      prisma.class.findFirst.mockResolvedValue({
        id: 'class-10',
        schoolId,
        academicYearId: 'ay-2026',
        name: 'Class 10',
        numericLevel: 10,
      });
      prisma.subject.findFirst.mockResolvedValue({
        id: 'sub-legacy',
        schoolId,
        name: 'Legacy Subject',
      });
      // Unique matching offering found in session
      prisma.schoolSubjectOffering.findMany.mockResolvedValue([
        {
          id: 'off-matched',
          schoolId,
          academicYearId: 'ay-2026',
          legacySubjectId: 'sub-legacy',
          gradeFrom: 9,
          gradeTo: 10,
          isOffered: true,
        },
      ]);
      prisma.assignment.create.mockImplementation((args) =>
        Promise.resolve({ id: 'assign-autolink', ...args.data }),
      );

      const res = await service.createAssignment(
        schoolId,
        {
          title: 'Legacy Subject Assignment',
          classId: 'class-10',
          subjectId: 'sub-legacy',
          dueDate: new Date(Date.now() + 86400000).toISOString(),
        },
        'user-teacher-1',
      );

      expect(res.schoolSubjectOfferingId).toBe('off-matched');
      expect(res.subjectId).toBe('sub-legacy');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // EXISTING SUBMISSION & ROSTER TESTS
  // ═══════════════════════════════════════════════════════════════════════════
  describe('getSubmissions', () => {
    const schoolId = 'school-123';
    const assignmentId = 'cmttsw9ah05y55br5fk1y1hli';

    it('should throw NotFoundException if assignment does not exist', async () => {
      prisma.assignment.findFirst.mockResolvedValue(null);

      await expect(
        service.getSubmissions(schoolId, assignmentId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should query section.classId when sectionId is null (Class-level assignment)', async () => {
      const classId = 'class-grade-10';
      prisma.assignment.findFirst.mockResolvedValue({
        id: assignmentId,
        schoolId,
        classId,
        sectionId: null,
        title: 'Maths Quadratic Equations Assignment',
        maxMarks: 50,
      });

      prisma.assignmentSubmission.findMany.mockResolvedValue([
        {
          id: 'sub-1',
          assignmentId,
          studentId: 'student-1',
          status: 'SUBMITTED',
          marksObtained: 45,
          feedback: 'Well done',
          submittedAt: new Date(),
          student: {
            user: {
              firstName: 'Aarav',
              lastName: 'Sharma',
              email: 'aarav@school.edu',
            },
            enrollments: [{ rollNumber: '10A01', sectionId: 'sec-1' }],
          },
        },
      ]);

      prisma.studentEnrollment.findMany.mockResolvedValue([
        {
          studentId: 'student-1',
          rollNumber: '10A01',
          status: 'ACTIVE',
          student: {
            user: {
              firstName: 'Aarav',
              lastName: 'Sharma',
              email: 'aarav@school.edu',
            },
          },
        },
        {
          studentId: 'student-2',
          rollNumber: '10A02',
          status: 'ACTIVE',
          student: {
            user: {
              firstName: 'Priya',
              lastName: 'Patel',
              email: 'priya@school.edu',
            },
          },
        },
      ]);

      const result = await service.getSubmissions(schoolId, assignmentId);

      expect(prisma.studentEnrollment.findMany).toHaveBeenCalledWith({
        where: {
          status: 'ACTIVE',
          section: { classId },
        },
        include: {
          student: {
            include: {
              user: {
                select: { firstName: true, lastName: true, email: true },
              },
            },
          },
        },
        orderBy: { rollNumber: 'asc' },
      });

      expect(result.submissions).toHaveLength(2);
      expect(result.submissions[0].studentName).toBe('Aarav Sharma');
      expect(result.submissions[0].status).toBe('SUBMITTED');
      expect(result.submissions[0].marksObtained).toBe(45);
      expect(result.submissions[1].studentName).toBe('Priya Patel');
      expect(result.submissions[1].status).toBe('PENDING');
      expect(result.submissions[1].marksObtained).toBeNull();
      expect(result.stats.totalStudents).toBe(2);
      expect(result.stats.submittedCount).toBe(1);
      expect(result.stats.pendingCount).toBe(1);
    });

    it('should query sectionId when sectionId is present (Section-level assignment)', async () => {
      const classId = 'class-grade-10';
      const sectionId = 'sec-10-A';
      prisma.assignment.findFirst.mockResolvedValue({
        id: assignmentId,
        schoolId,
        classId,
        sectionId,
        title: 'Science Lab Assignment',
        maxMarks: 20,
      });

      prisma.assignmentSubmission.findMany.mockResolvedValue([]);
      prisma.studentEnrollment.findMany.mockResolvedValue([
        {
          studentId: 'student-3',
          rollNumber: '10A03',
          status: 'ACTIVE',
          student: {
            user: {
              firstName: 'Rohan',
              lastName: 'Verma',
              email: 'rohan@school.edu',
            },
          },
        },
      ]);

      const result = await service.getSubmissions(schoolId, assignmentId);

      expect(prisma.studentEnrollment.findMany).toHaveBeenCalledWith({
        where: {
          status: 'ACTIVE',
          sectionId,
        },
        include: {
          student: {
            include: {
              user: {
                select: { firstName: true, lastName: true, email: true },
              },
            },
          },
        },
        orderBy: { rollNumber: 'asc' },
      });

      expect(result.submissions).toHaveLength(1);
      expect(result.submissions[0].studentName).toBe('Rohan Verma');
      expect(result.submissions[0].status).toBe('PENDING');
    });
  });

  describe('submitAssignment', () => {
    it('should grade/upsert assignment submission successfully', async () => {
      const schoolId = 'school-123';
      const assignmentId = 'assign-1';
      const studentId = 'student-1';

      prisma.assignment.findFirst.mockResolvedValue({
        id: assignmentId,
        schoolId,
      });
      prisma.student.findFirst.mockResolvedValue({ id: studentId, schoolId });
      prisma.assignmentSubmission.upsert.mockResolvedValue({
        id: 'sub-1',
        assignmentId,
        studentId,
        marksObtained: 18,
        status: 'GRADED',
      });

      const res = await service.submitAssignment(
        schoolId,
        assignmentId,
        studentId,
        {
          marksObtained: 18,
          feedback: 'Excellent work',
          status: 'GRADED',
        },
      );

      expect(prisma.assignmentSubmission.upsert).toHaveBeenCalled();
      expect(res.status).toBe('GRADED');
    });
  });
});
