import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
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
    userRole: string,
    data: MarkAttendanceInput,
  ) {
    const validSchoolId = requireSchoolId(schoolId);
    const targetDate = new Date(data.date);

    if (isNaN(targetDate.getTime())) {
      throw new BadRequestException('Invalid date format');
    }

    // Prevent marking attendance for future dates
    const startOfTomorrow = new Date();
    startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
    startOfTomorrow.setHours(0, 0, 0, 0);
    if (targetDate >= startOfTomorrow) {
      throw new BadRequestException('Cannot mark attendance for future dates');
    }

    // Prevent non-admin teachers from modifying attendance older than 7 days
    const now = new Date();
    const diffDays = (now.getTime() - targetDate.getTime()) / (1000 * 60 * 60 * 24);
    if (userRole === 'TEACHER' && diffDays > 7) {
      throw new ForbiddenException(
        'Teachers cannot modify attendance records older than 7 days. Please contact an administrator.',
      );
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

  async handleHardwarePunch(input: {
    deviceId: string;
    cardId: string;
    timestamp?: string | Date;
    scanType?: 'IN' | 'OUT' | 'PUNCH';
    schoolId?: string;
  }) {
    if (!input.deviceId || !input.cardId) {
      throw new BadRequestException('deviceId and cardId are required parameters');
    }

    const punchTime = input.timestamp ? new Date(input.timestamp) : new Date();
    if (isNaN(punchTime.getTime())) {
      throw new BadRequestException('Invalid timestamp format');
    }

    const punchDate = new Date(punchTime.getFullYear(), punchTime.getMonth(), punchTime.getDate());
    const isBiometric =
      input.deviceId.toLowerCase().includes('bio') ||
      input.deviceId.toLowerCase().includes('finger') ||
      input.deviceId.toLowerCase().includes('face');
    const method = isBiometric ? AttendanceMethod.BIOMETRIC : AttendanceMethod.RFID;

    // 1. Check if card matches a Student (by admissionNumber, aadhaarNumber, or student id)
    const student = await this.prisma.student.findFirst({
      where: {
        OR: [
          { admissionNumber: input.cardId },
          { aadhaarNumber: input.cardId },
          { id: input.cardId },
        ],
        ...(input.schoolId ? { schoolId: input.schoolId } : {}),
      },
      include: {
        user: { select: { firstName: true, lastName: true } },
        enrollments: {
          where: { status: 'ACTIVE' },
          select: { sectionId: true },
          take: 1,
        },
      },
    });

    if (student) {
      const sectionId = student.enrollments[0]?.sectionId;
      if (!sectionId) {
        throw new BadRequestException(`Student ${student.admissionNumber} has no active section enrollment`);
      }

      const record = await this.prisma.attendanceRecord.upsert({
        where: {
          studentId_sectionId_date: {
            studentId: student.id,
            sectionId,
            date: punchDate,
          },
        },
        update: {
          status: AttendanceStatus.PRESENT,
          remarks: `Hardware punch recorded from ${input.deviceId} (${input.scanType || 'PUNCH'}) at ${punchTime.toISOString()}`,
        },
        create: {
          schoolId: student.schoolId,
          studentId: student.id,
          sectionId,
          date: punchDate,
          status: AttendanceStatus.PRESENT,
          method,
          remarks: `Hardware punch recorded from ${input.deviceId} (${input.scanType || 'PUNCH'}) at ${punchTime.toISOString()}`,
          markedById: `HARDWARE_${input.deviceId}`,
        },
      });

      return {
        success: true,
        type: 'STUDENT',
        message: `Hardware attendance marked for ${student.user?.firstName || 'Student'} ${student.user?.lastName || ''} (${student.admissionNumber})`,
        student: {
          id: student.id,
          name: `${student.user?.firstName} ${student.user?.lastName}`,
          admissionNumber: student.admissionNumber,
        },
        recordId: record.id,
        method: record.method,
        timestamp: punchTime.toISOString(),
      };
    }

    // 2. Check if card matches a Staff member (by employeeId, aadhaarNumber, or staff id)
    const staff = await this.prisma.staff.findFirst({
      where: {
        OR: [
          { employeeId: input.cardId },
          { aadhaarNumber: input.cardId },
          { id: input.cardId },
        ],
        ...(input.schoolId ? { schoolId: input.schoolId } : {}),
      },
      include: {
        user: { select: { firstName: true, lastName: true } },
      },
    });

    if (staff) {
      const staffRecord = await this.prisma.staffAttendance.upsert({
        where: {
          staffId_date: {
            staffId: staff.id,
            date: punchDate,
          },
        },
        update: {
          ...(input.scanType === 'OUT' ? { checkOut: punchTime } : {}),
          remarks: `Hardware punch from ${input.deviceId} at ${punchTime.toISOString()}`,
        },
        create: {
          schoolId: staff.schoolId,
          staffId: staff.id,
          date: punchDate,
          checkIn: punchTime,
          status: AttendanceStatus.PRESENT,
          remarks: `Hardware punch from ${input.deviceId} at ${punchTime.toISOString()}`,
        },
      });

      return {
        success: true,
        type: 'STAFF',
        message: `Hardware punch recorded for staff ${staff.user?.firstName || 'Staff'} ${staff.user?.lastName || ''} (${staff.employeeId})`,
        staff: {
          id: staff.id,
          name: `${staff.user?.firstName} ${staff.user?.lastName}`,
          employeeId: staff.employeeId,
        },
        recordId: staffRecord.id,
        timestamp: punchTime.toISOString(),
      };
    }

    throw new NotFoundException(`Unregistered card/credential '${input.cardId}' on device '${input.deviceId}'`);
  }
}
