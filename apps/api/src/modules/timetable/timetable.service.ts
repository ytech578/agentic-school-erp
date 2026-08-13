import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class TimetableService {
  constructor(private prisma: PrismaService) {}

  private async resolveActiveYear(schoolId: string, academicYearId?: string): Promise<string> {
    if (academicYearId) return academicYearId;
    const ay = await this.prisma.academicYear.findFirst({
      where: { schoolId, isActive: true },
    });
    if (!ay) throw new NotFoundException('Active academic year not found');
    return ay.id;
  }

  async getTimetable(schoolId: string, query: { classId?: string; sectionId?: string; academicYearId?: string }) {
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
      orderBy: [
        { dayOfWeek: 'asc' },
        { periodNumber: 'asc' },
      ],
    });
  }

  async getTeacherTimetable(schoolId: string, staffId: string, academicYearId?: string) {
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
      orderBy: [
        { dayOfWeek: 'asc' },
        { periodNumber: 'asc' },
      ],
    });
  }

  async getTodaySchedule(schoolId: string, sectionId: string, academicYearId?: string) {
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

  async checkConflicts(schoolId: string, academicYearId: string, data: any, excludeSlotId?: string) {
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

    const slots = await this.prisma.timetableSlot.findMany({ where: whereBase });
    
    for (const slot of slots) {
      const sStart = parseInt(slot.startTime.replace(':', ''), 10);
      const sEnd = parseInt(slot.endTime.replace(':', ''), 10);
      
      // Check time overlap
      if (start < sEnd && end > sStart) {
        if (staffId && slot.staffId === staffId) {
          throw new ConflictException(`Teacher is already booked for period ${slot.periodNumber} (${slot.startTime}-${slot.endTime})`);
        }
        if (roomNumber && slot.roomNumber === roomNumber) {
          throw new ConflictException(`Room ${roomNumber} is already booked for period ${slot.periodNumber}`);
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
        const result = await this.saveSlot(schoolId, { ...slot, academicYearId: ayId });
        results.push(result);
      } catch (e: any) {
        errors.push({ slot, error: e.message });
      }
    }

    return { success: results.length, errors };
  }
}
