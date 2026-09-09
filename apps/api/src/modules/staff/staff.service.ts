import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { CreateStaffInput, UpdateStaffInput } from '@school-erp/shared';
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
          gender: data.gender,
          bloodGroup: data.bloodGroup,
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
        },
      };
    });
  }

  async getStaffList(schoolId: string, page = 1, limit = 10, search?: string, includeSubjects = false) {
    const skip = (page - 1) * limit;

    const where: Prisma.StaffWhereInput = {
      schoolId,
      ...(search
        ? {
            OR: [
              { employeeId: { contains: search, mode: 'insensitive' } },
              {
                user: { firstName: { contains: search, mode: 'insensitive' } },
              },
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
            select: { name: true },
          },
          designation: {
            select: { name: true },
          },
          ...(includeSubjects ? { teacherAssignments: { include: { subject: true } } } : {}),
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
      orderBy: { name: 'asc' },
    });
  }

  async getDesignations(schoolId: string) {
    return this.prisma.designation.findMany({
      where: { schoolId, isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async updateStaff(schoolId: string, id: string, data: UpdateStaffInput) {
    const staff = await this.prisma.staff.findUnique({
      where: { id, schoolId },
      include: { user: true },
    });

    if (!staff) {
      throw new NotFoundException('Staff not found');
    }

    if (data.email && data.email.toLowerCase() !== staff.user.email) {
      const existingUser = await this.prisma.user.findUnique({
        where: { email: data.email.toLowerCase() },
      });
      if (existingUser) {
        throw new ConflictException('Email already in use');
      }
    }

    if (data.employeeId && data.employeeId !== staff.employeeId) {
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
    }

    return this.prisma.$transaction(async (tx) => {
      // Update User fields
      const userUpdateData: any = {};
      if (data.firstName) userUpdateData.firstName = data.firstName;
      if (data.lastName) userUpdateData.lastName = data.lastName;
      if (data.email) userUpdateData.email = data.email.toLowerCase();
      if (data.phone) userUpdateData.phone = data.phone;
      if (data.role) userUpdateData.role = data.role;

      if (Object.keys(userUpdateData).length > 0) {
        await tx.user.update({
          where: { id: staff.userId },
          data: userUpdateData,
        });
      }

      // Update Staff fields
      const staffUpdateData: any = {};
      if (data.employeeId) staffUpdateData.employeeId = data.employeeId;
      if (data.departmentId) staffUpdateData.departmentId = data.departmentId;
      if (data.designationId) staffUpdateData.designationId = data.designationId;
      if (data.employmentType) staffUpdateData.employmentType = data.employmentType as EmploymentType;
      if (data.gender) staffUpdateData.gender = data.gender;
      if (data.bloodGroup) staffUpdateData.bloodGroup = data.bloodGroup;
      if (data.dateOfBirth) staffUpdateData.dateOfBirth = new Date(data.dateOfBirth);
      if (data.joinDate) staffUpdateData.joinDate = new Date(data.joinDate);
      if (data.address !== undefined) staffUpdateData.address = data.address;
      if (data.aadhaarNumber !== undefined) staffUpdateData.aadhaarNumber = data.aadhaarNumber;
      if (data.panNumber !== undefined) staffUpdateData.panNumber = data.panNumber;

      let updatedStaff = staff;
      if (Object.keys(staffUpdateData).length > 0) {
        updatedStaff = await tx.staff.update({
          where: { id: staff.id },
          data: staffUpdateData,
          include: { user: true, department: true, designation: true },
        });
      }

      return {
        ...updatedStaff,
        user: {
          firstName: updatedStaff.user.firstName,
          lastName: updatedStaff.user.lastName,
          email: updatedStaff.user.email,
        },
      };
    });
  }
}
