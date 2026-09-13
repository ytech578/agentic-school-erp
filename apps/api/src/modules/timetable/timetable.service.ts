import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { Prisma } from '@prisma/client';
import { TIMETABLE_TEMPLATES, getClassCategory } from '@school-erp/shared';
import { requireSchoolId } from '../../core/tenant/tenant.util';

@Injectable()
export class TimetableService {
  constructor(private prisma: PrismaService) {}

  private parseTimeToMinutes(timeStr?: string): number {
    if (!timeStr) return 0;
    const cleaned = timeStr.trim();
    const isPM = /pm/i.test(cleaned);
    const isAM = /am/i.test(cleaned);
    const timeOnly = cleaned.replace(/[^\d:]/g, '');
    const parts = timeOnly.split(':');
    let hours = parseInt(parts[0], 10) || 0;
    const minutes = parseInt(parts[1], 10) || 0;

    if (isPM && hours < 12) {
      hours += 12;
    } else if (isAM && hours === 12) {
      hours = 0;
    }

    return hours * 60 + minutes;
  }

  private async resolveActiveYear(
    schoolId: string,
    academicYearId?: string,
  ): Promise<string> {
    const validSchoolId = requireSchoolId(schoolId, 'Resolve active year');
    if (academicYearId && academicYearId !== 'undefined' && academicYearId !== 'null' && academicYearId.trim() !== '') {
      const trimmed = academicYearId.trim();
      const normalizedName = trimmed.replace(/^AY[-_]?/i, '');
      const year = await this.prisma.academicYear.findFirst({
        where: {
          schoolId: validSchoolId,
          OR: [
            { id: trimmed },
            { name: trimmed },
            { name: normalizedName },
          ],
        },
      });
      if (year) return year.id;
    }
    const ay = await this.prisma.academicYear.findFirst({
      where: { schoolId: validSchoolId, isActive: true },
    });
    if (ay) return ay.id;
    const latest = await this.prisma.academicYear.findFirst({
      where: { schoolId: validSchoolId },
      orderBy: { startDate: 'desc' },
    });
    if (latest) return latest.id;
    throw new NotFoundException('Active academic year not found');
  }

  async getTimetable(
    schoolId: string,
    query: { classId?: string; sectionId?: string; academicYearId?: string },
  ) {
    const validSchoolId = requireSchoolId(schoolId, 'Get timetable');
    const ayId = await this.resolveActiveYear(validSchoolId, query.academicYearId);

    const where: Prisma.TimetableSlotWhereInput = {
      schoolId: validSchoolId,
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
    const validSchoolId = requireSchoolId(schoolId, 'Get teacher timetable');
    const ayId = await this.resolveActiveYear(validSchoolId, academicYearId);
    return this.prisma.timetableSlot.findMany({
      where: {
        schoolId: validSchoolId,
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
    const validSchoolId = requireSchoolId(schoolId, 'Get today schedule');
    const ayId = await this.resolveActiveYear(validSchoolId, academicYearId);
    const dayOfWeek = new Date().getDay() || 7; // Convert 0 (Sunday) to 7 if using 1=Mon..7=Sun, or adjust per your week standard

    return this.prisma.timetableSlot.findMany({
      where: {
        schoolId: validSchoolId,
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
    const validSchoolId = requireSchoolId(schoolId, 'Check timetable conflicts');
    const { dayOfWeek, startTime, endTime, staffId, roomNumber } = data;

    // Convert times to comparable minute offsets from midnight
    const start = this.parseTimeToMinutes(startTime);
    const end = this.parseTimeToMinutes(endTime);

    if (end <= start) {
      throw new ConflictException('End time must be after start time');
    }

    const whereBase: Prisma.TimetableSlotWhereInput = {
      schoolId: validSchoolId,
      academicYearId,
      dayOfWeek,
      isActive: true,
      ...(excludeSlotId ? { id: { not: excludeSlotId } } : {}),
    };

    const slots = await this.prisma.timetableSlot.findMany({
      where: whereBase,
    });

    for (const slot of slots) {
      const sStart = this.parseTimeToMinutes(slot.startTime);
      const sEnd = this.parseTimeToMinutes(slot.endTime);

      // Check time overlap
      if (start < sEnd && end > sStart) {
        if (data.sectionId && slot.sectionId === data.sectionId) {
          throw new ConflictException(
            `Section already has a class scheduled for period ${slot.periodNumber} (${slot.startTime}-${slot.endTime})`,
          );
        }
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
    const validSchoolId = requireSchoolId(schoolId, 'Save timetable slot');
    const ayId = await this.resolveActiveYear(validSchoolId, data.academicYearId);

    if (data.staffId || data.roomNumber) {
      await this.checkConflicts(validSchoolId, ayId, data, data.id);
    }

    if (data.id) {
      return this.prisma.timetableSlot.update({
        where: { id: data.id, schoolId: validSchoolId },
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
        schoolId: validSchoolId,
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
    const validSchoolId = requireSchoolId(schoolId, 'Delete timetable slot');
    return this.prisma.timetableSlot.update({
      where: { id, schoolId: validSchoolId },
      data: { isActive: false },
    });
  }

  async bulkSaveSlots(schoolId: string, slots: any[]) {
    const validSchoolId = requireSchoolId(schoolId, 'Bulk save timetable slots');
    const results = [];
    const errors = [];

    // Get active academic year if not provided
    let ayId = slots[0]?.academicYearId;
    if (!ayId) {
      ayId = await this.resolveActiveYear(validSchoolId);
    }

    for (const slot of slots) {
      try {
        const result = await this.saveSlot(validSchoolId, {
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
    const validSchoolId = requireSchoolId(schoolId, 'Auto generate timetable');
    const ayId = await this.resolveActiveYear(validSchoolId, academicYearId);

    const assignments = await this.prisma.teacherAssignment.findMany({
      where: { sectionId, academicYearId: ayId },
    });

    if (assignments.length === 0) {
      throw new ConflictException("No teachers assigned to this section. Assign teachers first in the Class management module.");
    }

    const classDetails = await this.prisma.class.findFirst({ where: { id: classId, schoolId: validSchoolId } });
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
      where: { schoolId: validSchoolId, sectionId, academicYearId: ayId },
      data: { isActive: false }
    });

    // Fetch other active slots to check teacher availability
    const otherSectionsSlots = await this.prisma.timetableSlot.findMany({
      where: { schoolId: validSchoolId, academicYearId: ayId, isActive: true }
    });

    const isTeacherAvailable = (staffId: string, day: number, start: string, end: string) => {
      const sStart = this.parseTimeToMinutes(start);
      const sEnd = this.parseTimeToMinutes(end);
      
      const hasConflictInDb = otherSectionsSlots.some(slot => {
         if (slot.staffId !== staffId || slot.dayOfWeek !== day) return false;
         const slotStart = this.parseTimeToMinutes(slot.startTime);
         const slotEnd = this.parseTimeToMinutes(slot.endTime);
         return (sStart < slotEnd && sEnd > slotStart);
      });
      if (hasConflictInDb) return false;

      const hasConflictInGenerated = generatedSlots.some(slot => {
         if (slot.staffId !== staffId || slot.dayOfWeek !== day) return false;
         const slotStart = this.parseTimeToMinutes(slot.startTime);
         const slotEnd = this.parseTimeToMinutes(slot.endTime);
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
                 schoolId: validSchoolId,
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
