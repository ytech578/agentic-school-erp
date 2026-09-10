import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { MarkAttendanceInput } from '@school-erp/shared';
import { AttendanceStatus, AttendanceMethod } from '@prisma/client';
import { requireSchoolId } from '../../core/tenant/tenant.util';

@Injectable()
export class AttendanceService {
  constructor(private prisma: PrismaService) {}

  async getClassesAndSections(schoolId: string) {
    const validSchoolId = requireSchoolId(schoolId);
    return this.prisma.class.findMany({
      where: { schoolId: validSchoolId },
      orderBy: { numericLevel: 'asc' },
      include: {
        sections: {
          orderBy: { name: 'asc' },
        },
      },
    });
  }

  async getStudentsForAttendance(
    schoolId: string,
    sectionId: string,
    date: string,
  ) {
    const validSchoolId = requireSchoolId(schoolId);
    const targetDate = new Date(date);

    // Validate date
    if (isNaN(targetDate.getTime())) {
      throw new BadRequestException('Invalid date format');
    }

    // Validate section belongs to school
    const section = await this.prisma.section.findFirst({
      where: { id: sectionId, class: { schoolId: validSchoolId } },
    });
    if (!section) {
      throw new NotFoundException('Section not found');
    }

    const students = await this.prisma.student.findMany({
      where: {
        schoolId: validSchoolId,
        isActive: true,
        enrollments: {
          some: { sectionId, status: 'ACTIVE' },
        },
      },
      include: {
        user: {
          select: { firstName: true, lastName: true },
        },
        attendance: {
          where: {
            sectionId,
            date: targetDate,
          },
        },
      },
      orderBy: [{ user: { firstName: 'asc' } }, { user: { lastName: 'asc' } }],
    });

    return students.map((student) => ({
      id: student.id,
      firstName: student.user.firstName,
      lastName: student.user.lastName,
      admissionNumber: student.admissionNumber,
      rollNumber: student.rollNumber,
      attendance: student.attendance[0] || null,
    }));
  }

  async markAttendance(
    schoolId: string,
    userId: string,
    data: MarkAttendanceInput,
  ) {
    const validSchoolId = requireSchoolId(schoolId);
    const targetDate = new Date(data.date);

    if (isNaN(targetDate.getTime())) {
      throw new BadRequestException('Invalid date format');
    }

    // Validate section belongs to school
    const section = await this.prisma.section.findFirst({
      where: { id: data.sectionId, class: { schoolId: validSchoolId } },
    });
    if (!section) {
      throw new NotFoundException('Section not found');
    }

    // Validate all students belong to the school
    if (data.records && data.records.length > 0) {
      const studentIds = data.records.map((r) => r.studentId);
      const students = await this.prisma.student.findMany({
        where: { id: { in: studentIds }, schoolId: validSchoolId },
        select: { id: true },
      });
      if (students.length !== studentIds.length) {
        throw new BadRequestException('One or more students do not belong to this school');
      }
    }

    // Process bulk attendance using a transaction
    const results = await this.prisma.$transaction(async (tx) => {
      const ops = data.records.map((record) => {
        return tx.attendanceRecord.upsert({
          where: {
            studentId_sectionId_date: {
              studentId: record.studentId,
              sectionId: data.sectionId,
              date: targetDate,
            },
          },
          update: {
            status: record.status as AttendanceStatus,
            remarks: record.remarks,
            markedById: userId,
          },
          create: {
            schoolId: validSchoolId,
            studentId: record.studentId,
            sectionId: data.sectionId,
            date: targetDate,
            status: record.status as AttendanceStatus,
            method: AttendanceMethod.MANUAL,
            remarks: record.remarks,
            markedById: userId,
          },
        });
      });

      return Promise.all(ops);
    });

    return {
      message: `Successfully marked attendance for ${results.length} students`,
      updatedCount: results.length,
    };
  }
}
