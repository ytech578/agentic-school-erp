import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';

@Injectable()
export class SchoolsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.school.findMany();
  }

  async findById(id: string) {
    return this.prisma.school.findUnique({ where: { id } });
  }

  async findCurrent(schoolId: string) {
    const school = await this.prisma.school.findUnique({ where: { id: schoolId } });
    if (!school) throw new NotFoundException('School not found');
    return school;
  }

  async updateSchool(schoolId: string, data: any) {
    return this.prisma.school.update({
      where: { id: schoolId },
      data: {
        name: data.name,
        phone: data.phone,
        email: data.email,
        city: data.city,
        state: data.state,
        boardType: data.boardType,
      },
    });
  }

  async getAcademicYears(schoolId: string) {
    return this.prisma.academicYear.findMany({
      where: { schoolId },
      orderBy: { startDate: 'desc' },
    });
  }

  async createAcademicYear(schoolId: string, data: { name: string; startDate: string; endDate: string }) {
    // Deactivate all other years and set this one as active
    return this.prisma.academicYear.create({
      data: {
        schoolId,
        name: data.name,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        isActive: true,
      },
    });
  }

  async setActiveAcademicYear(schoolId: string, yearId: string) {
    // Deactivate all, then activate selected
    await this.prisma.academicYear.updateMany({
      where: { schoolId },
      data: { isActive: false },
    });
    return this.prisma.academicYear.update({
      where: { id: yearId },
      data: { isActive: true },
    });
  }
}
