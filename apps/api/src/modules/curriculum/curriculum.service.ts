import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import {
  InitializeCurriculumDto,
  CreateSchoolOfferingDto,
  UpdateSchoolOfferingDto,
  EnrollStudentSubjectsDto,
} from './dto/curriculum.dto';
import { OfferingSource, SubjectClassification, SubjectSelectionType } from '@prisma/client';
import { requireSchoolId } from '../../core/tenant/tenant.util';

@Injectable()
export class CurriculumService {
  private readonly logger = new Logger(CurriculumService.name);

  constructor(private prisma: PrismaService) {}

  // -------------------------------------------------------------
  // BOARDS & CURRICULUMS
  // -------------------------------------------------------------
  async getBoards() {
    return this.prisma.board.findMany({
      where: { isActive: true },
      include: {
        curriculums: {
          where: { isActive: true },
          orderBy: { version: 'desc' },
        },
      },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
  }

  async getCurriculums(boardId?: string) {
    const where: any = { isActive: true };
    if (boardId) {
      where.boardId = boardId;
    }
    return this.prisma.curriculum.findMany({
      where,
      include: {
        board: true,
        subjectGroups: {
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async getCurriculumFramework(curriculumId: string) {
    const curriculum = await this.prisma.curriculum.findUnique({
      where: { id: curriculumId },
      include: {
        board: true,
        subjectGroups: {
          orderBy: { sortOrder: 'asc' },
          include: {
            subjects: {
              where: { isActive: true },
              include: { globalSubject: true },
              orderBy: [{ gradeFrom: 'asc' }, { subjectCode: 'asc' }],
            },
          },
        },
        subjects: {
          where: { isActive: true },
          include: {
            globalSubject: true,
            subjectGroup: true,
          },
          orderBy: [{ gradeFrom: 'asc' }, { displayName: 'asc' }],
        },
      },
    });

    if (!curriculum) {
      throw new NotFoundException(`Curriculum with ID "${curriculumId}" not found`);
    }

    return curriculum;
  }

  // -------------------------------------------------------------
  // SCHOOL ONBOARDING & "LOAD RECOMMENDED CURRICULUM"
  // -------------------------------------------------------------
  async initializeSchoolCurriculum(schoolId: string, dto: InitializeCurriculumDto) {
    const validSchoolId = requireSchoolId(schoolId);
    const school = await this.prisma.school.findUnique({
      where: { id: validSchoolId },
      include: {
        academicYears: {
          where: { isActive: true },
          take: 1,
        },
      },
    });

    if (!school) {
      throw new NotFoundException(`School with ID "${validSchoolId}" not found`);
    }

    const curriculum = await this.prisma.curriculum.findUnique({
      where: { id: dto.curriculumId },
      include: {
        board: true,
        subjects: {
          where: { isActive: true },
          include: { globalSubject: true },
        },
      },
    });

    if (!curriculum) {
      throw new NotFoundException(`Curriculum with ID "${dto.curriculumId}" not found`);
    }

    // Determine active academic year
    let academicYearId = dto.academicYearId;
    if (!academicYearId) {
      const activeYear = school.academicYears[0];
      if (!activeYear) {
        throw new BadRequestException('No active Academic Year found for this school');
      }
      academicYearId = activeYear.id;
    }

    // 1. Update school's board and active curriculum
    await this.prisma.school.update({
      where: { id: schoolId },
      data: {
        boardId: dto.boardId,
        activeCurriculumId: dto.curriculumId,
        boardType: curriculum.board.category, // keep legacy field synced
      },
    });

    // 2. Load and initialize recommended curriculum subjects into SchoolSubjectOffering
    let createdCount = 0;
    let updatedCount = 0;

    for (const cs of curriculum.subjects) {
      // Find or create legacy Subject record to guarantee zero breakage for timetable, marks, exams
      let legacySubject = await this.prisma.subject.findFirst({
        where: {
          schoolId,
          name: cs.displayName,
        },
      });

      if (!legacySubject) {
        // Also try matching by global subject name
        legacySubject = await this.prisma.subject.findFirst({
          where: {
            schoolId,
            name: cs.globalSubject.name,
          },
        });
      }

      if (!legacySubject) {
        legacySubject = await this.prisma.subject.create({
          data: {
            schoolId,
            name: cs.displayName,
            code: cs.subjectCode,
            isElective: cs.selectionType === SubjectSelectionType.ELECTIVE,
            isActive: true,
          },
        });
      }

      // Upsert SchoolSubjectOffering
      const existing = await this.prisma.schoolSubjectOffering.findFirst({
        where: {
          schoolId,
          academicYearId,
          globalSubjectId: cs.globalSubjectId,
          gradeFrom: cs.gradeFrom,
          gradeTo: cs.gradeTo,
        },
      });

      if (existing) {
        await this.prisma.schoolSubjectOffering.update({
          where: { id: existing.id },
          data: {
            curriculumId: dto.curriculumId,
            curriculumSubjectId: cs.id,
            legacySubjectId: legacySubject.id,
            isOffered: true,
            periodsPerWeek: cs.periodsPerWeek,
            subjectType: cs.subjectType,
            selectionType: cs.selectionType,
            theoryEnabled: cs.theoryEnabled,
            practicalEnabled: cs.practicalEnabled,
            internalAssessmentEnabled: cs.internalAssessmentEnabled,
            examEnabled: cs.examEnabled,
            maxMarks: cs.maxMarks,
            passMarks: cs.passMarks,
          },
        });
        updatedCount++;
      } else {
        await this.prisma.schoolSubjectOffering.create({
          data: {
            schoolId,
            curriculumId: dto.curriculumId,
            academicYearId,
            curriculumSubjectId: cs.id,
            globalSubjectId: cs.globalSubjectId,
            legacySubjectId: legacySubject.id,
            gradeFrom: cs.gradeFrom,
            gradeTo: cs.gradeTo,
            isOffered: true,
            periodsPerWeek: cs.periodsPerWeek,
            subjectType: cs.subjectType,
            selectionType: cs.selectionType,
            source: OfferingSource.CURRICULUM,
            theoryEnabled: cs.theoryEnabled,
            practicalEnabled: cs.practicalEnabled,
            internalAssessmentEnabled: cs.internalAssessmentEnabled,
            examEnabled: cs.examEnabled,
            maxMarks: cs.maxMarks,
            passMarks: cs.passMarks,
          },
        });
        createdCount++;
      }
    }

    this.logger.log(
      `School ${schoolId} initialized with ${curriculum.name}: ${createdCount} created, ${updatedCount} updated.`,
    );

    return {
      message: 'Recommended curriculum loaded successfully',
      board: curriculum.board.name,
      curriculum: curriculum.name,
      createdOfferings: createdCount,
      updatedOfferings: updatedCount,
      totalOfferings: createdCount + updatedCount,
    };
  }

  // -------------------------------------------------------------
  // SCHOOL SUBJECT OFFERINGS (Management)
  // -------------------------------------------------------------
  async getSchoolOfferings(schoolId: string, academicYearId?: string) {
    const validSchoolId = requireSchoolId(schoolId);
    const where: any = { schoolId: validSchoolId };

    if (academicYearId) {
      where.academicYearId = academicYearId;
    } else {
      const activeYear = await this.prisma.academicYear.findFirst({
        where: { schoolId: validSchoolId, isActive: true },
      });
      if (activeYear) {
        where.academicYearId = activeYear.id;
      }
    }

    return this.prisma.schoolSubjectOffering.findMany({
      where,
      include: {
        curriculum: {
          include: { board: true },
        },
        curriculumSubject: {
          include: { subjectGroup: true },
        },
        globalSubject: true,
        legacySubject: true,
      },
      orderBy: [{ gradeFrom: 'asc' }, { gradeTo: 'asc' }, { globalSubject: { name: 'asc' } }],
    });
  }

  async createSchoolOffering(schoolId: string, dto: CreateSchoolOfferingDto) {
    const validSchoolId = requireSchoolId(schoolId);
    const activeYear = await this.prisma.academicYear.findFirst({
      where: { schoolId: validSchoolId, isActive: true },
    });
    if (!activeYear) {
      throw new BadRequestException('No active Academic Year found for this school');
    }

    const school = await this.prisma.school.findUnique({
      where: { id: validSchoolId },
    });
    if (!school?.activeCurriculumId) {
      throw new BadRequestException('School does not have an active curriculum configured');
    }

    let globalSubjectId = dto.globalSubjectId;

    // If SCHOOL_CUSTOM, ensure global subject exists or create one
    if (dto.source === OfferingSource.SCHOOL_CUSTOM) {
      if (!dto.customName) {
        throw new BadRequestException('customName is required for custom school subjects');
      }

      if (!globalSubjectId) {
        const customCode = (dto.customCode || dto.customName.replace(/\s+/g, '_').toUpperCase()).slice(0, 20);
        const globalSub = await this.prisma.globalSubject.upsert({
          where: { code: customCode },
          update: { name: dto.customName },
          create: {
            code: customCode,
            name: dto.customName,
            category: dto.subjectType || SubjectClassification.ADDITIONAL,
            isCommon: false,
          },
        });
        globalSubjectId = globalSub.id;
      }
    }

    if (!globalSubjectId) {
      throw new BadRequestException('globalSubjectId is required');
    }

    // Bridge with legacy Subject table
    const subjectName = dto.customName || (await this.prisma.globalSubject.findUnique({ where: { id: globalSubjectId } }))?.name || 'Subject';
    let legacySubject = await this.prisma.subject.findFirst({
      where: { schoolId: validSchoolId, name: subjectName },
    });
    if (!legacySubject) {
      legacySubject = await this.prisma.subject.create({
        data: {
          schoolId: validSchoolId,
          name: subjectName,
          code: dto.customCode,
          isElective: dto.selectionType === SubjectSelectionType.ELECTIVE,
          isActive: true,
        },
      });
    }

    return this.prisma.schoolSubjectOffering.create({
      data: {
        schoolId: validSchoolId,
        curriculumId: school.activeCurriculumId,
        academicYearId: activeYear.id,
        curriculumSubjectId: dto.curriculumSubjectId || null,
        globalSubjectId,
        legacySubjectId: legacySubject.id,
        customName: dto.customName,
        customCode: dto.customCode,
        source: dto.source || OfferingSource.CURRICULUM,
        gradeFrom: dto.gradeFrom,
        gradeTo: dto.gradeTo,
        periodsPerWeek: dto.periodsPerWeek || 5,
        isOffered: true,
        subjectType: dto.subjectType || SubjectClassification.CORE,
        selectionType: dto.selectionType || SubjectSelectionType.MANDATORY,
        theoryEnabled: dto.theoryEnabled !== false,
        practicalEnabled: !!dto.practicalEnabled,
        internalAssessmentEnabled: !!dto.internalAssessmentEnabled,
        examEnabled: dto.examEnabled !== false,
        maxMarks: dto.maxMarks || 100,
        passMarks: dto.passMarks || 35,
      },
      include: {
        globalSubject: true,
        curriculumSubject: true,
        legacySubject: true,
      },
    });
  }

  async updateSchoolOffering(schoolId: string, id: string, dto: UpdateSchoolOfferingDto) {
    const validSchoolId = requireSchoolId(schoolId);
    const offering = await this.prisma.schoolSubjectOffering.findFirst({
      where: { id, schoolId: validSchoolId },
    });

    if (!offering) {
      throw new NotFoundException(`School subject offering with ID "${id}" not found`);
    }

    return this.prisma.schoolSubjectOffering.update({
      where: { id: offering.id },
      data: {
        ...dto,
      },
      include: {
        globalSubject: true,
        curriculumSubject: true,
        legacySubject: true,
      },
    });
  }

  async deleteSchoolOffering(schoolId: string, id: string) {
    const validSchoolId = requireSchoolId(schoolId);
    const offering = await this.prisma.schoolSubjectOffering.findFirst({
      where: { id, schoolId: validSchoolId },
    });

    if (!offering) {
      throw new NotFoundException(`School subject offering with ID "${id}" not found`);
    }

    // Soft-deactivate to prevent breaking historical marks, assignments, or report cards!
    return this.prisma.schoolSubjectOffering.update({
      where: { id: offering.id },
      data: { isOffered: false },
    });
  }

  // -------------------------------------------------------------
  // CLASS-WISE OFFERINGS
  // -------------------------------------------------------------
  async getClassOfferings(schoolId: string, classId: string) {
    const validSchoolId = requireSchoolId(schoolId);
    const classRecord = await this.prisma.class.findFirst({
      where: { id: classId, schoolId: validSchoolId },
    });

    if (!classRecord) {
      throw new NotFoundException(`Class with ID "${classId}" not found`);
    }

    // Calculate actual grade level (1-10)
    // E.g., "Class 8" or numericLevel (where 3 is Class 1, ..., 12 is Class 10)
    let gradeLevel = 1;
    const nameMatch = classRecord.name.match(/\d+/);
    if (nameMatch) {
      gradeLevel = parseInt(nameMatch[0], 10);
    } else if (classRecord.numericLevel >= 3 && classRecord.numericLevel <= 12) {
      gradeLevel = classRecord.numericLevel - 2;
    }

    const activeYear = await this.prisma.academicYear.findFirst({
      where: { schoolId: validSchoolId, isActive: true },
    });

    return this.prisma.schoolSubjectOffering.findMany({
      where: {
        schoolId: validSchoolId,
        academicYearId: activeYear?.id,
        isOffered: true,
        gradeFrom: { lte: gradeLevel },
        gradeTo: { gte: gradeLevel },
      },
      include: {
        globalSubject: true,
        curriculumSubject: {
          include: { subjectGroup: true },
        },
        legacySubject: true,
      },
      orderBy: [{ subjectType: 'asc' }, { globalSubject: { name: 'asc' } }],
    });
  }

  // -------------------------------------------------------------
  // STUDENT SUBJECT ENROLLMENTS (Electives & Languages)
  // -------------------------------------------------------------
  async getStudentEnrollments(schoolId: string, studentId: string) {
    const validSchoolId = requireSchoolId(schoolId);
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, schoolId: validSchoolId },
    });
    if (!student) {
      throw new NotFoundException(`Student with ID "${studentId}" not found`);
    }

    return this.prisma.studentSubjectEnrollment.findMany({
      where: {
        studentId,
        schoolSubjectOffering: { schoolId: validSchoolId },
      },
      include: {
        schoolSubjectOffering: {
          include: {
            globalSubject: true,
            curriculumSubject: {
              include: { subjectGroup: true },
            },
            legacySubject: true,
          },
        },
      },
      orderBy: { schoolSubjectOffering: { globalSubject: { name: 'asc' } } },
    });
  }

  async enrollStudentSubjects(schoolId: string, studentId: string, dto: EnrollStudentSubjectsDto) {
    const validSchoolId = requireSchoolId(schoolId);
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, schoolId: validSchoolId },
      include: {
        enrollments: {
          where: { status: 'ACTIVE' },
          include: { section: { include: { class: true } } },
          take: 1,
        },
      },
    });

    if (!student) {
      throw new NotFoundException(`Student with ID "${studentId}" not found`);
    }

    const currentEnrollment = student.enrollments[0];
    if (!currentEnrollment) {
      throw new BadRequestException('Student has no active class enrollment');
    }

    const activeYear = await this.prisma.academicYear.findFirst({
      where: { schoolId: validSchoolId, isActive: true },
    });
    if (!activeYear) {
      throw new BadRequestException('No active Academic Year found');
    }

    // Verify all requested offering IDs belong to this school and are active
    const offerings = await this.prisma.schoolSubjectOffering.findMany({
      where: {
        id: { in: dto.offeringIds },
        schoolId: validSchoolId,
        isOffered: true,
      },
      include: {
        globalSubject: true,
        curriculumSubject: { include: { subjectGroup: true } },
      },
    });

    if (offerings.length !== dto.offeringIds.length) {
      throw new BadRequestException('One or more selected offerings are invalid or not offered by the school');
    }

    // Upsert student enrollments inside a transaction
    await this.prisma.$transaction(async (tx) => {
      // Deactivate unselected enrollments for this academic year
      await tx.studentSubjectEnrollment.updateMany({
        where: {
          studentId,
          academicYearId: activeYear.id,
          schoolSubjectOfferingId: { notIn: dto.offeringIds },
        },
        data: { status: 'DROPPED' },
      });

      // Upsert selected
      for (const off of offerings) {
        await tx.studentSubjectEnrollment.upsert({
          where: {
            studentId_schoolSubjectOfferingId_academicYearId: {
              studentId,
              schoolSubjectOfferingId: off.id,
              academicYearId: activeYear.id,
            },
          },
          update: {
            status: 'ACTIVE',
            enrollmentType: off.selectionType,
          },
          create: {
            studentId,
            schoolSubjectOfferingId: off.id,
            academicYearId: activeYear.id,
            enrollmentType: off.selectionType,
            status: 'ACTIVE',
          },
        });
      }
    });

    return this.getStudentEnrollments(validSchoolId, studentId);
  }

  // -------------------------------------------------------------
  // CURRICULUM SUMMARY / STATUS
  // -------------------------------------------------------------
  async getCurriculumSummary(schoolId: string) {
    const validSchoolId = requireSchoolId(schoolId);
    const school = await this.prisma.school.findUnique({
      where: { id: validSchoolId },
      include: {
        board: true,
      },
    });

    if (!school) {
      throw new NotFoundException('School not found');
    }

    let activeCurriculum = null;
    if (school.activeCurriculumId) {
      activeCurriculum = await this.prisma.curriculum.findUnique({
        where: { id: school.activeCurriculumId },
        include: {
          board: true,
          subjectGroups: true,
        },
      });
    }

    const offerings = await this.prisma.schoolSubjectOffering.findMany({
      where: { schoolId: validSchoolId, isOffered: true },
      include: {
        globalSubject: true,
        curriculumSubject: true,
      },
    });

    const byGrade: Record<number, number> = {};
    for (let g = 1; g <= 10; g++) {
      byGrade[g] = offerings.filter((o) => o.gradeFrom <= g && o.gradeTo >= g).length;
    }

    return {
      schoolName: school.name,
      board: school.board,
      curriculum: activeCurriculum,
      totalOfferings: offerings.length,
      customOfferingsCount: offerings.filter((o) => o.source === OfferingSource.SCHOOL_CUSTOM).length,
      gradeOfferingsCount: byGrade,
      isConfigured: !!school.boardId && !!school.activeCurriculumId && offerings.length > 0,
    };
  }

  // -------------------------------------------------------------
  // SYNC OFFERINGS TO CLASS SUBJECTS
  // -------------------------------------------------------------
  async syncClassSubjects(schoolId: string, classId: string) {
    const validSchoolId = requireSchoolId(schoolId);
    const classOfferings = await this.getClassOfferings(validSchoolId, classId);
    let synced = 0;

    for (const off of classOfferings) {
      if (off.legacySubjectId) {
        await this.prisma.classSubject.upsert({
          where: {
            classId_subjectId: {
              classId,
              subjectId: off.legacySubjectId,
            },
          },
          update: {},
          create: {
            classId,
            subjectId: off.legacySubjectId,
          },
        });
        synced++;
      }
    }

    return {
      message: `Synced ${synced} curriculum subjects to ClassSubject mapping`,
      syncedCount: synced,
    };
  }

  // -------------------------------------------------------------
  // SECTION STUDENTS ENROLLMENTS
  // -------------------------------------------------------------
  async getSectionStudentEnrollments(schoolId: string, sectionId: string) {
    const validSchoolId = requireSchoolId(schoolId);
    const section = await this.prisma.section.findFirst({
      where: { id: sectionId, class: { schoolId: validSchoolId } },
      include: {
        class: true,
        enrollments: {
          where: { status: 'ACTIVE' },
          include: {
            student: {
              include: {
                user: {
                  select: { firstName: true, lastName: true, avatarUrl: true },
                },
                subjectEnrollments: {
                  where: { status: 'ACTIVE' },
                  include: {
                    schoolSubjectOffering: {
                      include: {
                        globalSubject: true,
                        curriculumSubject: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!section) {
      throw new NotFoundException('Section not found');
    }

    const classOfferings = await this.getClassOfferings(schoolId, section.classId);

    return {
      section: {
        id: section.id,
        name: section.name,
        class: section.class,
      },
      availableOfferings: classOfferings,
      students: section.enrollments.map((e) => ({
        id: e.student.id,
        admissionNumber: e.student.admissionNumber,
        rollNumber: e.student.rollNumber,
        name: `${e.student.user.firstName} ${e.student.user.lastName}`,
        enrolledOfferingIds: e.student.subjectEnrollments.map(
          (se) => se.schoolSubjectOfferingId,
        ),
      })),
    };
  }
}
