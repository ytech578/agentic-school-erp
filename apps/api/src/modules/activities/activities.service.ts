import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';

@Injectable()
export class ActivitiesService {
  constructor(private prisma: PrismaService) {}

  async listActivities(schoolId: string, studentId?: string) {
    const where: any = { schoolId };
    if (studentId) where.studentId = studentId;

    return this.prisma.activity.findMany({
      where,
      include: {
        student: {
          include: {
            user: { select: { firstName: true, lastName: true } },
            enrollments: { include: { section: { include: { class: true } } } }
          }
        }
      },
      orderBy: { date: 'desc' }
    });
  }

  async createActivity(schoolId: string, data: any) {
    return this.prisma.activity.create({
      data: {
        schoolId,
        studentId: data.studentId,
        title: data.title,
        event: data.event,
        date: new Date(data.date),
        icon: data.icon || 'award',
        description: data.description,
      }
    });
  }

  async deleteActivity(schoolId: string, activityId: string) {
    const activity = await this.prisma.activity.findFirst({
      where: { id: activityId, schoolId }
    });
    if (!activity) throw new NotFoundException('Activity not found');

    return this.prisma.activity.delete({
      where: { id: activityId }
    });
  }
}
