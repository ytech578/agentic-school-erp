import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { requireSchoolId } from '../../core/tenant/tenant.util';
import { CreateActivityDto, UpdateActivityDto } from './dto/activity.dto';

@Injectable()
export class ActivitiesService {
  constructor(private prisma: PrismaService) {}

  async listActivities(schoolId: string, studentId?: string) {
    const validSchoolId = requireSchoolId(schoolId);
    if (studentId) {
      const student = await this.prisma.student.findFirst({
        where: { id: studentId, schoolId: validSchoolId },
      });
      if (!student) throw new NotFoundException('Student not found');
    }

    const where: any = { schoolId: validSchoolId };
    if (studentId) where.studentId = studentId;

    const activities = await this.prisma.activity.findMany({
      where,
      include: {
        student: {
          include: {
            user: { select: { firstName: true, lastName: true } },
            enrollments: { include: { section: { include: { class: true } } } },
          },
        },
      },
      orderBy: { date: 'desc' },
    });

    return activities.map((a) => ({
      ...a,
      category: a.icon || 'ACADEMIC',
    }));
  }

  async createActivity(schoolId: string, dto: CreateActivityDto) {
    const validSchoolId = requireSchoolId(schoolId);
    const student = await this.prisma.student.findFirst({
      where: { id: dto.studentId, schoolId: validSchoolId },
    });
    if (!student) throw new NotFoundException('Student not found');

    const created = await this.prisma.activity.create({
      data: {
        schoolId: validSchoolId,
        studentId: dto.studentId,
        title: dto.title,
        event: dto.event,
        date: new Date(dto.date),
        icon: dto.category ?? 'ACADEMIC',
        description: dto.description,
      },
    });

    return {
      ...created,
      category: created.icon || 'ACADEMIC',
    };
  }

  async updateActivity(schoolId: string, activityId: string, dto: UpdateActivityDto) {
    const validSchoolId = requireSchoolId(schoolId);
    const activity = await this.prisma.activity.findFirst({
      where: { id: activityId, schoolId: validSchoolId },
    });
    if (!activity) throw new NotFoundException('Activity not found');

    const updateData: Record<string, unknown> = {};
    if (dto.title !== undefined) updateData.title = dto.title;
    if (dto.event !== undefined) updateData.event = dto.event;
    if (dto.date !== undefined) updateData.date = new Date(dto.date);
    if (dto.category !== undefined) updateData.icon = dto.category;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.studentId !== undefined) {
      const student = await this.prisma.student.findFirst({
        where: { id: dto.studentId, schoolId: validSchoolId },
      });
      if (!student) throw new NotFoundException('Student not found');
      updateData.studentId = dto.studentId;
    }

    const updated = await this.prisma.activity.update({
      where: { id: activity.id },
      data: updateData,
    });

    return {
      ...updated,
      category: updated.icon || 'ACADEMIC',
    };
  }

  async deleteActivity(schoolId: string, activityId: string) {
    const validSchoolId = requireSchoolId(schoolId);
    const activity = await this.prisma.activity.findFirst({
      where: { id: activityId, schoolId: validSchoolId },
    });
    if (!activity) throw new NotFoundException('Activity not found');

    return this.prisma.activity.delete({
      where: { id: activity.id },
    });
  }
}
