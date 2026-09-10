import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { requireSchoolId } from '../../core/tenant/tenant.util';

@Injectable()
export class HRService {
  constructor(private prisma: PrismaService) {}

  // ─── Leave Requests ─────────────────────────────────────────────────────────

  async applyLeave(data: {
    schoolId: string;
    userId: string;
    leaveType: string;
    startDate: string;
    endDate: string;
    reason: string;
  }) {
    const validSchoolId = requireSchoolId(data.schoolId);

    // Resolve the actual Staff record from the user
    const staffRecord = await this.prisma.staff.findFirst({
      where: { userId: data.userId, schoolId: validSchoolId },
    });
    if (!staffRecord) {
      throw new NotFoundException('No staff profile found for this user in this school');
    }

    const start = new Date(data.startDate);
    const end = new Date(data.endDate);
    const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    return this.prisma.leaveRequest.create({
      data: {
        schoolId: validSchoolId,
        staffId: staffRecord.id,
        leaveType: data.leaveType as any,
        startDate: start,
        endDate: end,
        totalDays,
        reason: data.reason,
        status: 'PENDING',
      },
      include: {
        staff: { include: { user: { select: { firstName: true, lastName: true } } } },
      },
    });
  }

  async getLeaveRequests(
    schoolId: string,
    filters: { staffId?: string; status?: string } = {},
    userRole?: string,
    userId?: string
  ) {
    const validSchoolId = requireSchoolId(schoolId);
    const where: any = { schoolId: validSchoolId };
    
    // If user is a TEACHER, they can ONLY see their own leaves
    if (userRole === 'TEACHER' && userId) {
      const staff = await this.prisma.staff.findFirst({
        where: { userId, schoolId: validSchoolId },
      });
      if (!staff) return []; // No staff record means no leaves
      if (filters.staffId && filters.staffId !== staff.id) {
        throw new ForbiddenException("You can only view your own leave requests");
      }
      where.staffId = staff.id;
    } else if (filters.staffId) {
      const staff = await this.prisma.staff.findFirst({
        where: { id: filters.staffId, schoolId: validSchoolId },
      });
      if (!staff) throw new NotFoundException('Staff member not found');
      where.staffId = staff.id;
    }

    if (filters.status) where.status = filters.status;

    return this.prisma.leaveRequest.findMany({
      where,
      include: {
        staff: {
          include: {
            user: { select: { firstName: true, lastName: true, email: true, role: true } },
            designation: { select: { name: true } },
            department: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async reviewLeave(
    schoolId: string,
    leaveId: string,
    data: {
      status: 'APPROVED' | 'REJECTED';
      reviewNote?: string;
      reviewedBy: string;
    },
  ) {
    const validSchoolId = requireSchoolId(schoolId);
    const leave = await this.prisma.leaveRequest.findFirst({
      where: { id: leaveId, schoolId: validSchoolId },
    });
    if (!leave) throw new NotFoundException('Leave request not found');
    if (leave.status !== 'PENDING') throw new ForbiddenException('Leave already reviewed');

    return this.prisma.leaveRequest.update({
      where: { id: leave.id },
      data: {
        status: data.status,
        reviewNote: data.reviewNote,
        reviewedBy: data.reviewedBy,
        reviewedAt: new Date(),
      },
    });
  }

  async cancelLeave(schoolId: string, leaveId: string, userId: string) {
    const validSchoolId = requireSchoolId(schoolId);
    const leave = await this.prisma.leaveRequest.findFirst({
      where: { id: leaveId, schoolId: validSchoolId },
      include: { staff: true },
    });
    if (!leave) throw new NotFoundException('Leave request not found');
    if (leave.staff.userId !== userId) throw new ForbiddenException('Cannot cancel another staff\'s leave');
    if (leave.status !== 'PENDING') throw new ForbiddenException('Only PENDING leaves can be cancelled');

    return this.prisma.leaveRequest.update({
      where: { id: leave.id },
      data: { status: 'CANCELLED' },
    });
  }

  // ─── Summary stats ───────────────────────────────────────────────────────────

  async getLeaveSummary(schoolId: string, userRole?: string, userId?: string) {
    const validSchoolId = requireSchoolId(schoolId);
    let where: any = { schoolId: validSchoolId };
    
    if (userRole === 'TEACHER' && userId) {
      const staff = await this.prisma.staff.findFirst({
        where: { userId, schoolId: validSchoolId },
      });
      if (!staff) return { pending: 0, approved: 0, rejected: 0, total: 0 };
      where.staffId = staff.id;
    }

    const [pending, approved, rejected, total] = await Promise.all([
      this.prisma.leaveRequest.count({ where: { ...where, status: 'PENDING' } }),
      this.prisma.leaveRequest.count({ where: { ...where, status: 'APPROVED' } }),
      this.prisma.leaveRequest.count({ where: { ...where, status: 'REJECTED' } }),
      this.prisma.leaveRequest.count({ where }),
    ]);
    return { pending, approved, rejected, total };
  }

  // ─── Staff Attendance ─────────────────────────────────────────────────────────

  async getStaffAttendanceReport(schoolId: string, date?: string) {
    const validSchoolId = requireSchoolId(schoolId);
    const targetDate = date ? new Date(date) : new Date();
    targetDate.setHours(0, 0, 0, 0);

    const allStaff = await this.prisma.staff.findMany({
      where: { schoolId: validSchoolId, isActive: true },
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        attendanceRecords: {
          where: { date: targetDate },
          take: 1,
        },
        department: { select: { name: true } },
        designation: { select: { name: true } },
      },
    });

    return allStaff.map((s) => ({
      id: s.id,
      employeeId: s.employeeId,
      name: `${s.user.firstName} ${s.user.lastName}`,
      email: s.user.email,
      department: s.department?.name || 'N/A',
      designation: s.designation?.name || 'N/A',
      attendanceStatus: (s.attendanceRecords as any[])[0]?.status || 'NOT_MARKED',
    }));
  }

  async markStaffAttendance(
    schoolId: string,
    data: { staffId: string; date: string; status: 'PRESENT' | 'ABSENT' },
  ) {
    const validSchoolId = requireSchoolId(schoolId);
    const staff = await this.prisma.staff.findFirst({
      where: { id: data.staffId, schoolId: validSchoolId },
    });
    if (!staff) throw new NotFoundException('Staff member not found');

    const targetDate = new Date(data.date);
    targetDate.setHours(0, 0, 0, 0);

    // Upsert — create or update the attendance record for this date
    const existing = await this.prisma.staffAttendance.findFirst({
      where: { staffId: data.staffId, schoolId: validSchoolId, date: targetDate },
    });

    if (existing) {
      return this.prisma.staffAttendance.update({
        where: { id: existing.id },
        data: { status: data.status },
      });
    }

    return this.prisma.staffAttendance.create({
      data: {
        staffId: data.staffId,
        schoolId: validSchoolId,
        date: targetDate,
        status: data.status,
      },
    });
  }
}
