import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { requireSchoolId } from '../../core/tenant/tenant.util';

@Injectable()
export class AssignmentsService {
  constructor(private prisma: PrismaService) {}

  async resolveAcademicYearId(schoolId: string, providedYearId?: string) {
    const validSchoolId = requireSchoolId(schoolId);
    if (providedYearId) {
      const year = await this.prisma.academicYear.findFirst({
        where: { id: providedYearId, schoolId: validSchoolId },
      });
      if (!year) throw new NotFoundException('Academic year not found');
      return year.id;
    }
    const active = await this.prisma.academicYear.findFirst({
      where: { schoolId: validSchoolId, isActive: true },
    });
    return active?.id || '';
  }

  async createAssignment(schoolId: string, data: any, staffId: string) {
    const validSchoolId = requireSchoolId(schoolId);
    const academicYearId = await this.resolveAcademicYearId(validSchoolId, data.academicYearId);
    
    // Validate class belongs to school
    const cls = await this.prisma.class.findFirst({
      where: { id: data.classId, schoolId: validSchoolId },
    });
    if (!cls) throw new NotFoundException('Class not found');

    // Validate section belongs to class/school if provided
    if (data.sectionId) {
      const sec = await this.prisma.section.findFirst({
        where: { id: data.sectionId, class: { schoolId: validSchoolId } },
      });
      if (!sec) throw new NotFoundException('Section not found');
    }

    // Validate subject belongs to school
    const subj = await this.prisma.subject.findFirst({
      where: { id: data.subjectId, schoolId: validSchoolId },
    });
    if (!subj) throw new NotFoundException('Subject not found');

    // Resolve actual staff id to avoid foreign key errors when staffId is a user id
    let resolvedStaffId = data.staffId;
    if (!resolvedStaffId) {
      const staff = await this.prisma.staff.findFirst({
        where: { schoolId: validSchoolId, OR: [{ id: staffId }, { userId: staffId }] },
      });
      if (staff) {
        resolvedStaffId = staff.id;
      } else {
        const fallbackStaff = await this.prisma.staff.findFirst({
          where: { schoolId: validSchoolId },
        });
        resolvedStaffId = fallbackStaff?.id;
      }
    } else {
      const staff = await this.prisma.staff.findFirst({
        where: { id: resolvedStaffId, schoolId: validSchoolId },
      });
      if (!staff) throw new NotFoundException('Staff not found');
    }

    return this.prisma.assignment.create({
      data: {
        schoolId: validSchoolId,
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
    const validSchoolId = requireSchoolId(schoolId);
    const where: any = { schoolId: validSchoolId };
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
    const validSchoolId = requireSchoolId(schoolId);
    const assignment = await this.prisma.assignment.findFirst({
      where: { id, schoolId: validSchoolId },
    });
    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }
    return this.prisma.assignment.delete({ where: { id: assignment.id } });
  }

  async submitAssignment(schoolId: string, assignmentId: string, studentId: string, data: any) {
    const validSchoolId = requireSchoolId(schoolId);

    const assignment = await this.prisma.assignment.findFirst({
      where: { id: assignmentId, schoolId: validSchoolId },
    });
    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }

    const student = await this.prisma.student.findFirst({
      where: { id: studentId, schoolId: validSchoolId },
    });
    if (!student) {
      throw new NotFoundException('Student not found');
    }

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

  async getSubmissions(schoolId: string, assignmentId: string) {
    const validSchoolId = requireSchoolId(schoolId);
    const assignment = await this.prisma.assignment.findFirst({
      where: { id: assignmentId, schoolId: validSchoolId },
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

