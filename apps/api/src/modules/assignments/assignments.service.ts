import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { requireSchoolId } from '../../core/tenant/tenant.util';
import { resolveGradeLevel } from '../../core/academic/grade-resolver.util';
import {
  CreateAssignmentDto,
  UpdateAssignmentDto,
  SubmitAssignmentDto,
} from './dto/assignment.dto';

@Injectable()
export class AssignmentsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Deterministically resolves and validates target academic year:
   * - If providedYearId: must exist in school, must not be locked.
   * - If omitted: must have active session in school, must not be locked.
   * - Never falls back to arbitrary, random, or latest session.
   */
  async resolveAcademicYear(schoolId: string, providedYearId?: string) {
    const validSchoolId = requireSchoolId(schoolId);
    let year: any;

    if (providedYearId) {
      year = await this.prisma.academicYear.findFirst({
        where: { id: providedYearId, schoolId: validSchoolId },
      });
      if (!year) {
        throw new NotFoundException('Academic year not found for this school');
      }
    } else {
      year = await this.prisma.academicYear.findFirst({
        where: { schoolId: validSchoolId, isActive: true },
      });
      if (!year) {
        throw new BadRequestException(
          'No active Academic Year found for this school. Please specify an explicit academicYearId.',
        );
      }
    }

    if (year.isLocked) {
      throw new BadRequestException(
        `Academic session '${year.name}' is locked. Structural changes are not permitted.`,
      );
    }

    return year;
  }

  async resolveAcademicYearId(schoolId: string, providedYearId?: string) {
    const year = await this.resolveAcademicYear(schoolId, providedYearId);
    return year.id;
  }

  /**
   * Deterministically resolves staff member:
   * - If explicitStaffId: must exist in school and be active.
   * - If omitted: resolves authenticated user's active staff profile in this school.
   * - NEVER falls back to first/arbitrary staff record in the school.
   */
  async resolveStaff(
    schoolId: string,
    explicitStaffId?: string,
    currentUserIdOrStaffId?: string,
  ): Promise<string> {
    const validSchoolId = requireSchoolId(schoolId);

    if (explicitStaffId) {
      const staff = await this.prisma.staff.findFirst({
        where: { id: explicitStaffId, schoolId: validSchoolId, isActive: true },
      });
      if (!staff) {
        throw new BadRequestException(
          'Active staff record not found for this school',
        );
      }
      return staff.id;
    }

    if (!currentUserIdOrStaffId) {
      throw new BadRequestException(
        'Unable to resolve active staff profile for assignment creation. Please provide an explicit active staffId.',
      );
    }

    const staff = await this.prisma.staff.findFirst({
      where: {
        schoolId: validSchoolId,
        isActive: true,
        OR: [
          { id: currentUserIdOrStaffId },
          { userId: currentUserIdOrStaffId },
        ],
      },
    });

    if (!staff) {
      throw new BadRequestException(
        'Authenticated user has no active staff profile in this school. Please provide an explicit active staffId.',
      );
    }

    return staff.id;
  }

  /**
   * Authoritative validation of assignment academic relationship graph:
   * Class (matching year & school) → Section (matching class, school & year) → Offering/Subject
   */
  async validateAcademicContext(
    schoolId: string,
    academicYear: { id: string; name?: string; isLocked?: boolean },
    classId: string,
    sectionId?: string,
    offeringId?: string,
    subjectId?: string,
    options?: {
      requireActiveOffering?: boolean;
    },
  ) {
    const validSchoolId = requireSchoolId(schoolId);

    // 1. Validate Class
    const cls = await this.prisma.class.findFirst({
      where: { id: classId, schoolId: validSchoolId },
    });
    if (!cls) {
      throw new NotFoundException('Class not found in this school');
    }
    if (cls.academicYearId !== academicYear.id) {
      throw new BadRequestException(
        `Class belongs to academic session '${cls.academicYearId}', which does not match assignment academic session '${academicYear.name || academicYear.id}'`,
      );
    }

    const classGrade = resolveGradeLevel(cls);

    // 2. Validate Section (if provided)
    let sec: any = null;
    if (sectionId) {
      sec = await this.prisma.section.findFirst({
        where: { id: sectionId },
        include: { class: true },
      });
      if (!sec) {
        throw new NotFoundException('Section not found');
      }
      if (sec.classId !== classId) {
        throw new BadRequestException('Section does not belong to specified Class');
      }
      if (sec.class?.schoolId !== validSchoolId) {
        throw new BadRequestException('Section does not belong to this school');
      }
      if (sec.class?.academicYearId !== academicYear.id) {
        throw new BadRequestException(
          'Section belongs to a different academic session than assignment',
        );
      }
    }

    // 3. Validate Canonical Offering and/or Legacy Subject
    let resolvedOfferingId: string | null = null;
    let resolvedSubjectId: string | null = null;

    if (offeringId) {
      const offering = await this.prisma.schoolSubjectOffering.findFirst({
        where: { id: offeringId, schoolId: validSchoolId },
      });
      if (!offering) {
        throw new NotFoundException(
          'School subject offering not found in this school',
        );
      }
      if (offering.academicYearId !== academicYear.id) {
        throw new BadRequestException(
          'School subject offering belongs to a different academic session',
        );
      }
      if ((options?.requireActiveOffering ?? true) && !offering.isOffered) {
        throw new BadRequestException(
          `School subject offering "${offering.id}" is inactive and cannot be selected for assignments`,
        );
      }
      if (classGrade < offering.gradeFrom || classGrade > offering.gradeTo) {
        throw new BadRequestException(
          `Offering "${offering.id}" (grades ${offering.gradeFrom}-${offering.gradeTo}) is not compatible with class grade ${classGrade}`,
        );
      }
      if (subjectId && offering.legacySubjectId && subjectId !== offering.legacySubjectId) {
        throw new BadRequestException(
          `Subject "${subjectId}" contradicts canonical offering legacySubjectId "${offering.legacySubjectId}"`,
        );
      }
      resolvedOfferingId = offering.id;
      resolvedSubjectId = subjectId || offering.legacySubjectId || null;
    } else if (subjectId) {
      const subj = await this.prisma.subject.findFirst({
        where: { id: subjectId, schoolId: validSchoolId },
      });
      if (!subj) {
        throw new NotFoundException('Subject not found in this school');
      }
      resolvedSubjectId = subj.id;

      // Deterministically check if a unique matching active offering exists in session covering this class grade
      const matchingOfferings = await this.prisma.schoolSubjectOffering.findMany({
        where: {
          schoolId: validSchoolId,
          academicYearId: academicYear.id,
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

    return {
      class: cls,
      section: sec,
      resolvedOfferingId,
      resolvedSubjectId,
    };
  }

  async createAssignment(
    schoolId: string,
    data: CreateAssignmentDto,
    currentUserIdOrStaffId: string,
  ) {
    const validSchoolId = requireSchoolId(schoolId);

    // 1. Deterministically resolve target academic year (validates not locked)
    const targetYear = await this.resolveAcademicYear(
      validSchoolId,
      data.academicYearId,
    );

    // 2. Authoritative academic relationship graph validation (Class, Section, Offering/Subject)
    const { resolvedOfferingId, resolvedSubjectId } =
      await this.validateAcademicContext(
        validSchoolId,
        targetYear,
        data.classId,
        data.sectionId,
        data.schoolSubjectOfferingId,
        data.subjectId,
        { requireActiveOffering: true },
      );

    // 3. Deterministically resolve staff (no arbitrary fallback)
    const staffId = await this.resolveStaff(
      validSchoolId,
      data.staffId,
      currentUserIdOrStaffId,
    );

    return this.prisma.assignment.create({
      data: {
        schoolId: validSchoolId,
        academicYearId: targetYear.id,
        classId: data.classId,
        sectionId: data.sectionId || null,
        schoolSubjectOfferingId: resolvedOfferingId,
        subjectId: resolvedSubjectId,
        staffId,
        title: data.title,
        description: data.description || null,
        dueDate: new Date(data.dueDate),
        maxMarks: data.maxMarks ? parseInt(data.maxMarks.toString(), 10) : 10,
      },
      include: {
        subject: { select: { id: true, name: true, code: true } },
        schoolSubjectOffering: {
          include: {
            globalSubject: { select: { id: true, name: true, code: true } },
          },
        },
        class: { select: { id: true, name: true, numericLevel: true } },
        section: { select: { id: true, name: true } },
        staff: { select: { id: true, userId: true } },
      },
    });
  }

  async updateAssignment(
    schoolId: string,
    id: string,
    data: UpdateAssignmentDto,
    currentUserIdOrStaffId?: string,
  ) {
    const validSchoolId = requireSchoolId(schoolId);

    const existing = await this.prisma.assignment.findFirst({
      where: { id, schoolId: validSchoolId },
      include: { academicYear: true, class: true },
    });
    if (!existing) {
      throw new NotFoundException('Assignment not found');
    }

    if (existing.academicYear?.isLocked) {
      throw new BadRequestException(
        `Academic session '${existing.academicYear.name}' is locked. Structural changes are not permitted.`,
      );
    }

    // Determine target context
    const targetYearId = data.academicYearId || existing.academicYearId;
    const targetYear = await this.resolveAcademicYear(
      validSchoolId,
      targetYearId,
    );

    const targetClassId = data.classId || existing.classId;
    const targetSectionId =
      data.sectionId !== undefined ? data.sectionId : existing.sectionId;
    const targetOfferingId =
      data.schoolSubjectOfferingId !== undefined
        ? data.schoolSubjectOfferingId
        : existing.schoolSubjectOfferingId;
    const targetSubjectId =
      data.subjectId !== undefined ? data.subjectId : existing.subjectId;

    // Revalidate complete target context
    // Inactive offering check: require active offering only when newly assigned or changed
    const isOfferingChanged =
      data.schoolSubjectOfferingId !== undefined &&
      data.schoolSubjectOfferingId !== existing.schoolSubjectOfferingId;

    const { resolvedOfferingId, resolvedSubjectId } =
      await this.validateAcademicContext(
        validSchoolId,
        targetYear,
        targetClassId,
        targetSectionId || undefined,
        targetOfferingId || undefined,
        targetSubjectId || undefined,
        {
          requireActiveOffering: isOfferingChanged,
        },
      );

    let targetStaffId = existing.staffId;
    if (data.staffId) {
      targetStaffId = await this.resolveStaff(
        validSchoolId,
        data.staffId,
        currentUserIdOrStaffId,
      );
    }

    const updateData: any = {
      academicYearId: targetYear.id,
      classId: targetClassId,
      sectionId: targetSectionId || null,
      schoolSubjectOfferingId: resolvedOfferingId,
      subjectId: resolvedSubjectId,
      staffId: targetStaffId,
    };

    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.dueDate !== undefined) updateData.dueDate = new Date(data.dueDate);
    if (data.maxMarks !== undefined)
      updateData.maxMarks = parseInt(data.maxMarks.toString(), 10);
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    return this.prisma.assignment.update({
      where: { id: existing.id },
      data: updateData,
      include: {
        subject: { select: { id: true, name: true, code: true } },
        schoolSubjectOffering: {
          include: {
            globalSubject: { select: { id: true, name: true, code: true } },
          },
        },
        class: { select: { id: true, name: true, numericLevel: true } },
        section: { select: { id: true, name: true } },
        staff: { select: { id: true, userId: true } },
      },
    });
  }

  async listAssignments(
    schoolId: string,
    classId?: string,
    sectionId?: string,
    academicYearId?: string,
  ) {
    const validSchoolId = requireSchoolId(schoolId);
    const where: any = { schoolId: validSchoolId };
    if (classId) where.classId = classId;
    if (sectionId) where.sectionId = sectionId;
    if (academicYearId) where.academicYearId = academicYearId;

    return this.prisma.assignment.findMany({
      where,
      include: {
        subject: { select: { id: true, name: true, code: true } },
        schoolSubjectOffering: {
          include: {
            globalSubject: { select: { id: true, name: true, code: true } },
          },
        },
        class: { select: { id: true, name: true, numericLevel: true } },
        section: { select: { id: true, name: true } },
        staff: { select: { id: true, userId: true } },
        _count: { select: { submissions: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async deleteAssignment(schoolId: string, id: string) {
    const validSchoolId = requireSchoolId(schoolId);
    const assignment = await this.prisma.assignment.findFirst({
      where: { id, schoolId: validSchoolId },
      include: { academicYear: true },
    });
    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }
    if (assignment.academicYear?.isLocked) {
      throw new BadRequestException(
        `Academic session '${assignment.academicYear.name}' is locked. Structural changes are not permitted.`,
      );
    }
    return this.prisma.assignment.delete({ where: { id: assignment.id } });
  }

  async submitAssignment(
    schoolId: string,
    assignmentId: string,
    studentId: string,
    data: SubmitAssignmentDto,
  ) {
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
        marksObtained:
          data.marksObtained !== undefined && data.marksObtained !== null
            ? data.marksObtained
            : undefined,
        feedback: data.feedback,
        submittedAt: new Date(),
      },
      update: {
        status: data.status,
        marksObtained:
          data.marksObtained !== undefined && data.marksObtained !== null
            ? data.marksObtained
            : undefined,
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
        schoolSubjectOffering: true,
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
          : assignment.classId
            ? { section: { classId: assignment.classId } }
            : {}),
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
    const seenStudentIds = new Set<string>();
    const roster: any[] = [];

    for (const e of enrollments) {
      seenStudentIds.add(e.studentId);
      const sub = subMap.get(e.studentId);
      roster.push({
        studentId: e.studentId,
        rollNumber: e.rollNumber || null,
        studentName:
          `${e.student?.user?.firstName || ''} ${e.student?.user?.lastName || ''}`.trim() ||
          'Student',
        status: sub?.status || 'PENDING',
        marksObtained:
          sub?.marksObtained !== null && sub?.marksObtained !== undefined
            ? Number(sub.marksObtained)
            : null,
        feedback: sub?.feedback || '',
        submittedAt: sub?.submittedAt || null,
      });
    }

    // Also include any submissions from students who submitted even if not in the active enrollment query
    for (const sub of submissions) {
      if (!seenStudentIds.has(sub.studentId)) {
        seenStudentIds.add(sub.studentId);
        const roll = sub.student?.enrollments?.[0]?.rollNumber || null;
        roster.push({
          studentId: sub.studentId,
          rollNumber: roll,
          studentName:
            `${sub.student?.user?.firstName || ''} ${sub.student?.user?.lastName || ''}`.trim() ||
            'Student',
          status: sub.status || 'SUBMITTED',
          marksObtained:
            sub.marksObtained !== null && sub.marksObtained !== undefined
              ? Number(sub.marksObtained)
              : null,
          feedback: sub.feedback || '',
          submittedAt: sub.submittedAt || null,
        });
      }
    }

    return {
      assignment,
      submissions: roster,
      stats: {
        totalStudents: roster.length,
        submittedCount: roster.filter(
          (r) => r.status === 'SUBMITTED' || r.status === 'GRADED',
        ).length,
        gradedCount: roster.filter((r) => r.status === 'GRADED').length,
        pendingCount: roster.filter((r) => r.status === 'PENDING').length,
      },
    };
  }

  /**
   * Domain query: resolves staff profile by user ID within school.
   */
  async getStaffProfileByUserId(schoolId: string, userId: string) {
    const validSchoolId = requireSchoolId(schoolId);
    return this.prisma.staff.findFirst({
      where: {
        userId,
        schoolId: validSchoolId,
        isActive: true,
      },
    });
  }

  /**
   * Domain query: retrieves assignment by ID ensuring school ownership.
   */
  async getAssignmentById(schoolId: string, id: string) {
    const validSchoolId = requireSchoolId(schoolId);
    return this.prisma.assignment.findFirst({
      where: { id, schoolId: validSchoolId },
      include: {
        subject: { select: { id: true, name: true, code: true } },
        schoolSubjectOffering: {
          include: {
            globalSubject: { select: { id: true, name: true, code: true } },
          },
        },
        class: { select: { id: true, name: true, numericLevel: true } },
        section: { select: { id: true, name: true } },
        staff: { select: { id: true, userId: true } },
        academicYear: true,
      },
    });
  }

  /**
   * Domain query: finds assignment matching canonical business criteria for reconciliation.
   */
  async findAssignmentByDetails(
    schoolId: string,
    criteria: {
      classId: string;
      subjectId?: string;
      schoolSubjectOfferingId?: string;
      title: string;
      staffId?: string;
    },
  ) {
    const validSchoolId = requireSchoolId(schoolId);
    const where: any = {
      schoolId: validSchoolId,
      classId: criteria.classId,
      title: criteria.title,
    };
    if (criteria.subjectId) {
      where.subjectId = criteria.subjectId;
    }
    if (criteria.schoolSubjectOfferingId) {
      where.schoolSubjectOfferingId = criteria.schoolSubjectOfferingId;
    }
    if (criteria.staffId) {
      where.staffId = criteria.staffId;
    }

    return this.prisma.assignment.findFirst({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        subject: { select: { id: true, name: true } },
        schoolSubjectOffering: { select: { id: true } },
        class: { select: { id: true, name: true } },
        staff: { select: { id: true, userId: true } },
        academicYear: true,
      },
    });
  }
}
