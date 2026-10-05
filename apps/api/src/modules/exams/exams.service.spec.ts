import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ExamsService } from './exams.service';
import { PrismaService } from '../../core/database/prisma.service';

describe('ExamsService — Change #9B Hardened Academic Context', () => {
  let service: ExamsService;
  let prisma: {
    exam: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    examSubject: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      deleteMany: jest.Mock;
    };
    studentMark: {
      findMany: jest.Mock;
      upsert: jest.Mock;
    };
    student: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
    };
    studentEnrollment: {
      findMany: jest.Mock;
    };
    studentSubjectEnrollment: {
      findMany: jest.Mock;
    };
    academicYear: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
    };
    class: {
      findFirst: jest.Mock;
    };
    section: {
      findFirst: jest.Mock;
    };
    subject: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
    };
    schoolSubjectOffering: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
    };
    reportCard: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      upsert: jest.Mock;
      updateMany: jest.Mock;
    };
    message: {
      createMany: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  const schoolId = 'school-1';
  const academicYearId = 'ay-2026';
  const activeYear = {
    id: academicYearId,
    schoolId,
    name: '2026-27',
    isActive: true,
    isLocked: false,
  };

  beforeEach(async () => {
    prisma = {
      exam: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      examSubject: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      studentMark: {
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn(),
      },
      student: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      studentEnrollment: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      studentSubjectEnrollment: {
        findMany: jest.fn().mockResolvedValue([]),
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
        findMany: jest.fn().mockResolvedValue([]),
      },
      schoolSubjectOffering: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      reportCard: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      message: {
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      $transaction: jest.fn().mockImplementation((ops) => Promise.all(ops)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [ExamsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<ExamsService>(ExamsService);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. ACADEMIC YEAR RESOLUTION & LOCKING (Tests 1–5)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Academic Year Resolution & Locking', () => {
    it('1. succeeds when explicit valid academicYearId is provided for createExam', async () => {
      prisma.academicYear.findFirst.mockResolvedValue(activeYear);
      prisma.exam.create.mockImplementation((args) =>
        Promise.resolve({ id: 'exam-1', ...args.data }),
      );

      const res = await service.createExam(schoolId, {
        name: 'Midterm 2026',
        examType: 'MIDTERM',
        academicYearId,
        startDate: '2026-10-01',
        endDate: '2026-10-15',
      });

      expect(res.academicYearId).toBe(academicYearId);
      expect(prisma.academicYear.findFirst).toHaveBeenCalledWith({
        where: {
          schoolId,
          OR: [
            { id: academicYearId },
            { name: academicYearId },
            { name: '2026' },
          ],
        },
      });
    });

    it('2. resolves active academic year when academicYearId is omitted in createExam', async () => {
      prisma.academicYear.findFirst.mockResolvedValue(activeYear);
      prisma.exam.create.mockImplementation((args) =>
        Promise.resolve({ id: 'exam-1', ...args.data }),
      );

      const res = await service.createExam(schoolId, {
        name: 'Finals 2026',
        examType: 'FINAL',
        academicYearId: undefined,
        startDate: '2026-12-01',
        endDate: '2026-12-15',
      });

      expect(res.academicYearId).toBe(academicYearId);
    });

    it('3. throws BadRequestException when academicYearId is omitted and no active year exists in createExam', async () => {
      prisma.academicYear.findFirst.mockResolvedValue(null);

      await expect(
        service.createExam(schoolId, {
          name: 'Finals 2026',
          examType: 'FINAL',
          academicYearId: undefined as any,
          startDate: '2026-12-01',
          endDate: '2026-12-15',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('4. throws NotFoundException when explicit academicYearId does not belong to school', async () => {
      prisma.academicYear.findFirst.mockResolvedValue(null);

      await expect(
        service.createExam(schoolId, {
          name: 'Midterm 2026',
          examType: 'MIDTERM',
          academicYearId: 'foreign-ay',
          startDate: '2026-10-01',
          endDate: '2026-10-15',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('5. rejects createExam, updateExam, deleteExam, and addExamSubject when academic year is locked', async () => {
      const lockedYear = { ...activeYear, isLocked: true };
      prisma.academicYear.findFirst.mockResolvedValue(lockedYear);

      // createExam
      await expect(
        service.createExam(schoolId, {
          name: 'Midterm 2026',
          examType: 'MIDTERM',
          academicYearId,
          startDate: '2026-10-01',
          endDate: '2026-10-15',
        }),
      ).rejects.toThrow(BadRequestException);

      // updateExam
      prisma.exam.findFirst.mockResolvedValue({
        id: 'exam-1',
        schoolId,
        academicYearId,
        academicYear: lockedYear,
      });
      await expect(
        service.updateExam(schoolId, 'exam-1', { name: 'New Name' }),
      ).rejects.toThrow(BadRequestException);

      // deleteExam
      prisma.exam.findFirst.mockResolvedValue({
        id: 'exam-1',
        schoolId,
        academicYearId,
        academicYear: lockedYear,
        _count: { reportCards: 0 },
      });
      await expect(service.deleteExam(schoolId, 'exam-1')).rejects.toThrow(
        BadRequestException,
      );

      // addExamSubject
      await expect(
        service.addExamSubject('exam-1', schoolId, {
          classId: 'class-10',
          subjectId: 'sub-math',
          maxMarks: 100,
          passMarks: 40,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. EXAMSUBJECT ACADEMIC RELATIONSHIP GRAPH (Tests 6–16)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('ExamSubject Academic Relationship Graph', () => {
    const exam = {
      id: 'exam-1',
      schoolId,
      academicYearId,
      academicYear: activeYear,
    };
    const validClass = {
      id: 'class-10',
      schoolId,
      academicYearId,
      name: 'Class 10',
      numericLevel: 10,
    };
    const validOffering = {
      id: 'offering-math-10',
      schoolId,
      academicYearId,
      gradeFrom: 9,
      gradeTo: 10,
      isOffered: true,
      legacySubjectId: 'sub-math',
    };

    beforeEach(() => {
      prisma.exam.findFirst.mockResolvedValue(exam);
      prisma.class.findFirst.mockResolvedValue(validClass);
      prisma.schoolSubjectOffering.findFirst.mockResolvedValue(validOffering);
      prisma.examSubject.findFirst.mockResolvedValue(null); // no duplicate
      prisma.examSubject.create.mockImplementation((args) =>
        Promise.resolve({ id: 'es-1', ...args.data }),
      );
    });

    it('6. succeeds when class and offering belong to same school and academic year and grade band matches', async () => {
      const res = await service.addExamSubject('exam-1', schoolId, {
        classId: 'class-10',
        schoolSubjectOfferingId: 'offering-math-10',
        maxMarks: 100,
        passMarks: 40,
      });

      expect(res.schoolSubjectOfferingId).toBe('offering-math-10');
      expect(res.subjectId).toBe('sub-math');
      expect(res.classId).toBe('class-10');
    });

    it('7. throws NotFoundException when class does not exist or belongs to different school', async () => {
      prisma.class.findFirst.mockResolvedValue(null);

      await expect(
        service.addExamSubject('exam-1', schoolId, {
          classId: 'foreign-class',
          schoolSubjectOfferingId: 'offering-math-10',
          maxMarks: 100,
          passMarks: 40,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('8. throws BadRequestException when class belongs to different academic year than exam', async () => {
      prisma.class.findFirst.mockResolvedValue({
        ...validClass,
        academicYearId: 'ay-past-year',
      });

      await expect(
        service.addExamSubject('exam-1', schoolId, {
          classId: 'class-10',
          schoolSubjectOfferingId: 'offering-math-10',
          maxMarks: 100,
          passMarks: 40,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('9. throws NotFoundException when offering belongs to different school', async () => {
      prisma.schoolSubjectOffering.findFirst.mockResolvedValue(null);

      await expect(
        service.addExamSubject('exam-1', schoolId, {
          classId: 'class-10',
          schoolSubjectOfferingId: 'foreign-offering',
          maxMarks: 100,
          passMarks: 40,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('10. throws BadRequestException when offering belongs to different academic year than exam', async () => {
      prisma.schoolSubjectOffering.findFirst.mockResolvedValue({
        ...validOffering,
        academicYearId: 'ay-other-year',
      });

      await expect(
        service.addExamSubject('exam-1', schoolId, {
          classId: 'class-10',
          schoolSubjectOfferingId: 'offering-math-10',
          maxMarks: 100,
          passMarks: 40,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('11. throws BadRequestException when offering grade band does not cover class grade', async () => {
      prisma.schoolSubjectOffering.findFirst.mockResolvedValue({
        ...validOffering,
        gradeFrom: 1,
        gradeTo: 5, // Class 10 is out of 1-5
      });

      await expect(
        service.addExamSubject('exam-1', schoolId, {
          classId: 'class-10',
          schoolSubjectOfferingId: 'offering-math-10',
          maxMarks: 100,
          passMarks: 40,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('12. throws BadRequestException when offering is inactive (isOffered === false)', async () => {
      prisma.schoolSubjectOffering.findFirst.mockResolvedValue({
        ...validOffering,
        isOffered: false,
      });

      await expect(
        service.addExamSubject('exam-1', schoolId, {
          classId: 'class-10',
          schoolSubjectOfferingId: 'offering-math-10',
          maxMarks: 100,
          passMarks: 40,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('13. throws BadRequestException when subjectId contradicts offering legacySubjectId', async () => {
      await expect(
        service.addExamSubject('exam-1', schoolId, {
          classId: 'class-10',
          schoolSubjectOfferingId: 'offering-math-10',
          subjectId: 'sub-physics', // contradicts legacySubjectId: 'sub-math'
          maxMarks: 100,
          passMarks: 40,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('14. deterministically auto-links to single matching active offering when only legacy subjectId provided', async () => {
      prisma.subject.findFirst.mockResolvedValue({
        id: 'sub-math',
        schoolId,
        name: 'Mathematics',
      });
      prisma.schoolSubjectOffering.findMany.mockResolvedValue([validOffering]);

      const res = await service.addExamSubject('exam-1', schoolId, {
        classId: 'class-10',
        subjectId: 'sub-math',
        maxMarks: 100,
        passMarks: 40,
      });

      expect(res.schoolSubjectOfferingId).toBe('offering-math-10');
      expect(res.subjectId).toBe('sub-math');
    });

    it('15. does NOT auto-link (leaves schoolSubjectOfferingId null) when multiple matching offerings exist', async () => {
      prisma.subject.findFirst.mockResolvedValue({
        id: 'sub-math',
        schoolId,
        name: 'Mathematics',
      });
      prisma.schoolSubjectOffering.findMany.mockResolvedValue([
        validOffering,
        { ...validOffering, id: 'offering-math-advanced' },
      ]);

      const res = await service.addExamSubject('exam-1', schoolId, {
        classId: 'class-10',
        subjectId: 'sub-math',
        maxMarks: 100,
        passMarks: 40,
      });

      expect(res.schoolSubjectOfferingId).toBeNull();
      expect(res.subjectId).toBe('sub-math');
    });

    it('16. throws BadRequestException when subject or offering is duplicate for same exam and class', async () => {
      prisma.examSubject.findFirst.mockResolvedValue({ id: 'existing-es' });

      await expect(
        service.addExamSubject('exam-1', schoolId, {
          classId: 'class-10',
          schoolSubjectOfferingId: 'offering-math-10',
          maxMarks: 100,
          passMarks: 40,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. STUDENT MARK ENROLLMENT INVARIANTS (Tests 17–21)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Student Mark Enrollment Invariants', () => {
    const examSubject = {
      id: 'es-1',
      examId: 'exam-1',
      classId: 'class-10',
      maxMarks: 100,
      passMarks: 40,
      exam: {
        id: 'exam-1',
        schoolId,
        academicYearId,
        academicYear: activeYear,
      },
    };

    beforeEach(() => {
      prisma.examSubject.findFirst.mockResolvedValue(examSubject);
      prisma.student.findMany.mockResolvedValue([{ id: 'student-1' }]);
      prisma.studentEnrollment.findMany.mockResolvedValue([
        { studentId: 'student-1', academicYearId, status: 'ACTIVE' },
      ]);
      prisma.studentMark.upsert.mockImplementation((args) =>
        Promise.resolve({ id: 'sm-1', ...args.create }),
      );
    });

    it('17. enters marks successfully when student has active enrollment in exam year and exam class', async () => {
      const res = await service.enterMarks(
        'exam-1',
        'es-1',
        schoolId,
        [{ studentId: 'student-1', marksObtained: 85 }],
        'teacher-1',
      );

      expect(res).toHaveLength(1);
      expect(prisma.studentMark.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            studentId: 'student-1',
            marksObtained: 85,
            grade: 'A',
          }),
        }),
      );
    });

    it('18. throws BadRequestException when student does not belong to school', async () => {
      prisma.student.findMany.mockResolvedValue([]); // not found in school

      await expect(
        service.enterMarks(
          'exam-1',
          'es-1',
          schoolId,
          [{ studentId: 'foreign-student', marksObtained: 85 }],
          'teacher-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('19. throws BadRequestException when student has no active enrollment in exam year', async () => {
      prisma.studentEnrollment.findMany.mockResolvedValue([]); // no enrollment for ay-2026

      await expect(
        service.enterMarks(
          'exam-1',
          'es-1',
          schoolId,
          [{ studentId: 'student-1', marksObtained: 85 }],
          'teacher-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('20. throws BadRequestException when student is enrolled in a different class than examSubject', async () => {
      prisma.studentEnrollment.findMany.mockResolvedValue([]); // filtered by section.classId: class-10, returned 0

      await expect(
        service.enterMarks(
          'exam-1',
          'es-1',
          schoolId,
          [{ studentId: 'student-1', marksObtained: 85 }],
          'teacher-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('21. handles absent student by setting marksObtained to null and isAbsent to true', async () => {
      await service.enterMarks(
        'exam-1',
        'es-1',
        schoolId,
        [{ studentId: 'student-1', isAbsent: true }],
        'teacher-1',
      );

      expect(prisma.studentMark.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            studentId: 'student-1',
            marksObtained: null,
            isAbsent: true,
            grade: undefined,
          }),
        }),
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. SECTION & ROUTE INTEGRITY (Tests 22–25)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Section & Route Integrity', () => {
    const examSubject = {
      id: 'es-1',
      examId: 'exam-1',
      classId: 'class-10',
      maxMarks: 100,
      passMarks: 40,
      exam: {
        id: 'exam-1',
        schoolId,
        academicYearId,
        academicYear: activeYear,
      },
    };

    beforeEach(() => {
      prisma.examSubject.findFirst.mockResolvedValue(examSubject);
    });

    it('22. enterMarks throws BadRequestException when route examId does not match examSubject.examId', async () => {
      await expect(
        service.enterMarks(
          'mismatched-exam-id',
          'es-1',
          schoolId,
          [{ studentId: 'student-1', marksObtained: 90 }],
          'teacher-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('23. getMarksForSubject throws BadRequestException when route examId does not match examSubject.examId', async () => {
      await expect(
        service.getMarksForSubject('mismatched-exam-id', 'es-1', schoolId),
      ).rejects.toThrow(BadRequestException);
    });

    it('24. getStudentsForMarksEntry throws BadRequestException when route examId does not match examSubject.examId', async () => {
      await expect(
        service.getStudentsForMarksEntry(
          'mismatched-exam-id',
          'es-1',
          'sec-10a',
          schoolId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('25. getStudentsForMarksEntry throws BadRequestException when section belongs to different class than examSubject', async () => {
      prisma.section.findFirst.mockResolvedValue({
        id: 'sec-9a',
        classId: 'class-9', // does not match examSubject.classId 'class-10'
        class: { schoolId },
      });

      await expect(
        service.getStudentsForMarksEntry('exam-1', 'es-1', 'sec-9a', schoolId),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. YEAR-SAFE REPORTING & HISTORICAL SAFETY (Tests 26–30)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Year-Safe Reporting & Historical Safety', () => {
    it('26. getMarksForSubject scopes student enrollment lookups by exam.academicYearId', async () => {
      prisma.examSubject.findFirst.mockResolvedValue({
        id: 'es-1',
        examId: 'exam-1',
        classId: 'class-10',
        exam: { id: 'exam-1', academicYearId: 'ay-2025' },
      });

      await service.getMarksForSubject('exam-1', 'es-1', schoolId);

      expect(prisma.studentMark.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            student: expect.objectContaining({
              include: expect.objectContaining({
                enrollments: expect.objectContaining({
                  where: { academicYearId: 'ay-2025', status: 'ACTIVE' },
                }),
              }),
            }),
          }),
        }),
      );
    });

    it('27. getStudentsForMarksEntry scopes student enrollment lookup by section and exam.academicYearId', async () => {
      prisma.examSubject.findFirst.mockResolvedValue({
        id: 'es-1',
        examId: 'exam-1',
        classId: 'class-10',
        exam: { id: 'exam-1', academicYearId: 'ay-2025' },
        marks: [],
      });
      prisma.section.findFirst.mockResolvedValue({
        id: 'sec-10a',
        classId: 'class-10',
        class: { schoolId },
      });

      await service.getStudentsForMarksEntry(
        'exam-1',
        'es-1',
        'sec-10a',
        schoolId,
      );

      expect(prisma.studentEnrollment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            sectionId: 'sec-10a',
            academicYearId: 'ay-2025',
            status: 'ACTIVE',
          },
        }),
      );
    });

    it('28. getClassResults scopes student enrollment lookups by exam.academicYearId', async () => {
      prisma.exam.findFirst.mockResolvedValue({
        id: 'exam-1',
        academicYearId: 'ay-2024',
      });

      await service.getClassResults('exam-1', schoolId);

      expect(prisma.reportCard.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { examId: 'exam-1' },
          include: expect.objectContaining({
            student: expect.objectContaining({
              include: expect.objectContaining({
                enrollments: expect.objectContaining({
                  where: { academicYearId: 'ay-2024', status: 'ACTIVE' },
                }),
              }),
            }),
          }),
        }),
      );
    });

    it('29. getStudentReportCard scopes student enrollment and subject enrollments by exam.academicYearId', async () => {
      prisma.exam.findFirst.mockResolvedValue({
        id: 'exam-1',
        academicYearId: 'ay-2024',
      });
      prisma.student.findFirst.mockResolvedValue({
        id: 'student-1',
        userId: 'user-1',
      });

      await service.getStudentReportCard('exam-1', 'student-1', schoolId);

      expect(prisma.studentSubjectEnrollment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            studentId: 'student-1',
            academicYearId: 'ay-2024',
            status: 'ACTIVE',
          },
        }),
      );
    });

    it('30. getStudentResults safely formats subject names using offering or legacy subject name without errors', async () => {
      prisma.student.findFirst.mockResolvedValue({
        id: 'student-1',
        userId: 'user-1',
      });
      prisma.reportCard.findMany.mockResolvedValue([
        {
          id: 'rc-1',
          examId: 'exam-1',
          exam: {
            name: 'Midterm',
            examType: 'MIDTERM',
            startDate: new Date(),
            academicYear: { name: '2026-27' },
          },
          totalMarks: 100,
          obtainedMarks: 95,
          percentage: 95,
          grade: 'A+',
          rank: 1,
          isPublished: true,
        },
      ]);
      prisma.studentMark.findMany.mockResolvedValue([
        {
          examSubject: {
            exam: { id: 'exam-1' },
            schoolSubjectOfferingId: 'offering-1',
            subjectId: null,
            maxMarks: 100,
            passMarks: 40,
            schoolSubjectOffering: {
              curriculumSubject: { displayName: 'Advanced Mathematics' },
            },
            subject: null,
          },
          marksObtained: 95,
          grade: 'A+',
          isAbsent: false,
          remarks: 'Excellent',
        },
      ]);

      const results = await service.getStudentResults('student-1', schoolId);

      expect(results).toHaveLength(1);
      expect(results[0].marks[0].subjectName).toBe('Advanced Mathematics');
    });
  });
});
