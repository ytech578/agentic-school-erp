import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';

@Injectable()
export class AssignmentsService {
  constructor(private prisma: PrismaService) {}

  async resolveAcademicYearId(schoolId: string, providedYearId?: string) {
    if (providedYearId) return providedYearId;
    const active = await this.prisma.academicYear.findFirst({
      where: { schoolId, isActive: true },
    });
    return active?.id || '';
  }

  async createAssignment(schoolId: string, data: any, staffId: string) {
    const academicYearId = await this.resolveAcademicYearId(schoolId, data.academicYearId);
    
    // Resolve actual staff id to avoid foreign key errors when staffId is a user id
    let resolvedStaffId = data.staffId;
    if (!resolvedStaffId) {
      const staff = await this.prisma.staff.findFirst({
        where: { OR: [{ id: staffId }, { userId: staffId }] },
      });
      if (staff) {
        resolvedStaffId = staff.id;
      } else {
        const fallbackStaff = await this.prisma.staff.findFirst({
          where: { schoolId },
        });
        resolvedStaffId = fallbackStaff?.id;
      }
    }

    return this.prisma.assignment.create({
      data: {
        schoolId,
        academicYearId,
        classId: data.classId,
        sectionId: data.sectionId || null,
        subjectId: data.subjectId,
        staffId: resolvedStaffId,
        title: data.title,
        description: data.description || null,
        dueDate: new Date(data.dueDate),
        maxMarks: data.maxMarks ? parseInt(data.maxMarks.toString(), 10) : 10,
      },
      include: {
        subject: { select: { id: true, name: true, code: true } },
        class: { select: { id: true, name: true } },
        section: { select: { id: true, name: true } },
      },
    });
  }

  async listAssignments(schoolId: string, classId?: string, sectionId?: string) {
    const where: any = { schoolId };
    if (classId) where.classId = classId;
    if (sectionId) where.sectionId = sectionId;
    
    return this.prisma.assignment.findMany({
      where,
      include: {
        subject: { select: { id: true, name: true, code: true } },
        class: { select: { id: true, name: true } },
        section: { select: { id: true, name: true } },
        _count: { select: { submissions: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async deleteAssignment(schoolId: string, id: string) {
    const assignment = await this.prisma.assignment.findFirst({
      where: { id, schoolId },
    });
    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }
    return this.prisma.assignment.delete({ where: { id } });
  }

  async submitAssignment(assignmentId: string, studentId: string, data: any) {
    return this.prisma.assignmentSubmission.upsert({
      where: { assignmentId_studentId: { assignmentId, studentId } },
      create: {
        assignmentId,
        studentId,
        status: data.status || 'SUBMITTED',
        marksObtained: data.marksObtained !== undefined && data.marksObtained !== null ? data.marksObtained : undefined,
        feedback: data.feedback,
        submittedAt: new Date(),
      },
      update: {
        status: data.status,
        marksObtained: data.marksObtained !== undefined && data.marksObtained !== null ? data.marksObtained : undefined,
        feedback: data.feedback,
      },
    });
  }

  async getSubmissions(assignmentId: string) {
    const assignment = await this.prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: {
        class: true,
        section: true,
        subject: true,
      },
    });
    if (!assignment) throw new NotFoundException('Assignment not found');

    const submissions = await this.prisma.assignmentSubmission.findMany({
      where: { assignmentId },
      include: {
        student: {
          include: {
            user: { select: { firstName: true, lastName: true, email: true } },
            enrollments: { select: { rollNumber: true, sectionId: true } },
          },
        },
      },
    });

    // Also fetch students in the class/section to show comprehensive roster
    const enrollments = await this.prisma.studentEnrollment.findMany({
      where: {
        status: 'ACTIVE',
        ...(assignment.sectionId
          ? { sectionId: assignment.sectionId }
          : { classId: assignment.classId }),
      },
      include: {
        student: {
          include: {
            user: { select: { firstName: true, lastName: true, email: true } },
          },
        },
      },
      orderBy: { rollNumber: 'asc' },
    });

    const subMap = new Map(submissions.map((s) => [s.studentId, s]));

    const roster = enrollments.map((e) => {
      const sub = subMap.get(e.studentId);
      return {
        studentId: e.studentId,
        rollNumber: e.rollNumber,
        studentName: `${e.student.user.firstName} ${e.student.user.lastName}`,
        status: sub?.status || 'PENDING',
        marksObtained: sub?.marksObtained !== null && sub?.marksObtained !== undefined ? Number(sub.marksObtained) : null,
        feedback: sub?.feedback || '',
        submittedAt: sub?.submittedAt || null,
      };
    });

    return {
      assignment,
      submissions: roster,
      stats: {
        totalStudents: roster.length,
        submittedCount: roster.filter((r) => r.status === 'SUBMITTED' || r.status === 'GRADED').length,
        gradedCount: roster.filter((r) => r.status === 'GRADED').length,
        pendingCount: roster.filter((r) => r.status === 'PENDING').length,
      },
    };
  }
}

