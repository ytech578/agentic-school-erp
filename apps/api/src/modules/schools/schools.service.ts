import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../core/database/prisma.service';
import { requireSchoolId } from '../../core/tenant/tenant.util';
import { CreateSchoolDto, UpdateSchoolDto } from './dto/create-school.dto';

@Injectable()
export class SchoolsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Retrieves all onboarded schools in the system with live metric counts.
   * Ordered by most recently created first.
   */
  async findAll() {
    return this.prisma.school.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            students: true,
            users: true,
            departments: true,
          },
        },
        academicYears: {
          where: { isActive: true },
          take: 1,
          select: { id: true, name: true, startDate: true, endDate: true },
        },
      },
    });
  }

  /**
   * Finds a school by ID.
   */
  async findById(id: string) {
    const school = await this.prisma.school.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            students: true,
            users: true,
            departments: true,
            subjects: true,
          },
        },
        academicYears: {
          orderBy: { startDate: 'desc' },
        },
        departments: {
          where: { isActive: true },
        },
      },
    });
    if (!school) throw new NotFoundException('School not found');
    return school;
  }

  /**
   * Finds the current active school for the user's session context.
   */
  async findCurrent(schoolId: string) {
    const validSchoolId = requireSchoolId(schoolId);
    const school = await this.prisma.school.findUnique({
      where: { id: validSchoolId },
      include: {
        academicYears: {
          where: { isActive: true },
          take: 1,
        },
        _count: {
          select: {
            students: true,
            users: true,
            departments: true,
          },
        },
      },
    });
    if (!school) throw new NotFoundException('School not found');
    return school;
  }

  /**
   * Atomically onboards a new school campus with full initial provisioning:
   * 1. Creates the School record.
   * 2. Creates the default active Academic Year.
   * 3. Seeds starter standard academic & administrative departments.
   * 4. Optionally creates the initial School Administrator account.
   * 5. Creates an audit trail ActivityLog entry.
   */
  async createSchool(data: CreateSchoolDto, creatorUserId?: string) {
    const normalizedCode = data.code.trim().toUpperCase();

    // 1. Verify code uniqueness
    const existingCode = await this.prisma.school.findUnique({
      where: { code: normalizedCode },
    });
    if (existingCode) {
      throw new ConflictException(
        `A school with code '${normalizedCode}' already exists (${existingCode.name}). Please use a unique school code.`,
      );
    }

    // 2. If initial admin email provided, verify email uniqueness
    if (data.adminEmail) {
      const normalizedAdminEmail = data.adminEmail.trim().toLowerCase();
      const existingEmail = await this.prisma.user.findUnique({
        where: { email: normalizedAdminEmail },
      });
      if (existingEmail) {
        throw new ConflictException(
          `User with email '${normalizedAdminEmail}' already exists in the platform.`,
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      // Create School record
      const school = await tx.school.create({
        data: {
          name: data.name.trim(),
          code: normalizedCode,
          boardType: data.boardType || 'CBSE',
          affiliationNo: data.affiliationNo?.trim() || null,
          udiseCode: data.udiseCode?.trim() || null,
          principalName: data.principalName?.trim() || null,
          phone: data.phone?.trim() || null,
          email: data.email?.trim().toLowerCase() || null,
          website: data.website?.trim() || null,
          address: data.address?.trim() || null,
          city: data.city?.trim() || null,
          state: data.state?.trim() || null,
          pinCode: data.pinCode?.trim() || null,
          currency: 'INR',
          timezone: 'Asia/Kolkata',
          isActive: true,
        },
      });

      // Create Initial Active Academic Year
      const currentYear = new Date().getFullYear();
      const academicYearName =
        data.academicYearName?.trim() || `${currentYear}-${currentYear + 1}`;
      const startDate = new Date(currentYear, 3, 1); // April 1
      const endDate = new Date(currentYear + 1, 2, 31); // March 31 of next year

      const academicYear = await tx.academicYear.create({
        data: {
          schoolId: school.id,
          name: academicYearName,
          startDate,
          endDate,
          isActive: true,
        },
      });

      // Seed standard initial departments
      const starterDepartments = [
        {
          name: 'Science',
          code: 'SCI',
          desc: 'Physics, Chemistry, Biology & Laboratory Sciences',
        },
        {
          name: 'Mathematics',
          code: 'MATH',
          desc: 'Core & Applied Mathematics',
        },
        {
          name: 'Languages & Literature',
          code: 'LANG',
          desc: 'English, Hindi, and Regional Languages',
        },
        {
          name: 'Social Sciences',
          code: 'SOC',
          desc: 'History, Geography, Political Science & Economics',
        },
        {
          name: 'Administration & Operations',
          code: 'ADMIN',
          desc: 'School Operations, Accounts & Front Office',
        },
      ];

      for (const dept of starterDepartments) {
        await tx.department.create({
          data: {
            schoolId: school.id,
            name: dept.name,
            code: dept.code,
            description: dept.desc,
            isActive: true,
          },
        });
      }

      // Optionally create initial school admin account
      let initialAdmin = null;
      if (data.adminEmail && data.adminPassword) {
        const passwordHash = await bcrypt.hash(data.adminPassword, 12);
        initialAdmin = await tx.user.create({
          data: {
            schoolId: school.id,
            email: data.adminEmail.trim().toLowerCase(),
            passwordHash,
            firstName: data.adminFirstName?.trim() || 'School',
            lastName: data.adminLastName?.trim() || 'Admin',
            role: 'SCHOOL_ADMIN',
            status: 'ACTIVE',
            emailVerified: true,
          },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        });
      }

      // Log activity
      if (creatorUserId) {
        await tx.activityLog
          .create({
            data: {
              schoolId: school.id,
              userId: creatorUserId,
              action: 'CREATE',
              module: 'SCHOOL',
              description: `School campus '${school.name}' (${school.code}) onboarded successfully into the multi-tenant fleet.`,
            },
          })
          .catch(() => {});
      }

      return {
        school,
        academicYear,
        initialAdmin,
        departmentsCount: starterDepartments.length,
      };
    });
  }

  /**
   * Updates any school by ID (Super Admin action).
   */
  async updateSchoolById(id: string, data: UpdateSchoolDto) {
    const existing = await this.prisma.school.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('School not found');

    return this.prisma.school.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name.trim() }),
        ...(data.boardType !== undefined && { boardType: data.boardType }),
        ...(data.affiliationNo !== undefined && {
          affiliationNo: data.affiliationNo?.trim() || null,
        }),
        ...(data.udiseCode !== undefined && {
          udiseCode: data.udiseCode?.trim() || null,
        }),
        ...(data.principalName !== undefined && {
          principalName: data.principalName?.trim() || null,
        }),
        ...(data.phone !== undefined && { phone: data.phone?.trim() || null }),
        ...(data.email !== undefined && {
          email: data.email?.trim().toLowerCase() || null,
        }),
        ...(data.website !== undefined && {
          website: data.website?.trim() || null,
        }),
        ...(data.address !== undefined && {
          address: data.address?.trim() || null,
        }),
        ...(data.city !== undefined && { city: data.city?.trim() || null }),
        ...(data.state !== undefined && { state: data.state?.trim() || null }),
        ...(data.pinCode !== undefined && {
          pinCode: data.pinCode?.trim() || null,
        }),
      },
    });
  }

  /**
   * Updates the current school for the current session.
   */
  async updateSchool(schoolId: string, data: any) {
    const validSchoolId = requireSchoolId(schoolId);
    return this.updateSchoolById(validSchoolId, data);
  }

  /**
   * Toggles the active status of a school campus.
   */
  async toggleSchoolStatus(id: string, isActive: boolean) {
    const school = await this.prisma.school.findUnique({ where: { id } });
    if (!school) throw new NotFoundException('School not found');

    return this.prisma.school.update({
      where: { id },
      data: { isActive },
    });
  }

  /**
   * Retrieves academic years for a school.
   */
  async getAcademicYears(schoolId: string) {
    const validSchoolId = requireSchoolId(schoolId);
    return this.prisma.academicYear.findMany({
      where: { schoolId: validSchoolId },
      orderBy: { startDate: 'desc' },
    });
  }

  /**
   * Creates an academic year for a school.
   */
  async createAcademicYear(
    schoolId: string,
    data: { name: string; startDate: string; endDate: string },
  ) {
    const validSchoolId = requireSchoolId(schoolId);
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

    return this.prisma.$transaction(async (tx) => {
      // Deactivate existing active years to enforce single-active invariant
      await tx.academicYear.updateMany({
        where: { schoolId: validSchoolId, isActive: true },
        data: { isActive: false },
      });

      return tx.academicYear.create({
        data: {
          schoolId: validSchoolId,
          name: data.name.trim(),
          startDate,
          endDate,
          isActive: true,
        },
      });
    });
  }

  /**
   * Sets the active academic year for a school.
   */
  async setActiveAcademicYear(schoolId: string, yearId: string) {
    const validSchoolId = requireSchoolId(schoolId);

    return this.prisma.$transaction(async (tx) => {
      const year = await tx.academicYear.findFirst({
        where: { id: yearId, schoolId: validSchoolId },
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
}
