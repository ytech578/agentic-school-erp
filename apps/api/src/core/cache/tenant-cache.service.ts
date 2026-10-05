import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { RedisService } from './redis.service';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class TenantCacheService {
  private readonly logger = new Logger(TenantCacheService.name);

  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Enterprise Caching Layer: Resolves and caches the active academic year for a school.
   * This is called on almost every request for Timetable, Reports, Attendance, etc.
   * Caching this saves a significant amount of redundant database queries.
   */
  async resolveActiveYear(
    schoolId: string,
    requestedId?: string,
  ): Promise<string> {
    // If a specific ID/name is requested, check cache for that specific resolution
    if (
      requestedId &&
      requestedId !== 'undefined' &&
      requestedId !== 'null' &&
      requestedId.trim() !== ''
    ) {
      const trimmed = requestedId.trim();
      const normalizedName = trimmed.replace(/^AY[-_]?/i, '');
      const cacheKey = `school:${schoolId}:ay_res:${trimmed}`;

      const cached = await this.redis.get(cacheKey);
      if (cached) return cached;

      const year = await this.prisma.academicYear.findFirst({
        where: {
          schoolId,
          OR: [{ id: trimmed }, { name: trimmed }, { name: normalizedName }],
        },
      });

      if (year) {
        // Cache resolution mapping for 24 hours
        await this.redis.set(cacheKey, year.id, 86400);
        return year.id;
      }
    }

    // Default to the globally active academic year for the school
    const activeKey = `school:${schoolId}:ay_active`;
    const cachedActive = await this.redis.get(activeKey);
    if (cachedActive) return cachedActive;

    const ay = await this.prisma.academicYear.findFirst({
      where: { schoolId, isActive: true },
    });

    if (ay) {
      await this.redis.set(activeKey, ay.id, 86400);
      return ay.id;
    }

    // Fallback to the latest year if none is marked active
    const latest = await this.prisma.academicYear.findFirst({
      where: { schoolId },
      orderBy: { startDate: 'desc' },
    });

    if (latest) {
      await this.redis.set(activeKey, latest.id, 86400);
      return latest.id;
    }

    throw new NotFoundException('Active academic year not found');
  }

  /**
   * Invalidates the active academic year cache.
   * Call this when an admin changes the active academic year.
   */
  async invalidateActiveYear(schoolId: string): Promise<void> {
    await this.redis.del(`school:${schoolId}:ay_active`);
  }

  // ─── Reference Data Caching ──────────────────────────────────────────────────

  async getDepartments(schoolId: string) {
    const cacheKey = `school:${schoolId}:departments`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const depts = await this.prisma.department.findMany({
      where: { schoolId },
      orderBy: { name: 'asc' },
    });

    await this.redis.set(cacheKey, JSON.stringify(depts), 86400 * 7); // Cache for 7 days
    return depts;
  }

  async invalidateDepartments(schoolId: string): Promise<void> {
    await this.redis.del(`school:${schoolId}:departments`);
  }

  async getDesignations(schoolId: string) {
    const cacheKey = `school:${schoolId}:designations`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const designations = await this.prisma.designation.findMany({
      where: { schoolId, isActive: true },
      orderBy: { name: 'asc' },
    });

    await this.redis.set(cacheKey, JSON.stringify(designations), 86400 * 7);
    return designations;
  }

  async invalidateDesignations(schoolId: string): Promise<void> {
    await this.redis.del(`school:${schoolId}:designations`);
  }

  async getClassesAndSections(schoolId: string) {
    const cacheKey = `school:${schoolId}:classes_sections`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const classes = await this.prisma.class.findMany({
      where: { schoolId },
      orderBy: { numericLevel: 'asc' },
      include: {
        sections: {
          orderBy: { name: 'asc' },
        },
      },
    });

    await this.redis.set(cacheKey, JSON.stringify(classes), 86400 * 7); // Cache for 7 days
    return classes;
  }

  async invalidateClassesAndSections(schoolId: string): Promise<void> {
    await this.redis.del(`school:${schoolId}:classes_sections`);
  }
}
