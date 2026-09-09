import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { MarkAttendanceInput } from '@school-erp/shared';
import { AttendanceStatus, AttendanceMethod } from '@prisma/client';

@Injectable()
export class AttendanceService {
  constructor(private prisma: PrismaService) {}

  async getClassesAndSections(schoolId: string) {
    return this.prisma.class.findMany({
      where: { schoolId },
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
    const targetDate = new Date(date);

    // Validate date
    if (isNaN(targetDate.getTime())) {
      throw new BadRequestException('Invalid date format');
    }

    const students = await this.prisma.student.findMany({
      where: {
        schoolId,
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
    const targetDate = new Date(data.date);

    if (isNaN(targetDate.getTime())) {
      throw new BadRequestException('Invalid date format');
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
            schoolId,
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
