import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { requireSchoolId } from '../../core/tenant/tenant.util';
import {
  CreateStudentEnrollmentDto,
  UpdateEnrollmentStatusDto,
} from './dto/student-enrollment.dto';
import { EnrollmentStatus } from '@prisma/client';

@Injectable()
export class StudentEnrollmentService {
  constructor(private prisma: PrismaService) {}

  /**
   * Lists homeroom student enrollments for a school.
   */
  async listEnrollments(
    schoolId: string,
    filter: {
      classId?: string;
      sectionId?: string;
      academicYearId?: string;
      studentId?: string;
      status?: EnrollmentStatus;
    },
  ) {
    const validSchoolId = requireSchoolId(schoolId, 'List student enrollments');
    const where: any = {
      section: { class: { schoolId: validSchoolId } },
    };

    if (filter.studentId) where.studentId = filter.studentId;
    if (filter.sectionId) where.sectionId = filter.sectionId;
    if (filter.academicYearId) where.academicYearId = filter.academicYearId;
    if (filter.status) where.status = filter.status;
    if (filter.classId)
      where.section = { ...where.section, classId: filter.classId };

    return this.prisma.studentEnrollment.findMany({
      where,
      include: {
        student: {
          select: {
            id: true,
            admissionNumber: true,
            isActive: true,
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
        section: {
          select: {
            id: true,
            name: true,
            class: { select: { id: true, name: true, numericLevel: true } },
          },
        },
        academicYear: { select: { id: true, name: true, isActive: true } },
      },
      orderBy: [
        { section: { class: { numericLevel: 'asc' } } },
        { rollNumber: 'asc' },
      ],
    });
  }

  /**
   * Retrieves a single homeroom student enrollment.
   */
  async getEnrollmentById(schoolId: string, id: string) {
    const validSchoolId = requireSchoolId(schoolId, 'Get student enrollment');
    const enrollment = await this.prisma.studentEnrollment.findFirst({
      where: {
        id,
        section: { class: { schoolId: validSchoolId } },
      },
      include: {
        student: {
          select: {
            id: true,
            admissionNumber: true,
            isActive: true,
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
        section: {
          select: {
            id: true,
            name: true,
            class: { select: { id: true, name: true, numericLevel: true } },
          },
        },
        academicYear: { select: { id: true, name: true, isActive: true } },
      },
    });

    if (!enrollment) {
      throw new NotFoundException('Student enrollment not found');
    }

    return enrollment;
  }

  /**
   * Enrolls a student into a class section for an academic year.
   * Enforces single active enrollment per student per academic session.
   */
  async createEnrollment(schoolId: string, data: CreateStudentEnrollmentDto) {
    const validSchoolId = requireSchoolId(
      schoolId,
      'Create student enrollment',
    );

    // 1. Verify student exists and belongs to this school
    const student = await this.prisma.student.findFirst({
      where: { id: data.studentId, schoolId: validSchoolId },
      include: {
        user: { select: { firstName: true, lastName: true } },
      },
    });
    if (!student) {
      throw new NotFoundException('Student not found in this school');
    }

    // 2. Verify section exists and belongs to this school
    const section = await this.prisma.section.findFirst({
      where: { id: data.sectionId, class: { schoolId: validSchoolId } },
      include: { class: { include: { academicYear: true } } },
    });
    if (!section) {
      throw new NotFoundException('Section not found in this school');
    }

    if (student.schoolId !== section.class.schoolId) {
      throw new BadRequestException(
        'Cross-school student enrollments are not permitted',
      );
    }

    // 3. Resolve and verify academic year
    if (
      data.academicYearId &&
      data.academicYearId !== section.class.academicYearId
    ) {
      throw new BadRequestException(
        'Specified academic year does not match section class academic year',
      );
    }
    const resolvedYearId = section.class.academicYearId;
    const academicYear = await this.prisma.academicYear.findFirst({
      where: { id: resolvedYearId, schoolId: validSchoolId },
    });
    if (!academicYear) {
      throw new NotFoundException('Academic year not found for this school');
    }

    if (academicYear.isLocked) {
      throw new BadRequestException(
        `Academic session '${academicYear.name}' is locked. Structural changes are not permitted.`,
      );
    }

    // 4. Enforce single active enrollment per student per academic year
    const activeEnrollment = await this.prisma.studentEnrollment.findFirst({
      where: {
        studentId: data.studentId,
        academicYearId: resolvedYearId,
        status: EnrollmentStatus.ACTIVE,
      },
      include: { section: { include: { class: true } } },
    });

    if (activeEnrollment) {
      const studentName = student.user
        ? `${student.user.firstName} ${student.user.lastName}`.trim()
        : student.admissionNumber;
      throw new ConflictException(
        `Student '${studentName}' already has an active enrollment in ${activeEnrollment.section.class.name} (${activeEnrollment.section.name}) for this session`,
      );
    }

    return this.prisma.studentEnrollment.create({
      data: {
        studentId: data.studentId,
        sectionId: data.sectionId,
        academicYearId: resolvedYearId,
        rollNumber: data.rollNumber?.trim(),
        status: EnrollmentStatus.ACTIVE,
      },
      include: {
        student: {
          select: {
            id: true,
            admissionNumber: true,
            user: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        section: {
          select: {
            id: true,
            name: true,
            class: { select: { id: true, name: true } },
          },
        },
        academicYear: { select: { id: true, name: true } },
      },
    });
  }

  /**
   * Updates an enrollment's status (e.g. TRANSFERRED, DROPPED, GRADUATED).
   */
  async updateEnrollmentStatus(
    schoolId: string,
    id: string,
    data: UpdateEnrollmentStatusDto,
  ) {
    const validSchoolId = requireSchoolId(
      schoolId,
      'Update student enrollment',
    );
    const existing = await this.prisma.studentEnrollment.findFirst({
      where: {
        id,
        section: { class: { schoolId: validSchoolId } },
      },
      include: { academicYear: true },
    });

    if (!existing) {
      throw new NotFoundException('Student enrollment not found');
    }

    if (existing.academicYear?.isLocked) {
      throw new BadRequestException(
        `Academic session '${existing.academicYear.name}' is locked. Structural changes are not permitted.`,
      );
    }

    return this.prisma.studentEnrollment.update({
      where: { id },
      data: {
        status: data.status,
        rollNumber:
          data.rollNumber !== undefined
            ? data.rollNumber?.trim()
            : existing.rollNumber,
        leftAt: data.leftAt ? new Date(data.leftAt) : existing.leftAt,
      },
    });
  }

  /**
   * Deletes a student enrollment.
   */
  async deleteEnrollment(schoolId: string, id: string) {
    const validSchoolId = requireSchoolId(
      schoolId,
      'Delete student enrollment',
    );
    const existing = await this.prisma.studentEnrollment.findFirst({
      where: {
        id,
        section: { class: { schoolId: validSchoolId } },
      },
      include: { academicYear: true },
    });

    if (!existing) {
      throw new NotFoundException('Student enrollment not found');
    }

    if (existing.academicYear?.isLocked) {
      throw new BadRequestException(
        `Academic session '${existing.academicYear.name}' is locked. Structural changes are not permitted.`,
      );
    }

    await this.prisma.studentEnrollment.delete({ where: { id } });
    return { success: true, message: 'Student enrollment removed' };
  }
}
