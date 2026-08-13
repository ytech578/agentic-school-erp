import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { CreateStudentInput, UpdateStudentInput } from '@school-erp/shared';
import * as bcrypt from 'bcryptjs';
import { Prisma, Gender, BloodGroup } from '@prisma/client';

@Injectable()
export class StudentsService {
  constructor(private readonly prisma: PrismaService) {}

  async createStudent(schoolId: string, data: CreateStudentInput) {
    // Check if user email already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new ConflictException('Email address is already in use');
    }

    // Check if admission number exists in this school
    const existingStudent = await this.prisma.student.findUnique({
      where: {
        schoolId_admissionNumber: {
          schoolId,
          admissionNumber: data.admissionNumber,
        },
      },
    });

    if (existingStudent) {
      throw new ConflictException(`Admission number ${data.admissionNumber} is already in use`);
    }

    // Default password for new students (could be configured per school or randomly generated)
    // For MVP, using a standard temporary password logic
    const tempPassword = `Std@${data.dateOfBirth?.split('-')[0] || '2026'}`;
    const hashedPassword = await bcrypt.hash(tempPassword, 12);

    return this.prisma.$transaction(async (tx) => {
      // 1. Create User record
      const user = await tx.user.create({
        data: {
          email: data.email,
          passwordHash: hashedPassword,
          firstName: data.firstName,
          lastName: data.lastName,
          role: 'STUDENT',
          schoolId,
          phone: data.phone,
        },
      });

      // 2. Create Student record
      const student = await tx.student.create({
        data: {
          schoolId,
          userId: user.id,
          admissionNumber: data.admissionNumber,
          rollNumber: data.rollNumber,
          dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
          gender: data.gender as Gender,
          bloodGroup: (data.bloodGroup as BloodGroup) || 'UNKNOWN',
          religion: data.religion,
          caste: data.caste,
          nationality: data.nationality || 'Indian',
          aadhaarNumber: data.aadhaarNumber,
          address: data.address,
          city: data.city,
          state: data.state,
          pinCode: data.pinCode,
          medicalNotes: data.medicalNotes,
          previousSchool: data.previousSchool,
          admissionDate: data.admissionDate ? new Date(data.admissionDate) : new Date(),
        },
      });

      // 3. Create Guardian record if details provided
      if (data.guardianFirstName && data.guardianRelationship) {
        await tx.guardian.create({
          data: {
            studentId: student.id,
            firstName: data.guardianFirstName,
            lastName: data.guardianLastName || '',
            relationship: data.guardianRelationship,
            phone: data.guardianPhone || '',
            email: data.guardianEmail || null,
            isPrimary: true,
          },
        });
      }

      return {
        ...student,
        user: {
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
        }
      };
    });
  }

  async getStudents(schoolId: string, page = 1, limit = 10, search?: string) {
    const skip = (page - 1) * limit;

    const where: Prisma.StudentWhereInput = {
      schoolId,
      ...(search
        ? {
            OR: [
              { admissionNumber: { contains: search, mode: 'insensitive' } },
              { user: { firstName: { contains: search, mode: 'insensitive' } } },
              { user: { lastName: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [total, students] = await Promise.all([
      this.prisma.student.count({ where }),
      this.prisma.student.findMany({
        where,
        skip,
        take: limit,
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
              avatarUrl: true,
            },
          },
          guardians: {
            where: { isPrimary: true },
            select: {
              firstName: true,
              lastName: true,
              phone: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      items: students,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getStudentById(schoolId: string, id: string) {
    const student = await this.prisma.student.findFirst({
      where: { id, schoolId },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            avatarUrl: true,
          },
        },
        guardians: true,
      },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    return student;
  }
}
