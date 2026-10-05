import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../core/database/prisma.service';
import { requireSchoolId } from '../../core/tenant/tenant.util';
import {
  RecordParentalConsentDto,
  CreateDataPrivacyRequestDto,
  UpdateDataPrivacyRequestStatusDto,
} from './dto/dpdp.dto';
import { StorageService } from '../../services/storage/storage.service';
import JSZip from 'jszip';

@Injectable()
export class DpdpService {
  private readonly logger = new Logger(DpdpService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  // ─── GDPR/DPDP DATA RETENTION POLICY (Auto-Purge Scheduler) ───────────────
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async purgeOldAuditLogs() {
    this.logger.log(
      'Running GDPR/DPDP data retention policy: purging old activity logs...',
    );
    try {
      // DPDP guidelines suggest limiting retention unless legally required.
      // We auto-purge audit logs older than 3 years (1095 days) by default.
      const retentionDays = 1095;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const result = await this.prisma.activityLog.deleteMany({
        where: {
          createdAt: {
            lt: cutoffDate,
          },
        },
      });

      this.logger.log(
        `Purged ${result.count} outdated activity logs older than ${retentionDays} days.`,
      );
    } catch (error) {
      this.logger.error('Failed to execute DPDP data retention purge', error);
    }
  }

  // ─── 1. VERIFIABLE PARENTAL CONSENT (Section 9) ───────────────────────────

  async recordParentalConsent(
    schoolId: string,
    guardianUserId: string,
    dto: RecordParentalConsentDto,
    ipAddress?: string,
  ) {
    const validSchoolId = requireSchoolId(schoolId);

    // Verify student exists and belongs to school
    const student = await this.prisma.student.findFirst({
      where: { id: dto.studentId, schoolId: validSchoolId },
      include: { guardians: true },
    });

    if (!student) {
      throw new NotFoundException(
        `Student with ID '${dto.studentId}' not found in this school.`,
      );
    }

    // Verify requesting guardian is associated with the student (unless school admin)
    const isGuardian = student.guardians.some(
      (g) => g.userId === guardianUserId,
    );
    if (!isGuardian) {
      throw new ForbiddenException(
        `User ${guardianUserId} is not authorized as a verified guardian for student ${dto.studentId}`,
      );
    }

    const now = new Date();
    return this.prisma.dataConsent.upsert({
      where: {
        studentId_consentType: {
          studentId: dto.studentId,
          consentType: dto.consentType,
        },
      },
      create: {
        schoolId: validSchoolId,
        studentId: dto.studentId,
        guardianId: guardianUserId,
        consentType: dto.consentType,
        isGranted: dto.isGranted,
        grantedAt: dto.isGranted ? now : null,
        revokedAt: dto.isGranted ? null : now,
        ipAddress: ipAddress || '127.0.0.1',
        consentNoticeVersion: dto.consentNoticeVersion || '1.0',
      },
      update: {
        isGranted: dto.isGranted,
        grantedAt: dto.isGranted ? now : undefined,
        revokedAt: dto.isGranted ? null : now,
        ipAddress: ipAddress || '127.0.0.1',
        consentNoticeVersion: dto.consentNoticeVersion || '1.0',
        guardianId: guardianUserId,
      },
    });
  }

  async grantOrRevokeConsent(
    schoolId: string,
    guardianUserId: string,
    ipAddress: string,
    dto: RecordParentalConsentDto,
  ) {
    // Delegates to recordParentalConsent — kept for controller backwards-compat
    return this.recordParentalConsent(schoolId, guardianUserId, dto, ipAddress);
  }

  async getStudentConsents(
    schoolId: string,
    studentId: string,
    requestingUserId?: string,
    requestingUserRole?: string,
  ) {
    const validSchoolId = requireSchoolId(schoolId);

    const isElevated = [
      'SUPER_ADMIN',
      'SCHOOL_ADMIN',
      'PRINCIPAL',
      'TEACHER',
    ].includes(requestingUserRole ?? '');

    // Non-elevated users (PARENT, STUDENT) may only view consents for their own ward
    if (!isElevated && requestingUserId) {
      const student = await this.prisma.student.findFirst({
        where: { id: studentId, schoolId: validSchoolId },
        include: { guardians: { select: { userId: true } } },
      });

      if (!student) {
        throw new NotFoundException(`Student not found in this school.`);
      }

      const isGuardian = student.guardians.some(
        (g) => g.userId === requestingUserId,
      );
      const isOwnRecord =
        requestingUserRole === 'STUDENT' &&
        (await this.prisma.student.findFirst({
          where: { id: studentId, userId: requestingUserId },
        })) !== null;

      if (!isGuardian && !isOwnRecord) {
        throw new ForbiddenException(
          'You are not authorized to view consent records for this student.',
        );
      }
    }

    return this.prisma.dataConsent.findMany({
      where: {
        schoolId: validSchoolId,
        studentId,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─── 2. DATA PRIVACY REQUESTS (Subject Rights Engine) ─────────────────────

  async createPrivacyRequest(
    schoolId: string,
    userId: string,
    dto: CreateDataPrivacyRequestDto,
  ) {
    const validSchoolId = requireSchoolId(schoolId);

    // Pending requests limit per user (prevent spam)
    const pendingCount = await this.prisma.dataPrivacyRequest.count({
      where: {
        schoolId: validSchoolId,
        userId,
        status: { in: ['PENDING', 'PROCESSING'] },
      },
    });

    if (pendingCount >= 3) {
      throw new BadRequestException(
        'You have active privacy requests already pending processing.',
      );
    }

    const request = await this.prisma.dataPrivacyRequest.create({
      data: {
        schoolId: validSchoolId,
        userId,
        requestType: dto.requestType,
        status: 'PENDING',
      },
    });

    if (dto.requestType === 'EXPORT_DATA') {
      // Trigger async processing of personal data export
      this.processExportRequest(validSchoolId, request.id).catch((err) => {
        this.logger.error(
          `Async DPDP export failed for request ${request.id}: ${err.message}`,
          err.stack,
        );
      });
    }

    return request;
  }

  async getPrivacyRequests(
    schoolId: string | null,
    filtersOrUserId?: any,
    userRole?: string,
  ) {
    const where: any = schoolId ? { schoolId } : {};
    if (typeof filtersOrUserId === 'string') {
      if (
        userRole &&
        !['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL'].includes(userRole)
      ) {
        where.userId = filtersOrUserId;
      }
    } else if (filtersOrUserId && typeof filtersOrUserId === 'object') {
      if (filtersOrUserId.status) where.status = filtersOrUserId.status;
      if (filtersOrUserId.requestType)
        where.requestType = filtersOrUserId.requestType;
      if (filtersOrUserId.userId) where.userId = filtersOrUserId.userId;
    }

    return this.prisma.dataPrivacyRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async updatePrivacyRequestStatus(
    schoolId: string,
    requestId: string,
    dto: UpdateDataPrivacyRequestStatusDto,
  ) {
    const validSchoolId = requireSchoolId(schoolId);

    const request = await this.prisma.dataPrivacyRequest.findFirst({
      where: { id: requestId, schoolId: validSchoolId },
    });

    if (!request) {
      throw new NotFoundException(`Data privacy request not found.`);
    }

    return this.prisma.dataPrivacyRequest.update({
      where: { id: requestId },
      data: {
        status: dto.status,
        exportDownloadUrl: dto.exportDownloadUrl ?? request.exportDownloadUrl,
        rejectionReason: dto.rejectionReason ?? request.rejectionReason,
        processedAt: ['COMPLETED', 'REJECTED'].includes(dto.status)
          ? new Date()
          : request.processedAt,
      },
    });
  }

  async processExportRequest(schoolId: string, requestId: string) {
    const validSchoolId = requireSchoolId(schoolId);

    const request = await this.prisma.dataPrivacyRequest.findFirst({
      where: { id: requestId, schoolId: validSchoolId },
    });

    if (!request) {
      throw new NotFoundException(`Data privacy request not found.`);
    }

    // Set to PROCESSING
    await this.prisma.dataPrivacyRequest.update({
      where: { id: requestId },
      data: { status: 'PROCESSING' },
    });

    try {
      // 1. Gather all personal data
      const exportedData = await this.exportUserData(
        validSchoolId,
        request.userId,
      );

      // 2. Package into a ZIP archive using JSZip
      const zip = new JSZip();

      // Add metadata
      zip.file(
        'metadata.json',
        JSON.stringify(exportedData.exportMetadata, null, 2),
      );

      // Add user profile
      zip.file(
        'user-profile.json',
        JSON.stringify(exportedData.userProfile, null, 2),
      );

      // Add academic records if available
      if (exportedData.academicRecord) {
        zip.file(
          'academic-record.json',
          JSON.stringify(exportedData.academicRecord, null, 2),
        );
      }

      // Add legal notice / README
      const readmeText = `================================================================================
DIGITAL PERSONAL DATA PROTECTION ACT, 2023 (DPDP ACT) - DATA PORTABILITY EXPORT
================================================================================
Request ID: ${request.id}
User ID: ${request.userId}
Export Generated: ${new Date().toISOString()}
Data Fiduciary School ID: ${validSchoolId}

This ZIP bundle contains personal data collected by the school institution in
a structured, commonly used, and machine-readable format pursuant to Section 11
of the Digital Personal Data Protection Act, 2023.

Archive Contents:
- metadata.json: Export compliance headers and reference law
- user-profile.json: Identity, role, and central contact profile
- academic-record.json: Enrollment history, marks, attendance summary, parental consents
================================================================================`;

      zip.file('README.txt', readmeText);

      const zipBuffer = await zip.generateAsync({
        type: 'nodebuffer',
        compression: 'DEFLATE',
        compressionOptions: { level: 9 },
      });

      // 3. Upload to storage
      const fileName = `dpdp-archive-${request.userId}-${Date.now()}.zip`;
      const uploadResult = await this.storage.uploadFile(
        zipBuffer,
        fileName,
        'application/zip',
        `schools/${validSchoolId}/dpdp-exports`,
      );

      // 4. Update request status to COMPLETED
      const completed = await this.prisma.dataPrivacyRequest.update({
        where: { id: requestId },
        data: {
          status: 'COMPLETED',
          exportDownloadUrl: uploadResult.url,
          processedAt: new Date(),
        },
      });

      // 5. Notify user
      try {
        await this.prisma.notification.create({
          data: {
            schoolId: validSchoolId,
            userId: request.userId,
            type: 'GENERAL',
            title: 'Personal Data Archive Ready',
            message:
              'Your personal data export request has been processed. The ZIP archive is ready for download.',
            actionUrl: uploadResult.url,
            metadata: {
              requestId: request.id,
              exportDownloadUrl: uploadResult.url,
            },
          },
        });
      } catch (err: any) {
        this.logger.warn(
          `Failed to notify user for DPDP export completion: ${err.message}`,
        );
      }

      return completed;
    } catch (err: any) {
      await this.prisma.dataPrivacyRequest.update({
        where: { id: requestId },
        data: {
          status: 'REJECTED',
          rejectionReason: `Automated processing failed: ${err.message}`,
          processedAt: new Date(),
        },
      });
      throw err;
    }
  }

  async getExportDownloadStream(
    schoolId: string,
    requestId: string,
    requestingUserId: string,
    requestingUserRole: string,
  ) {
    const validSchoolId = requireSchoolId(schoolId);
    const request = await this.prisma.dataPrivacyRequest.findFirst({
      where: { id: requestId, schoolId: validSchoolId },
    });

    if (!request) {
      throw new NotFoundException(`Data privacy request not found.`);
    }

    const isElevated = ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL'].includes(
      requestingUserRole,
    );

    if (!isElevated && request.userId !== requestingUserId) {
      throw new ForbiddenException(
        `You are not authorized to download this data archive.`,
      );
    }

    if (request.status !== 'COMPLETED' || !request.exportDownloadUrl) {
      throw new BadRequestException(
        `Data export is not yet ready for download (current status: ${request.status}).`,
      );
    }

    return this.storage.getFileStream(request.exportDownloadUrl);
  }

  // ─── 3. DATA PORTABILITY EXPORT (Section 11) ──────────────────────────────

  async exportUserData(schoolId: string, targetUserId: string) {
    const validSchoolId = requireSchoolId(schoolId);

    const user = await this.prisma.user.findFirst({
      where: { id: targetUserId, schoolId: validSchoolId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`User record not found in this school.`);
    }

    // Fetch student data if student
    const student = await this.prisma.student.findFirst({
      where: { userId: targetUserId, schoolId: validSchoolId },
      include: {
        guardians: true,
        enrollments: { include: { section: { include: { class: true } } } },
        attendance: { take: 100, orderBy: { date: 'desc' } },
        marks: {
          include: { examSubject: { include: { exam: true, subject: true } } },
        },
        feePayments: { take: 50, orderBy: { createdAt: 'desc' } },
        dataConsents: true,
      },
    });

    // Fetch activity logs
    const activityLogs = await this.prisma.activityLog.findMany({
      where: { userId: targetUserId },
      take: 100,
      orderBy: { createdAt: 'desc' },
    });

    return {
      exportMetadata: {
        act: 'Digital Personal Data Protection Act, 2023 (DPDP Act)',
        exportDate: new Date().toISOString(),
        dataFiduciarySchoolId: validSchoolId,
      },
      userProfile: user,
      academicRecord: student
        ? {
            studentProfile: {
              admissionNumber: student.admissionNumber,
              gender: student.gender,
              bloodGroup: student.bloodGroup,
            },
            guardians: student.guardians || [],
            enrollments: student.enrollments || [],
            attendanceSummaryCount: student.attendance?.length || 0,
            recentMarks: (student.marks || []).map((m: any) => ({
              subject: m.examSubject?.subject?.name,
              exam: m.examSubject?.exam?.name,
              marksObtained: m.marksObtained,
              grade: m.grade,
            })),
            feePaymentsCount: student.feePayments?.length || 0,
            parentalConsents: student.dataConsents || [],
          }
        : null,
      activityAuditTrailCount: activityLogs.length,
    };
  }

  // ─── 4. RIGHT TO ERASURE / ANONYMIZATION (Section 12) ─────────────────────

  async anonymizeUserData(
    schoolId: string,
    targetUserId: string,
    adminReason: string,
  ) {
    const validSchoolId = requireSchoolId(schoolId);

    const user = await this.prisma.user.findFirst({
      where: { id: targetUserId, schoolId: validSchoolId },
    });

    if (!user) {
      throw new NotFoundException(`User record not found in this school.`);
    }

    const timestamp = Date.now();
    const anonymizedEmail = `erased_${timestamp}@anonymized.dpdp.local`;
    const anonymizedPhone = `0000000000`;

    return this.prisma.$transaction(async (tx) => {
      // 1. Anonymize Central User
      await tx.user.update({
        where: { id: targetUserId },
        data: {
          firstName: 'Anonymized',
          lastName: 'User',
          email: anonymizedEmail,
          phone: anonymizedPhone,
          status: 'SUSPENDED',
        },
      });

      // 2. Anonymize Student Record if exists
      const student = await tx.student.findFirst({
        where: { userId: targetUserId, schoolId: validSchoolId },
      });

      if (student) {
        await tx.student.update({
          where: { id: student.id },
          data: {
            aadhaarNumber: null,
            address: null,
            city: null,
            state: null,
            pinCode: null,
            isActive: false,
          },
        });

        // 3. Clear PII on Guardians
        await tx.guardian.updateMany({
          where: { studentId: student.id },
          data: {
            firstName: 'Anonymized',
            lastName: 'Guardian',
            phone: '0000000000',
            email: null,
            aadhaarNumber: null,
          },
        });
      }

      this.logger.log(
        `[DPDP Act 2023] Anonymized user ${targetUserId} in school ${validSchoolId}. Reason: ${adminReason}`,
      );

      return {
        success: true,
        message:
          'Personal data has been irreversibly anonymized in compliance with DPDP Act 2023 Section 12.',
        erasedUserId: targetUserId,
      };
    });
  }

  async getComplianceStats(schoolId: string | null) {
    const validSchoolId = requireSchoolId(schoolId);

    const [
      totalConsents,
      activeConsents,
      totalRequests,
      pendingErasure,
      completedExports,
      school,
    ] = await Promise.all([
      this.prisma.dataConsent.count({ where: { schoolId: validSchoolId } }),
      this.prisma.dataConsent.count({
        where: { schoolId: validSchoolId, isGranted: true },
      }),
      this.prisma.dataPrivacyRequest.count({
        where: { schoolId: validSchoolId },
      }),
      this.prisma.dataPrivacyRequest.count({
        where: {
          schoolId: validSchoolId,
          requestType: 'DATA_ERASURE',
          status: { not: 'COMPLETED' },
        },
      }),
      this.prisma.dataPrivacyRequest.count({
        where: {
          schoolId: validSchoolId,
          requestType: 'DATA_EXPORT',
          status: 'COMPLETED',
        },
      }),
      this.prisma.school.findUnique({
        where: { id: validSchoolId },
        select: { name: true, email: true, phone: true, principalName: true },
      }),
    ]);

    const consentRate =
      totalConsents > 0
        ? Math.round((activeConsents / totalConsents) * 100)
        : 100;

    return {
      totalConsents,
      activeConsents,
      withdrawnConsents: totalConsents - activeConsents,
      consentRate,
      totalRequests,
      pendingErasure,
      completedExports,
      dpoOfficer: {
        name: school?.principalName || 'Institutional Data Protection Officer',
        email: school?.email || 'dpo@school.internal',
        phone: school?.phone || '+91 80 2345 6789',
        address: 'School Administration Wing, DPDP Grievance Cell',
        statutoryWindowDays: 30,
      },
    };
  }
}
