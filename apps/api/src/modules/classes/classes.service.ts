import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { requireSchoolId } from '../../core/tenant/tenant.util';
import {
  CreateClassDto,
  UpdateClassDto,
  CreateSectionDto,
  UpdateSectionDto,
} from './dto/class.dto';
import {
  CreateTeacherAssignmentDto,
  UpdateTeacherAssignmentDto,
} from './dto/teacher-assignment.dto';

@Injectable()
export class ClassesService {
  constructor(private prisma: PrismaService) {}

  // -------------------------------------------------------------
  // CLASSES
  // -------------------------------------------------------------

  async findAll(schoolId: string) {
    const validSchoolId = requireSchoolId(schoolId, 'List classes');
    return this.prisma.class.findMany({
      where: { schoolId: validSchoolId },
      include: {
        academicYear: {
          select: { id: true, name: true, isActive: true, isLocked: true },
        },
        sections: {
          include: {
            _count: {
              select: {
                enrollments: {
                  where: { status: 'ACTIVE' },
                },
              },
            },
          },
          orderBy: { name: 'asc' },
        },
      },
      orderBy: [{ numericLevel: 'asc' }, { name: 'asc' }],
    });
  }

  async getClassById(schoolId: string, classId: string) {
    const validSchoolId = requireSchoolId(schoolId, 'Get class');
    const classRecord = await this.prisma.class.findFirst({
      where: { id: classId, schoolId: validSchoolId },
      include: {
        academicYear: {
          select: { id: true, name: true, isActive: true, isLocked: true },
        },
        sections: {
          include: {
            _count: {
              select: {
                enrollments: {
                  where: { status: 'ACTIVE' },
                },
              },
            },
            teacherAssignments: {
              include: {
                staff: {
                  select: {
                    id: true,
                    employeeId: true,
                    user: { select: { firstName: true, lastName: true } },
                  },
                },
                subject: { select: { id: true, name: true } },
                schoolSubjectOffering: {
                  select: {
                    id: true,
                    globalSubject: { select: { name: true } },
                  },
                },
              },
            },
          },
          orderBy: { name: 'asc' },
        },
      },
    });

    if (!classRecord) {
      throw new NotFoundException('Class not found');
    }

    return classRecord;
  }

  async createClass(schoolId: string, data: CreateClassDto) {
    const validSchoolId = requireSchoolId(schoolId, 'Create class');

    let targetYear: any = null;
    let resolvedYearId: string;

    if (!data.academicYearId) {
      targetYear =
        (await this.prisma.academicYear.findFirst({
          where: { schoolId: validSchoolId, isActive: true },
        })) ||
        (await this.prisma.academicYear.findFirst({
          where: { schoolId: validSchoolId },
        }));
      if (!targetYear) {
        throw new BadRequestException(
          'No active academic year found for this school',
        );
      }
      resolvedYearId = targetYear.id;
    } else {
      targetYear = await this.prisma.academicYear.findFirst({
        where: { id: data.academicYearId, schoolId: validSchoolId },
      });
      if (!targetYear) {
        throw new BadRequestException(
          'Specified academic year does not belong to this school',
        );
      }
      resolvedYearId = targetYear.id;
    }

    if (targetYear.isLocked) {
      throw new BadRequestException(
        `Academic session '${targetYear.name}' is locked. Structural changes are not permitted.`,
      );
    }

    const cleanName = data.name.trim();
    const numericLevel =
      data.numericLevel ?? (parseInt(cleanName.replace(/\D/g, ''), 10) || 1);

    if (numericLevel < 1 || numericLevel > 12) {
      throw new BadRequestException(
        'Class numeric level must be between 1 and 12',
      );
    }

    const existing = await this.prisma.class.findUnique({
      where: {
        schoolId_academicYearId_name: {
          schoolId: validSchoolId,
          academicYearId: resolvedYearId,
          name: cleanName,
        },
      },
    });

    if (existing) {
      throw new ConflictException(
        `Class "${cleanName}" already exists for this academic session`,
      );
    }

    const sectionsList =
      data.sections && data.sections.length > 0 ? data.sections : ['A'];

    return this.prisma.class.create({
      data: {
        schoolId: validSchoolId,
        academicYearId: resolvedYearId,
        name: cleanName,
        numericLevel,
        sections: {
          create: sectionsList.map((secName) => ({
            name: secName.trim().toUpperCase(),
            capacity: 40,
          })),
        },
      },
      include: {
        sections: true,
      },
    });
  }

  async updateClass(schoolId: string, classId: string, data: UpdateClassDto) {
    const validSchoolId = requireSchoolId(schoolId, 'Update class');
    const existing = await this.prisma.class.findFirst({
      where: { id: classId, schoolId: validSchoolId },
      include: { academicYear: true },
    });
    if (!existing) throw new NotFoundException('Class not found');

    if (existing.academicYear?.isLocked) {
      throw new BadRequestException(
        `Academic session '${existing.academicYear.name}' is locked. Structural changes are not permitted.`,
      );
    }

    if (
      data.numericLevel !== undefined &&
      (data.numericLevel < 1 || data.numericLevel > 12)
    ) {
      throw new BadRequestException(
        'Class numeric level must be between 1 and 12',
      );
    }

    return this.prisma.class.update({
      where: { id: classId },
      data: {
        name: data.name?.trim(),
        numericLevel: data.numericLevel,
      },
      include: { sections: true },
    });
  }

  async deleteClass(schoolId: string, classId: string) {
    const validSchoolId = requireSchoolId(schoolId, 'Delete class');
    const existing = await this.prisma.class.findFirst({
      where: { id: classId, schoolId: validSchoolId },
      include: {
        academicYear: true,
        sections: {
          include: {
            _count: { select: { enrollments: true } },
          },
        },
      },
    });
    if (!existing) throw new NotFoundException('Class not found');

    if (existing.academicYear?.isLocked) {
      throw new BadRequestException(
        `Academic session '${existing.academicYear.name}' is locked. Structural changes are not permitted.`,
      );
    }

    const totalStudents = existing.sections.reduce(
      (acc, sec) => acc + sec._count.enrollments,
      0,
    );
    if (totalStudents > 0) {
      throw new BadRequestException(
        `Cannot delete class containing ${totalStudents} enrolled students. Transfer or graduate students first.`,
      );
    }

    await this.prisma.class.delete({ where: { id: classId } });
    return {
      success: true,
      message: `Class ${existing.name} deleted successfully`,
    };
  }

  // -------------------------------------------------------------
  // SECTIONS
  // -------------------------------------------------------------

  async findSections(schoolId: string, classId: string) {
    const validSchoolId = requireSchoolId(schoolId, 'List sections');
    return this.prisma.section.findMany({
      where: { classId, class: { schoolId: validSchoolId } },
      include: {
        _count: {
          select: {
            enrollments: {
              where: { status: 'ACTIVE' },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async getSectionById(schoolId: string, sectionId: string) {
    const validSchoolId = requireSchoolId(schoolId, 'Get section');
    const section = await this.prisma.section.findFirst({
      where: { id: sectionId, class: { schoolId: validSchoolId } },
      include: {
        class: {
          include: {
            academicYear: {
              select: { id: true, name: true, isActive: true, isLocked: true },
            },
          },
        },
        _count: {
          select: {
            enrollments: {
              where: { status: 'ACTIVE' },
            },
            teacherAssignments: true,
          },
        },
        teacherAssignments: {
          include: {
            staff: {
              select: {
                id: true,
                employeeId: true,
                user: { select: { firstName: true, lastName: true } },
              },
            },
            subject: { select: { id: true, name: true } },
            schoolSubjectOffering: {
              select: { id: true, globalSubject: { select: { name: true } } },
            },
          },
        },
      },
    });

    if (!section) {
      throw new NotFoundException('Section not found');
    }

    return section;
  }

  async createSection(
    schoolId: string,
    classId: string,
    data: CreateSectionDto,
  ) {
    const validSchoolId = requireSchoolId(schoolId, 'Create section');
    const existingClass = await this.prisma.class.findFirst({
      where: { id: classId, schoolId: validSchoolId },
      include: { academicYear: true },
    });
    if (!existingClass) throw new NotFoundException('Class not found');

    if (existingClass.academicYear?.isLocked) {
      throw new BadRequestException(
        `Academic session '${existingClass.academicYear.name}' is locked. Structural changes are not permitted.`,
      );
    }

    const cleanName = data.name.trim().toUpperCase();
    const existingSec = await this.prisma.section.findUnique({
      where: {
        classId_name: {
          classId,
          name: cleanName,
        },
      },
    });
    if (existingSec) {
      throw new ConflictException(
        `Section ${cleanName} already exists in ${existingClass.name}`,
      );
    }

    return this.prisma.section.create({
      data: {
        classId,
        name: cleanName,
        capacity: data.capacity || 40,
        roomNumber: data.roomNumber?.trim(),
      },
    });
  }

  async updateSection(
    schoolId: string,
    sectionId: string,
    data: UpdateSectionDto,
  ) {
    const validSchoolId = requireSchoolId(schoolId, 'Update section');
    const existing = await this.prisma.section.findFirst({
      where: { id: sectionId, class: { schoolId: validSchoolId } },
      include: { class: { include: { academicYear: true } } },
    });
    if (!existing) throw new NotFoundException('Section not found');

    if (existing.class.academicYear?.isLocked) {
      throw new BadRequestException(
        `Academic session '${existing.class.academicYear.name}' is locked. Structural changes are not permitted.`,
      );
    }

    const cleanName = data.name
      ? data.name.trim().toUpperCase()
      : existing.name;

    if (data.name && cleanName !== existing.name) {
      const duplicate = await this.prisma.section.findUnique({
        where: {
          classId_name: {
            classId: existing.classId,
            name: cleanName,
          },
        },
      });
      if (duplicate) {
        throw new ConflictException(
          `Section ${cleanName} already exists in ${existing.class.name}`,
        );
      }
    }

    return this.prisma.section.update({
      where: { id: sectionId },
      data: {
        name: cleanName,
        capacity: data.capacity ?? existing.capacity,
        roomNumber:
          data.roomNumber !== undefined
            ? data.roomNumber?.trim()
            : existing.roomNumber,
      },
    });
  }

  async deleteSection(schoolId: string, sectionId: string) {
    const validSchoolId = requireSchoolId(schoolId, 'Delete section');
    const existing = await this.prisma.section.findFirst({
      where: { id: sectionId, class: { schoolId: validSchoolId } },
      include: {
        class: { include: { academicYear: true } },
        _count: { select: { enrollments: true } },
      },
    });
    if (!existing) throw new NotFoundException('Section not found');

    if (existing.class.academicYear?.isLocked) {
      throw new BadRequestException(
        `Academic session '${existing.class.academicYear.name}' is locked. Structural changes are not permitted.`,
      );
    }

    if (existing._count.enrollments > 0) {
      throw new BadRequestException(
        `Cannot delete section with ${existing._count.enrollments} active student enrollments.`,
      );
    }

    await this.prisma.section.delete({ where: { id: sectionId } });
    return { success: true, message: `Section ${existing.name} deleted` };
  }

  // -------------------------------------------------------------
  // TEACHER ASSIGNMENTS (Canonical Academic Staff Allocations)
  // -------------------------------------------------------------

  async listTeacherAssignments(
    schoolId: string,
    filter: {
      staffId?: string;
      sectionId?: string;
      classId?: string;
      academicYearId?: string;
    },
  ) {
    const validSchoolId = requireSchoolId(schoolId, 'List teacher assignments');
    const where: any = { schoolId: validSchoolId };

    if (filter.staffId) where.staffId = filter.staffId;
    if (filter.sectionId) where.sectionId = filter.sectionId;
    if (filter.academicYearId) where.academicYearId = filter.academicYearId;
    if (filter.classId) where.section = { classId: filter.classId };

    return this.prisma.teacherAssignment.findMany({
      where,
      include: {
        staff: {
          select: {
            id: true,
            employeeId: true,
            user: { select: { firstName: true, lastName: true, email: true } },
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
        subject: { select: { id: true, name: true, code: true } },
        schoolSubjectOffering: {
          select: {
            id: true,
            globalSubject: { select: { id: true, name: true, code: true } },
          },
        },
      },
      orderBy: [
        { section: { class: { numericLevel: 'asc' } } },
        { createdAt: 'desc' },
      ],
    });
  }

  async getTeacherAssignmentById(schoolId: string, id: string) {
    const validSchoolId = requireSchoolId(schoolId, 'Get teacher assignment');
    const assignment = await this.prisma.teacherAssignment.findFirst({
      where: { id, schoolId: validSchoolId },
      include: {
        staff: {
          select: {
            id: true,
            employeeId: true,
            user: { select: { firstName: true, lastName: true, email: true } },
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
        subject: { select: { id: true, name: true, code: true } },
        schoolSubjectOffering: {
          select: {
            id: true,
            globalSubject: { select: { id: true, name: true, code: true } },
          },
        },
      },
    });

    if (!assignment) {
      throw new NotFoundException('Teacher assignment not found');
    }

    return assignment;
  }

  async createTeacherAssignment(
    schoolId: string,
    data: CreateTeacherAssignmentDto,
  ) {
    const validSchoolId = requireSchoolId(
      schoolId,
      'Create teacher assignment',
    );

    // 1. Verify staff belongs to school and is active
    const staff = await this.prisma.staff.findFirst({
      where: { id: data.staffId, schoolId: validSchoolId },
    });
    if (!staff) {
      throw new NotFoundException(
        'Faculty / Staff member not found in this school',
      );
    }
    if (!staff.isActive) {
      throw new BadRequestException('Cannot assign inactive staff member');
    }

    // 2. Verify section belongs to school
    const section = await this.prisma.section.findFirst({
      where: { id: data.sectionId, class: { schoolId: validSchoolId } },
      include: { class: { include: { academicYear: true } } },
    });
    if (!section) {
      throw new NotFoundException('Section not found in this school');
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

    if (staff.schoolId !== section.class.schoolId) {
      throw new BadRequestException(
        'Cross-school teacher assignments are not permitted',
      );
    }

    // 4. Verify Offering / Subject if provided
    const resolvedOfferingId = data.schoolSubjectOfferingId || null;
    let resolvedSubjectId = data.subjectId || null;

    if (!data.isClassTeacher && !resolvedOfferingId && !resolvedSubjectId) {
      throw new BadRequestException(
        'Subject offering or subject is required for teacher assignment when not designated as class teacher',
      );
    }

    if (resolvedOfferingId) {
      const offering = await this.prisma.schoolSubjectOffering.findFirst({
        where: {
          id: resolvedOfferingId,
          schoolId: validSchoolId,
          academicYearId: resolvedYearId,
        },
      });
      if (!offering) {
        throw new BadRequestException(
          'Specified school subject offering does not exist or belong to this academic year',
        );
      }
      if (
        offering.gradeFrom !== undefined &&
        offering.gradeTo !== undefined &&
        section.class?.numericLevel !== undefined
      ) {
        const classLevel = section.class.numericLevel;
        if (classLevel < offering.gradeFrom || classLevel > offering.gradeTo) {
          throw new BadRequestException(
            `Subject offering grade band (${offering.gradeFrom}-${offering.gradeTo}) does not cover class level (${classLevel})`,
          );
        }
      }
      if (!resolvedSubjectId && offering.legacySubjectId) {
        resolvedSubjectId = offering.legacySubjectId;
      }
    }

    if (resolvedSubjectId) {
      const subject = await this.prisma.subject.findFirst({
        where: { id: resolvedSubjectId, schoolId: validSchoolId },
      });
      if (!subject) {
        throw new NotFoundException('Subject not found for this school');
      }
    }

    // 5. Enforce single class teacher constraint if requested
    if (data.isClassTeacher) {
      const existingClassTeacher =
        await this.prisma.teacherAssignment.findFirst({
          where: {
            sectionId: data.sectionId,
            academicYearId: resolvedYearId,
            isClassTeacher: true,
          },
          include: { staff: { include: { user: true } } },
        });

      if (existingClassTeacher) {
        const teacherName = existingClassTeacher.staff?.user
          ? `${existingClassTeacher.staff.user.firstName} ${existingClassTeacher.staff.user.lastName}`
          : 'another teacher';
        throw new ConflictException(
          `Section '${section.name}' already has a designated class teacher (${teacherName}) for this academic year`,
        );
      }
    }

    // 6. Check for duplicate assignment (handling NULL subject and offering cases)
    const duplicateWhere: any = {
      academicYearId: resolvedYearId,
      staffId: data.staffId,
      sectionId: data.sectionId,
    };

    if (resolvedOfferingId) {
      duplicateWhere.schoolSubjectOfferingId = resolvedOfferingId;
    } else if (resolvedSubjectId) {
      duplicateWhere.subjectId = resolvedSubjectId;
    } else {
      duplicateWhere.subjectId = null;
      duplicateWhere.schoolSubjectOfferingId = null;
    }

    const duplicate = await this.prisma.teacherAssignment.findFirst({
      where: duplicateWhere,
    });

    if (duplicate) {
      throw new ConflictException(
        'This teacher is already assigned to this section and subject/offering for this academic year',
      );
    }

    return this.prisma.teacherAssignment.create({
      data: {
        schoolId: validSchoolId,
        academicYearId: resolvedYearId,
        staffId: data.staffId,
        sectionId: data.sectionId,
        subjectId: resolvedSubjectId,
        schoolSubjectOfferingId: resolvedOfferingId,
        isClassTeacher: data.isClassTeacher || false,
      },
      include: {
        staff: {
          select: {
            id: true,
            user: { select: { firstName: true, lastName: true } },
          },
        },
        section: {
          select: { id: true, name: true, class: { select: { name: true } } },
        },
        subject: { select: { id: true, name: true } },
        schoolSubjectOffering: {
          select: { id: true, globalSubject: { select: { name: true } } },
        },
      },
    });
  }

  async updateTeacherAssignment(
    schoolId: string,
    id: string,
    data: UpdateTeacherAssignmentDto,
  ) {
    const validSchoolId = requireSchoolId(
      schoolId,
      'Update teacher assignment',
    );
    const existing = await this.prisma.teacherAssignment.findFirst({
      where: { id, schoolId: validSchoolId },
      include: { academicYear: true, section: true },
    });

    if (!existing) {
      throw new NotFoundException('Teacher assignment not found');
    }

    if (existing.academicYear?.isLocked) {
      throw new BadRequestException(
        `Academic session '${existing.academicYear.name}' is locked. Structural changes are not permitted.`,
      );
    }

    // If changing to class teacher, verify single class teacher rule
    if (data.isClassTeacher && !existing.isClassTeacher) {
      const existingClassTeacher =
        await this.prisma.teacherAssignment.findFirst({
          where: {
            sectionId: existing.sectionId,
            academicYearId: existing.academicYearId,
            isClassTeacher: true,
            id: { not: id },
          },
        });
      if (existingClassTeacher) {
        throw new ConflictException(
          'Section already has a designated class teacher for this academic year',
        );
      }
    }

    return this.prisma.teacherAssignment.update({
      where: { id },
      data: {
        staffId: data.staffId || existing.staffId,
        subjectId:
          data.subjectId !== undefined ? data.subjectId : existing.subjectId,
        schoolSubjectOfferingId:
          data.schoolSubjectOfferingId !== undefined
            ? data.schoolSubjectOfferingId
            : existing.schoolSubjectOfferingId,
        isClassTeacher:
          data.isClassTeacher !== undefined
            ? data.isClassTeacher
            : existing.isClassTeacher,
      },
    });
  }

  async deleteTeacherAssignment(schoolId: string, id: string) {
    const validSchoolId = requireSchoolId(
      schoolId,
      'Delete teacher assignment',
    );
    const existing = await this.prisma.teacherAssignment.findFirst({
      where: { id, schoolId: validSchoolId },
      include: { academicYear: true },
    });

    if (!existing) {
      throw new NotFoundException('Teacher assignment not found');
    }

    if (existing.academicYear?.isLocked) {
      throw new BadRequestException(
        `Academic session '${existing.academicYear.name}' is locked. Structural changes are not permitted.`,
      );
    }

    await this.prisma.teacherAssignment.delete({ where: { id } });
    return {
      success: true,
      message: 'Teacher assignment removed successfully',
    };
  }

  // -------------------------------------------------------------
  // LEGACY SUBJECT ADAPTER
  // -------------------------------------------------------------

  async findAllSubjects(schoolId: string) {
    const validSchoolId = requireSchoolId(schoolId, 'List subjects');
    return this.prisma.subject.findMany({
      where: { schoolId: validSchoolId, isActive: true },
      orderBy: { name: 'asc' },
    });
  }
}
