import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { CreateStaffInput } from '@school-erp/shared';
import * as bcrypt from 'bcryptjs';
import { Prisma, EmploymentType, Gender, BloodGroup } from '@prisma/client';

@Injectable()
export class StaffService {
  constructor(private prisma: PrismaService) {}

  async createStaff(schoolId: string, data: CreateStaffInput) {
    // 1. Check if user email already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: data.email.toLowerCase() },
    });

    if (existingUser) {
      throw new ConflictException('Email already in use');
    }

    // 2. Check if employee ID is unique within school
    const existingStaff = await this.prisma.staff.findUnique({
      where: {
        schoolId_employeeId: {
          schoolId,
          employeeId: data.employeeId,
        },
      },
    });

    if (existingStaff) {
      throw new ConflictException('Employee ID already exists');
    }

    // Default password: first name + last 4 of phone (or 1234)
    const phoneSuffix = data.phone ? data.phone.slice(-4) : '1234';
    const defaultPassword = `${data.firstName.toLowerCase()}@${phoneSuffix}`;
    const hashedPassword = await bcrypt.hash(defaultPassword, 12);

    // 3. Create User & Staff in transaction
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: data.email.toLowerCase(),
          passwordHash: hashedPassword,
          firstName: data.firstName,
          lastName: data.lastName,
          role: data.role,
          schoolId,
          phone: data.phone,
          status: 'ACTIVE',
        },
      });

      const staff = await tx.staff.create({
        data: {
          schoolId,
          userId: user.id,
          employeeId: data.employeeId,
          departmentId: data.departmentId,
          designationId: data.designationId,
          employmentType: data.employmentType as EmploymentType,
          gender: data.gender as Gender | undefined,
          bloodGroup: data.bloodGroup as BloodGroup,
          dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
          joinDate: new Date(data.joinDate),
          address: data.address,
          aadhaarNumber: data.aadhaarNumber,
          panNumber: data.panNumber,
          isActive: true,
        },
      });

      return {
        ...staff,
        user: {
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
        }
      };
    });
  }

  async getStaffList(schoolId: string, page = 1, limit = 10, search?: string) {
    const skip = (page - 1) * limit;

    const where: Prisma.StaffWhereInput = {
      schoolId,
      ...(search
        ? {
            OR: [
              { employeeId: { contains: search, mode: 'insensitive' } },
              { user: { firstName: { contains: search, mode: 'insensitive' } } },
              { user: { lastName: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [total, staffList] = await Promise.all([
      this.prisma.staff.count({ where }),
      this.prisma.staff.findMany({
        where,
        skip,
        take: limit,
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
              role: true,
              avatarUrl: true,
            },
          },
          department: {
            select: { name: true }
          },
          designation: {
            select: { name: true }
          }
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      items: staffList,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getStaffById(schoolId: string, id: string) {
    const staff = await this.prisma.staff.findFirst({
      where: { id, schoolId },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            role: true,
            avatarUrl: true,
          },
        },
        department: true,
        designation: true,
      },
    });

    if (!staff) {
      throw new NotFoundException('Staff not found');
    }

    return staff;
  }

  async getDepartments(schoolId: string) {
    return this.prisma.department.findMany({
      where: { schoolId },
      orderBy: { name: 'asc' }
    });
  }

  async getDesignations(schoolId: string) {
    return this.prisma.designation.findMany({
      where: { schoolId, isActive: true },
      orderBy: { name: 'asc' }
    });
  }
}
