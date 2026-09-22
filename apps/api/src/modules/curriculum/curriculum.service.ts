import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import {
  InitializeCurriculumDto,
  CreateSchoolOfferingDto,
  UpdateSchoolOfferingDto,
  EnrollStudentSubjectsDto,
  CreateBoardDto,
  UpdateBoardDto,
  CreateCurriculumDto,
  UpdateCurriculumDto,
  CreateSubjectGroupDto,
  UpdateSubjectGroupDto,
} from './dto/curriculum.dto';
import {
  OfferingSource,
  SubjectClassification,
  SubjectSelectionType,
} from '@prisma/client';
import { requireSchoolId } from '../../core/tenant/tenant.util';
import { resolveGradeLevel } from '../../core/academic/grade-resolver.util';

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

  async getBoardById(id: string) {
    const board = await this.prisma.board.findUnique({
      where: { id },
      include: {
        curriculums: {
          orderBy: { version: 'desc' },
        },
      },
    });
    if (!board) throw new NotFoundException('Board not found');
    return board;
  }

  async createBoard(dto: CreateBoardDto) {
    const existing = await this.prisma.board.findUnique({
      where: { code: dto.code.trim().toUpperCase() },
    });
    if (existing) {
      throw new ConflictException(`Board code '${dto.code}' already exists`);
    }
    return this.prisma.board.create({
      data: {
        name: dto.name.trim(),
        code: dto.code.trim().toUpperCase(),
        category: (dto.category as any) || 'CBSE',
        description: dto.description?.trim(),
      },
    });
  }

  async updateBoard(id: string, dto: UpdateBoardDto) {
    const existing = await this.prisma.board.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Board not found');
    return this.prisma.board.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        code: dto.code ? dto.code.trim().toUpperCase() : undefined,
        category: dto.category as any,
        description:
          dto.description !== undefined ? dto.description?.trim() : undefined,
        isActive: dto.isActive,
      },
    });
  }

  async getCurriculumById(id: string) {
    const curriculum = await this.prisma.curriculum.findUnique({
      where: { id },
      include: {
        board: true,
        subjectGroups: {
          orderBy: { sortOrder: 'asc' },
          include: { subjects: true },
        },
      },
    });
    if (!curriculum) throw new NotFoundException('Curriculum not found');
    return curriculum;
  }

  async createCurriculum(dto: CreateCurriculumDto) {
    const board = await this.prisma.board.findUnique({
      where: { id: dto.boardId },
    });
    if (!board) throw new NotFoundException('Parent Board not found');

    const existing = await this.prisma.curriculum.findFirst({
      where: { boardId: dto.boardId, code: dto.code.trim().toUpperCase() },
    });
    if (existing) {
      throw new ConflictException(
        `Curriculum code '${dto.code}' already exists for this board`,
      );
    }

    return this.prisma.curriculum.create({
      data: {
        boardId: dto.boardId,
        name: dto.name.trim(),
        code: dto.code.trim().toUpperCase(),
        version: dto.version.trim(),
        description: dto.description?.trim(),
        isActive: true,
      },
      include: { board: true },
    });
  }

  async updateCurriculum(id: string, dto: UpdateCurriculumDto) {
    const existing = await this.prisma.curriculum.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Curriculum not found');
    return this.prisma.curriculum.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        version: dto.version?.trim(),
        description:
          dto.description !== undefined ? dto.description?.trim() : undefined,
        isActive: dto.isActive,
      },
    });
  }

  async getSubjectGroups(curriculumId: string) {
    return this.prisma.subjectGroup.findMany({
      where: { curriculumId },
      include: {
        subjects: {
          where: { isActive: true },
          include: { globalSubject: true },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async getSubjectGroupById(id: string) {
    const group = await this.prisma.subjectGroup.findUnique({
      where: { id },
      include: {
        curriculum: true,
        subjects: { include: { globalSubject: true } },
      },
    });
    if (!group) throw new NotFoundException('Subject group not found');
    return group;
  }

  async createSubjectGroup(curriculumId: string, dto: CreateSubjectGroupDto) {
    const curriculum = await this.prisma.curriculum.findUnique({
      where: { id: curriculumId },
    });
    if (!curriculum) throw new NotFoundException('Curriculum not found');

    const existing = await this.prisma.subjectGroup.findFirst({
      where: { curriculumId, code: dto.code.trim().toUpperCase() },
    });
    if (existing) {
      throw new ConflictException(
        `Subject group code '${dto.code}' already exists in this curriculum`,
      );
    }

    const count = await this.prisma.subjectGroup.count({
      where: { curriculumId },
    });

    return this.prisma.subjectGroup.create({
      data: {
        curriculumId,
        name: dto.name.trim(),
        code: dto.code.trim().toUpperCase(),
        description: dto.description?.trim(),
        minSelection: dto.minSelection ?? dto.minSubjects ?? 0,
        maxSelection: dto.maxSelection ?? dto.maxSubjects,
        isRequired: dto.isRequired ?? true,
        sortOrder: dto.sortOrder ?? count + 1,
      },
    });
  }

  async updateSubjectGroup(id: string, dto: UpdateSubjectGroupDto) {
    const existing = await this.prisma.subjectGroup.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Subject group not found');
    return this.prisma.subjectGroup.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        description:
          dto.description !== undefined ? dto.description?.trim() : undefined,
        minSelection: dto.minSelection ?? dto.minSubjects,
        maxSelection: dto.maxSelection ?? dto.maxSubjects,
        isRequired: dto.isRequired,
        sortOrder: dto.sortOrder,
      },
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
      throw new NotFoundException(
        `Curriculum with ID "${curriculumId}" not found`,
      );
    }

    return curriculum;
  }

  // -------------------------------------------------------------
  // SCHOOL ONBOARDING & "LOAD RECOMMENDED CURRICULUM"
  // -------------------------------------------------------------
  async initializeSchoolCurriculum(
    schoolId: string,
    dto: InitializeCurriculumDto,
  ) {
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
      throw new NotFoundException(
        `School with ID "${validSchoolId}" not found`,
      );
    }

    const board = await this.prisma.board.findUnique({
      where: { id: dto.boardId },
    });
    if (!board) {
      throw new NotFoundException(`Board with ID "${dto.boardId}" not found`);
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
      throw new NotFoundException(
        `Curriculum with ID "${dto.curriculumId}" not found`,
      );
    }

    if (curriculum.boardId !== dto.boardId) {
      throw new BadRequestException(
        'Selected curriculum does not belong to the requested education board',
      );
    }

    // Determine target academic year and validate lock / school ownership
    let targetYear: any;
    if (dto.academicYearId) {
      targetYear = await this.prisma.academicYear.findFirst({
        where: { id: dto.academicYearId, schoolId: validSchoolId },
      });
      if (!targetYear) {
        throw new NotFoundException('Academic year not found for this school');
      }
    } else {
      targetYear = school.academicYears[0];
      if (!targetYear) {
        throw new BadRequestException(
          'No active Academic Year found for this school',
        );
      }
    }

    if (targetYear.isLocked) {
      throw new BadRequestException(
        `Academic session '${targetYear.name}' is locked. Structural changes are not permitted.`,
      );
    }
    const academicYearId = targetYear.id;

    if (!curriculum.subjects || curriculum.subjects.length === 0) {
      throw new BadRequestException(
        'Curriculum framework has no active subjects configured',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Update school's board and active curriculum
      await tx.school.update({
        where: { id: validSchoolId },
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
        let legacySubject = await tx.subject.findFirst({
          where: {
            schoolId: validSchoolId,
            name: cs.displayName,
          },
        });

        if (!legacySubject) {
          // Also try matching by global subject name
          legacySubject = await tx.subject.findFirst({
            where: {
              schoolId: validSchoolId,
              name: cs.globalSubject.name,
            },
          });
        }

        if (!legacySubject) {
          legacySubject = await tx.subject.create({
            data: {
              schoolId: validSchoolId,
              name: cs.displayName,
              code: cs.subjectCode,
              isElective: cs.selectionType === SubjectSelectionType.ELECTIVE,
              isActive: true,
            },
          });
        }

        // Upsert SchoolSubjectOffering
        const existing = await tx.schoolSubjectOffering.findFirst({
          where: {
            schoolId: validSchoolId,
            academicYearId,
            globalSubjectId: cs.globalSubjectId,
            gradeFrom: cs.gradeFrom,
            gradeTo: cs.gradeTo,
          },
        });

        if (existing) {
          await tx.schoolSubjectOffering.update({
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
          await tx.schoolSubjectOffering.create({
            data: {
              schoolId: validSchoolId,
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
        `School ${validSchoolId} initialized with ${curriculum.name}: ${createdCount} created, ${updatedCount} updated.`,
      );

      return {
        message: 'Recommended curriculum loaded successfully',
        board: curriculum.board.name,
        curriculum: curriculum.name,
        createdOfferings: createdCount,
        updatedOfferings: updatedCount,
        totalOfferings: createdCount + updatedCount,
      };
    });
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
      orderBy: [
        { gradeFrom: 'asc' },
        { gradeTo: 'asc' },
        { globalSubject: { name: 'asc' } },
      ],
    });
  }

  async createSchoolOffering(schoolId: string, dto: CreateSchoolOfferingDto) {
    const validSchoolId = requireSchoolId(schoolId);

    const maxMarks = dto.maxMarks ?? 100;
    const passMarks = dto.passMarks ?? 35;
    if (maxMarks <= 0 || passMarks < 0 || passMarks > maxMarks) {
      throw new BadRequestException(
        'Invalid marks configuration: passMarks must be between 0 and maxMarks, and maxMarks > 0',
      );
    }

    if (dto.gradeFrom < 1 || dto.gradeTo > 12 || dto.gradeFrom > dto.gradeTo) {
      throw new BadRequestException(
        'Invalid grade range: gradeFrom and gradeTo must be between 1 and 12, and gradeFrom <= gradeTo',
      );
    }

    if (dto.periodsPerWeek !== undefined && dto.periodsPerWeek <= 0) {
      throw new BadRequestException('periodsPerWeek must be greater than 0');
    }

    // 1. Resolve and validate target academic year
    let targetYear: any;
    if (dto.academicYearId) {
      targetYear = await this.prisma.academicYear.findFirst({
        where: { id: dto.academicYearId, schoolId: validSchoolId },
      });
      if (!targetYear) {
        throw new NotFoundException('Academic year not found for this school');
      }
    } else {
      targetYear = await this.prisma.academicYear.findFirst({
        where: { schoolId: validSchoolId, isActive: true },
      });
      if (!targetYear) {
        throw new BadRequestException(
          'No active Academic Year found for this school',
        );
      }
    }

    if (targetYear.isLocked) {
      throw new BadRequestException(
        `Academic session '${targetYear.name}' is locked. Structural changes are not permitted.`,
      );
    }

    const school = await this.prisma.school.findUnique({
      where: { id: validSchoolId },
    });
    if (!school) {
      throw new NotFoundException('School not found');
    }

    // 2. Resolve and validate curriculum
    const targetCurriculumId = dto.curriculumId || school.activeCurriculumId;
    if (!targetCurriculumId) {
      throw new BadRequestException(
        'School does not have an active curriculum configured',
      );
    }
    if (dto.curriculumId) {
      const curriculum = await this.prisma.curriculum.findUnique({
        where: { id: dto.curriculumId },
      });
      if (!curriculum) {
        throw new NotFoundException('Curriculum not found');
      }
    }

    let globalSubjectId = dto.globalSubjectId;

    // 3. If curriculumSubjectId provided, validate belongs to curriculum and matches globalSubjectId
    if (dto.curriculumSubjectId) {
      const cs = await this.prisma.curriculumSubject.findUnique({
        where: { id: dto.curriculumSubjectId },
      });
      if (!cs) {
        throw new NotFoundException('Curriculum subject not found');
      }
      if (cs.curriculumId !== targetCurriculumId) {
        throw new BadRequestException(
          'Curriculum subject does not belong to the target curriculum',
        );
      }
      if (globalSubjectId && globalSubjectId !== cs.globalSubjectId) {
        throw new BadRequestException(
          'Specified globalSubjectId contradicts the specified curriculum subject',
        );
      }
      if (!globalSubjectId) {
        globalSubjectId = cs.globalSubjectId;
      }
    }

    // 4. If SCHOOL_CUSTOM, ensure global subject exists or create one without mutating master
    if (dto.source === OfferingSource.SCHOOL_CUSTOM) {
      if (!dto.customName) {
        throw new BadRequestException(
          'customName is required for custom school subjects',
        );
      }

      if (!globalSubjectId) {
        const customCode = (
          dto.customCode || dto.customName.replace(/\s+/g, '_').toUpperCase()
        ).slice(0, 20);

        let existingGlobal: any = null;
        if (this.prisma.globalSubject.findUnique) {
          existingGlobal = await this.prisma.globalSubject.findUnique({
            where: { code: customCode },
          });
        }

        if (existingGlobal) {
          const cleanCustomName = dto.customName.trim().toLowerCase();
          const cleanExistingName = existingGlobal.name.trim().toLowerCase();
          if (cleanCustomName !== cleanExistingName) {
            throw new ConflictException(
              `Subject code "${customCode}" conflicts with existing global subject "${existingGlobal.name}". Choose a distinct code or matching name.`,
            );
          }
          globalSubjectId = existingGlobal.id;
        } else {
          let globalSub: any = null;
          if (this.prisma.globalSubject.upsert) {
            globalSub = await this.prisma.globalSubject.upsert({
              where: { code: customCode },
              update: {}, // Preserve global master data immutability
              create: {
                code: customCode,
                name: dto.customName.trim(),
                category: dto.subjectType || SubjectClassification.ADDITIONAL,
                isCommon: false,
              },
            });
          } else if (this.prisma.globalSubject.create) {
            globalSub = await this.prisma.globalSubject.create({
              data: {
                code: customCode,
                name: dto.customName.trim(),
                category: dto.subjectType || SubjectClassification.ADDITIONAL,
                isCommon: false,
              },
            });
          }

          if (globalSub) {
            const cleanCustomName = dto.customName.trim().toLowerCase();
            const cleanExistingName = globalSub.name.trim().toLowerCase();
            if (cleanCustomName !== cleanExistingName) {
              throw new ConflictException(
                `Subject code "${customCode}" conflicts with existing global subject "${globalSub.name}". Choose a distinct code or matching name.`,
              );
            }
            globalSubjectId = globalSub.id;
          }
        }
      }
    }

    if (!globalSubjectId) {
      throw new BadRequestException('globalSubjectId is required');
    }

    // 5. Prevent duplicate offering in the same academic session & grade band
    const duplicate = await this.prisma.schoolSubjectOffering.findFirst({
      where: {
        schoolId: validSchoolId,
        academicYearId: targetYear.id,
        globalSubjectId,
        gradeFrom: dto.gradeFrom,
        gradeTo: dto.gradeTo,
      },
    });
    if (duplicate) {
      throw new ConflictException(
        'A subject offering for this subject and grade band already exists in this academic session',
      );
    }

    // Bridge with legacy Subject table
    const subjectName =
      dto.customName ||
      (
        await this.prisma.globalSubject.findUnique({
          where: { id: globalSubjectId },
        })
      )?.name ||
      'Subject';
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
        curriculumId: targetCurriculumId,
        academicYearId: targetYear.id,
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

  async getSchoolOfferingById(schoolId: string, id: string) {
    const validSchoolId = requireSchoolId(schoolId);
    const offering = await this.prisma.schoolSubjectOffering.findFirst({
      where: { id, schoolId: validSchoolId },
      include: {
        globalSubject: true,
        curriculumSubject: true,
        legacySubject: true,
        academicYear: true,
        _count: {
          select: {
            studentEnrollments: { where: { status: 'ACTIVE' } },
            teacherAssignments: true,
          },
        },
      },
    });

    if (!offering) {
      throw new NotFoundException(
        `School subject offering with ID "${id}" not found`,
      );
    }

    return offering;
  }

  async updateSchoolOffering(
    schoolId: string,
    id: string,
    dto: UpdateSchoolOfferingDto,
  ) {
    const validSchoolId = requireSchoolId(schoolId);
    const offering = await this.prisma.schoolSubjectOffering.findFirst({
      where: { id, schoolId: validSchoolId },
      include: { academicYear: true },
    });

    if (!offering) {
      throw new NotFoundException(
        `School subject offering with ID "${id}" not found`,
      );
    }

    if (offering.academicYear?.isLocked) {
      throw new BadRequestException(
        `Academic session '${offering.academicYear.name}' is locked. Structural changes are not permitted.`,
      );
    }

    const maxMarks = dto.maxMarks ?? offering.maxMarks;
    const passMarks = dto.passMarks ?? offering.passMarks;
    if (maxMarks <= 0 || passMarks < 0 || passMarks > maxMarks) {
      throw new BadRequestException(
        'Invalid marks configuration: passMarks must be between 0 and maxMarks, and maxMarks > 0',
      );
    }

    // Step 9: Strictly whitelist mutable configuration properties.
    // Disallow ordinary update of immutable identity fields:
    // schoolId, academicYearId, curriculumId, globalSubjectId, legacySubjectId, source.
    const updateData: any = {};
    if (dto.periodsPerWeek !== undefined)
      updateData.periodsPerWeek = dto.periodsPerWeek;
    if (dto.isOffered !== undefined) updateData.isOffered = dto.isOffered;
    if (dto.subjectType !== undefined) updateData.subjectType = dto.subjectType;
    if (dto.selectionType !== undefined)
      updateData.selectionType = dto.selectionType;
    if (dto.theoryEnabled !== undefined)
      updateData.theoryEnabled = dto.theoryEnabled;
    if (dto.practicalEnabled !== undefined)
      updateData.practicalEnabled = dto.practicalEnabled;
    if (dto.internalAssessmentEnabled !== undefined)
      updateData.internalAssessmentEnabled = dto.internalAssessmentEnabled;
    if (dto.examEnabled !== undefined) updateData.examEnabled = dto.examEnabled;
    if (dto.maxMarks !== undefined) updateData.maxMarks = dto.maxMarks;
    if (dto.passMarks !== undefined) updateData.passMarks = dto.passMarks;

    return this.prisma.schoolSubjectOffering.update({
      where: { id: offering.id },
      data: updateData,
      include: {
        globalSubject: true,
        curriculumSubject: true,
        legacySubject: true,
      },
    });
  }

  async toggleOfferingStatus(schoolId: string, id: string, isOffered: boolean) {
    const validSchoolId = requireSchoolId(schoolId);
    const offering = await this.prisma.schoolSubjectOffering.findFirst({
      where: { id, schoolId: validSchoolId },
      include: { academicYear: true },
    });

    if (!offering) {
      throw new NotFoundException(
        `School subject offering with ID "${id}" not found`,
      );
    }

    if (offering.academicYear?.isLocked) {
      throw new BadRequestException(
        `Academic session '${offering.academicYear.name}' is locked. Structural changes are not permitted.`,
      );
    }

    return this.prisma.schoolSubjectOffering.update({
      where: { id: offering.id },
      data: { isOffered },
    });
  }

  async deleteSchoolOffering(schoolId: string, id: string) {
    const validSchoolId = requireSchoolId(schoolId);
    const offering = await this.prisma.schoolSubjectOffering.findFirst({
      where: { id, schoolId: validSchoolId },
      include: { academicYear: true },
    });

    if (!offering) {
      throw new NotFoundException(
        `School subject offering with ID "${id}" not found`,
      );
    }

    if (offering.academicYear?.isLocked) {
      throw new BadRequestException(
        `Academic session '${offering.academicYear.name}' is locked. Structural changes are not permitted.`,
      );
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

    // Calculate actual grade level (1-12)
    const gradeLevel = resolveGradeLevel(classRecord);

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
  async getStudentEnrollments(
    schoolId: string,
    studentId: string,
    academicYearId?: string,
  ) {
    const validSchoolId = requireSchoolId(schoolId);
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, schoolId: validSchoolId },
    });
    if (!student) {
      throw new NotFoundException(`Student with ID "${studentId}" not found`);
    }

    const whereClause: any = {
      studentId,
      schoolSubjectOffering: { schoolId: validSchoolId },
    };
    if (academicYearId) {
      whereClause.academicYearId = academicYearId;
    }

    return this.prisma.studentSubjectEnrollment.findMany({
      where: whereClause,
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

  async enrollStudentSubjects(
    schoolId: string,
    studentId: string,
    dto: EnrollStudentSubjectsDto,
  ) {
    const validSchoolId = requireSchoolId(schoolId);

    // 1. Deterministic academic year resolution: explicit academicYearId or active session
    let targetYear: any;
    if (dto.academicYearId) {
      targetYear = await this.prisma.academicYear.findFirst({
        where: { id: dto.academicYearId, schoolId: validSchoolId },
      });
      if (!targetYear) {
        throw new NotFoundException('Academic year not found for this school');
      }
    } else {
      targetYear = await this.prisma.academicYear.findFirst({
        where: { schoolId: validSchoolId, isActive: true },
      });
      if (!targetYear) {
        throw new BadRequestException(
          'No active Academic Year found for this school',
        );
      }
    }

    if (targetYear.isLocked) {
      throw new BadRequestException(
        `Academic session '${targetYear.name}' is locked. Structural changes are not permitted.`,
      );
    }

    // 2. Validate student exists in this school
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, schoolId: validSchoolId },
      include: {
        enrollments: {
          where: { status: 'ACTIVE', academicYearId: targetYear.id },
          include: {
            section: { include: { class: true } },
            academicYear: true,
          },
        },
      },
    });

    if (!student) {
      throw new NotFoundException(`Student with ID "${studentId}" not found`);
    }

    // 3. Resolve student's active enrollment for the exact target academic session
    let currentEnrollment: any;
    if (student.enrollments && student.enrollments.length > 0) {
      currentEnrollment = student.enrollments.find(
        (e: any) =>
          e.status === 'ACTIVE' &&
          (!e.academicYearId || e.academicYearId === targetYear.id),
      );
    }

    if (!currentEnrollment) {
      currentEnrollment = await this.prisma.studentEnrollment.findFirst({
        where: {
          studentId,
          academicYearId: targetYear.id,
          status: 'ACTIVE',
          section: { class: { schoolId: validSchoolId } },
        },
        include: {
          section: { include: { class: true } },
          academicYear: true,
        },
      });
    }

    if (!currentEnrollment) {
      throw new BadRequestException(
        `Student has no active class enrollment in academic session "${targetYear.name || targetYear.id}"`,
      );
    }

    if (
      currentEnrollment.section?.class?.schoolId &&
      currentEnrollment.section.class.schoolId !== validSchoolId
    ) {
      throw new BadRequestException(
        'Student active enrollment does not belong to this school',
      );
    }

    const enrollmentYear = currentEnrollment.academicYear || targetYear;

    // 4. Authoritative student grade resolution
    const studentGrade = resolveGradeLevel(currentEnrollment.section?.class);

    // 5. Verify all requested offering IDs belong to this school and are active (reject duplicates in request)
    const uniqueOfferingIds = Array.from(new Set(dto.offeringIds));
    if (uniqueOfferingIds.length !== dto.offeringIds.length) {
      throw new BadRequestException(
        'Duplicate subject offering IDs provided in registration',
      );
    }

    const offerings = await this.prisma.schoolSubjectOffering.findMany({
      where: {
        id: { in: uniqueOfferingIds },
        schoolId: validSchoolId,
        isOffered: true,
      },
      include: {
        globalSubject: true,
        curriculumSubject: { include: { subjectGroup: true } },
      },
    });

    if (offerings.length !== uniqueOfferingIds.length) {
      throw new BadRequestException(
        'One or more selected offerings are invalid or not offered by the school',
      );
    }

    // Enforce elective selection constraints
    const groupSelectionCounts = new Map<
      string,
      { count: number; max?: number | null; name: string }
    >();

    for (const off of offerings) {
      if (off.academicYearId !== enrollmentYear.id) {
        throw new BadRequestException(
          `Subject offering "${off.id}" belongs to a different academic session`,
        );
      }
      if (studentGrade < off.gradeFrom || studentGrade > off.gradeTo) {
        throw new BadRequestException(
          `Subject offering "${off.globalSubject?.name || off.customName || off.id}" is only valid for grades ${off.gradeFrom} to ${off.gradeTo}, but student is enrolled in Grade ${studentGrade}`,
        );
      }

      const group = off.curriculumSubject?.subjectGroup;
      if (group) {
        const cur = groupSelectionCounts.get(group.id) || {
          count: 0,
          max: group.maxSelection,
          name: group.name,
        };
        cur.count++;
        if (cur.max && cur.count > cur.max) {
          throw new BadRequestException(
            `Incompatible elective selection: Subject group "${group.name}" permits a maximum of ${cur.max} subject(s), but ${cur.count} were selected`,
          );
        }
        groupSelectionCounts.set(group.id, cur);
      }
    }

    // Upsert student enrollments inside a transaction
    await this.prisma.$transaction(async (tx) => {
      // Deactivate unselected enrollments for this academic year
      await tx.studentSubjectEnrollment.updateMany({
        where: {
          studentId,
          academicYearId: enrollmentYear.id,
          schoolSubjectOfferingId: { notIn: uniqueOfferingIds },
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
              academicYearId: enrollmentYear.id,
            },
          },
          update: {
            status: 'ACTIVE',
            enrollmentType: off.selectionType,
          },
          create: {
            studentId,
            schoolSubjectOfferingId: off.id,
            academicYearId: enrollmentYear.id,
            enrollmentType: off.selectionType,
            status: 'ACTIVE',
          },
        });
      }
    });

    return this.getStudentEnrollments(
      validSchoolId,
      studentId,
      enrollmentYear.id,
    );
  }

  async unenrollStudentSubject(
    schoolId: string,
    studentId: string,
    offeringId: string,
  ) {
    const validSchoolId = requireSchoolId(schoolId);
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, schoolId: validSchoolId },
    });
    if (!student) {
      throw new NotFoundException(`Student with ID "${studentId}" not found`);
    }

    const enrollment = await this.prisma.studentSubjectEnrollment.findFirst({
      where: {
        studentId,
        schoolSubjectOfferingId: offeringId,
        schoolSubjectOffering: { schoolId: validSchoolId },
      },
      include: { academicYear: true },
    });

    if (!enrollment) {
      throw new NotFoundException('Student subject enrollment not found');
    }

    if (enrollment.academicYear?.isLocked) {
      throw new BadRequestException(
        `Academic session '${enrollment.academicYear.name}' is locked. Structural changes are not permitted.`,
      );
    }

    await this.prisma.studentSubjectEnrollment.delete({
      where: { id: enrollment.id },
    });

    return { success: true, message: 'Student subject enrollment removed' };
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
      byGrade[g] = offerings.filter(
        (o) => o.gradeFrom <= g && o.gradeTo >= g,
      ).length;
    }

    return {
      schoolName: school.name,
      board: school.board,
      curriculum: activeCurriculum,
      totalOfferings: offerings.length,
      customOfferingsCount: offerings.filter(
        (o) => o.source === OfferingSource.SCHOOL_CUSTOM,
      ).length,
      gradeOfferingsCount: byGrade,
      isConfigured:
        !!school.boardId && !!school.activeCurriculumId && offerings.length > 0,
    };
  }

  // -------------------------------------------------------------
  // SYNC OFFERINGS TO CLASS SUBJECTS
  // -------------------------------------------------------------
  async syncClassSubjects(schoolId: string, classId: string) {
    const validSchoolId = requireSchoolId(schoolId);
    const classRecord = await this.prisma.class.findFirst({
      where: { id: classId, schoolId: validSchoolId },
      include: { academicYear: true },
    });
    if (!classRecord) {
      throw new NotFoundException(`Class with ID "${classId}" not found`);
    }
    if (classRecord.academicYear?.isLocked) {
      throw new BadRequestException(
        `Academic session '${classRecord.academicYear.name}' is locked. Structural changes are not permitted.`,
      );
    }
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

    const classOfferings = await this.getClassOfferings(
      schoolId,
      section.classId,
    );

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
