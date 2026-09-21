import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { CreateStudentInput, UpdateStudentInput } from '@school-erp/shared';
import * as bcrypt from 'bcryptjs';
import { Prisma, Gender, BloodGroup } from '@prisma/client';
import { requireSchoolId } from '../../core/tenant/tenant.util';

@Injectable()
export class StudentsService {
  constructor(private readonly prisma: PrismaService) {}

  async createStudent(schoolId: string, data: CreateStudentInput) {
    const validSchoolId = requireSchoolId(schoolId, 'Create student');

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
          schoolId: validSchoolId,
          admissionNumber: data.admissionNumber,
        },
      },
    });

    if (existingStudent) {
      throw new ConflictException(
        `Admission number ${data.admissionNumber} is already in use`,
      );
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
          schoolId: validSchoolId,
          phone: data.phone,
        },
      });

      // 2. Create Student record
      const student = await tx.student.create({
        data: {
          schoolId: validSchoolId,
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
          admissionDate: data.admissionDate
            ? new Date(data.admissionDate)
            : new Date(),
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
        },
      };
    });
  }

  async getStudents(
    schoolId: string,
    page = 1,
    limit = 10,
    search?: string,
    sectionId?: string,
    classId?: string,
  ) {
    const validSchoolId = requireSchoolId(schoolId, 'List students');
    const skip = (page - 1) * limit;

    const where: Prisma.StudentWhereInput = {
      schoolId: validSchoolId,
      ...(sectionId
        ? {
            enrollments: {
              some: {
                sectionId,
                status: 'ACTIVE',
              },
            },
          }
        : classId
          ? {
              enrollments: {
                some: {
                  section: { classId },
                  status: 'ACTIVE',
                },
              },
            }
          : {}),
      ...(search
        ? {
            OR: [
              { admissionNumber: { contains: search, mode: 'insensitive' } },
              {
                user: { firstName: { contains: search, mode: 'insensitive' } },
              },
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
          enrollments: {
            where: { status: 'ACTIVE' },
            include: {
              section: {
                include: { class: true },
              },
            },
          },
        },
        orderBy: { riskScore: 'desc' }, // Order by highest risk first for agentic view
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
    const validSchoolId = requireSchoolId(schoolId, 'Get student');
    const student = await this.prisma.student.findFirst({
      where: { id, schoolId: validSchoolId },
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

  async calculateRiskScores(schoolId: string) {
    const validSchoolId = requireSchoolId(schoolId, 'Calculate risk scores');

    // Fetch active academic year for financial ledger context
    const activeYear = await this.prisma.academicYear.findFirst({
      where: { schoolId: validSchoolId, isActive: true },
      select: { id: true },
    });

    const students = await this.prisma.student.findMany({
      where: { schoolId: validSchoolId, isActive: true },
      include: {
        attendance: true,
        enrollments: {
          where: { status: 'ACTIVE' },
          include: { section: { select: { classId: true } } },
          take: 1,
        },
        feePayments: activeYear
          ? { where: { academicYearId: activeYear.id } }
          : true,
      },
    });

    const structures: any[] = activeYear
      ? await this.prisma.feeStructure.findMany({
          where: {
            schoolId: validSchoolId,
            academicYearId: activeYear.id,
            isActive: true,
          },
          include: { items: true },
        })
      : [];

    let updatedCount = 0;

    for (const student of students) {
      let riskScore = 0;

      // 1. Attendance Risk
      const presentDays = student.attendance.filter(
        (a) => a.status === 'PRESENT',
      ).length;
      const totalDays = Math.max(student.attendance.length, 1);
      const attendancePct = (presentDays / totalDays) * 100;

      if (attendancePct < 75) {
        riskScore += 30; // High risk if attendance < 75%
      } else if (attendancePct < 85) {
        riskScore += 15; // Medium risk
      }

      // 2. Real Fee Default Risk
      const classId = student.enrollments[0]?.section?.classId;
      const structure = structures.find((s) => s.classId === classId);
      const totalFee =
        structure?.items?.reduce(
          (sum: number, item: any) => sum + Number(item.amount),
          0,
        ) || 0;
      const totalPaid = student.feePayments
        .filter(
          (p: any) =>
            p.paymentStatus === 'PAID' || p.paymentStatus === 'PARTIAL',
        )
        .reduce((sum: number, p: any) => sum + Number(p.paidAmount), 0);
      const pendingFees = Math.max(totalFee - totalPaid, 0);

      if (totalFee > 0 && pendingFees > 0) {
        const defaultRatio = pendingFees / totalFee;
        if (defaultRatio >= 0.5 || pendingFees >= 10000) {
          riskScore += 25; // Severe default risk (>50% unpaid or >= 10,000 due)
        } else if (defaultRatio >= 0.25 || pendingFees >= 5000) {
          riskScore += 15; // Moderate fee default risk
        } else {
          riskScore += 5; // Minor outstanding balance
        }
      }

      // Determine level
      let riskLevel: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' = 'NONE';
      if (riskScore >= 40) riskLevel = 'HIGH';
      else if (riskScore >= 20) riskLevel = 'MEDIUM';
      else if (riskScore > 0) riskLevel = 'LOW';

      // Update student
      await this.prisma.student.update({
        where: { id: student.id },
        data: { riskScore, riskLevel },
      });
      updatedCount++;
    }

    return { message: 'Risk scores updated successfully', updatedCount };
  }

  async updateStudent(schoolId: string, id: string, data: UpdateStudentInput) {
    const validSchoolId = requireSchoolId(schoolId, 'Update student');
    const student = await this.prisma.student.findFirst({
      where: { id, schoolId: validSchoolId },
      include: { user: true, guardians: true },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    if (
      data.email &&
      data.email.toLowerCase() !== student.user.email?.toLowerCase()
    ) {
      const existingUser = await this.prisma.user.findUnique({
        where: { email: data.email.toLowerCase() },
      });
      if (existingUser) {
        throw new ConflictException('Email already in use');
      }
    }

    if (
      data.admissionNumber &&
      data.admissionNumber !== student.admissionNumber
    ) {
      const existingStudent = await this.prisma.student.findUnique({
        where: {
          schoolId_admissionNumber: {
            schoolId,
            admissionNumber: data.admissionNumber,
          },
        },
      });
      if (existingStudent) {
        throw new ConflictException('Admission number already exists');
      }
    }

    return this.prisma.$transaction(async (tx) => {
      // Update User fields
      const userUpdateData: any = {};
      if (data.firstName !== undefined)
        userUpdateData.firstName = data.firstName;
      if (data.lastName !== undefined) userUpdateData.lastName = data.lastName;
      if (data.email !== undefined)
        userUpdateData.email = data.email.toLowerCase();
      if (data.phone !== undefined) userUpdateData.phone = data.phone;

      if (Object.keys(userUpdateData).length > 0) {
        await tx.user.update({
          where: { id: student.userId },
          data: userUpdateData,
        });
      }

      // Update Student fields
      const studentUpdateData: any = {};
      if (data.admissionNumber !== undefined)
        studentUpdateData.admissionNumber = data.admissionNumber;
      if (data.rollNumber !== undefined)
        studentUpdateData.rollNumber = data.rollNumber;
      if (data.dateOfBirth !== undefined)
        studentUpdateData.dateOfBirth = data.dateOfBirth
          ? new Date(data.dateOfBirth)
          : null;
      if (data.gender !== undefined) studentUpdateData.gender = data.gender;
      if (data.bloodGroup !== undefined)
        studentUpdateData.bloodGroup = data.bloodGroup as BloodGroup;
      if (data.religion !== undefined)
        studentUpdateData.religion = data.religion;
      if (data.caste !== undefined) studentUpdateData.caste = data.caste;
      if (data.nationality !== undefined)
        studentUpdateData.nationality = data.nationality;
      if (data.aadhaarNumber !== undefined)
        studentUpdateData.aadhaarNumber = data.aadhaarNumber;
      if (data.address !== undefined) studentUpdateData.address = data.address;
      if (data.city !== undefined) studentUpdateData.city = data.city;
      if (data.state !== undefined) studentUpdateData.state = data.state;
      if (data.pinCode !== undefined) studentUpdateData.pinCode = data.pinCode;
      if (data.medicalNotes !== undefined)
        studentUpdateData.medicalNotes = data.medicalNotes;
      if (data.previousSchool !== undefined)
        studentUpdateData.previousSchool = data.previousSchool;
      if (data.admissionDate !== undefined)
        studentUpdateData.admissionDate = data.admissionDate
          ? new Date(data.admissionDate)
          : null;

      if (Object.keys(studentUpdateData).length > 0) {
        await tx.student.update({
          where: { id: student.id },
          data: studentUpdateData,
        });
      }

      // Update Guardian if present
      if (
        data.guardianFirstName ||
        data.guardianLastName ||
        data.guardianRelationship ||
        data.guardianPhone ||
        data.guardianEmail !== undefined
      ) {
        const primaryGuardian =
          student.guardians.find((g: any) => g.isPrimary) ||
          student.guardians[0];

        if (primaryGuardian) {
          const guardianUpdateData: any = {};
          if (data.guardianFirstName !== undefined)
            guardianUpdateData.firstName = data.guardianFirstName;
          if (data.guardianLastName !== undefined)
            guardianUpdateData.lastName = data.guardianLastName;
          if (data.guardianRelationship !== undefined)
            guardianUpdateData.relationship = data.guardianRelationship;
          if (data.guardianPhone !== undefined)
            guardianUpdateData.phone = data.guardianPhone;
          if (data.guardianEmail !== undefined)
            guardianUpdateData.email = data.guardianEmail || null;

          await tx.guardian.update({
            where: { id: primaryGuardian.id },
            data: guardianUpdateData,
          });
        }
      }

      return this.getStudentById(schoolId, student.id);
    });
  }

  async promoteStudents(
    schoolId: string,
    promotedById: string,
    data: {
      fromSectionId: string;
      toSectionId?: string;
      studentIds: string[];
      academicYearId: string;
      remarks?: string;
      status?: 'PROMOTED' | 'GRADUATED';
    },
  ) {
    const validSchoolId = requireSchoolId(schoolId, 'Promote students');

    if (!data.studentIds || data.studentIds.length === 0) {
      throw new BadRequestException(
        'At least one student must be selected for promotion',
      );
    }

    const targetStatus =
      data.status || (data.toSectionId ? 'PROMOTED' : 'GRADUATED');

    return this.prisma.$transaction(async (tx) => {
      const results = [];

      for (const studentId of data.studentIds) {
        // 1. Mark existing active enrollment as PROMOTED or GRADUATED
        await tx.studentEnrollment.updateMany({
          where: {
            studentId,
            sectionId: data.fromSectionId,
            status: 'ACTIVE',
          },
          data: {
            status: targetStatus as any,
            leftAt: new Date(),
          },
        });

        // 2. If toSectionId provided, create active enrollment in target section
        if (data.toSectionId) {
          await tx.studentEnrollment.upsert({
            where: {
              studentId_sectionId: {
                studentId,
                sectionId: data.toSectionId,
              },
            },
            create: {
              studentId,
              sectionId: data.toSectionId,
              status: 'ACTIVE',
              joinedAt: new Date(),
            },
            update: {
              status: 'ACTIVE',
              leftAt: null,
            },
          });
        }

        // 3. Record StudentPromotion log
        const promotion = await tx.studentPromotion.create({
          data: {
            schoolId: validSchoolId,
            studentId,
            academicYearId: data.academicYearId,
            fromSectionId: data.fromSectionId,
            toSectionId: data.toSectionId || null,
            promotedById,
            remarks:
              data.remarks ||
              `Promoted to ${data.toSectionId ? 'next class' : 'Graduated'}`,
          },
        });

        results.push(promotion);
      }

      return {
        success: true,
        promotedCount: results.length,
        status: targetStatus,
      };
    });
  }

  async updateStudentStatus(
    schoolId: string,
    studentId: string,
    data: {
      isActive: boolean;
      status?: 'ACTIVE' | 'TRANSFERRED' | 'DROPPED' | 'GRADUATED';
      reason?: string;
    },
  ) {
    const validSchoolId = requireSchoolId(schoolId, 'Update student status');

    const student = await this.prisma.student.findFirst({
      where: { id: studentId, schoolId: validSchoolId },
      include: { user: true },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Update Student isActive flag
      const updatedStudent = await tx.student.update({
        where: { id: student.id },
        data: { isActive: data.isActive },
      });

      // 2. Update User status (ACTIVE vs INACTIVE)
      await tx.user.update({
        where: { id: student.userId },
        data: { status: data.isActive ? 'ACTIVE' : 'INACTIVE' },
      });

      // 3. Update active enrollment if deactivating
      if (!data.isActive) {
        await tx.studentEnrollment.updateMany({
          where: { studentId: student.id, status: 'ACTIVE' },
          data: {
            status: (data.status || 'TRANSFERRED') as any,
            leftAt: new Date(),
          },
        });
      } else {
        // If reactivating, make sure latest enrollment is ACTIVE
        const latestEnrollment = await tx.studentEnrollment.findFirst({
          where: { studentId: student.id },
          orderBy: { joinedAt: 'desc' },
        });
        if (latestEnrollment) {
          await tx.studentEnrollment.update({
            where: { id: latestEnrollment.id },
            data: { status: 'ACTIVE', leftAt: null },
          });
        }
      }

      return {
        id: updatedStudent.id,
        isActive: updatedStudent.isActive,
        message: data.isActive
          ? 'Student account successfully reactivated'
          : `Student marked as inactive (${data.status || 'TRANSFERRED'})`,
      };
    });
  }
}
