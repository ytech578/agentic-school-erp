import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  private async resolveActiveYear(
    schoolId: string,
    academicYearId?: string,
  ): Promise<string | undefined> {
    if (academicYearId) return academicYearId;
    const ay = await this.prisma.academicYear.findFirst({
      where: { schoolId, isActive: true },
    });
    return ay?.id;
  }

  // ── Attendance Reports ────────────────────────────────────────────────

  async getDailyAttendance(schoolId: string, date?: string) {
    const targetDate = date ? new Date(date) : new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const [records, totalStudents] = await Promise.all([
      this.prisma.attendanceRecord.groupBy({
        by: ['status'],
        where: { schoolId, date: { gte: startOfDay, lte: endOfDay } },
        _count: { status: true },
      }),
      this.prisma.student.count({ where: { schoolId, isActive: true } }),
    ]);

    const summary: Record<string, number> = {
      PRESENT: 0,
      ABSENT: 0,
      LATE: 0,
      EXCUSED: 0,
    };
    records.forEach((r) => {
      summary[r.status] = r._count.status;
    });

    return {
      date: (date ? new Date(date) : new Date()).toISOString().split('T')[0],
      totalStudents,
      ...summary,
      attendanceRate:
        totalStudents > 0
          ? ((summary.PRESENT / totalStudents) * 100).toFixed(1)
          : '0',
    };
  }

  async getAttendanceRegister(
    schoolId: string,
    sectionId: string,
    month: number,
    year: number,
  ) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    // Enrollments for this section
    const enrollments = await this.prisma.studentEnrollment.findMany({
      where: { sectionId, status: 'ACTIVE' },
      include: {
        student: {
          include: { user: { select: { firstName: true, lastName: true } } },
        },
      },
    });

    // Attendance records for this section in the given month
    const records = await this.prisma.attendanceRecord.findMany({
      where: { schoolId, sectionId, date: { gte: startDate, lte: endDate } },
    });

    // Build lookup: studentId → { day → status }
    const recordMap: Record<string, Record<string, string>> = {};
    records.forEach((r) => {
      const day = new Date(r.date).getDate().toString();
      if (!recordMap[r.studentId]) recordMap[r.studentId] = {};
      recordMap[r.studentId][day] = r.status;
    });

    const daysInMonth = new Date(year, month, 0).getDate();
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    const students = enrollments.map((e) => {
      const studentRecords = recordMap[e.studentId] || {};
      let present = 0,
        absent = 0,
        late = 0;
      days.forEach((d) => {
        const s = studentRecords[d.toString()];
        if (s === 'PRESENT') present++;
        else if (s === 'ABSENT') absent++;
        else if (s === 'LATE') late++;
      });
      return {
        studentId: e.studentId,
        name: `${e.student.user.firstName} ${e.student.user.lastName}`,
        rollNumber: e.rollNumber,
        days: studentRecords,
        present,
        absent,
        late,
        percentage:
          daysInMonth > 0 ? ((present / daysInMonth) * 100).toFixed(1) : '0',
      };
    });

    return { sectionId, month, year, days, students };
  }

  async getLowAttendanceStudents(schoolId: string, threshold = 75) {
    // Get all students in school
    const students = await this.prisma.student.findMany({
      where: { schoolId, isActive: true },
      include: {
        user: { select: { firstName: true, lastName: true } },
        enrollments: {
          where: { status: 'ACTIVE' },
          include: {
            section: { include: { class: { select: { name: true } } } },
          },
          take: 1,
        },
      },
    });

    const results: any[] = [];
    for (const s of students) {
      const [present, total] = await Promise.all([
        this.prisma.attendanceRecord.count({
          where: { studentId: s.id, status: 'PRESENT' },
        }),
        this.prisma.attendanceRecord.count({ where: { studentId: s.id } }),
      ]);
      const pct = total > 0 ? (present / total) * 100 : 0;
      if (pct < threshold) {
        results.push({
          studentId: s.id,
          name: `${s.user.firstName} ${s.user.lastName}`,
          rollNumber: s.rollNumber,
          className: s.enrollments[0]?.section?.class?.name || '—',
          presentDays: present,
          totalDays: total,
          percentage: pct.toFixed(1),
        });
      }
    }
    return results.sort(
      (a, b) => parseFloat(a.percentage) - parseFloat(b.percentage),
    );
  }

  // ── Fee Reports ────────────────────────────────────────────────────────

  async getFeeCollectionSummary(schoolId: string, from: string, to: string) {
    const payments = await this.prisma.feePayment.findMany({
      where: {
        schoolId,
        paymentStatus: 'PAID',
        paymentDate: { gte: new Date(from), lte: new Date(to + 'T23:59:59') },
      },
      include: {
        items: {
          include: { feePayment: false },
        },
        student: {
          include: { user: { select: { firstName: true, lastName: true } } },
        },
      },
      orderBy: { paymentDate: 'desc' },
    });

    const totalCollected = payments.reduce(
      (s, p) => s + p.totalAmount.toNumber(),
      0,
    );

    // Group by feeHeadId (we don't have feeHead name without the relation, use headId as key)
    const byPayment = payments.map((p) => ({
      id: p.id,
      studentName: `${p.student.user.firstName} ${p.student.user.lastName}`,
      totalAmount: p.totalAmount,
      paymentDate: p.paymentDate,
      paymentMode: p.paymentMode,
    }));

    return {
      from,
      to,
      totalCollected,
      totalPayments: payments.length,
      payments: byPayment,
    };
  }

  async getFeeOutstanding(schoolId: string) {
    const pending = await this.prisma.feePayment.findMany({
      where: {
        schoolId,
        paymentStatus: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] },
      },
      include: {
        student: {
          include: {
            user: { select: { firstName: true, lastName: true } },
            enrollments: {
              where: { status: 'ACTIVE' },
              include: {
                section: { include: { class: { select: { name: true } } } },
              },
              take: 1,
            },
          },
        },
      },
      orderBy: { paymentDate: 'asc' },
    });

    return pending.map((p) => ({
      paymentId: p.id,
      studentId: p.studentId,
      studentName: `${p.student.user.firstName} ${p.student.user.lastName}`,
      rollNumber: p.student.rollNumber,
      className: p.student.enrollments[0]?.section?.class?.name || '—',
      totalAmount: p.totalAmount,
      paidAmount: p.paidAmount,
      outstanding: p.outstandingAmount,
      paymentDate: p.paymentDate,
      status: p.paymentStatus,
    }));
  }

  // ── Exam Reports ──────────────────────────────────────────────────────

  async getExamReport(schoolId: string, examId: string, classId?: string) {
    const exam = await this.prisma.exam.findFirst({
      where: { id: examId, schoolId },
      include: { academicYear: { select: { name: true } } },
    });
    if (!exam) return null;

    // Get exam subjects (optionally filtered by class)
    const examSubjects = await this.prisma.examSubject.findMany({
      where: {
        examId,
        ...(classId ? { classId } : {}),
      },
      include: { subject: { select: { name: true } } },
    });

    const examSubjectIds = examSubjects.map((es) => es.id);

    // Get all marks for those exam subjects
    const marks = await this.prisma.studentMark.findMany({
      where: { examSubjectId: { in: examSubjectIds } },
      include: {
        student: {
          include: { user: { select: { firstName: true, lastName: true } } },
        },
        examSubject: {
          include: { subject: { select: { name: true } } },
        },
      },
    });

    // Group by student
    const studentMap: Record<string, any> = {};
    marks.forEach((m) => {
      if (!studentMap[m.studentId]) {
        studentMap[m.studentId] = {
          studentId: m.studentId,
          name: `${m.student.user.firstName} ${m.student.user.lastName}`,
          rollNumber: m.student.rollNumber,
          subjects: {},
          total: 0,
          maxTotal: 0,
        };
      }
      const subName = m.examSubject.subject.name;
      const esMaxMarks = m.examSubject.maxMarks.toNumber();
      studentMap[m.studentId].subjects[subName] = {
        marks: m.marksObtained?.toNumber() ?? null,
        maxMarks: esMaxMarks,
        isAbsent: m.isAbsent,
      };
      studentMap[m.studentId].total += m.marksObtained?.toNumber() ?? 0;
      studentMap[m.studentId].maxTotal += esMaxMarks;
    });

    const students = Object.values(studentMap)
      .map((s: any) => ({
        ...s,
        percentage:
          s.maxTotal > 0 ? ((s.total / s.maxTotal) * 100).toFixed(1) : '0',
        grade: this.calcGrade(
          s.maxTotal > 0 ? (s.total / s.maxTotal) * 100 : 0,
        ),
      }))
      .sort((a: any, b: any) => b.total - a.total)
      .map((s: any, i: number) => ({ ...s, rank: i + 1 }));

    const avg =
      students.length > 0
        ? students.reduce(
            (s: number, st: any) => s + parseFloat(st.percentage),
            0,
          ) / students.length
        : 0;
    const passed = students.filter(
      (s: any) => parseFloat(s.percentage) >= 35,
    ).length;

    return {
      exam: {
        id: exam.id,
        name: exam.name,
        type: exam.examType,
        academicYear: exam.academicYear.name,
      },
      classAverage: avg.toFixed(1),
      passCount: passed,
      failCount: students.length - passed,
      passPercentage:
        students.length > 0
          ? ((passed / students.length) * 100).toFixed(1)
          : '0',
      topScore: students[0]?.percentage || '0',
      students,
    };
  }

  async getReportCard(schoolId: string, studentId: string, examId?: string) {
    // Fetch student with user + active enrollment
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, schoolId },
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        enrollments: {
          where: { status: 'ACTIVE' },
          include: {
            section: {
              include: {
                class: { select: { name: true } },
              },
            },
          },
          take: 1,
        },
      },
    });

    if (!student) return null;

    // Find report card(s) for this student
    const reportCards = await this.prisma.reportCard.findMany({
      where: {
        studentId,
        ...(examId ? { examId } : {}),
      },
      include: { exam: { select: { name: true, examType: true } } },
      orderBy: { createdAt: 'desc' },
    });

    // Attendance summary
    const attendanceGroups = await this.prisma.attendanceRecord.groupBy({
      by: ['status'],
      where: { studentId },
      _count: { status: true },
    });
    const attMap: Record<string, number> = {};
    attendanceGroups.forEach((a) => {
      attMap[a.status] = a._count.status;
    });
    const totalDays = Object.values(attMap).reduce((s, n) => s + n, 0);
    const presentDays = attMap['PRESENT'] || 0;

    return {
      student: {
        id: student.id,
        name: `${student.user.firstName} ${student.user.lastName}`,
        email: student.user.email,
        rollNumber: student.rollNumber,
        dob: student.dateOfBirth,
        admissionNumber: student.admissionNumber,
      },
      class: student.enrollments[0]?.section?.class?.name,
      section: student.enrollments[0]?.section?.name,
      reportCards,
      attendance: {
        present: presentDays,
        total: totalDays,
        percentage:
          totalDays > 0 ? ((presentDays / totalDays) * 100).toFixed(1) : '0',
      },
    };
  }

  private calcGrade(pct: number): string {
    if (pct >= 90) return 'A+';
    if (pct >= 80) return 'A';
    if (pct >= 70) return 'B+';
    if (pct >= 60) return 'B';
    if (pct >= 50) return 'C';
    if (pct >= 35) return 'D';
    return 'F';
  }
}
