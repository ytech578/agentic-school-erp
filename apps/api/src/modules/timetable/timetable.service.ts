import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { Prisma } from '@prisma/client';
import { TIMETABLE_TEMPLATES, getClassCategory } from '@school-erp/shared';

@Injectable()
export class TimetableService {
  constructor(private prisma: PrismaService) {}

  private async resolveActiveYear(
    schoolId: string,
    academicYearId?: string,
  ): Promise<string> {
    if (academicYearId) return academicYearId;
    const ay = await this.prisma.academicYear.findFirst({
      where: { schoolId, isActive: true },
    });
    if (!ay) throw new NotFoundException('Active academic year not found');
    return ay.id;
  }

  async getTimetable(
    schoolId: string,
    query: { classId?: string; sectionId?: string; academicYearId?: string },
  ) {
    const ayId = await this.resolveActiveYear(schoolId, query.academicYearId);

    const where: Prisma.TimetableSlotWhereInput = {
      schoolId,
      academicYearId: ayId,
      isActive: true,
    };
    if (query.classId) where.classId = query.classId;
    if (query.sectionId) where.sectionId = query.sectionId;

    return this.prisma.timetableSlot.findMany({
      where,
      include: {
        subject: { select: { id: true, name: true, code: true } },
        staff: {
          include: {
            user: { select: { firstName: true, lastName: true } },
          },
        },
        class: { select: { id: true, name: true } },
        section: { select: { id: true, name: true } },
      },
      orderBy: [{ dayOfWeek: 'asc' }, { periodNumber: 'asc' }],
    });
  }

  async getTeacherTimetable(
    schoolId: string,
    staffId: string,
    academicYearId?: string,
  ) {
    const ayId = await this.resolveActiveYear(schoolId, academicYearId);
    return this.prisma.timetableSlot.findMany({
      where: {
        schoolId,
        academicYearId: ayId,
        staffId,
        isActive: true,
      },
      include: {
        subject: { select: { id: true, name: true, code: true } },
        class: { select: { id: true, name: true } },
        section: { select: { id: true, name: true } },
      },
      orderBy: [{ dayOfWeek: 'asc' }, { periodNumber: 'asc' }],
    });
  }

  async getTodaySchedule(
    schoolId: string,
    sectionId: string,
    academicYearId?: string,
  ) {
    const ayId = await this.resolveActiveYear(schoolId, academicYearId);
    const dayOfWeek = new Date().getDay() || 7; // Convert 0 (Sunday) to 7 if using 1=Mon..7=Sun, or adjust per your week standard

    return this.prisma.timetableSlot.findMany({
      where: {
        schoolId,
        academicYearId: ayId,
        sectionId,
        dayOfWeek,
        isActive: true,
      },
      include: {
        subject: { select: { id: true, name: true } },
        staff: {
          include: { user: { select: { firstName: true, lastName: true } } },
        },
      },
      orderBy: { periodNumber: 'asc' },
    });
  }

  async checkConflicts(
    schoolId: string,
    academicYearId: string,
    data: any,
    excludeSlotId?: string,
  ) {
    const { dayOfWeek, startTime, endTime, staffId, roomNumber } = data;

    // Convert times to comparable numbers (e.g., "09:00" -> 900)
    const start = parseInt(startTime.replace(':', ''), 10);
    const end = parseInt(endTime.replace(':', ''), 10);

    const whereBase: Prisma.TimetableSlotWhereInput = {
      schoolId,
      academicYearId,
      dayOfWeek,
      isActive: true,
      ...(excludeSlotId ? { id: { not: excludeSlotId } } : {}),
    };

    const slots = await this.prisma.timetableSlot.findMany({
      where: whereBase,
    });

    for (const slot of slots) {
      const sStart = parseInt(slot.startTime.replace(':', ''), 10);
      const sEnd = parseInt(slot.endTime.replace(':', ''), 10);

      // Check time overlap
      if (start < sEnd && end > sStart) {
        if (staffId && slot.staffId === staffId) {
          throw new ConflictException(
            `Teacher is already booked for period ${slot.periodNumber} (${slot.startTime}-${slot.endTime})`,
          );
        }
        if (roomNumber && slot.roomNumber === roomNumber) {
          throw new ConflictException(
            `Room ${roomNumber} is already booked for period ${slot.periodNumber}`,
          );
        }
      }
    }
  }

  async saveSlot(schoolId: string, data: any) {
    const ayId = await this.resolveActiveYear(schoolId, data.academicYearId);

    if (data.staffId || data.roomNumber) {
      await this.checkConflicts(schoolId, ayId, data, data.id);
    }

    if (data.id) {
      return this.prisma.timetableSlot.update({
        where: { id: data.id, schoolId },
        data: {
          dayOfWeek: data.dayOfWeek,
          periodNumber: data.periodNumber,
          startTime: data.startTime,
          endTime: data.endTime,
          subjectId: data.subjectId,
          staffId: data.staffId,
          roomNumber: data.roomNumber,
          slotType: data.slotType,
        },
      });
    }

    return this.prisma.timetableSlot.create({
      data: {
        schoolId,
        academicYearId: ayId,
        classId: data.classId,
        sectionId: data.sectionId,
        dayOfWeek: data.dayOfWeek,
        periodNumber: data.periodNumber,
        startTime: data.startTime,
        endTime: data.endTime,
        subjectId: data.subjectId,
        staffId: data.staffId,
        roomNumber: data.roomNumber,
        slotType: data.slotType,
      },
    });
  }

  async deleteSlot(schoolId: string, id: string) {
    return this.prisma.timetableSlot.update({
      where: { id, schoolId },
      data: { isActive: false },
    });
  }

  async bulkSaveSlots(schoolId: string, slots: any[]) {
    const results = [];
    const errors = [];

    // Get active academic year if not provided
    let ayId = slots[0]?.academicYearId;
    if (!ayId) {
      ayId = await this.resolveActiveYear(schoolId);
    }

    for (const slot of slots) {
      try {
        const result = await this.saveSlot(schoolId, {
          ...slot,
          academicYearId: ayId,
        });
        results.push(result);
      } catch (e: any) {
        errors.push({ slot, error: e.message });
      }
    }

    return { success: results.length, errors };
  }

  async autoGenerateTimetable(schoolId: string, classId: string, sectionId: string, academicYearId?: string) {
    const ayId = await this.resolveActiveYear(schoolId, academicYearId);

    const assignments = await this.prisma.teacherAssignment.findMany({
      where: { sectionId, academicYearId: ayId },
    });

    if (assignments.length === 0) {
      throw new ConflictException("No teachers assigned to this section. Assign teachers first in the Class management module.");
    }

    const classDetails = await this.prisma.class.findUnique({ where: { id: classId } });
    if (!classDetails) throw new NotFoundException("Class not found");

    const DAYS = [1, 2, 3, 4, 5, 6];
    const category = getClassCategory(classDetails.name);
    const template = TIMETABLE_TEMPLATES[category];
    const PERIODS = template.filter((p: any) => !p.isBreak).map((p: any) => ({
      num: p.num as number,
      start: p.start,
      end: p.end
    }));

    const generatedSlots: any[] = [];
    
    // Clear existing timetable slots for this section to avoid conflicts during generation
    await this.prisma.timetableSlot.updateMany({
      where: { schoolId, sectionId, academicYearId: ayId },
      data: { isActive: false }
    });

    // Fetch other active slots to check teacher availability
    const otherSectionsSlots = await this.prisma.timetableSlot.findMany({
      where: { schoolId, academicYearId: ayId, isActive: true }
    });

    const isTeacherAvailable = (staffId: string, day: number, start: string, end: string) => {
      const sStart = parseInt(start.replace(':', ''), 10);
      const sEnd = parseInt(end.replace(':', ''), 10);
      
      const hasConflictInDb = otherSectionsSlots.some(slot => {
         if (slot.staffId !== staffId || slot.dayOfWeek !== day) return false;
         const slotStart = parseInt(slot.startTime.replace(':', ''), 10);
         const slotEnd = parseInt(slot.endTime.replace(':', ''), 10);
         return (sStart < slotEnd && sEnd > slotStart);
      });
      if (hasConflictInDb) return false;

      const hasConflictInGenerated = generatedSlots.some(slot => {
         if (slot.staffId !== staffId || slot.dayOfWeek !== day) return false;
         const slotStart = parseInt(slot.startTime.replace(':', ''), 10);
         const slotEnd = parseInt(slot.endTime.replace(':', ''), 10);
         return (sStart < slotEnd && sEnd > slotStart);
      });
      return !hasConflictInGenerated;
    };

    for (const day of DAYS) {
      const dailySubjectCount: Record<string, number> = {};
      
      // Shuffle assignments to ensure varied schedule each day
      const dailyAssignments = [...assignments].sort(() => Math.random() - 0.5);
      let assignmentIndex = 0;
      
      for (const period of PERIODS) {
        let placed = false;
        let attempts = 0;
        
        while (!placed && attempts < dailyAssignments.length) {
           const assignment = dailyAssignments[assignmentIndex % dailyAssignments.length];
           assignmentIndex++;
           attempts++;
           
           if (!assignment.subjectId) continue;
           
           // We have 8-9 periods per day but only 7 subjects in the DB.
           // To avoid empty periods, we must allow some subjects to be taught up to twice per day.
           if ((dailySubjectCount[assignment.subjectId] || 0) >= 2) continue; // max 2 periods of same subject per day
           
           if (isTeacherAvailable(assignment.staffId, day, period.start, period.end)) {
              generatedSlots.push({
                 schoolId,
                 academicYearId: ayId,
                 classId,
                 sectionId,
                 dayOfWeek: day,
                 periodNumber: period.num,
                 startTime: period.start,
                 endTime: period.end,
                 subjectId: assignment.subjectId,
                 staffId: assignment.staffId,
                 slotType: 'CLASS',
                 isActive: true
              });
              dailySubjectCount[assignment.subjectId] = (dailySubjectCount[assignment.subjectId] || 0) + 1;
              placed = true;
           }
        }
      }
    }

    if (generatedSlots.length > 0) {
      await this.prisma.timetableSlot.createMany({ data: generatedSlots });
    }

    return { success: true, count: generatedSlots.length, message: "Timetable generated successfully with AI Optimizer." };
  }
}
