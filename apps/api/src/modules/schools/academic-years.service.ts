import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { requireSchoolId } from '../../core/tenant/tenant.util';
import {
  CreateAcademicYearDto,
  UpdateAcademicYearDto,
} from './dto/academic-year.dto';

@Injectable()
export class AcademicYearsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Retrieves all academic sessions for a school.
   */
  async getAcademicYears(schoolId: string) {
    const validSchoolId = requireSchoolId(schoolId, 'List academic years');
    return this.prisma.academicYear.findMany({
      where: { schoolId: validSchoolId },
      orderBy: { startDate: 'desc' },
      include: {
        _count: {
          select: {
            classes: true,
            schoolSubjectOfferings: true,
            teacherAssignments: true,
            studentEnrollments: true,
          },
        },
      },
    });
  }

  /**
   * Retrieves a single academic session by ID with relation counts.
   */
  async getAcademicYearById(schoolId: string, id: string) {
    const validSchoolId = requireSchoolId(schoolId, 'Get academic year');
    const year = await this.prisma.academicYear.findFirst({
      where: { id, schoolId: validSchoolId },
      include: {
        _count: {
          select: {
            classes: true,
            schoolSubjectOfferings: true,
            teacherAssignments: true,
            studentEnrollments: true,
          },
        },
      },
    });

    if (!year) {
      throw new NotFoundException('Academic year not found');
    }

    return year;
  }

  /**
   * Creates an academic year for a school.
   * Atomically sets it as active if requested or if it's the first session.
   */
  async createAcademicYear(schoolId: string, data: CreateAcademicYearDto) {
    const validSchoolId = requireSchoolId(schoolId, 'Create academic year');
    const startDate = new Date(data.startDate);
    const endDate = new Date(data.endDate);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new BadRequestException('Invalid startDate or endDate format');
    }

    if (startDate >= endDate) {
      throw new BadRequestException(
        'Academic year startDate must be strictly before endDate',
      );
    }

    const cleanName = data.name.trim();

    return this.prisma.$transaction(async (tx) => {
      // Check for duplicate name within this school
      const existing = await tx.academicYear.findUnique({
        where: {
          schoolId_name: {
            schoolId: validSchoolId,
            name: cleanName,
          },
        },
      });

      if (existing) {
        throw new BadRequestException(
          `Academic session '${cleanName}' already exists for this school`,
        );
      }

      // Check if this school has any active years
      const hasActive = await tx.academicYear.findFirst({
        where: { schoolId: validSchoolId, isActive: true },
      });

      // If no active year exists, default this one to active
      const shouldBeActive = !hasActive;

      return tx.academicYear.create({
        data: {
          schoolId: validSchoolId,
          name: cleanName,
          startDate,
          endDate,
          isActive: shouldBeActive,
          isLocked: false,
        },
      });
    });
  }

  /**
   * Updates an academic year.
   * Disallows modifying date bounds if the session is locked.
   */
  async updateAcademicYear(
    schoolId: string,
    id: string,
    data: UpdateAcademicYearDto,
  ) {
    const validSchoolId = requireSchoolId(schoolId, 'Update academic year');
    const year = await this.prisma.academicYear.findFirst({
      where: { id, schoolId: validSchoolId },
    });

    if (!year) {
      throw new NotFoundException('Academic year not found');
    }

    if (year.isLocked) {
      throw new BadRequestException(
        'Academic year is locked. Structural changes are not permitted.',
      );
    }

    const startDate = data.startDate
      ? new Date(data.startDate)
      : year.startDate;
    const endDate = data.endDate ? new Date(data.endDate) : year.endDate;

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new BadRequestException('Invalid startDate or endDate format');
    }

    if (startDate >= endDate) {
      throw new BadRequestException(
        'Academic year startDate must be strictly before endDate',
      );
    }

    const cleanName = data.name ? data.name.trim() : undefined;
    if (cleanName && cleanName !== year.name) {
      const duplicate = await this.prisma.academicYear.findFirst({
        where: {
          schoolId: validSchoolId,
          name: cleanName,
          id: { not: year.id },
        },
      });
      if (duplicate) {
        throw new ConflictException(
          `Academic session '${cleanName}' already exists for this school`,
        );
      }
    }

    return this.prisma.academicYear.update({
      where: { id: year.id },
      data: {
        name: cleanName || year.name,
        startDate,
        endDate,
      },
    });
  }

  /**
   * Sets an academic year as active for a school.
   * Atomically deactivates any other active sessions.
   */
  async setActiveAcademicYear(schoolId: string, id: string) {
    const validSchoolId = requireSchoolId(schoolId, 'Activate academic year');

    return this.prisma.$transaction(async (tx) => {
      const year = await tx.academicYear.findFirst({
        where: { id, schoolId: validSchoolId },
      });
      if (!year) {
        throw new NotFoundException('Academic year not found');
      }

      // Deactivate all for this school, then activate selected
      await tx.academicYear.updateMany({
        where: { schoolId: validSchoolId, isActive: true },
        data: { isActive: false },
      });

      return tx.academicYear.update({
        where: { id: year.id },
        data: { isActive: true },
      });
    });
  }

  /**
   * Locks or unlocks an academic year.
   * When locked, structural changes (classes, sections, offerings, assignments) are rejected.
   */
  async setLockAcademicYear(schoolId: string, id: string, isLocked: boolean) {
    const validSchoolId = requireSchoolId(
      schoolId,
      'Lock/Unlock academic year',
    );
    const year = await this.prisma.academicYear.findFirst({
      where: { id, schoolId: validSchoolId },
    });

    if (!year) {
      throw new NotFoundException('Academic year not found');
    }

    return this.prisma.academicYear.update({
      where: { id: year.id },
      data: { isLocked },
    });
  }

  /**
   * Helper to assert that an academic year is not locked.
   * Throws BadRequestException if locked or not found.
   */
  async assertYearNotLocked(schoolId: string, yearId: string): Promise<void> {
    const validSchoolId = requireSchoolId(schoolId, 'Assert year lock status');
    const year = await this.prisma.academicYear.findFirst({
      where: { id: yearId, schoolId: validSchoolId },
    });

    if (!year) {
      throw new NotFoundException('Academic year not found');
    }

    if (year.isLocked) {
      throw new BadRequestException(
        `Academic session '${year.name}' is locked. Structural changes are not permitted.`,
      );
    }
  }
}
