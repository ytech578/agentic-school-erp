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
    if (student.isActive === false) {
      throw new BadRequestException('Cannot enroll inactive student');
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
      include: {
        academicYear: true,
        student: true,
        section: { include: { class: true } },
      },
    });

    if (!existing) {
      throw new NotFoundException('Student enrollment not found');
    }

    // 1. Academic year exists and belongs to school
    if (
      !existing.academicYear ||
      (existing.academicYear.schoolId &&
        existing.academicYear.schoolId !== validSchoolId)
    ) {
      throw new BadRequestException(
        'Enrollment academic session does not belong to this school',
      );
    }

    // 2. Academic year belongs to the enrollment
    if (existing.academicYearId !== existing.academicYear.id) {
      throw new BadRequestException(
        'Enrollment academic session reference mismatch',
      );
    }

    // 3. Locked year check
    if (existing.academicYear.isLocked) {
      throw new BadRequestException(
        `Academic session '${existing.academicYear.name}' is locked. Structural changes are not permitted.`,
      );
    }

    // 4. Student belongs to school
    if (
      !existing.student ||
      (existing.student.schoolId && existing.student.schoolId !== validSchoolId)
    ) {
      throw new BadRequestException('Enrolled student does not belong to this school');
    }

    // 5. Section belongs to same school and academic year
    if (
      !existing.section ||
      (existing.section.class?.schoolId &&
        existing.section.class.schoolId !== validSchoolId)
    ) {
      throw new BadRequestException('Enrolled section does not belong to this school');
    }
    if (
      existing.section.class?.academicYearId &&
      existing.section.class.academicYearId !== existing.academicYearId
    ) {
      throw new BadRequestException(
        'Enrolled section academic session does not match enrollment session',
      );
    }

    // 6. Valid status transition: if transitioning to ACTIVE, check for conflicting active enrollment
    if (
      data.status === EnrollmentStatus.ACTIVE &&
      existing.status !== EnrollmentStatus.ACTIVE
    ) {
      const activeConflict = await this.prisma.studentEnrollment.findFirst({
        where: {
          studentId: existing.studentId,
          academicYearId: existing.academicYearId,
          status: EnrollmentStatus.ACTIVE,
          id: { not: id },
        },
        include: { section: { include: { class: true } } },
      });
      if (activeConflict) {
        throw new ConflictException(
          `Student already has an active enrollment in ${activeConflict.section.class.name} (${activeConflict.section.name}) for this session`,
        );
      }
    }

    // 7. Whitelist mutable fields - immutable identity cannot be mutated
    const updateData: any = {};
    if (data.status !== undefined) updateData.status = data.status;
    if (data.rollNumber !== undefined)
      updateData.rollNumber = data.rollNumber?.trim();
    if (data.leftAt !== undefined)
      updateData.leftAt = data.leftAt ? new Date(data.leftAt) : null;

    return this.prisma.studentEnrollment.update({
      where: { id },
      data: updateData,
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
