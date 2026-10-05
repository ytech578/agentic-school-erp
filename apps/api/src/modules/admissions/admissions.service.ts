import {
  Injectable,
  Optional,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { AdmissionStatus, EnquiryStatus, Gender } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { requireSchoolId } from '../../core/tenant/tenant.util';
import { generateNextSequence } from '../../core/database/sequence.util';
import { StorageService } from '../../services/storage/storage.service';

@Injectable()
export class AdmissionsService {
  constructor(
    private prisma: PrismaService,
    @Optional() private storageService?: StorageService,
  ) {}

  // ================= ENQUIRIES =================

  async createEnquiry(schoolId: string, data: any) {
    const validSchoolId = requireSchoolId(schoolId, 'Create admission enquiry');
    const activeYear = await this.prisma.academicYear.findFirst({
      where: { schoolId: validSchoolId, isActive: true },
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
        schoolId: validSchoolId,
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
    const validSchoolId = requireSchoolId(schoolId, 'List admission enquiries');
    return this.prisma.admissionEnquiry.findMany({
      where: { schoolId: validSchoolId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateEnquiryStatus(
    schoolId: string,
    id: string,
    status: EnquiryStatus,
  ) {
    const validSchoolId = requireSchoolId(schoolId, 'Update enquiry status');
    return this.prisma.admissionEnquiry.update({
      where: { id, schoolId: validSchoolId },
      data: { status },
    });
  }

  async calculateLeadScores(schoolId: string) {
    const validSchoolId = requireSchoolId(schoolId, 'Calculate lead scores');
    const enquiries = await this.prisma.admissionEnquiry.findMany({
      where: { schoolId: validSchoolId },
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
    const validSchoolId = requireSchoolId(
      schoolId,
      'Create admission application',
    );
    const activeYear = await this.prisma.academicYear.findFirst({
      where: { schoolId: validSchoolId, isActive: true },
    });
    if (!activeYear)
      throw new BadRequestException('No active academic year found');

    const applicationNo = await generateNextSequence(
      this.prisma,
      validSchoolId,
      'APP',
    );

    return this.prisma.admissionApplication.create({
      data: {
        schoolId: validSchoolId,
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
    const validSchoolId = requireSchoolId(
      schoolId,
      'List admission applications',
    );
    return this.prisma.admissionApplication.findMany({
      where: { schoolId: validSchoolId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getApplicationById(schoolId: string, id: string) {
    const validSchoolId = requireSchoolId(
      schoolId,
      'Get admission application',
    );
    const app = await this.prisma.admissionApplication.findFirst({
      where: { id, schoolId: validSchoolId },
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
    const validSchoolId = requireSchoolId(
      schoolId,
      'Update application status',
    );
    return this.prisma.admissionApplication.update({
      where: { id, schoolId: validSchoolId },
      data: { status },
    });
  }

  async getEnrollmentPreview(schoolId: string, id: string) {
    const validSchoolId = requireSchoolId(schoolId, 'Get enrollment preview');
    const app = await this.prisma.admissionApplication.findFirst({
      where: { id, schoolId: validSchoolId },
    });
    if (!app) throw new NotFoundException('Application not found');

    const classes = await this.prisma.class.findMany({
      where: {
        schoolId: validSchoolId,
        ...(app.academicYearId ? { academicYearId: app.academicYearId } : {}),
      },
      include: {
        sections: {
          include: {
            _count: {
              select: { enrollments: { where: { status: 'ACTIVE' } } },
            },
          },
          orderBy: { name: 'asc' },
        },
      },
      orderBy: [{ numericLevel: 'asc' }, { name: 'asc' }],
    });

    const students = await this.prisma.student.findMany({
      where: { schoolId: validSchoolId },
      select: { admissionNumber: true },
      orderBy: { createdAt: 'desc' },
    });
    let maxNum = 0;
    let useCompactAdmPattern = false;
    for (const s of students) {
      const adm = s.admissionNumber || '';
      const mCompact = adm.match(/^ADM26(\d+)$/i);
      if (mCompact) {
        const n = parseInt(mCompact[1], 10);
        if (n > maxNum) {
          maxNum = n;
          useCompactAdmPattern = true;
        }
        continue;
      }
      const mDash = adm.match(/^ADM-(?:\d{4})-(\d+)$/i);
      if (mDash) {
        const n = parseInt(mDash[1], 10);
        if (n > maxNum && !useCompactAdmPattern) {
          maxNum = n;
        }
      }
    }
    const nextSeq = maxNum > 0 ? maxNum + 1 : students.length + 1;
    const nextAdmissionNumber = useCompactAdmPattern
      ? `ADM26${String(nextSeq).padStart(4, '0')}`
      : `ADM-${new Date().getFullYear()}-${String(nextSeq).padStart(4, '0')}`;

    return {
      application: app,
      classes,
      nextAdmissionNumber,
    };
  }

  async rejectApplication(schoolId: string, id: string, reason?: string) {
    const validSchoolId = requireSchoolId(
      schoolId,
      'Reject admission application',
    );
    const app = await this.prisma.admissionApplication.findFirst({
      where: { id, schoolId: validSchoolId },
    });
    if (!app) throw new NotFoundException('Application not found');
    if (app.convertedStudentId) {
      throw new BadRequestException(
        'Cannot reject an application that is already enrolled as a student',
      );
    }

    const updatedNotes = reason
      ? app.interviewNotes
        ? `${app.interviewNotes}\n[Rejected]: ${reason}`
        : `[Rejected]: ${reason}`
      : app.interviewNotes;

    return this.prisma.admissionApplication.update({
      where: { id: app.id },
      data: {
        status: AdmissionStatus.REJECTED,
        interviewNotes: updatedNotes,
      },
    });
  }

  async convertApplicationToStudent(
    schoolId: string,
    id: string,
    options?: { classId?: string; sectionId?: string; rollNumber?: string },
  ) {
    const validSchoolId = requireSchoolId(
      schoolId,
      'Convert application to student',
    );
    const app = await this.prisma.admissionApplication.findFirst({
      where: { id, schoolId: validSchoolId },
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

    const birthYear = app.dateOfBirth
      ? new Date(app.dateOfBirth).getFullYear()
      : '2026';
    const tempPassword = `Std@${birthYear}!${Math.random().toString(36).slice(-4)}`;
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    return this.prisma.$transaction(async (tx: any) => {
      // 1. Resolve Target Class and Section
      let targetSection: any = null;

      if (options?.sectionId) {
        targetSection = await tx.section.findFirst({
          where: {
            id: options.sectionId,
            class: { schoolId: validSchoolId },
          },
          include: { class: true },
        });
      } else if (options?.classId) {
        targetSection = await tx.section.findFirst({
          where: {
            classId: options.classId,
            class: { schoolId: validSchoolId },
          },
          include: { class: true },
          orderBy: { name: 'asc' },
        });
      }

      // If not explicitly provided, heuristically resolve from classApplied and interviewNotes
      if (!targetSection && tx.class?.findMany) {
        const textToAnalyze =
          `${app.classApplied || ''} ${app.interviewNotes || ''}`.toLowerCase();

        let targetLevel: number | null = null;
        const numMatch = textToAnalyze.match(
          /(?:class|grade|standard|std)?\s*(\d{1,2})/i,
        );
        if (numMatch) {
          targetLevel = parseInt(numMatch[1], 10);
        } else if (/\bone\b|\bfirst\b/i.test(textToAnalyze)) {
          targetLevel = 1;
        } else if (/\btwo\b|\bsecond\b/i.test(textToAnalyze)) {
          targetLevel = 2;
        } else if (/\bthree\b|\bthird\b/i.test(textToAnalyze)) {
          targetLevel = 3;
        } else if (/\bfour\b|\bfourth\b/i.test(textToAnalyze)) {
          targetLevel = 4;
        } else if (/\bfive\b|\bfifth\b/i.test(textToAnalyze)) {
          targetLevel = 5;
        } else if (/\bsix\b|\bsixth\b/i.test(textToAnalyze)) {
          targetLevel = 6;
        } else if (/\bseven\b|\bseventh\b/i.test(textToAnalyze)) {
          targetLevel = 7;
        } else if (/\beight\b|\beighth\b/i.test(textToAnalyze)) {
          targetLevel = 8;
        } else if (/\bnine\b|\bninth\b/i.test(textToAnalyze)) {
          targetLevel = 9;
        } else if (/\bten\b|\btenth\b/i.test(textToAnalyze)) {
          targetLevel = 10;
        }

        let targetSectionName: string | null = null;
        const secMatch = textToAnalyze.match(/(?:section|\b)\s*([a-e])\b/i);
        if (secMatch) {
          targetSectionName = secMatch[1].toUpperCase();
        }

        const candidateClasses = await tx.class.findMany({
          where: {
            schoolId: validSchoolId,
            ...(app.academicYearId
              ? { academicYearId: app.academicYearId }
              : {}),
            ...(targetLevel !== null
              ? {
                  OR: [
                    {
                      name: { contains: `${targetLevel}`, mode: 'insensitive' },
                    },
                    { numericLevel: targetLevel },
                    { numericLevel: targetLevel + 2 },
                  ],
                }
              : {}),
          },
          include: { sections: { orderBy: { name: 'asc' } } },
        });

        if (candidateClasses.length > 0) {
          const chosenClass = candidateClasses[0];
          if (chosenClass.sections.length > 0) {
            targetSection = targetSectionName
              ? chosenClass.sections.find(
                  (s: any) => s.name.toUpperCase() === targetSectionName,
                ) || chosenClass.sections[0]
              : chosenClass.sections[0];
          }
        }
      }

      // Determine Roll Number in the target section
      let assignedRollNumber = options?.rollNumber || null;
      if (
        !assignedRollNumber &&
        targetSection &&
        tx.studentEnrollment?.findMany
      ) {
        const sectionEnrollments = await tx.studentEnrollment.findMany({
          where: { sectionId: targetSection.id, status: 'ACTIVE' },
          select: { rollNumber: true },
        });
        let maxRoll = 0;
        for (const e of sectionEnrollments) {
          if (e.rollNumber) {
            const parsed = parseInt(e.rollNumber, 10);
            if (!isNaN(parsed) && parsed > maxRoll) maxRoll = parsed;
          }
        }
        assignedRollNumber = String(maxRoll + 1).padStart(2, '0');
      }

      // 2. Create user for student with hashed credentials
      const user = await tx.user.create({
        data: {
          email: app.parentEmail
            ? `student_${app.applicationNo}@example.com`
            : `temp_${app.applicationNo}@example.com`,
          passwordHash,
          firstName: app.studentName.split(' ')[0],
          lastName: app.studentName.split(' ').slice(1).join(' ') || 'Student',
          role: 'STUDENT',
          schoolId: validSchoolId,
        },
      });

      // 3. Atomically generate continuous sequential admission number matching school pattern
      const admissionNumber = await generateNextSequence(
        tx,
        validSchoolId,
        'ADM',
      );

      // 4. Create Student record with roll number
      const student = await tx.student.create({
        data: {
          schoolId: validSchoolId,
          userId: user.id,
          admissionNumber,
          rollNumber: assignedRollNumber,
          dateOfBirth: app.dateOfBirth,
          gender: app.gender,
          religion: app.religion,
          caste: app.category,
          address: app.address,
          previousSchool: app.previousSchool,
        },
      });

      // 5. Create Active Student Enrollment
      let enrollment: any = null;
      if (targetSection && tx.studentEnrollment?.create) {
        enrollment = await tx.studentEnrollment.create({
          data: {
            studentId: student.id,
            sectionId: targetSection.id,
            academicYearId: app.academicYearId,
            rollNumber: assignedRollNumber,
            status: 'ACTIVE',
          },
          include: {
            section: {
              include: { class: true },
            },
          },
        });
      }

      // 6. Create guardian
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

      // 7. Update application
      const updatedApp = await tx.admissionApplication.update({
        where: { id: app.id },
        data: {
          convertedStudentId: student.id,
          status: AdmissionStatus.ACCEPTED,
        },
      });

      return {
        student,
        enrollment,
        application: updatedApp,
        temporaryPassword: tempPassword,
      };
    });
  }

  async getAnalytics(schoolId: string) {
    const validSchoolId = requireSchoolId(schoolId, 'Get admission analytics');
    const [enquiries, applications] = await Promise.all([
      this.prisma.admissionEnquiry.groupBy({
        by: ['status'],
        where: { schoolId: validSchoolId },
        _count: true,
      }),
      this.prisma.admissionApplication.groupBy({
        by: ['status'],
        where: { schoolId: validSchoolId },
        _count: true,
      }),
    ]);

    const activeYear = await this.prisma.academicYear.findFirst({
      where: { schoolId: validSchoolId, isActive: true },
    });

    const recentApplications = await this.prisma.admissionApplication.findMany({
      where: { schoolId: validSchoolId, academicYearId: activeYear?.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    return { enquiries, applications, recentApplications };
  }

  // ================= ADMISSION DOCUMENTS =================

  async uploadApplicationDocument(
    schoolId: string,
    applicationId: string,
    file: {
      buffer: Buffer;
      originalname: string;
      mimetype: string;
      size: number;
    },
    documentType: string,
  ) {
    const validSchoolId = requireSchoolId(
      schoolId,
      'Upload admission document',
    );
    const application = await this.prisma.admissionApplication.findFirst({
      where: { id: applicationId, schoolId: validSchoolId },
    });
    if (!application) {
      throw new NotFoundException('Admission application not found');
    }

    if (!file) throw new BadRequestException('File is required');

    const allowedMimeTypes = ['application/pdf', 'image/png', 'image/jpeg'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        'Only PDF, PNG, and JPEG files are permitted',
      );
    }

    if (file.size > 10 * 1024 * 1024) {
      throw new BadRequestException('File size exceeds the 10MB limit');
    }

    if (!this.storageService) {
      throw new BadRequestException('Storage service is not configured');
    }

    const uploadResult = await this.storageService.uploadFile(
      file.buffer,
      file.originalname,
      file.mimetype,
      `admissions/${validSchoolId}/${applicationId}`,
    );

    return this.prisma.admissionDocument.create({
      data: {
        applicationId: application.id,
        documentType: documentType || 'GENERAL_DOCUMENT',
        fileUrl: uploadResult.url,
      },
    });
  }

  async getApplicationDocuments(schoolId: string, applicationId: string) {
    const validSchoolId = requireSchoolId(schoolId, 'List admission documents');
    const application = await this.prisma.admissionApplication.findFirst({
      where: { id: applicationId, schoolId: validSchoolId },
      include: {
        documents: true,
      },
    });
    if (!application) {
      throw new NotFoundException('Admission application not found');
    }
    return application.documents;
  }

  async getApplicationDocumentStream(
    schoolId: string,
    applicationId: string,
    documentId: string,
  ) {
    const validSchoolId = requireSchoolId(
      schoolId,
      'Download admission document',
    );
    const doc = await this.prisma.admissionDocument.findFirst({
      where: {
        id: documentId,
        application: { id: applicationId, schoolId: validSchoolId },
      },
    });
    if (!doc) throw new NotFoundException('Document not found');

    if (!this.storageService) {
      throw new BadRequestException('Storage service is not configured');
    }

    const fileStreamResult = await this.storageService.getFileStream(
      doc.fileUrl,
    );
    return { doc, fileStreamResult };
  }

  async deleteApplicationDocument(
    schoolId: string,
    applicationId: string,
    documentId: string,
  ) {
    const validSchoolId = requireSchoolId(
      schoolId,
      'Delete admission document',
    );
    const doc = await this.prisma.admissionDocument.findFirst({
      where: {
        id: documentId,
        application: { id: applicationId, schoolId: validSchoolId },
      },
    });
    if (!doc) throw new NotFoundException('Document not found');

    if (!this.storageService) {
      throw new BadRequestException('Storage service is not configured');
    }

    await this.storageService.deleteFile(doc.fileUrl);
    await this.prisma.admissionDocument.delete({ where: { id: documentId } });
    return { success: true, message: 'Document deleted successfully' };
  }
}
