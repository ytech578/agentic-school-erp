import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { requireSchoolId } from '../../core/tenant/tenant.util';
import { AGENT_ERRORS } from '../ai/agent/agent-types';

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

  /**
   * Approves a leave request with atomic conditional update and stale detection.
   * Reusable ERP domain operation ensuring tenant isolation and atomic status transition.
   */
  async approveLeaveRequest(
    schoolId: string,
    leaveId: string,
    data: {
      reviewedBy: string;
      reviewNote?: string;
    },
  ) {
    const validSchoolId = requireSchoolId(schoolId);
    const updated = await this.prisma.leaveRequest.updateMany({
      where: { id: leaveId, schoolId: validSchoolId, status: 'PENDING' },
      data: {
        status: 'APPROVED',
        reviewedBy: data.reviewedBy,
        reviewNote: data.reviewNote,
        reviewedAt: new Date(),
      },
    });

    if (updated.count === 0) {
      const leave = await this.prisma.leaveRequest.findUnique({
        where: { id: leaveId },
      });
      if (!leave || leave.schoolId !== validSchoolId) {
        throw new Error(AGENT_ERRORS.ACTION_TENANT_MISMATCH);
      }
      throw new Error(
        `${AGENT_ERRORS.ACTION_STALE_RESOURCE}: Leave request is no longer PENDING (current status: ${leave.status})`,
      );
    }

    return { leaveId, approved: true };
  }

  /**
   * Appends an AI review recommendation note to a leave request.
   */
  async addLeaveRecommendation(
    schoolId: string,
    leaveId: string,
    recommendation: string,
    reasoning?: string,
  ) {
    const validSchoolId = requireSchoolId(schoolId);
    const leave = await this.prisma.leaveRequest.findFirst({
      where: { id: leaveId, schoolId: validSchoolId },
    });
    if (!leave) return false;
    await this.prisma.leaveRequest.update({
      where: { id: leaveId },
      data: {
        reviewNote: `[AI Recommendation: ${recommendation}] ${reasoning ?? ''}`.trim(),
      },
    });
    return true;
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
    const targetStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0);
    const targetEnd = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59, 999);

    const [allStaff, approvedLeaves] = await Promise.all([
      this.prisma.staff.findMany({
        where: { schoolId: validSchoolId, isActive: true },
        include: {
          user: { select: { firstName: true, lastName: true, email: true } },
          attendanceRecords: {
            where: { date: { gte: targetStart, lte: targetEnd } },
            take: 1,
          },
          department: { select: { name: true } },
          designation: { select: { name: true } },
        },
      }),
      this.prisma.leaveRequest.findMany({
        where: {
          schoolId: validSchoolId,
          status: 'APPROVED',
          startDate: { lte: targetEnd },
          endDate: { gte: targetStart },
        },
      }),
    ]);

    const leaveMap = new Map<string, any>();
    for (const l of approvedLeaves) {
      leaveMap.set(l.staffId, l);
    }

    return allStaff.map((s) => {
      const rawAttendance = (s.attendanceRecords as any[])[0]?.status;
      const approvedLeave = leaveMap.get(s.id);

      let attendanceStatus: string = 'NOT_MARKED';
      let leaveReason: string | undefined = undefined;
      let leaveType: string | undefined = undefined;

      if (approvedLeave) {
        attendanceStatus = 'ON_LEAVE';
        leaveReason = approvedLeave.reason || 'Approved Leave';
        leaveType = approvedLeave.leaveType;
      } else if (rawAttendance === 'EXCUSED') {
        attendanceStatus = 'ON_LEAVE';
        leaveReason = (s.attendanceRecords as any[])[0]?.remarks || 'Excused / On Leave';
      } else if (rawAttendance === 'PRESENT') {
        attendanceStatus = 'PRESENT';
      } else if (rawAttendance === 'ABSENT') {
        attendanceStatus = 'ABSENT';
      }

      return {
        id: s.id,
        employeeId: s.employeeId,
        name: `${s.user.firstName} ${s.user.lastName}`,
        email: s.user.email,
        department: s.department?.name || 'N/A',
        designation: s.designation?.name || 'N/A',
        attendanceStatus,
        leaveReason,
        leaveType,
      };
    });
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

  // ─── Enterprise Organization & Structure ───────────────────────────────────

  async getDepartmentsWithStats(schoolId: string) {
    const validSchoolId = requireSchoolId(schoolId, 'Get departments');
    return this.prisma.department.findMany({
      where: { schoolId: validSchoolId },
      include: {
        _count: {
          select: { staff: true },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async createDepartment(schoolId: string, data: { name: string; description?: string }) {
    const validSchoolId = requireSchoolId(schoolId, 'Create department');
    return this.prisma.department.create({
      data: {
        schoolId: validSchoolId,
        name: data.name,
        description: data.description,
      },
    });
  }

  async getDesignationsWithStats(schoolId: string) {
    const validSchoolId = requireSchoolId(schoolId, 'Get designations');
    return this.prisma.designation.findMany({
      where: { schoolId: validSchoolId },
      include: {
        _count: {
          select: { staff: true },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async createDesignation(schoolId: string, data: { name: string }) {
    const validSchoolId = requireSchoolId(schoolId, 'Create designation');
    return this.prisma.designation.create({
      data: {
        schoolId: validSchoolId,
        name: data.name,
        isActive: true,
      },
    });
  }

  // ─── Staff Roster ─────────────────────────────────────────────────────────

  async getStaffRoster(
    schoolId: string,
    filters: { departmentId?: string; designationId?: string; search?: string; page?: number; limit?: number } = {},
  ) {
    const validSchoolId = requireSchoolId(schoolId, 'Get staff roster');
    const page = filters.page ? Number(filters.page) : 1;
    const limit = filters.limit ? Number(filters.limit) : 50;
    const skip = (page - 1) * limit;

    const where: any = {
      schoolId: validSchoolId,
      ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
      ...(filters.designationId ? { designationId: filters.designationId } : {}),
      ...(filters.search
        ? {
            OR: [
              { employeeId: { contains: filters.search, mode: 'insensitive' } },
              { user: { firstName: { contains: filters.search, mode: 'insensitive' } } },
              { user: { lastName: { contains: filters.search, mode: 'insensitive' } } },
              { user: { email: { contains: filters.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [total, items] = await Promise.all([
      this.prisma.staff.count({ where }),
      this.prisma.staff.findMany({
        where,
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              role: true,
              avatarUrl: true,
            },
          },
          department: { select: { id: true, name: true } },
          designation: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ─── Leave Policy & Entitlement Balances ───────────────────────────────────

  async getLeaveBalances(schoolId: string, userId?: string) {
    const validSchoolId = requireSchoolId(schoolId, 'Get leave balances');
    let staffId: string | undefined;
    if (userId) {
      const staff = await this.prisma.staff.findFirst({
        where: { userId, schoolId: validSchoolId },
      });
      if (staff) staffId = staff.id;
    }

    const currentYear = new Date().getFullYear();
    const yearStart = new Date(currentYear, 0, 1);
    const yearEnd = new Date(currentYear, 11, 31, 23, 59, 59);

    const approvedLeaves = staffId
      ? await this.prisma.leaveRequest.findMany({
          where: {
            schoolId: validSchoolId,
            staffId,
            status: 'APPROVED',
            startDate: { gte: yearStart, lte: yearEnd },
          },
        })
      : [];

    const quotas = [
      { type: 'CASUAL', label: 'Casual Leave', quota: 12 },
      { type: 'SICK', label: 'Sick Leave', quota: 10 },
      { type: 'EARNED', label: 'Earned Leave', quota: 15 },
      { type: 'MATERNITY', label: 'Maternity Leave', quota: 180 },
      { type: 'PATERNITY', label: 'Paternity Leave', quota: 15 },
      { type: 'COMPENSATORY', label: 'Compensatory Leave', quota: 5 },
      { type: 'UNPAID', label: 'Unpaid Leave', quota: 30 },
    ];

    return quotas.map((q) => {
      const used = approvedLeaves
        .filter((l) => l.leaveType === q.type)
        .reduce((sum, l) => sum + (l.totalDays || 0), 0);
      return {
        ...q,
        used,
        balance: Math.max(0, q.quota - used),
      };
    });
  }
}
