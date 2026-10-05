import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { requireSchoolId } from '../tenant/tenant.util';

export interface ResolveAcademicYearOptions {
  schoolId: string;
  requestedId?: string;
  isMutation?: boolean;
}

/**
 * Authoritative Centralized Academic Year Resolution Utility.
 * Deduplicates scattered and redundant resolution logic across Fees, Exams, Classes, Curriculum, and Students.
 */
export async function resolveActiveAcademicYear(
  prisma: PrismaService,
  options: ResolveAcademicYearOptions,
): Promise<{ id: string; name: string; isLocked: boolean; [key: string]: any }> {
  const validSchoolId = requireSchoolId(options.schoolId, 'Resolve academic year');
  const { requestedId, isMutation = false } = options;

  if (
    requestedId &&
    requestedId !== 'undefined' &&
    requestedId !== 'null' &&
    requestedId.trim() !== ''
  ) {
    const trimmed = requestedId.trim();
    const normalizedName = trimmed.replace(/^AY[-_]?/i, '');
    const year = await prisma.academicYear.findFirst({
      where: {
        schoolId: validSchoolId,
        OR: [{ id: trimmed }, { name: trimmed }, { name: normalizedName }],
      },
    });
    if (year) {
      if (isMutation && year.isLocked) {
        throw new BadRequestException('Academic year is locked against modifications');
      }
      return year;
    }
    throw new NotFoundException('Academic year not found for this school');
  }

  // 1. Check globally active academic year for the school
  const activeYear = await prisma.academicYear.findFirst({
    where: { schoolId: validSchoolId, isActive: true },
  });
  if (activeYear) {
    if (isMutation && activeYear.isLocked) {
      throw new BadRequestException('Active academic year is locked against modifications');
    }
    return activeYear;
  }

  // 2. If mutation and no active year is set, fail-closed
  if (isMutation) {
    throw new BadRequestException(
      'No active academic year found for this school. Please specify an explicit academicYearId.',
    );
  }

  // 3. Fallback to chronologically most recent academic year
  const latestYear = await prisma.academicYear.findFirst({
    where: { schoolId: validSchoolId },
    orderBy: { startDate: 'desc' },
  });
  if (latestYear) {
    return latestYear;
  }

  throw new BadRequestException('No active academic year found for this school');
}
