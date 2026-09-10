import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { requireSchoolId } from '../../core/tenant/tenant.util';

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
    const validSchoolId = requireSchoolId(schoolId);
    const student = await this.prisma.student.findFirst({
      where: { id: data.studentId, schoolId: validSchoolId },
    });
    if (!student) throw new NotFoundException('Student not found');

    return this.prisma.activity.create({
      data: {
        schoolId: validSchoolId,
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
    const validSchoolId = requireSchoolId(schoolId);
    const activity = await this.prisma.activity.findFirst({
      where: { id: activityId, schoolId: validSchoolId }
    });
    if (!activity) throw new NotFoundException('Activity not found');

    return this.prisma.activity.delete({
      where: { id: activity.id }
    });
  }
}
