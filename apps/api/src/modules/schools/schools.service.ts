import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { requireSchoolId } from '../../core/tenant/tenant.util';

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
    const validSchoolId = requireSchoolId(schoolId);
    const school = await this.prisma.school.findUnique({
      where: { id: validSchoolId },
    });
    if (!school) throw new NotFoundException('School not found');
    return school;
  }

  async updateSchool(schoolId: string, data: any) {
    const validSchoolId = requireSchoolId(schoolId);
    return this.prisma.school.update({
      where: { id: validSchoolId },
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
    const validSchoolId = requireSchoolId(schoolId);
    return this.prisma.academicYear.findMany({
      where: { schoolId: validSchoolId },
      orderBy: { startDate: 'desc' },
    });
  }

  async createAcademicYear(
    schoolId: string,
    data: { name: string; startDate: string; endDate: string },
  ) {
    const validSchoolId = requireSchoolId(schoolId);
    // Deactivate all other years and set this one as active
    return this.prisma.academicYear.create({
      data: {
        schoolId: validSchoolId,
        name: data.name,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        isActive: true,
      },
    });
  }

  async setActiveAcademicYear(schoolId: string, yearId: string) {
    const validSchoolId = requireSchoolId(schoolId);

    const year = await this.prisma.academicYear.findFirst({
      where: { id: yearId, schoolId: validSchoolId },
    });
    if (!year) {
      throw new NotFoundException('Academic year not found');
    }

    // Deactivate all for this school, then activate selected
    await this.prisma.academicYear.updateMany({
      where: { schoolId: validSchoolId },
      data: { isActive: false },
    });
    return this.prisma.academicYear.update({
      where: { id: year.id },
      data: { isActive: true },
    });
  }
}
