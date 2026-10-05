import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { requireSchoolId } from '../../core/tenant/tenant.util';
import {
  CreateIncidentDto,
  UpdateIncidentStatusDto,
  NotifyParentDto,
  UpdateDisciplineIncidentDto,
} from './dto/discipline.dto';
import { Cron } from '@nestjs/schedule';

@Injectable()
export class DisciplineService {
  private readonly logger = new Logger(DisciplineService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── 1. INCIDENT REPORTING ────────────────────────────────────────────────

  async createIncident(
    schoolId: string,
    reportingUserId: string,
    dto: CreateIncidentDto,
  ) {
    const validSchoolId = requireSchoolId(schoolId);

    // 1. Verify reporting staff belongs to school
    let staff = await this.prisma.staff.findFirst({
      where: { userId: reportingUserId, schoolId: validSchoolId },
    });

    if (!staff) {
      const user = await this.prisma.user.findFirst({
        where: { id: reportingUserId },
      });

      const authorizedRoles = ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER'];
      if (user && authorizedRoles.includes(user.role)) {
        // Check if staff profile already exists for this user in any school
        staff = await this.prisma.staff.findUnique({
          where: { userId: reportingUserId },
        });

        if (!staff) {
          const empCount = await this.prisma.staff.count({
            where: { schoolId: validSchoolId },
          });
          const prefix =
            user.role === 'TEACHER'
              ? 'TCH'
              : user.role === 'PRINCIPAL'
                ? 'PRN'
                : 'ADM';
          staff = await this.prisma.staff.create({
            data: {
              schoolId: validSchoolId,
              userId: reportingUserId,
              employeeId: `${prefix}${String(empCount + 1).padStart(4, '0')}`,
              joinDate: new Date(),
              isActive: true,
            },
          });
        } else if (staff.schoolId !== validSchoolId) {
          if (user.role === 'SUPER_ADMIN') {
            // Super admin operating across schools - use an active staff from target school
            const schoolStaff = await this.prisma.staff.findFirst({
              where: { schoolId: validSchoolId, isActive: true },
            });
            if (schoolStaff) {
              staff = schoolStaff;
            }
          } else if (user.schoolId === validSchoolId) {
            staff = await this.prisma.staff.update({
              where: { id: staff.id },
              data: { schoolId: validSchoolId },
            });
          }
        }
      }

      if (!staff) {
        throw new BadRequestException(
          `Reporting staff member record not found in this school.`,
        );
      }
    }

    // 2. Verify student exists in this school
    const student = await this.prisma.student.findFirst({
      where: { id: dto.studentId, schoolId: validSchoolId },
      include: {
        guardians: true,
        user: { select: { firstName: true, lastName: true } },
      },
    });

    if (!student) {
      throw new NotFoundException(`Student record not found in this school.`);
    }

    // 3. Generate sequential Incident Number
    const count = await this.prisma.disciplineIncident.count({
      where: { schoolId: validSchoolId },
    });
    const year = new Date().getFullYear();
    const incidentNumber = `DISC/${year}/${String(count + 1).padStart(4, '0')}`;

    const incidentDate = dto.incidentDate
      ? new Date(dto.incidentDate)
      : new Date();
    const actionExpiryDate = dto.actionExpiryDate
      ? new Date(dto.actionExpiryDate)
      : null;

    let parentNotified = false;
    let parentNotifiedAt: Date | null = null;

    const title =
      dto.title && dto.title.trim()
        ? dto.title.trim()
        : `${(dto.category || 'Disciplinary').replace(/_/g, ' ')} Incident`;

    // 4. Send Parent Notification if requested
    if (dto.notifyParent && student.guardians.length > 0) {
      const parentUserIds = student.guardians
        .map((g) => g.userId)
        .filter((uid): uid is string => Boolean(uid));

      for (const parentUid of parentUserIds) {
        try {
          await this.prisma.notification.create({
            data: {
              schoolId: validSchoolId,
              userId: parentUid,
              type: 'GENERAL',
              title: `Disciplinary Notice: ${title}`,
              message: `A disciplinary incident (${dto.severity || 'MINOR'}) regarding ${student.user?.firstName || (student as any).firstName || 'the student'} was reported on ${incidentDate.toLocaleDateString('en-IN')}. Remedial action: ${dto.actionTaken || 'Under Review'}.`,
              actionUrl: `/dashboard/discipline`,
              metadata: {
                category: dto.category,
                severity: dto.severity || 'MINOR',
                incidentNumber,
              },
            },
          });
          parentNotified = true;
          parentNotifiedAt = new Date();
        } catch (err: any) {
          this.logger.warn(`Failed to notify parent: ${err.message}`);
        }
      }
    }

    // 5. Create Incident
    return this.prisma.disciplineIncident.create({
      data: {
        schoolId: validSchoolId,
        incidentNumber,
        title,
        description: dto.description,
        category: dto.category,
        severity: (dto.severity as any) || 'MINOR',
        status: 'REPORTED',
        incidentDate,
        location: dto.location,
        studentId: student.id,
        reportedByStaffId: staff.id,
        actionTaken: dto.actionTaken,
        actionExpiryDate,
        parentNotified,
        parentNotifiedAt,
        isConfidential:
          dto.isConfidential !== undefined ? dto.isConfidential : false,
      },
      include: {
        student: {
          select: {
            id: true,
            admissionNumber: true,
            user: { select: { firstName: true, lastName: true } },
          },
        },
        reportedByStaff: {
          select: {
            id: true,
            employeeId: true,
            user: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });
  }

  // ─── 2. RETRIEVAL & CONFIDENTIALITY ───────────────────────────────────────

  async getIncidents(
    schoolId: string | null,
    requestingUserId: string,
    requestingUserRole: string,
    filters?: { studentId?: string; status?: string; category?: string },
  ) {
    const isElevated = ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL'].includes(
      requestingUserRole,
    );

    const where: any = {};
    if (schoolId) {
      where.schoolId = schoolId;
    } else if (requestingUserRole !== 'SUPER_ADMIN') {
      requireSchoolId(schoolId);
    }

    if (filters?.studentId) where.studentId = filters.studentId;
    if (filters?.status) where.status = filters.status;
    if (filters?.category) where.category = filters.category;

    // Confidentiality enforcement:
    // Non-elevated users can NEVER view confidential incidents unless they reported it
    if (!isElevated) {
      where.OR = [
        { isConfidential: false },
        { reportedByStaff: { userId: requestingUserId } },
      ];
    }

    return this.prisma.disciplineIncident.findMany({
      where,
      include: {
        student: {
          select: {
            id: true,
            admissionNumber: true,
            user: { select: { firstName: true, lastName: true } },
          },
        },
        reportedByStaff: {
          select: {
            id: true,
            user: { select: { firstName: true, lastName: true } },
          },
        },
      },
      orderBy: { incidentDate: 'desc' },
    });
  }

  async getIncidentById(
    schoolId: string,
    incidentId: string,
    requestingUserId: string,
    requestingUserRole: string,
  ) {
    const validSchoolId = requireSchoolId(schoolId);

    const incident = await this.prisma.disciplineIncident.findFirst({
      where: { id: incidentId, schoolId: validSchoolId },
      include: {
        student: {
          include: {
            guardians: true,
          },
        },
        reportedByStaff: {
          select: {
            id: true,
            userId: true,
            employeeId: true,
            user: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });

    if (!incident) {
      throw new NotFoundException(`Discipline incident not found.`);
    }

    const isElevated = ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL'].includes(
      requestingUserRole,
    );

    // Confidentiality check
    if (
      incident.isConfidential &&
      !isElevated &&
      incident.reportedByStaff.userId !== requestingUserId
    ) {
      throw new ForbiddenException(
        `This incident is marked confidential and cannot be viewed.`,
      );
    }

    // Role check for students/parents
    if (
      !isElevated &&
      requestingUserRole !== 'TEACHER' &&
      incident.reportedByStaff.userId !== requestingUserId
    ) {
      const isStudent = incident.student.userId === requestingUserId;
      const isParent = incident.student.guardians.some(
        (g) => g.userId === requestingUserId,
      );
      if (!isStudent && !isParent) {
        throw new ForbiddenException(
          `You are not authorized to view this incident.`,
        );
      }
    }

    return incident;
  }

  // ─── 3. RESOLUTION & STATUS WORKFLOW ──────────────────────────────────────

  async updateIncidentStatus(
    schoolId: string,
    incidentId: string,
    dto: UpdateIncidentStatusDto,
  ) {
    const validSchoolId = requireSchoolId(schoolId);

    const incident = await this.prisma.disciplineIncident.findFirst({
      where: { id: incidentId, schoolId: validSchoolId },
    });

    if (!incident) {
      throw new NotFoundException(`Discipline incident not found.`);
    }

    let finalStatus: string = dto.status;
    if (dto.status === ('IN_PROGRESS' as any)) {
      finalStatus = 'INVESTIGATING';
    } else if (dto.status === ('ESCALATED' as any)) {
      finalStatus = 'APPEALED';
    }

    const isResolvedOrClosed = ['RESOLVED', 'CLOSED'].includes(finalStatus);
    const resolvedNotes =
      dto.resolutionNotes !== undefined
        ? dto.resolutionNotes
        : dto.resolution !== undefined
          ? dto.resolution
          : incident.resolutionNotes;

    return this.prisma.disciplineIncident.update({
      where: { id: incidentId },
      data: {
        status: finalStatus as any,
        actionTaken: dto.actionTaken ?? incident.actionTaken,
        resolutionNotes: resolvedNotes,
        resolvedAt: isResolvedOrClosed ? new Date() : null,
      },
    });
  }

  // ─── 4. MANUAL PARENT NOTIFICATION ────────────────────────────────────────

  async notifyParent(
    schoolId: string,
    incidentId: string,
    dto?: NotifyParentDto,
  ) {
    const validSchoolId = requireSchoolId(schoolId);

    const incident = await this.prisma.disciplineIncident.findFirst({
      where: { id: incidentId, schoolId: validSchoolId },
      include: {
        student: {
          include: { guardians: true, user: true },
        },
      },
    });

    if (!incident) {
      throw new NotFoundException(`Discipline incident not found.`);
    }

    const parentUserIds = incident.student.guardians
      .map((g) => g.userId)
      .filter((uid): uid is string => Boolean(uid));

    if (parentUserIds.length === 0) {
      throw new BadRequestException(
        `No registered parent accounts found for this student.`,
      );
    }

    const studentName =
      (incident.student.user
        ? `${incident.student.user.firstName} ${incident.student.user.lastName}`
        : `${(incident.student as any).firstName || ''} ${(incident.student as any).lastName || ''}`
      ).trim() || 'the student';
    const message =
      dto?.customMessage ||
      dto?.message ||
      `Official Disciplinary Notice: Incident ${incident.incidentNumber} (${incident.severity}) regarding ${studentName} has been recorded. Action taken: ${incident.actionTaken || 'None specified'}.`;

    for (const parentUid of parentUserIds) {
      await this.prisma.notification.create({
        data: {
          schoolId: validSchoolId,
          userId: parentUid,
          type: 'GENERAL',
          title: `Disciplinary Alert: ${incident.title}`,
          message,
          actionUrl: `/dashboard/discipline`,
          metadata: {
            incidentNumber: incident.incidentNumber,
            severity: incident.severity,
          },
        },
      });
    }

    return this.prisma.disciplineIncident.update({
      where: { id: incidentId },
      data: {
        parentNotified: true,
        parentNotifiedAt: new Date(),
      },
    });
  }

  // ─── 5. STUDENT INCIDENT PROFILE ──────────────────────────────────────────

  async getStudentIncidentSummary(schoolId: string, studentId: string) {
    const validSchoolId = requireSchoolId(schoolId);

    const [totalCount, activeIncidents, severityBreakdown] = await Promise.all([
      this.prisma.disciplineIncident.count({
        where: { schoolId: validSchoolId, studentId },
      }),
      this.prisma.disciplineIncident.count({
        where: {
          schoolId: validSchoolId,
          studentId,
          status: { in: ['REPORTED', 'INVESTIGATING'] },
        },
      }),
      this.prisma.disciplineIncident.groupBy({
        by: ['severity'],
        where: { schoolId: validSchoolId, studentId },
        _count: { id: true },
      }),
    ]);

    return {
      studentId,
      totalCount,
      activeIncidents,
      severityBreakdown: severityBreakdown.map((s) => ({
        severity: s.severity,
        count: s._count.id,
      })),
    };
  }

  // ─── 6. INCIDENT EDIT / UPDATE ────────────────────────────────────────────

  async updateIncident(
    schoolId: string,
    incidentId: string,
    dto: UpdateDisciplineIncidentDto,
  ) {
    const validSchoolId = requireSchoolId(schoolId);

    const incident = await this.prisma.disciplineIncident.findFirst({
      where: { id: incidentId, schoolId: validSchoolId },
    });

    if (!incident) {
      throw new NotFoundException(`Discipline incident not found.`);
    }

    return this.prisma.disciplineIncident.update({
      where: { id: incidentId },
      data: {
        title: dto.title !== undefined ? dto.title : incident.title,
        description:
          dto.description !== undefined ? dto.description : incident.description,
        category: dto.category !== undefined ? dto.category : incident.category,
        severity:
          dto.severity !== undefined ? (dto.severity as any) : incident.severity,
        incidentDate: dto.incidentDate
          ? new Date(dto.incidentDate)
          : incident.incidentDate,
        location: dto.location !== undefined ? dto.location : incident.location,
        actionTaken:
          dto.actionTaken !== undefined ? dto.actionTaken : incident.actionTaken,
        actionExpiryDate: dto.actionExpiryDate
          ? new Date(dto.actionExpiryDate)
          : incident.actionExpiryDate,
        isConfidential:
          dto.isConfidential !== undefined
            ? dto.isConfidential
            : incident.isConfidential,
      },
    });
  }

  // ─── 7. SCHEDULED CRON: UNRESOLVED INCIDENT ESCALATION ───────────────────

  @Cron('0 */2 * * *')
  async escalateUnresolvedMajorIncidents() {
    try {
      const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
      const overdueIncidents = await this.prisma.disciplineIncident.findMany({
        where: {
          severity: { in: ['MAJOR', 'CRITICAL'] },
          status: 'REPORTED',
          createdAt: { lte: cutoff },
        },
        include: {
          student: {
            include: { user: true },
          },
        },
        take: 20,
      });

      for (const inc of overdueIncidents) {
        const admins = await this.prisma.user.findMany({
          where: {
            schoolId: inc.schoolId,
            role: { in: ['PRINCIPAL', 'SCHOOL_ADMIN', 'SUPER_ADMIN'] },
          },
          select: { id: true },
          take: 5,
        });

        for (const admin of admins) {
          await this.prisma.notification
            .create({
              data: {
                schoolId: inc.schoolId,
                userId: admin.id,
                title: `Escalation: Unresolved ${inc.severity} Incident ${inc.incidentNumber}`,
                message: `Incident ${inc.incidentNumber} involving ${inc.student?.user?.firstName || 'Student'} (${inc.category}) has been pending resolution for over 48 hours. Immediate review required.`,
                type: 'SYSTEM',
              },
            })
            .catch(() => {});
        }
      }
    } catch (err: any) {
      this.logger.warn(`Discipline escalation cron error: ${err.message}`);
    }
  }
}

