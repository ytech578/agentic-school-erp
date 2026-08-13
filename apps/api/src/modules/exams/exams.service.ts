import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';

const GRADE_SCALE = [
  { min: 90, grade: 'A+' },
  { min: 75, grade: 'A' },
  { min: 60, grade: 'B' },
  { min: 50, grade: 'C' },
  { min: 35, grade: 'D' },
  { min: 0,  grade: 'F' },
];

function calculateGrade(obtained: number, max: number): string {
  const pct = max > 0 ? (obtained / max) * 100 : 0;
  return GRADE_SCALE.find(g => pct >= g.min)?.grade ?? 'F';
}

@Injectable()
export class ExamsService {
  constructor(private prisma: PrismaService) {}

  private async resolveAcademicYearId(schoolId: string, providedId?: string): Promise<string> {
    if (providedId && !providedId.startsWith('AY')) return providedId;
    const activeYear = await this.prisma.academicYear.findFirst({ where: { schoolId, isActive: true } });
    if (!activeYear) throw new BadRequestException('No active academic year found');
    return activeYear.id;
  }

  // ─── Create Exam ──────────────────────────────────────────────────────────
  async createExam(schoolId: string, data: {
    academicYearId: string;
    name: string;
    examType: string;
    startDate: string;
    endDate: string;
  }) {
    const resolvedAcademicYearId = await this.resolveAcademicYearId(schoolId, data.academicYearId);
    return this.prisma.exam.create({
      data: {
        schoolId,
        academicYearId: resolvedAcademicYearId,
        name: data.name,
        examType: data.examType,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
      },
      include: { subjects: true },
    });
  }

  // ─── List Exams ───────────────────────────────────────────────────────────
  async listExams(schoolId: string, academicYearId?: string) {
    const resolvedAcademicYearId = await this.resolveAcademicYearId(schoolId, academicYearId);
    return this.prisma.exam.findMany({
      where: { schoolId, academicYearId: resolvedAcademicYearId },
      include: {
        _count: { select: { subjects: true, reportCards: true } },
        academicYear: { select: { name: true } },
      },
      orderBy: { startDate: 'desc' },
    });
  }

  // ─── Get Single Exam ──────────────────────────────────────────────────────
  async getExam(schoolId: string, examId: string) {
    const exam = await this.prisma.exam.findFirst({
      where: { id: examId, schoolId },
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
  async addExamSubject(examId: string, schoolId: string, data: {
    subjectId: string;
    classId: string;
    maxMarks: number;
    passMarks: number;
    examDate?: string;
    duration?: number;
  }) {
    const exam = await this.prisma.exam.findFirst({ where: { id: examId, schoolId } });
    if (!exam) throw new NotFoundException('Exam not found');
    return this.prisma.examSubject.create({
      data: {
        examId,
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
    marks: { studentId: string; marksObtained?: number; isAbsent?: boolean; remarks?: string }[],
    enteredById: string,
  ) {
    const examSubject = await this.prisma.examSubject.findUnique({
      where: { id: examSubjectId },
      include: { exam: true },
    });
    if (!examSubject || examSubject.exam.schoolId !== schoolId) {
      throw new NotFoundException('Exam subject not found');
    }

    const ops = marks.map(m => {
      const grade = (!m.isAbsent && m.marksObtained !== undefined)
        ? calculateGrade(m.marksObtained, Number(examSubject.maxMarks))
        : undefined;

      return this.prisma.studentMark.upsert({
        where: { studentId_examSubjectId: { studentId: m.studentId, examSubjectId } },
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
    const es = await this.prisma.examSubject.findUnique({
      where: { id: examSubjectId },
      include: { exam: true, subject: { select: { name: true } } },
    });
    if (!es || es.exam.schoolId !== schoolId) throw new NotFoundException('Exam subject not found');

    const marks = await this.prisma.studentMark.findMany({
      where: { examSubjectId },
      include: {
        student: {
          include: {
            user: { select: { firstName: true, lastName: true } },
            enrollments: { where: { status: 'ACTIVE' }, include: { section: { select: { name: true, class: { select: { name: true } } } } }, take: 1 },
          },
        },
      },
      orderBy: { marksObtained: 'desc' },
    });
    return { examSubject: es, marks };
  }

  // ─── Get Students for Marks Entry (by section) ────────────────────────────
  async getStudentsForMarksEntry(examSubjectId: string, sectionId: string, schoolId: string) {
    const examSubject = await this.prisma.examSubject.findUnique({
      where: { id: examSubjectId },
      include: { exam: true, subject: { select: { name: true } }, marks: true },
    });
    if (!examSubject || examSubject.exam.schoolId !== schoolId) {
      throw new NotFoundException('Exam subject not found');
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
      students: enrollments.map(e => {
        const mark = examSubject.marks.find(m => m.studentId === e.studentId);
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
    const exam = await this.prisma.exam.findFirst({
      where: { id: examId, schoolId },
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
    const sorted = [...studentMap.entries()]
      .sort((a, b) => b[1].obtained - a[1].obtained);

    const ops = sorted.map(([studentId, data], index) => {
      const pct = data.total > 0 ? (data.obtained / data.total) * 100 : 0;
      const grade = GRADE_SCALE.find(g => pct >= g.min)?.grade ?? 'F';
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
    const exam = await this.prisma.exam.findFirst({ where: { id: examId, schoolId } });
    if (!exam) throw new NotFoundException('Exam not found');

    const reportCards = await this.prisma.reportCard.findMany({
      where: { examId },
      include: {
        student: {
          include: {
            user: { select: { firstName: true, lastName: true, avatarUrl: true } },
            enrollments: {
              where: { status: 'ACTIVE' },
              include: { section: { select: { name: true, class: { select: { name: true } } } } },
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
  async getStudentReportCard(examId: string, studentId: string, schoolId: string) {
    const exam = await this.prisma.exam.findFirst({ where: { id: examId, schoolId } });
    if (!exam) throw new NotFoundException('Exam not found');

    const [reportCard, subjectMarks] = await Promise.all([
      this.prisma.reportCard.findUnique({
        where: { studentId_examId: { studentId, examId } },
        include: {
          student: {
            include: {
              user: { select: { firstName: true, lastName: true, avatarUrl: true } },
              enrollments: {
                where: { status: 'ACTIVE' },
                include: { section: { select: { name: true, class: { select: { name: true } } } } },
                take: 1,
              },
            },
          },
          exam: { select: { name: true, examType: true, startDate: true, endDate: true } },
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
    ]);

    return { reportCard, subjectMarks };
  }

  // ─── Publish Results ──────────────────────────────────────────────────────
  async publishResults(examId: string, schoolId: string) {
    const exam = await this.prisma.exam.findFirst({ where: { id: examId, schoolId } });
    if (!exam) throw new NotFoundException('Exam not found');

    await Promise.all([
      this.prisma.exam.update({
        where: { id: examId },
        data: { isPublished: true, publishedAt: new Date() },
      }),
      this.prisma.reportCard.updateMany({
        where: { examId },
        data: { isPublished: true, publishedAt: new Date() },
      }),
    ]);

    return { published: true };
  }

  // ─── Get Subjects for a school ────────────────────────────────────────────
  async getSubjects(schoolId: string) {
    return this.prisma.subject.findMany({
      where: { schoolId, isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  // ─── Get Student Results (all exams) ─────────────────────────────────────
  async getStudentResults(studentId: string, schoolId: string) {
    return this.prisma.reportCard.findMany({
      where: { studentId, isPublished: true },
      include: {
        exam: { select: { name: true, examType: true, startDate: true, academicYear: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
