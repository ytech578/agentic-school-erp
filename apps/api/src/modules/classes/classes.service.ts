import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { requireSchoolId } from '../../core/tenant/tenant.util';

@Injectable()
export class ClassesService {
  constructor(private prisma: PrismaService) {}

  async findAll(schoolId: string) {
    const validSchoolId = requireSchoolId(schoolId, 'List classes');
    return this.prisma.class.findMany({
      where: { schoolId: validSchoolId },
      include: {
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

  async createClass(
    schoolId: string,
    data: {
      name: string;
      numericLevel?: number;
      academicYearId?: string;
      sections?: string[];
    },
  ) {
    const validSchoolId = requireSchoolId(schoolId, 'Create class');

    let resolvedYearId = data.academicYearId;
    if (!resolvedYearId) {
      const activeYear =
        (await this.prisma.academicYear.findFirst({
          where: { schoolId: validSchoolId, isActive: true },
        })) ||
        (await this.prisma.academicYear.findFirst({
          where: { schoolId: validSchoolId },
        }));
      if (!activeYear) {
        throw new BadRequestException('No active academic year found for this school');
      }
      resolvedYearId = activeYear.id;
    }

    const cleanName = data.name.trim();
    const numericLevel =
      data.numericLevel ?? (parseInt(cleanName.replace(/\D/g, ''), 10) || 1);

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
      throw new ConflictException(`Class "${cleanName}" already exists for this academic session`);
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

  async updateClass(
    schoolId: string,
    classId: string,
    data: { name?: string; numericLevel?: number },
  ) {
    const validSchoolId = requireSchoolId(schoolId, 'Update class');
    const existing = await this.prisma.class.findFirst({
      where: { id: classId, schoolId: validSchoolId },
    });
    if (!existing) throw new NotFoundException('Class not found');

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
        sections: {
          include: {
            _count: { select: { enrollments: true } },
          },
        },
      },
    });
    if (!existing) throw new NotFoundException('Class not found');

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
    return { success: true, message: `Class ${existing.name} deleted successfully` };
  }

  async createSection(
    schoolId: string,
    classId: string,
    data: { name: string; capacity?: number; roomNumber?: string },
  ) {
    const validSchoolId = requireSchoolId(schoolId, 'Create section');
    const existingClass = await this.prisma.class.findFirst({
      where: { id: classId, schoolId: validSchoolId },
    });
    if (!existingClass) throw new NotFoundException('Class not found');

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
      throw new ConflictException(`Section ${cleanName} already exists in ${existingClass.name}`);
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

  async deleteSection(schoolId: string, sectionId: string) {
    const validSchoolId = requireSchoolId(schoolId, 'Delete section');
    const existing = await this.prisma.section.findFirst({
      where: { id: sectionId, class: { schoolId: validSchoolId } },
      include: { _count: { select: { enrollments: true } } },
    });
    if (!existing) throw new NotFoundException('Section not found');

    if (existing._count.enrollments > 0) {
      throw new BadRequestException(
        `Cannot delete section with ${existing._count.enrollments} active student enrollments.`,
      );
    }

    await this.prisma.section.delete({ where: { id: sectionId } });
    return { success: true, message: `Section ${existing.name} deleted` };
  }

  async findAllSubjects(schoolId: string) {
    const validSchoolId = requireSchoolId(schoolId, 'List subjects');
    return this.prisma.subject.findMany({
      where: { schoolId: validSchoolId, isActive: true },
      orderBy: { name: 'asc' },
    });
  }
}
