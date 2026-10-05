import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { requireSchoolId } from '../../core/tenant/tenant.util';
import {
  CreatePtmSessionDto,
  BookPtmSlotDto,
  CompletePtmSlotDto,
} from './dto/ptm.dto';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class PtmService {
  private readonly logger = new Logger(PtmService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Helper: Generate Time Intervals ──────────────────────────────────────

  private generateTimeSlots(
    startTime: string,
    endTime: string,
    durationMinutes: number,
  ): Array<{ startTime: string; endTime: string }> {
    const parseMinutes = (timeStr: string) => {
      const [h, m] = timeStr.split(':').map((v) => parseInt(v, 10));
      return h * 60 + m;
    };

    const formatMinutes = (totalMinutes: number) => {
      const h = Math.floor(totalMinutes / 60);
      const m = totalMinutes % 60;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    };

    const startM = parseMinutes(startTime);
    const endM = parseMinutes(endTime);

    if (startM >= endM) {
      throw new BadRequestException('startTime must be earlier than endTime.');
    }

    const slots: Array<{ startTime: string; endTime: string }> = [];
    let cur = startM;
    while (cur + durationMinutes <= endM) {
      slots.push({
        startTime: formatMinutes(cur),
        endTime: formatMinutes(cur + durationMinutes),
      });
      cur += durationMinutes;
    }
    return slots;
  }

  // ─── 1. SESSION MANAGEMENT ───────────────────────────────────────────────

  async createSession(schoolId: string, dto: CreatePtmSessionDto) {
    const validSchoolId = requireSchoolId(schoolId);

    const slotDuration =
      dto.slotDuration || (dto as any).slotDurationMinutes || 15;
    const intervals = this.generateTimeSlots(
      dto.startTime,
      dto.endTime,
      slotDuration,
    );

    if (intervals.length === 0) {
      throw new BadRequestException(
        'Time window is too short for the specified slot duration.',
      );
    }

    let teacherIds = dto.teacherIds || [];
    if (!teacherIds || teacherIds.length === 0) {
      // Auto-fallback: fetch active teaching staff for the school so creation doesn't fail
      const activeStaff = await this.prisma.staff.findMany({
        where: { schoolId: validSchoolId, isActive: true },
        take: 20,
        select: { id: true },
      });
      teacherIds = activeStaff.map((s) => s.id);
    }

    if (teacherIds.length === 0) {
      throw new BadRequestException(
        'At least one participating teacher is required. Please ensure active staff exist in the school.',
      );
    }

    // Verify all teachers belong to this school
    const teachers = await this.prisma.staff.findMany({
      where: {
        id: { in: teacherIds },
        schoolId: validSchoolId,
        isActive: true,
      },
    });

    if (teachers.length === 0) {
      throw new BadRequestException(
        'No active participating teachers found in this school.',
      );
    }

    const rawDate = dto.date || (dto as any).meetingDate;
    const sessionDate = new Date(rawDate || Date.now());

    const createdSession = await this.prisma.$transaction(async (tx) => {
      const session = await tx.ptmSession.create({
        data: {
          schoolId: validSchoolId,
          title: dto.title,
          description: dto.description,
          date: sessionDate,
          startTime: dto.startTime,
          endTime: dto.endTime,
          slotDuration,
          mode: (dto.mode as any) || 'IN_PERSON',
          meetingLink: dto.meetingLink,
          location: dto.location,
          classId: dto.classId,
        },
      });

      // Generate discrete meeting slots for each teacher
      const slotRecords: any[] = [];
      for (const teacher of teachers) {
        for (const interval of intervals) {
          slotRecords.push({
            schoolId: validSchoolId,
            sessionId: session.id,
            teacherId: teacher.id,
            startTime: interval.startTime,
            endTime: interval.endTime,
            status: 'AVAILABLE',
          });
        }
      }

      await tx.ptmSlot.createMany({
        data: slotRecords,
      });

      this.logger.log(
        `Created PTM session "${dto.title}" with ${slotRecords.length} slots across ${teachers.length} teachers.`,
      );

      return session;
    });

    // Broadcast notification to parents if classId is specified
    if (dto.classId) {
      try {
        const students = await this.prisma.student.findMany({
          where: {
            schoolId: validSchoolId,
            isActive: true,
            enrollments: {
              some: {
                status: 'ACTIVE',
                section: { classId: dto.classId },
              },
            },
          },
          include: {
            guardians: { select: { userId: true } },
          },
        });

        const parentUserIds: string[] = Array.from(
          new Set(
            students
              .flatMap((s: any) => s.guardians.map((g: any) => g.userId))
              .filter(
                (id: any): id is string =>
                  typeof id === 'string' && id.length > 0,
              ),
          ),
        );

        if (parentUserIds.length > 0) {
          const dateStr = sessionDate.toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          });
          await this.prisma.notification.createMany({
            data: parentUserIds.map((pid: string) => ({
              schoolId: validSchoolId,
              userId: pid,
              type: 'GENERAL' as const,
              title: `New PTM Scheduled: ${dto.title}`,
              message: `A Parent-Teacher Meeting has been scheduled for ${dateStr} (${dto.startTime} - ${dto.endTime}). Please book your slot early.`,
              actionUrl: '/dashboard/ptm',
              metadata: { sessionId: createdSession.id },
            })),
            skipDuplicates: true,
          });
        }
      } catch (err: any) {
        this.logger.warn(
          `Failed to broadcast PTM session notifications: ${err.message}`,
        );
      }
    }

    return createdSession;
  }

  async getSessions(schoolId: string | null) {
    const where: any = { isActive: true };
    if (schoolId) where.schoolId = schoolId;
    return this.prisma.ptmSession.findMany({
      where,
      include: {
        _count: {
          select: { slots: true },
        },
      },
      orderBy: { date: 'desc' },
    });
  }

  async getSessionById(schoolId: string, sessionId: string) {
    const validSchoolId = requireSchoolId(schoolId);
    const session = await this.prisma.ptmSession.findFirst({
      where: { id: sessionId, schoolId: validSchoolId },
      include: {
        slots: {
          include: {
            teacher: {
              select: {
                id: true,
                user: { select: { firstName: true, lastName: true } },
                designation: { select: { name: true } },
              },
            },
            student: {
              select: {
                id: true,
                admissionNumber: true,
                user: { select: { firstName: true, lastName: true } },
              },
            },
          },
          orderBy: [{ teacherId: 'asc' }, { startTime: 'asc' }],
        },
      },
    });

    if (!session) {
      throw new NotFoundException(`PTM session not found.`);
    }

    return session;
  }

  // ─── 2. SLOT BOOKING (PARENTS) ─────────────────────────────────────────────

  async bookSlot(
    schoolId: string,
    slotId: string,
    requestingUserId: string,
    requestingUserRole: string,
    dto: BookPtmSlotDto,
  ) {
    const validSchoolId = requireSchoolId(schoolId);

    // 1. Verify student exists in this school
    const student = await this.prisma.student.findFirst({
      where: { id: dto.studentId, schoolId: validSchoolId },
      include: { user: true, guardians: true },
    });

    if (!student) {
      throw new NotFoundException(`Student not found in this school.`);
    }

    // 2. Verify parent authorization
    const isElevated = ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL'].includes(
      requestingUserRole,
    );

    if (!isElevated) {
      const isParentOfStudent = student.guardians.some(
        (g) => g.userId === requestingUserId,
      );
      if (!isParentOfStudent) {
        throw new ForbiddenException(
          `You are not registered as a parent/guardian of this student.`,
        );
      }
    }

    // 3. Atomically check slot availability and book
    const bookedSlot = await this.prisma.$transaction(async (tx) => {
      const slot = await tx.ptmSlot.findFirst({
        where: { id: slotId, schoolId: validSchoolId },
      });

      if (!slot) {
        throw new NotFoundException(`PTM slot not found.`);
      }

      if (slot.status !== 'AVAILABLE') {
        throw new ConflictException(
          `This time slot is no longer available (current status: ${slot.status}).`,
        );
      }

      // Check if student already has a slot booked with this teacher in this session
      const existingBooking = await tx.ptmSlot.findFirst({
        where: {
          sessionId: slot.sessionId,
          teacherId: slot.teacherId,
          studentId: student.id,
          status: 'BOOKED',
        },
      });

      if (existingBooking) {
        throw new ConflictException(
          `A slot is already booked for this student with this teacher in this session.`,
        );
      }

      // Check if student already has an overlapping appointment at this exact time with another teacher
      const overlappingTimeBooking = await tx.ptmSlot.findFirst({
        where: {
          sessionId: slot.sessionId,
          studentId: student.id,
          startTime: slot.startTime,
          status: 'BOOKED',
        },
        include: {
          teacher: {
            select: {
              user: { select: { firstName: true, lastName: true } },
            },
          },
        },
      });

      if (overlappingTimeBooking) {
        const teacherName = overlappingTimeBooking.teacher?.user
          ? `${overlappingTimeBooking.teacher.user.firstName} ${overlappingTimeBooking.teacher.user.lastName || ''}`.trim()
          : 'another teacher';
        throw new ConflictException(
          `Schedule conflict: Student already has an appointment at ${slot.startTime} with ${teacherName}. Please choose a non-overlapping time slot.`,
        );
      }

      return tx.ptmSlot.update({
        where: { id: slotId },
        data: {
          status: 'BOOKED',
          studentId: student.id,
          parentId: requestingUserId,
          parentNotes: dto.parentNotes,
        },
        include: {
          teacher: {
            select: {
              id: true,
              userId: true,
              user: { select: { firstName: true, lastName: true } },
            },
          },
          session: true,
        },
      });
    });

    // 4. Trigger Notifications to Parent & Teacher
    const studentDisplayName =
      (student.user
        ? `${student.user.firstName} ${student.user.lastName || ''}`
        : `${(student as any).firstName || ''} ${(student as any).lastName || ''}`
      ).trim() || 'Student';

    const teacherDisplayName = bookedSlot.teacher?.user
      ? `${bookedSlot.teacher.user.firstName} ${bookedSlot.teacher.user.lastName || ''}`.trim()
      : 'Teacher';

    const sessionTitle = bookedSlot.session?.title || 'PTM Session';
    const sessionDateFormatted = bookedSlot.session?.date
      ? new Date(bookedSlot.session.date).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })
      : 'Scheduled Date';
    const sessionMode = bookedSlot.session?.mode || 'IN_PERSON';

    // 4a. Notify Parent
    try {
      await this.prisma.notification.create({
        data: {
          schoolId: validSchoolId,
          userId: requestingUserId,
          type: 'GENERAL',
          title: `PTM Booking Confirmed: ${sessionTitle}`,
          message: `Your PTM slot with ${teacherDisplayName} for ${studentDisplayName} is confirmed on ${sessionDateFormatted} (${bookedSlot.startTime} - ${bookedSlot.endTime}). Mode: ${sessionMode}.`,
          actionUrl: '/dashboard/ptm',
          metadata: {
            slotId: bookedSlot.id,
            sessionId: bookedSlot.sessionId,
            teacherId: bookedSlot.teacherId,
            studentId: bookedSlot.studentId,
          },
        },
      });
    } catch (err: any) {
      this.logger.warn(
        `Failed to send PTM notification to parent: ${err.message}`,
      );
    }

    // 4b. Notify Teacher
    if (bookedSlot.teacher?.userId) {
      try {
        await this.prisma.notification.create({
          data: {
            schoolId: validSchoolId,
            userId: bookedSlot.teacher.userId,
            type: 'GENERAL',
            title: `New PTM Booking: ${sessionTitle}`,
            message: `A meeting slot for ${studentDisplayName} has been booked on ${sessionDateFormatted} (${bookedSlot.startTime} - ${bookedSlot.endTime}). Notes: ${bookedSlot.parentNotes || 'None'}.`,
            actionUrl: '/dashboard/ptm',
            metadata: {
              slotId: bookedSlot.id,
              sessionId: bookedSlot.sessionId,
              studentId: bookedSlot.studentId,
              parentId: requestingUserId,
            },
          },
        });
      } catch (err: any) {
        this.logger.warn(
          `Failed to send PTM notification to teacher: ${err.message}`,
        );
      }
    }

    return bookedSlot;
  }

  async cancelBooking(
    schoolId: string,
    slotId: string,
    requestingUserId: string,
    requestingUserRole: string,
  ) {
    const validSchoolId = requireSchoolId(schoolId);

    const slot = await this.prisma.ptmSlot.findFirst({
      where: { id: slotId, schoolId: validSchoolId },
    });

    if (!slot) {
      throw new NotFoundException(`PTM slot not found.`);
    }

    if (slot.status !== 'BOOKED') {
      throw new BadRequestException(
        `Only booked slots can be cancelled (current status: ${slot.status}).`,
      );
    }

    const isElevated = ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL'].includes(
      requestingUserRole,
    );

    if (!isElevated && slot.parentId !== requestingUserId) {
      throw new ForbiddenException(
        `You are not authorized to cancel this booking.`,
      );
    }

    return this.prisma.ptmSlot.update({
      where: { id: slotId },
      data: {
        status: 'AVAILABLE',
        studentId: null,
        parentId: null,
        parentNotes: null,
      },
    });
  }

  // ─── 3. SLOT COMPLETION & FEEDBACK (TEACHERS) ──────────────────────────────

  async completeSlot(
    schoolId: string,
    slotId: string,
    requestingUserId: string,
    requestingUserRole: string,
    dto: CompletePtmSlotDto,
  ) {
    const validSchoolId = requireSchoolId(schoolId);

    const slot = await this.prisma.ptmSlot.findFirst({
      where: { id: slotId, schoolId: validSchoolId },
      include: {
        teacher: true,
      },
    });

    if (!slot) {
      throw new NotFoundException(`PTM slot not found.`);
    }

    const isElevated = ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL'].includes(
      requestingUserRole,
    );

    if (!isElevated && slot.teacher.userId !== requestingUserId) {
      throw new ForbiddenException(
        `Only the assigned teacher can complete this meeting slot.`,
      );
    }

    return this.prisma.ptmSlot.update({
      where: { id: slotId },
      data: {
        status: 'COMPLETED',
        teacherNotes: dto.teacherNotes,
        actionItems: dto.actionItems,
      },
    });
  }

  // ─── 4. SCHEDULE & HISTORY ────────────────────────────────────────────────

  async getTeacherSchedule(schoolId: string, teacherStaffId: string) {
    const validSchoolId = requireSchoolId(schoolId);
    return this.prisma.ptmSlot.findMany({
      where: { teacherId: teacherStaffId, schoolId: validSchoolId },
      include: {
        session: true,
        student: {
          select: {
            id: true,
            admissionNumber: true,
            user: { select: { firstName: true, lastName: true } },
          },
        },
      },
      orderBy: [{ session: { date: 'desc' } }, { startTime: 'asc' }],
    });
  }

  async getStudentPtmHistory(
    schoolId: string,
    studentId: string,
    requestingUserId: string,
    requestingUserRole: string,
  ) {
    const validSchoolId = requireSchoolId(schoolId);

    const student = await this.prisma.student.findFirst({
      where: { id: studentId, schoolId: validSchoolId },
      include: { guardians: true },
    });

    if (!student) {
      throw new NotFoundException(`Student not found.`);
    }

    const isElevated = [
      'SUPER_ADMIN',
      'SCHOOL_ADMIN',
      'PRINCIPAL',
      'TEACHER',
    ].includes(requestingUserRole);

    if (!isElevated) {
      const isParentOfStudent = student.guardians.some(
        (g) => g.userId === requestingUserId,
      );
      const isStudentUser = student.userId === requestingUserId;
      if (!isParentOfStudent && !isStudentUser) {
        throw new ForbiddenException(
          `You are not authorized to view PTM history for this student.`,
        );
      }
    }

    return this.prisma.ptmSlot.findMany({
      where: {
        studentId,
        schoolId: validSchoolId,
        status: { in: ['BOOKED', 'COMPLETED'] },
      },
      include: {
        session: true,
        teacher: {
          select: {
            id: true,
            user: { select: { firstName: true, lastName: true } },
            designation: { select: { name: true } },
          },
        },
      },
      orderBy: { session: { date: 'desc' } },
    });
  }

  // ─── 4. SCHEDULED CRON: 24-HOUR PTM REMINDER ────────────────────────────

  @Cron(CronExpression.EVERY_HOUR)
  async sendUpcomingPtmReminders() {
    try {
      const now = new Date();
      const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const upcomingSlots = await this.prisma.ptmSlot.findMany({
        where: {
          status: 'BOOKED',
          session: {
            date: {
              gte: now,
              lte: in24h,
            },
          },
        },
        include: {
          session: true,
          student: {
            include: {
              user: true,
              guardians: true,
            },
          },
          teacher: {
            include: { user: true },
          },
        },
        take: 50,
      });

      for (const slot of upcomingSlots) {
        const guardianUserId = slot.student?.guardians?.[0]?.userId;
        const targetUserId = guardianUserId || slot.student?.userId;
        if (targetUserId) {
          await this.prisma.notification
            .create({
              data: {
                schoolId: slot.schoolId,
                userId: targetUserId,
                title: `Upcoming PTM Reminder: ${slot.session.title}`,
                message: `Reminder: Your PTM session for ${slot.student?.user?.firstName || 'your ward'} with Teacher ${slot.teacher?.user?.firstName || ''} is scheduled for tomorrow at ${slot.startTime}.`,
                type: 'GENERAL',
              },
            })
            .catch(() => {});
        }
      }
    } catch (err: any) {
      this.logger.warn(`Upcoming PTM reminder cron error: ${err.message}`);
    }
  }
}
