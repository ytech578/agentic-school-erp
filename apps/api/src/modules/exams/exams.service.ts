import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { requireSchoolId } from '../../core/tenant/tenant.util';
import { resolveGradeLevel } from '../../core/academic/grade-resolver.util';
import { resolveActiveAcademicYear } from '../../core/academic/academic-year.util';
import {
  CreateExamDto,
  UpdateExamDto,
  AddExamSubjectDto,
  StudentMarkEntryDto,
} from './dto/exam.dto';

const GRADE_SCALE = [
  { min: 90, grade: 'A+' },
  { min: 75, grade: 'A' },
  { min: 60, grade: 'B' },
  { min: 50, grade: 'C' },
  { min: 35, grade: 'D' },
  { min: 0, grade: 'F' },
];

function calculateGrade(obtained: number, max: number): string {
  const pct = max > 0 ? (obtained / max) * 100 : 0;
  return GRADE_SCALE.find((g) => pct >= g.min)?.grade ?? 'F';
}

@Injectable()
export class ExamsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Deterministically resolves academic year for exam operations.
   * - If providedId is provided, validates that it exists in the school.
   * - If providedId is omitted and isMutation=true, resolves the single active academic year (never falls back to latest).
   * - If isMutation=true and resolved year is locked, throws BadRequestException.
   * - If isMutation=false (queries) and no active year exists, falls back to latest year.
   */
  async resolveAcademicYear(
    schoolId: string,
    providedId?: string,
    isMutation = false,
  ) {
    return await resolveActiveAcademicYear(this.prisma, {
      schoolId,
      requestedId: providedId,
      isMutation,
    });
  }

  async resolveAcademicYearId(
    schoolId: string,
    providedId?: string,
    isMutation = false,
  ): Promise<string> {
    const year = await this.resolveAcademicYear(
      schoolId,
      providedId,
      isMutation,
    );
    return year.id;
  }

  // ─── Create Exam ──────────────────────────────────────────────────────────
  async createExam(schoolId: string, data: CreateExamDto) {
    const validSchoolId = requireSchoolId(schoolId);
    const resolvedAcademicYear = await this.resolveAcademicYear(
      validSchoolId,
      data.academicYearId,
      true, // mutation
    );

    return this.prisma.exam.create({
      data: {
        schoolId: validSchoolId,
        academicYearId: resolvedAcademicYear.id,
        name: data.name,
        examType: data.examType,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
      },
      include: { subjects: true },
    });
  }

  // ─── Update Exam ──────────────────────────────────────────────────────────
  async updateExam(schoolId: string, examId: string, data: UpdateExamDto) {
    const validSchoolId = requireSchoolId(schoolId);
    const exam = await this.prisma.exam.findFirst({
      where: { id: examId, schoolId: validSchoolId },
      include: { academicYear: true },
    });
    if (!exam) throw new NotFoundException('Exam not found');

    if (exam.academicYear?.isLocked) {
      throw new BadRequestException(
        `Academic session '${exam.academicYear.name}' is locked. Structural changes are not permitted.`,
      );
    }

    return this.prisma.exam.update({
      where: { id: exam.id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.examType && { examType: data.examType }),
        ...(data.startDate && { startDate: new Date(data.startDate) }),
        ...(data.endDate && { endDate: new Date(data.endDate) }),
      },
      include: { _count: { select: { subjects: true, reportCards: true } } },
    });
  }

  // ─── Delete Exam ──────────────────────────────────────────────────────────
  async deleteExam(schoolId: string, examId: string) {
    const validSchoolId = requireSchoolId(schoolId);
    const exam = await this.prisma.exam.findFirst({
      where: { id: examId, schoolId: validSchoolId },
      include: {
        academicYear: true,
        _count: { select: { reportCards: true } },
      },
    });
    if (!exam) throw new NotFoundException('Exam not found');

    if (exam.academicYear?.isLocked) {
      throw new BadRequestException(
        `Academic session '${exam.academicYear.name}' is locked. Structural changes are not permitted.`,
      );
    }

    if ((exam._count as any).reportCards > 0) {
      throw new BadRequestException(
        'Cannot delete an exam that has report cards. Unpublish first.',
      );
    }
    // Delete subjects first, then exam
    await this.prisma.examSubject.deleteMany({ where: { examId: exam.id } });
    await this.prisma.exam.delete({ where: { id: exam.id } });
    return { message: 'Exam deleted successfully' };
  }

  // ─── List Exams ───────────────────────────────────────────────────────────
  async listExams(schoolId: string, academicYearId?: string) {
    const validSchoolId = requireSchoolId(schoolId);
    const resolvedAcademicYear = await this.resolveAcademicYear(
      validSchoolId,
      academicYearId,
      false, // query
    );
    return this.prisma.exam.findMany({
      where: {
        schoolId: validSchoolId,
        academicYearId: resolvedAcademicYear.id,
      },
      include: {
        _count: { select: { subjects: true, reportCards: true } },
        academicYear: { select: { name: true } },
      },
      orderBy: { startDate: 'desc' },
    });
  }

  // ─── Get Single Exam ──────────────────────────────────────────────────────
  async getExam(schoolId: string, examId: string) {
    const validSchoolId = requireSchoolId(schoolId);
    const exam = await this.prisma.exam.findFirst({
      where: { id: examId, schoolId: validSchoolId },
      include: {
        academicYear: { select: { id: true, name: true, isLocked: true } },
        subjects: {
          include: {
            subject: { select: { id: true, name: true, code: true } },
            schoolSubjectOffering: {
              include: { globalSubject: true, curriculumSubject: true },
            },
            class: { select: { id: true, name: true } },
            _count: { select: { marks: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        _count: { select: { reportCards: true } },
      },
    });
    if (!exam) throw new NotFoundException('Exam not found');
    return exam;
  }

  // ─── Add Subject to Exam ──────────────────────────────────────────────────
  async addExamSubject(
    examId: string,
    schoolId: string,
    data: AddExamSubjectDto,
  ) {
    const validSchoolId = requireSchoolId(schoolId);
    const exam = await this.prisma.exam.findFirst({
      where: { id: examId, schoolId: validSchoolId },
      include: { academicYear: true },
    });
    if (!exam) throw new NotFoundException('Exam not found');

    if (exam.academicYear?.isLocked) {
      throw new BadRequestException(
        `Academic session '${exam.academicYear.name}' is locked. Structural changes are not permitted.`,
      );
    }

    // 1. Validate class belongs to school and matches exam academic year
    const cls = await this.prisma.class.findFirst({
      where: { id: data.classId, schoolId: validSchoolId },
    });
    if (!cls) throw new NotFoundException('Class not found in this school');

    if (cls.academicYearId !== exam.academicYearId) {
      throw new BadRequestException(
        `Class belongs to academic session '${cls.academicYearId}', which does not match exam academic session '${exam.academicYear?.name || exam.academicYearId}'`,
      );
    }

    const classGrade = resolveGradeLevel(cls);

    // 2. Validate Canonical Offering and/or Legacy Subject
    let resolvedOfferingId: string | null = null;
    let resolvedSubjectId: string | null = null;

    if (data.schoolSubjectOfferingId) {
      const offering = await this.prisma.schoolSubjectOffering.findFirst({
        where: { id: data.schoolSubjectOfferingId, schoolId: validSchoolId },
      });
      if (!offering) {
        throw new NotFoundException(
          'School subject offering not found in this school',
        );
      }
      if (offering.academicYearId !== exam.academicYearId) {
        throw new BadRequestException(
          'School subject offering belongs to a different academic session than exam',
        );
      }
      if (!offering.isOffered) {
        throw new BadRequestException(
          `School subject offering "${offering.id}" is inactive and cannot be selected for exams`,
        );
      }
      if (classGrade < offering.gradeFrom || classGrade > offering.gradeTo) {
        throw new BadRequestException(
          `Offering "${offering.id}" (grades ${offering.gradeFrom}-${offering.gradeTo}) is not compatible with class grade ${classGrade}`,
        );
      }
      if (
        data.subjectId &&
        offering.legacySubjectId &&
        data.subjectId !== offering.legacySubjectId
      ) {
        throw new BadRequestException(
          `Subject "${data.subjectId}" contradicts canonical offering legacySubjectId "${offering.legacySubjectId}"`,
        );
      }
      resolvedOfferingId = offering.id;
      resolvedSubjectId = data.subjectId || offering.legacySubjectId || null;
    } else if (data.subjectId) {
      const subj = await this.prisma.subject.findFirst({
        where: { id: data.subjectId, schoolId: validSchoolId },
      });
      if (!subj) {
        throw new NotFoundException('Subject not found in this school');
      }
      resolvedSubjectId = subj.id;

      // Deterministically check if a unique matching active offering exists in session covering this class grade
      const matchingOfferings =
        await this.prisma.schoolSubjectOffering.findMany({
          where: {
            schoolId: validSchoolId,
            academicYearId: exam.academicYearId,
            legacySubjectId: subj.id,
            gradeFrom: { lte: classGrade },
            gradeTo: { gte: classGrade },
            isOffered: true,
          },
        });
      if (matchingOfferings.length === 1) {
        resolvedOfferingId = matchingOfferings[0].id;
      }
    } else {
      throw new BadRequestException(
        'Either schoolSubjectOfferingId or subjectId must be provided',
      );
    }

    // 3. Duplicate check
    const existing = await this.prisma.examSubject.findFirst({
      where: {
        examId: exam.id,
        classId: data.classId,
        OR: [
          ...(resolvedOfferingId
            ? [{ schoolSubjectOfferingId: resolvedOfferingId }]
            : []),
          ...(resolvedSubjectId ? [{ subjectId: resolvedSubjectId }] : []),
        ],
      },
    });
    if (existing) {
      throw new BadRequestException(
        'Subject or offering already added to this exam for this class',
      );
    }

    return this.prisma.examSubject.create({
      data: {
        examId: exam.id,
        classId: data.classId,
        schoolSubjectOfferingId: resolvedOfferingId,
        subjectId: resolvedSubjectId,
        maxMarks: data.maxMarks,
        passMarks: data.passMarks,
        examDate: data.examDate ? new Date(data.examDate) : undefined,
        duration: data.duration,
      },
      include: {
        subject: { select: { name: true, code: true } },
        schoolSubjectOffering: {
          include: { globalSubject: true, curriculumSubject: true },
        },
        class: { select: { name: true } },
      },
    });
  }

  // ─── Enter / Update Marks ─────────────────────────────────────────────────
  // ─── Enter / Update Marks ─────────────────────────────────────────────────
  async enterMarks(
    examIdOrExamSubjectId: string,
    examSubjectIdOrSchoolId: string,
    schoolIdOrMarks: string | StudentMarkEntryDto[],
    marksOrEnteredById?: StudentMarkEntryDto[] | string,
    enteredById?: string,
  ) {
    let examId: string | undefined;
    let examSubjectId: string;
    let schoolId: string;
    let marks: StudentMarkEntryDto[];
    let authorId: string;

    if (Array.isArray(schoolIdOrMarks)) {
      examSubjectId = examIdOrExamSubjectId;
      schoolId = examSubjectIdOrSchoolId;
      marks = schoolIdOrMarks;
      authorId = (marksOrEnteredById as string) || '';
    } else {
      examId = examIdOrExamSubjectId;
      examSubjectId = examSubjectIdOrSchoolId;
      schoolId = schoolIdOrMarks;
      marks = (marksOrEnteredById as StudentMarkEntryDto[]) || [];
      authorId = enteredById || '';
    }

    const validSchoolId = requireSchoolId(schoolId);
    const examSubject = await this.prisma.examSubject.findFirst({
      where: { id: examSubjectId, exam: { schoolId: validSchoolId } },
      include: { exam: { include: { academicYear: true } } },
    });
    if (!examSubject) {
      throw new NotFoundException('Exam subject not found');
    }

    if (examId && examSubject.examId !== examId) {
      throw new BadRequestException(
        'Exam subject does not belong to the specified exam',
      );
    }

    if (examSubject.exam.academicYear?.isLocked) {
      throw new BadRequestException(
        `Academic session '${examSubject.exam.academicYear.name}' is locked. Structural changes are not permitted.`,
      );
    }

    // Validate that all students belong to the school and are enrolled in the exam's year and examSubject's class
    if (marks.length > 0) {
      const studentIds = marks.map((m) => m.studentId);
      const students = await this.prisma.student.findMany({
        where: { id: { in: studentIds }, schoolId: validSchoolId },
        select: { id: true },
      });
      if (students.length !== studentIds.length) {
        throw new BadRequestException(
          'One or more students do not belong to this school',
        );
      }

      if (examSubject.exam?.academicYearId && examSubject.classId) {
        const enrollments = await this.prisma.studentEnrollment.findMany({
          where: {
            studentId: { in: studentIds },
            academicYearId: examSubject.exam.academicYearId,
            section: { classId: examSubject.classId },
            status: 'ACTIVE',
          },
          select: { studentId: true },
        });
        const enrolledStudentIds = new Set(enrollments.map((e) => e.studentId));

        for (const sId of studentIds) {
          if (!enrolledStudentIds.has(sId)) {
            throw new BadRequestException(
              `Student '${sId}' does not have an active enrollment in class '${examSubject.classId}' for academic session '${examSubject.exam.academicYearId}'`,
            );
          }
        }
      }
    }

    const ops = marks.map((m) => {
      const grade =
        !m.isAbsent && m.marksObtained !== undefined
          ? calculateGrade(m.marksObtained, Number(examSubject.maxMarks))
          : undefined;

      return this.prisma.studentMark.upsert({
        where: {
          studentId_examSubjectId: { studentId: m.studentId, examSubjectId },
        },
        create: {
          studentId: m.studentId,
          examSubjectId,
          marksObtained: m.isAbsent ? null : m.marksObtained,
          isAbsent: m.isAbsent ?? false,
          grade,
          remarks: m.remarks,
          enteredById: authorId,
        },
        update: {
          marksObtained: m.isAbsent ? null : m.marksObtained,
          isAbsent: m.isAbsent ?? false,
          grade,
          remarks: m.remarks,
          enteredById: authorId,
        },
      });
    });

    return this.prisma.$transaction(ops);
  }

  // ─── Get Marks for an Exam Subject ───────────────────────────────────────
  async getMarksForSubject(
    examIdOrExamSubjectId: string,
    examSubjectIdOrSchoolId: string,
    possibleSchoolId?: string,
  ) {
    let examId: string | undefined;
    let examSubjectId: string;
    let schoolId: string;

    if (possibleSchoolId) {
      examId = examIdOrExamSubjectId;
      examSubjectId = examSubjectIdOrSchoolId;
      schoolId = possibleSchoolId;
    } else {
      examSubjectId = examIdOrExamSubjectId;
      schoolId = examSubjectIdOrSchoolId;
    }

    const validSchoolId = requireSchoolId(schoolId);
    const es = await this.prisma.examSubject.findFirst({
      where: { id: examSubjectId, exam: { schoolId: validSchoolId } },
      include: {
        exam: true,
        subject: { select: { name: true } },
        schoolSubjectOffering: {
          include: { globalSubject: true, curriculumSubject: true },
        },
      },
    });
    if (!es) throw new NotFoundException('Exam subject not found');

    if (examId && es.examId !== examId) {
      throw new BadRequestException(
        'Exam subject does not belong to the specified exam',
      );
    }

    const marks = await this.prisma.studentMark.findMany({
      where: { examSubjectId },
      include: {
        student: {
          include: {
            user: { select: { firstName: true, lastName: true } },
            enrollments: {
              where: {
                academicYearId: es.exam?.academicYearId,
                status: 'ACTIVE',
              },
              include: {
                section: {
                  select: { name: true, class: { select: { name: true } } },
                },
              },
              take: 1,
            },
          },
        },
      },
      orderBy: { marksObtained: 'desc' },
    });
    return { examSubject: es, marks };
  }

  // ─── Get Students for Marks Entry (by section) ────────────────────────────
  async getStudentsForMarksEntry(
    examIdOrExamSubjectId: string,
    examSubjectIdOrSectionId: string,
    sectionIdOrSchoolId: string,
    possibleSchoolId?: string,
  ) {
    let examId: string | undefined;
    let examSubjectId: string;
    let sectionId: string;
    let schoolId: string;

    if (possibleSchoolId) {
      examId = examIdOrExamSubjectId;
      examSubjectId = examSubjectIdOrSectionId;
      sectionId = sectionIdOrSchoolId;
      schoolId = possibleSchoolId;
    } else {
      examSubjectId = examIdOrExamSubjectId;
      sectionId = examSubjectIdOrSectionId;
      schoolId = sectionIdOrSchoolId;
    }

    const validSchoolId = requireSchoolId(schoolId);
    const examSubject = await this.prisma.examSubject.findFirst({
      where: { id: examSubjectId, exam: { schoolId: validSchoolId } },
      include: {
        exam: true,
        subject: { select: { name: true } },
        schoolSubjectOffering: {
          include: { globalSubject: true, curriculumSubject: true },
        },
        marks: true,
      },
    });
    if (!examSubject) {
      throw new NotFoundException('Exam subject not found');
    }

    if (examId && examSubject.examId !== examId) {
      throw new BadRequestException(
        'Exam subject does not belong to the specified exam',
      );
    }

    // Validate section belongs to school and section belongs to exam subject's class
    const section = await this.prisma.section.findFirst({
      where: { id: sectionId, class: { schoolId: validSchoolId } },
      include: { class: true },
    });
    if (!section) {
      throw new NotFoundException('Section not found');
    }

    if (section.classId !== examSubject.classId) {
      throw new BadRequestException(
        'Section does not belong to the exam subject class',
      );
    }

    const enrollments = await this.prisma.studentEnrollment.findMany({
      where: {
        sectionId,
        academicYearId: examSubject.exam.academicYearId,
        status: 'ACTIVE',
      },
      include: {
        student: {
          include: {
            user: { select: { firstName: true, lastName: true } },
          },
        },
      },
      orderBy: { rollNumber: 'asc' },
    });

    return {
      examSubject,
      students: enrollments.map((e) => {
        const mark = examSubject.marks.find((m) => m.studentId === e.studentId);
        return {
          studentId: e.studentId,
          rollNumber: e.rollNumber,
          name: `${e.student.user.firstName} ${e.student.user.lastName}`,
          mark: mark ?? null,
        };
      }),
    };
  }

  // ─── Generate Report Cards ────────────────────────────────────────────────
  async generateReportCards(examId: string, schoolId: string) {
    const validSchoolId = requireSchoolId(schoolId);
    const exam = await this.prisma.exam.findFirst({
      where: { id: examId, schoolId: validSchoolId },
      include: {
        academicYear: true,
        subjects: {
          include: {
            marks: { include: { student: true } },
          },
        },
      },
    });
    if (!exam) throw new NotFoundException('Exam not found');

    if (exam.academicYear?.isLocked) {
      throw new BadRequestException(
        `Academic session '${exam.academicYear.name}' is locked. Structural changes are not permitted.`,
      );
    }

    // Gather all students who have marks in this exam
    const studentMap = new Map<string, { total: number; obtained: number }>();
    for (const es of exam.subjects) {
      for (const mark of es.marks) {
        if (!studentMap.has(mark.studentId)) {
          studentMap.set(mark.studentId, { total: 0, obtained: 0 });
        }
        const s = studentMap.get(mark.studentId)!;
        s.total += Number(es.maxMarks);
        if (!mark.isAbsent && mark.marksObtained !== null) {
          s.obtained += Number(mark.marksObtained);
        }
      }
    }

    // Sort for rank calculation
    const sorted = [...studentMap.entries()].sort(
      (a, b) => b[1].obtained - a[1].obtained,
    );

    const ops = sorted.map(([studentId, data], index) => {
      const pct = data.total > 0 ? (data.obtained / data.total) * 100 : 0;
      const grade = GRADE_SCALE.find((g) => pct >= g.min)?.grade ?? 'F';
      return this.prisma.reportCard.upsert({
        where: { studentId_examId: { studentId, examId } },
        create: {
          studentId,
          examId,
          totalMarks: data.total,
          obtainedMarks: data.obtained,
          percentage: Math.round(pct * 100) / 100,
          grade,
          rank: index + 1,
        },
        update: {
          totalMarks: data.total,
          obtainedMarks: data.obtained,
          percentage: Math.round(pct * 100) / 100,
          grade,
          rank: index + 1,
        },
      });
    });

    await this.prisma.$transaction(ops);
    return { generated: ops.length };
  }

  // ─── Get Class Results ────────────────────────────────────────────────────
  async getClassResults(examId: string, schoolId: string) {
    const validSchoolId = requireSchoolId(schoolId);
    const exam = await this.prisma.exam.findFirst({
      where: { id: examId, schoolId: validSchoolId },
    });
    if (!exam) throw new NotFoundException('Exam not found');

    const reportCards = await this.prisma.reportCard.findMany({
      where: { examId },
      include: {
        student: {
          include: {
            user: {
              select: { firstName: true, lastName: true, avatarUrl: true },
            },
            enrollments: {
              where: {
                academicYearId: exam.academicYearId,
                status: 'ACTIVE',
              },
              include: {
                section: {
                  select: { name: true, class: { select: { name: true } } },
                },
              },
              take: 1,
            },
          },
        },
      },
      orderBy: { rank: 'asc' },
    });

    return reportCards;
  }

  private async validateStudentAccess(
    student: { id: string; userId: string },
    requestingUser?: { id: string; role: string },
  ) {
    if (!requestingUser) return;
    const { id: userId, role } = requestingUser;

    if (
      ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER'].includes(role)
    ) {
      return;
    }

    if (role === 'STUDENT') {
      if (student.userId !== userId) {
        throw new ForbiddenException(
          'You can only view your own academic records',
        );
      }
      return;
    }

    if (role === 'PARENT') {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true },
      });
      const guardian = await this.prisma.guardian.findFirst({
        where: {
          studentId: student.id,
          OR: [{ userId }, ...(user?.email ? [{ email: user.email }] : [])],
        },
      });
      if (!guardian) {
        throw new ForbiddenException(
          "You are not authorized to view this student's academic records",
        );
      }
      return;
    }

    throw new ForbiddenException('Access denied');
  }

  // ─── Get Student Report Card ──────────────────────────────────────────────
  async getStudentReportCard(
    examId: string,
    studentId: string,
    schoolId: string,
    requestingUser?: { id: string; role: string },
  ) {
    const validSchoolId = requireSchoolId(schoolId);
    const exam = await this.prisma.exam.findFirst({
      where: { id: examId, schoolId: validSchoolId },
    });
    if (!exam) throw new NotFoundException('Exam not found');

    const student = await this.prisma.student.findFirst({
      where: { id: studentId, schoolId: validSchoolId },
    });
    if (!student) throw new NotFoundException('Student not found');

    await this.validateStudentAccess(student, requestingUser);

    const [reportCard, subjectMarks, studentEnrollments] = await Promise.all([
      this.prisma.reportCard.findUnique({
        where: { studentId_examId: { studentId, examId } },
        include: {
          student: {
            include: {
              user: {
                select: { firstName: true, lastName: true, avatarUrl: true },
              },
              enrollments: {
                where: {
                  academicYearId: exam.academicYearId,
                  status: 'ACTIVE',
                },
                include: {
                  section: {
                    select: { name: true, class: { select: { name: true } } },
                  },
                },
                take: 1,
              },
            },
          },
          exam: {
            select: {
              name: true,
              examType: true,
              startDate: true,
              endDate: true,
            },
          },
        },
      }),
      this.prisma.studentMark.findMany({
        where: {
          studentId,
          examSubject: { examId },
        },
        include: {
          examSubject: {
            include: {
              subject: { select: { name: true, code: true } },
              schoolSubjectOffering: {
                include: {
                  globalSubject: true,
                  curriculumSubject: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.studentSubjectEnrollment.findMany({
        where: {
          studentId,
          academicYearId: exam.academicYearId,
          status: 'ACTIVE',
        },
        include: {
          schoolSubjectOffering: {
            include: {
              globalSubject: true,
              curriculumSubject: {
                include: { subjectGroup: true },
              },
            },
          },
        },
      }),
    ]);

    const curriculumEnrollments = studentEnrollments.map((se) => ({
      offeringId: se.schoolSubjectOfferingId,
      subjectName:
        se.schoolSubjectOffering.curriculumSubject?.displayName ||
        se.schoolSubjectOffering.customName ||
        se.schoolSubjectOffering.globalSubject.name,
      subjectCode:
        se.schoolSubjectOffering.curriculumSubject?.subjectCode ||
        se.schoolSubjectOffering.customCode ||
        se.schoolSubjectOffering.globalSubject.code,
      groupName:
        se.schoolSubjectOffering.curriculumSubject?.subjectGroup?.name ||
        'General Academic',
      selectionType: se.schoolSubjectOffering.selectionType,
      periodsPerWeek: se.schoolSubjectOffering.periodsPerWeek,
      theoryEnabled: se.schoolSubjectOffering.theoryEnabled,
      practicalEnabled: se.schoolSubjectOffering.practicalEnabled,
      internalAssessmentEnabled:
        se.schoolSubjectOffering.internalAssessmentEnabled,
    }));

    return { reportCard, subjectMarks, curriculumEnrollments };
  }

  // ─── Publish Results ──────────────────────────────────────────────────────
  async publishResults(examId: string, schoolId: string) {
    const validSchoolId = requireSchoolId(schoolId);
    const exam = await this.prisma.exam.findFirst({
      where: { id: examId, schoolId: validSchoolId },
    });
    if (!exam) throw new NotFoundException('Exam not found');

    await Promise.all([
      this.prisma.exam.update({
        where: { id: exam.id },
        data: { isPublished: true, publishedAt: new Date() },
      }),
      this.prisma.reportCard.updateMany({
        where: { examId: exam.id },
        data: { isPublished: true, publishedAt: new Date() },
      }),
    ]);

    return { published: true };
  }

  // ─── Get Subjects for a school ────────────────────────────────────────────
  async getSubjects(schoolId: string) {
    const validSchoolId = requireSchoolId(schoolId);
    return this.prisma.subject.findMany({
      where: { schoolId: validSchoolId, isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  // ─── Get Student Results (all exams) ─────────────────────────────────────
  async getStudentResults(
    studentId: string,
    schoolId: string,
    requestingUser?: { id: string; role: string },
  ) {
    const validSchoolId = requireSchoolId(schoolId);
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, schoolId: validSchoolId },
    });
    if (!student) throw new NotFoundException('Student not found');

    await this.validateStudentAccess(student, requestingUser);

    const reportCards = await this.prisma.reportCard.findMany({
      where: {
        studentId,
        isPublished: true,
        exam: { schoolId: validSchoolId },
      },
      include: {
        exam: {
          select: {
            id: true,
            name: true,
            examType: true,
            startDate: true,
            academicYear: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const marks = await this.prisma.studentMark.findMany({
      where: {
        studentId,
        examSubject: { exam: { schoolId: validSchoolId } },
      },
      include: {
        examSubject: {
          include: {
            subject: { select: { name: true } },
            schoolSubjectOffering: {
              include: {
                globalSubject: true,
                curriculumSubject: true,
              },
            },
            exam: {
              select: { id: true, name: true, examType: true, startDate: true },
            },
          },
        },
      },
    });

    // Group marks by examId
    const marksByExam = new Map<string, any[]>();
    for (const m of marks) {
      const eId = m.examSubject.exam.id;
      if (!marksByExam.has(eId)) marksByExam.set(eId, []);
      const offering = m.examSubject.schoolSubjectOffering;
      const resolvedName =
        offering?.curriculumSubject?.displayName ||
        offering?.customName ||
        offering?.globalSubject?.name ||
        m.examSubject.subject?.name ||
        'Subject';

      marksByExam.get(eId)!.push({
        subjectId:
          m.examSubject.schoolSubjectOfferingId || m.examSubject.subjectId,
        subjectName: resolvedName,
        marksObtained: m.marksObtained ? Number(m.marksObtained) : 0,
        maxMarks: Number(m.examSubject.maxMarks || 100),
        passMarks: Number(m.examSubject.passMarks || 35),
        grade: m.grade,
        isAbsent: m.isAbsent,
        remarks: m.remarks,
      });
    }

    return reportCards.map((rc) => ({
      id: rc.id,
      examId: rc.examId,
      name: rc.exam.name,
      examName: rc.exam.name,
      examType: rc.exam.examType,
      startDate: rc.exam.startDate,
      totalMarks: Number(rc.totalMarks),
      obtainedMarks: Number(rc.obtainedMarks),
      percentage: Number(rc.percentage),
      grade: rc.grade,
      rank: rc.rank,
      isPublished: rc.isPublished,
      marks: marksByExam.get(rc.examId) || [],
      subjects: marksByExam.get(rc.examId) || [],
    }));
  }

  /**
   * Authoritative domain operation: publishes exam results and dispatches result notifications to students.
   */
  async publishAndNotifyExamResults(data: {
    schoolId: string;
    examId: string;
    senderId: string;
    customMessage?: string;
  }): Promise<{
    examId: string;
    examName: string;
    published: boolean;
    notifiedCount: number;
  }> {
    const validSchoolId = requireSchoolId(data.schoolId);
    const exam = await this.prisma.exam.findFirst({
      where: { id: data.examId, schoolId: validSchoolId },
    });
    if (!exam) {
      throw new NotFoundException('Exam not found in this school');
    }

    // Publish exam and report cards
    await this.publishResults(exam.id, validSchoolId);

    // Notify active students
    const students = await this.prisma.student.findMany({
      where: { schoolId: validSchoolId, isActive: true },
      include: { user: { select: { id: true } } },
      take: 500,
    });

    const messages = students.map((s) => ({
      schoolId: validSchoolId,
      senderId: data.senderId,
      recipientId: s.user.id,
      subject: `Results Ready: ${exam.name}`,
      body: data.customMessage ?? `Results for ${exam.name} are now available.`,
    }));

    let notifiedCount = 0;
    if (messages.length > 0) {
      await this.prisma.message.createMany({ data: messages });
      notifiedCount = messages.length;
    }

    return {
      examId: exam.id,
      examName: exam.name,
      published: true,
      notifiedCount,
    };
  }

  /**
   * Domain query: inspects publication status of an exam.
   */
  async getExamPublishStatus(schoolId: string, examId: string) {
    const validSchoolId = requireSchoolId(schoolId);
    return this.prisma.exam.findFirst({
      where: { id: examId, schoolId: validSchoolId },
      select: {
        id: true,
        name: true,
        isPublished: true,
        publishedAt: true,
        schoolId: true,
      },
    });
  }
}
