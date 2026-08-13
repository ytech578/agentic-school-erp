import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';

@Injectable()
export class ClassesService {
  constructor(private prisma: PrismaService) {}

  async findAll(schoolId: string) {
    return this.prisma.class.findMany({
      where: { schoolId },
      include: { sections: true },
      orderBy: { name: 'asc' },
    });
  }

  async findSections(schoolId: string, classId: string) {
    return this.prisma.section.findMany({
      where: { classId, class: { schoolId } },
      orderBy: { name: 'asc' },
    });
  }

  async findAllSubjects(schoolId: string) {
    return this.prisma.subject.findMany({
      where: { schoolId, isActive: true },
      orderBy: { name: 'asc' },
    });
  }
}
