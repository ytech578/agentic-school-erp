import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { AdmissionStatus, EnquiryStatus, Gender } from '@prisma/client';

@Injectable()
export class AdmissionsService {
  constructor(private prisma: PrismaService) {}

  // ================= ENQUIRIES =================

  async createEnquiry(schoolId: string, data: any) {
    const activeYear = await this.prisma.academicYear.findFirst({
      where: { schoolId, isActive: true },
    });
    if (!activeYear)
      throw new BadRequestException('No active academic year found');

    // Calculate simple lead score based on source and phone
    let leadScore = 50;
    if (data.source === 'WEBSITE') leadScore += 20;
    if (data.source === 'REFERRAL') leadScore += 30;
    if (data.phone) leadScore += 10;

    let nextAction = 'Call parent to schedule tour';
    if (leadScore >= 80) nextAction = 'Send fast-track application link';

    return this.prisma.admissionEnquiry.create({
      data: {
        schoolId,
        academicYearId: activeYear.id,
        studentName: data.studentName,
        dob: data.dob ? new Date(data.dob) : null,
        classApplied: data.classApplied,
        parentName: data.parentName,
        phone: data.phone,
        email: data.email,
        source: data.source,
        notes: data.notes,
        followUpDate: data.followUpDate ? new Date(data.followUpDate) : null,
        status: data.status || EnquiryStatus.NEW,
        leadScore,
        nextAction,
      },
    });
  }

  async findAllEnquiries(schoolId: string) {
    return this.prisma.admissionEnquiry.findMany({
      where: { schoolId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateEnquiryStatus(
    schoolId: string,
    id: string,
    status: EnquiryStatus,
  ) {
    return this.prisma.admissionEnquiry.update({
      where: { id, schoolId },
      data: { status },
    });
  }

  async calculateLeadScores(schoolId: string) {
    const enquiries = await this.prisma.admissionEnquiry.findMany({
      where: { schoolId },
    });

    let updatedCount = 0;
    for (const enquiry of enquiries) {
      // Logic for lead scoring
      let score = 40; // Base score

      // Source bonus
      if (enquiry.source === 'REFERRAL') score += 35;
      else if (enquiry.source === 'WEBSITE') score += 25;
      else if (enquiry.source === 'WALK_IN') score += 15;

      // Contact info bonus
      if (enquiry.email) score += 10;
      if (enquiry.phone) score += 10;

      // Status adjustments
      if (enquiry.status === 'INTERESTED') score += 20;
      if (enquiry.status === 'NOT_INTERESTED') score = 0;
      if (enquiry.status === 'CONVERTED') score = 100;

      // Cap at 99 for non-converted
      if (score > 99 && enquiry.status !== 'CONVERTED') score = 99;

      let nextAction = 'Send introductory email';
      if (score >= 80) nextAction = 'Priority: Call to schedule tour';
      else if (score >= 60) nextAction = 'Follow up via WhatsApp';

      if (enquiry.status === 'CONVERTED') nextAction = 'Enrollment complete';
      if (enquiry.status === 'NOT_INTERESTED') nextAction = 'Archive';

      await this.prisma.admissionEnquiry.update({
        where: { id: enquiry.id },
        data: { leadScore: score, nextAction },
      });
      updatedCount++;
    }
    return {
      success: true,
      message: `Updated lead scores for ${updatedCount} enquiries`,
    };
  }

  // ================= APPLICATIONS =================

  async createApplication(schoolId: string, data: any) {
    const activeYear = await this.prisma.academicYear.findFirst({
      where: { schoolId, isActive: true },
    });
    if (!activeYear)
      throw new BadRequestException('No active academic year found');

    const appCount = await this.prisma.admissionApplication.count({
      where: { schoolId, academicYearId: activeYear.id },
    });
    const applicationNo = `APP-${new Date().getFullYear()}-${String(appCount + 1).padStart(4, '0')}`;

    return this.prisma.admissionApplication.create({
      data: {
        schoolId,
        academicYearId: activeYear.id,
        applicationNo,
        studentName: data.studentName,
        dateOfBirth: new Date(data.dateOfBirth),
        gender: data.gender as Gender,
        religion: data.religion,
        category: data.category,
        classApplied: data.classApplied,
        previousSchool: data.previousSchool,
        parentName: data.parentName,
        parentEmail: data.parentEmail,
        parentPhone: data.parentPhone,
        address: data.address,
        status: AdmissionStatus.SUBMITTED,
      },
    });
  }

  async findAllApplications(schoolId: string) {
    return this.prisma.admissionApplication.findMany({
      where: { schoolId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getApplicationById(schoolId: string, id: string) {
    const app = await this.prisma.admissionApplication.findUnique({
      where: { id, schoolId },
      include: { documents: true },
    });
    if (!app) throw new NotFoundException('Application not found');
    return app;
  }

  async updateApplicationStatus(
    schoolId: string,
    id: string,
    status: AdmissionStatus,
  ) {
    return this.prisma.admissionApplication.update({
      where: { id, schoolId },
      data: { status },
    });
  }

  async convertApplicationToStudent(schoolId: string, id: string) {
    const app = await this.prisma.admissionApplication.findUnique({
      where: { id, schoolId },
    });
    if (!app) throw new NotFoundException('Application not found');
    if (app.status !== AdmissionStatus.ACCEPTED) {
      throw new BadRequestException(
        'Only ACCEPTED applications can be converted',
      );
    }
    if (app.convertedStudentId) {
      throw new BadRequestException('Application already converted to student');
    }

    return this.prisma.$transaction(async (tx: any) => {
      // Create user for student (randomized credentials for now, could be sent via email later)
      const user = await tx.user.create({
        data: {
          email: app.parentEmail
            ? `student_${app.applicationNo}@example.com`
            : `temp_${app.applicationNo}@example.com`,
          password: 'Password123', // In real app, generate securely
          firstName: app.studentName.split(' ')[0],
          lastName: app.studentName.split(' ').slice(1).join(' '),
          role: 'STUDENT',
          schoolId: schoolId,
        },
      });

      // Find how many students exist to generate admission number
      const studentCount = await tx.student.count({ where: { schoolId } });
      const admissionNumber = `ADM-${new Date().getFullYear()}-${String(studentCount + 1).padStart(4, '0')}`;

      const student = await tx.student.create({
        data: {
          schoolId,
          userId: user.id,
          admissionNumber,
          dateOfBirth: app.dateOfBirth,
          gender: app.gender,
          religion: app.religion,
          caste: app.category,
          address: app.address,
          previousSchool: app.previousSchool,
        },
      });

      // Create guardian
      await tx.guardian.create({
        data: {
          studentId: student.id,
          relationship: 'Parent',
          firstName: app.parentName,
          lastName: '',
          phone: app.parentPhone,
          email: app.parentEmail,
          isPrimary: true,
        },
      });

      // Update application
      const updatedApp = await tx.admissionApplication.update({
        where: { id: app.id },
        data: {
          convertedStudentId: student.id,
          status: AdmissionStatus.ACCEPTED,
        },
      });

      return { student, application: updatedApp };
    });
  }

  async getAnalytics(schoolId: string) {
    const [enquiries, applications] = await Promise.all([
      this.prisma.admissionEnquiry.groupBy({
        by: ['status'],
        where: { schoolId },
        _count: true,
      }),
      this.prisma.admissionApplication.groupBy({
        by: ['status'],
        where: { schoolId },
        _count: true,
      }),
    ]);

    const activeYear = await this.prisma.academicYear.findFirst({
      where: { schoolId, isActive: true },
    });

    const recentApplications = await this.prisma.admissionApplication.findMany({
      where: { schoolId, academicYearId: activeYear?.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    return { enquiries, applications, recentApplications };
  }
}
