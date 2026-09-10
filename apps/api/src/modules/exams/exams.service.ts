import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { requireSchoolId } from '../../core/tenant/tenant.util';

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

  private async resolveAcademicYearId(
    schoolId: string,
    providedId?: string,
  ): Promise<string> {
    const validSchoolId = requireSchoolId(schoolId);
    if (providedId) {
      const year = await this.prisma.academicYear.findFirst({
        where: { id: providedId, schoolId: validSchoolId },
      });
      if (!year) throw new NotFoundException('Academic year not found');
      return year.id;
    }
    const activeYear = await this.prisma.academicYear.findFirst({
      where: { schoolId: validSchoolId, isActive: true },
    });
    if (!activeYear)
      throw new BadRequestException('No active academic year found');
    return activeYear.id;
  }

  // ─── Create Exam ──────────────────────────────────────────────────────────
  async createExam(
    schoolId: string,
    data: {
      academicYearId: string;
      name: string;
      examType: string;
      startDate: string;
      endDate: string;
    },
  ) {
    const validSchoolId = requireSchoolId(schoolId);
    const resolvedAcademicYearId = await this.resolveAcademicYearId(
      validSchoolId,
      data.academicYearId,
    );
    return this.prisma.exam.create({
      data: {
        schoolId: validSchoolId,
        academicYearId: resolvedAcademicYearId,
        name: data.name,
        examType: data.examType,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
      },
      include: { subjects: true },
    });
  }

  // ─── Update Exam ──────────────────────────────────────────────────────────
  async updateExam(
    schoolId: string,
    examId: string,
    data: { name?: string; examType?: string; startDate?: string; endDate?: string },
  ) {
    const validSchoolId = requireSchoolId(schoolId);
    const exam = await this.prisma.exam.findFirst({ where: { id: examId, schoolId: validSchoolId } });
    if (!exam) throw new NotFoundException('Exam not found');
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
      include: { _count: { select: { reportCards: true } } },
    });
    if (!exam) throw new NotFoundException('Exam not found');
    if ((exam._count as any).reportCards > 0) {
      throw new BadRequestException('Cannot delete an exam that has report cards. Unpublish first.');
    }
    // Delete subjects first, then exam
    await this.prisma.examSubject.deleteMany({ where: { examId: exam.id } });
    await this.prisma.exam.delete({ where: { id: exam.id } });
    return { message: 'Exam deleted successfully' };
  }

  // ─── List Exams ───────────────────────────────────────────────────────────
  async listExams(schoolId: string, academicYearId?: string) {
    const validSchoolId = requireSchoolId(schoolId);
    const resolvedAcademicYearId = await this.resolveAcademicYearId(
      validSchoolId,
      academicYearId,
    );
    return this.prisma.exam.findMany({
      where: { schoolId: validSchoolId, academicYearId: resolvedAcademicYearId },
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
        academicYear: { select: { name: true } },
        subjects: {
          include: {
            subject: { select: { id: true, name: true, code: true } },
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
    data: {
      subjectId: string;
      classId: string;
      maxMarks: number;
      passMarks: number;
      examDate?: string;
      duration?: number;
    },
  ) {
    const validSchoolId = requireSchoolId(schoolId);
    const exam = await this.prisma.exam.findFirst({
      where: { id: examId, schoolId: validSchoolId },
    });
    if (!exam) throw new NotFoundException('Exam not found');

    // Validate subject belongs to school
    const subject = await this.prisma.subject.findFirst({
      where: { id: data.subjectId, schoolId: validSchoolId },
    });
    if (!subject) throw new NotFoundException('Subject not found');

    // Validate class belongs to school
    const cls = await this.prisma.class.findFirst({
      where: { id: data.classId, schoolId: validSchoolId },
    });
    if (!cls) throw new NotFoundException('Class not found');

    return this.prisma.examSubject.create({
      data: {
        examId: exam.id,
        subjectId: data.subjectId,
        classId: data.classId,
        maxMarks: data.maxMarks,
        passMarks: data.passMarks,
        examDate: data.examDate ? new Date(data.examDate) : undefined,
        duration: data.duration,
      },
      include: { subject: { select: { name: true, code: true } } },
    });
  }

  // ─── Enter / Update Marks ─────────────────────────────────────────────────
  async enterMarks(
    examSubjectId: string,
    schoolId: string,
    marks: {
      studentId: string;
      marksObtained?: number;
      isAbsent?: boolean;
      remarks?: string;
    }[],
    enteredById: string,
  ) {
    const validSchoolId = requireSchoolId(schoolId);
    const examSubject = await this.prisma.examSubject.findFirst({
      where: { id: examSubjectId, exam: { schoolId: validSchoolId } },
      include: { exam: true },
    });
    if (!examSubject) {
      throw new NotFoundException('Exam subject not found');
    }

    // Validate that all students belong to the school
    if (marks.length > 0) {
      const studentIds = marks.map((m) => m.studentId);
      const students = await this.prisma.student.findMany({
        where: { id: { in: studentIds }, schoolId: validSchoolId },
        select: { id: true },
      });
      if (students.length !== studentIds.length) {
        throw new BadRequestException('One or more students do not belong to this school');
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
          enteredById,
        },
        update: {
          marksObtained: m.isAbsent ? null : m.marksObtained,
          isAbsent: m.isAbsent ?? false,
          grade,
          remarks: m.remarks,
          enteredById,
        },
      });
    });

    return this.prisma.$transaction(ops);
  }

  // ─── Get Marks for an Exam Subject ───────────────────────────────────────
  async getMarksForSubject(examSubjectId: string, schoolId: string) {
    const validSchoolId = requireSchoolId(schoolId);
    const es = await this.prisma.examSubject.findFirst({
      where: { id: examSubjectId, exam: { schoolId: validSchoolId } },
      include: { exam: true, subject: { select: { name: true } } },
    });
    if (!es)
      throw new NotFoundException('Exam subject not found');

    const marks = await this.prisma.studentMark.findMany({
      where: { examSubjectId },
      include: {
        student: {
          include: {
            user: { select: { firstName: true, lastName: true } },
            enrollments: {
              where: { status: 'ACTIVE' },
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
    examSubjectId: string,
    sectionId: string,
    schoolId: string,
  ) {
    const validSchoolId = requireSchoolId(schoolId);
    const examSubject = await this.prisma.examSubject.findFirst({
      where: { id: examSubjectId, exam: { schoolId: validSchoolId } },
      include: { exam: true, subject: { select: { name: true } }, marks: true },
    });
    if (!examSubject) {
      throw new NotFoundException('Exam subject not found');
    }

    // Validate section belongs to school
    const section = await this.prisma.section.findFirst({
      where: { id: sectionId, class: { schoolId: validSchoolId } },
    });
    if (!section) {
      throw new NotFoundException('Section not found');
    }

    const enrollments = await this.prisma.studentEnrollment.findMany({
      where: { sectionId, status: 'ACTIVE' },
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
        subjects: {
          include: {
            marks: { include: { student: true } },
          },
        },
      },
    });
    if (!exam) throw new NotFoundException('Exam not found');

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
              where: { status: 'ACTIVE' },
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

  // ─── Get Student Report Card ──────────────────────────────────────────────
  async getStudentReportCard(
    examId: string,
    studentId: string,
    schoolId: string,
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
                where: { status: 'ACTIVE' },
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
            include: { subject: { select: { name: true, code: true } } },
          },
        },
      }),
      this.prisma.studentSubjectEnrollment.findMany({
        where: { studentId, status: 'ACTIVE' },
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
  async getStudentResults(studentId: string, schoolId: string) {
    const validSchoolId = requireSchoolId(schoolId);
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, schoolId: validSchoolId },
    });
    if (!student) throw new NotFoundException('Student not found');

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
            exam: { select: { id: true, name: true, examType: true, startDate: true } },
          },
        },
      },
    });

    // Group marks by examId
    const marksByExam = new Map<string, any[]>();
    for (const m of marks) {
      const eId = m.examSubject.exam.id;
      if (!marksByExam.has(eId)) marksByExam.set(eId, []);
      marksByExam.get(eId)!.push({
        subjectId: m.examSubject.subjectId,
        subjectName: m.examSubject.subject.name,
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
}
