import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { StorageService } from '../../services/storage/storage.service';
import { requireSchoolId } from '../../core/tenant/tenant.util';
import {
  CreateCertificateTemplateDto,
  UpdateCertificateTemplateDto,
  IssueCertificateDto,
  BulkIssueCertificateDto,
  RevokeCertificateDto,
} from './dto/certificate.dto';
import * as crypto from 'crypto';
import PDFDocument from 'pdfkit';
import * as QRCode from 'qrcode';

@Injectable()
export class CertificatesService {
  private readonly logger = new Logger(CertificatesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  // ─── 1. TEMPLATE MANAGEMENT ───────────────────────────────────────────────

  async createTemplate(schoolId: string, dto: CreateCertificateTemplateDto) {
    const validSchoolId = requireSchoolId(schoolId);
    return this.prisma.certificateTemplate.create({
      data: {
        schoolId: validSchoolId,
        type: dto.type as any,
        name: dto.name,
        headerText: dto.headerText,
        bodyTemplate: dto.bodyTemplate,
        footerText: dto.footerText,
        signatoryTitle: dto.signatoryTitle || 'Principal',
        includeQrCode:
          dto.includeQrCode !== undefined ? dto.includeQrCode : true,
      },
    });
  }

  async getTemplates(schoolId: string | null) {
    const where: any = { isActive: true };
    if (schoolId) where.schoolId = schoolId;
    return this.prisma.certificateTemplate.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateTemplate(
    schoolId: string,
    templateId: string,
    dto: UpdateCertificateTemplateDto,
  ) {
    const validSchoolId = requireSchoolId(schoolId);

    const template = await this.prisma.certificateTemplate.findFirst({
      where: { id: templateId, schoolId: validSchoolId },
    });

    if (!template) {
      throw new NotFoundException('Certificate template not found.');
    }

    return this.prisma.certificateTemplate.update({
      where: { id: templateId },
      data: {
        type: dto.type ? (dto.type as any) : template.type,
        name: dto.name !== undefined ? dto.name : template.name,
        headerText:
          dto.headerText !== undefined ? dto.headerText : template.headerText,
        bodyTemplate:
          dto.bodyTemplate !== undefined
            ? dto.bodyTemplate
            : template.bodyTemplate,
        footerText:
          dto.footerText !== undefined ? dto.footerText : template.footerText,
        signatoryTitle:
          dto.signatoryTitle !== undefined
            ? dto.signatoryTitle
            : template.signatoryTitle,
        includeQrCode:
          dto.includeQrCode !== undefined
            ? dto.includeQrCode
            : template.includeQrCode,
        isActive:
          dto.isActive !== undefined ? dto.isActive : template.isActive,
      },
    });
  }

  async getCertificates(schoolId: string | null) {
    const where: any = schoolId ? { schoolId } : {};
    return this.prisma.issuedCertificate.findMany({
      where,
      include: {
        student: {
          select: {
            id: true,
            admissionNumber: true,
            dateOfBirth: true,
            gender: true,
            admissionDate: true,
            user: { select: { firstName: true, lastName: true, email: true } },
            enrollments: {
              where: { status: 'ACTIVE' },
              include: {
                section: {
                  include: { class: true },
                },
              },
              take: 1,
            },
            guardians: {
              select: {
                firstName: true,
                lastName: true,
                relationship: true,
              },
            },
          },
        },
        template: {
          select: {
            id: true,
            name: true,
            type: true,
            headerText: true,
            bodyTemplate: true,
            footerText: true,
            signatoryTitle: true,
          },
        },
      },
      orderBy: { issueDate: 'desc' },
    });
  }

  async getCertificateById(schoolId: string, certificateId: string) {
    const validSchoolId = requireSchoolId(schoolId);
    const cert = await this.prisma.issuedCertificate.findFirst({
      where: { id: certificateId, schoolId: validSchoolId },
      include: {
        student: {
          select: {
            id: true,
            admissionNumber: true,
            dateOfBirth: true,
            gender: true,
            admissionDate: true,
            user: { select: { firstName: true, lastName: true, email: true } },
            enrollments: {
              where: { status: 'ACTIVE' },
              include: {
                section: {
                  include: { class: true },
                },
              },
              take: 1,
            },
            guardians: {
              select: {
                firstName: true,
                lastName: true,
                relationship: true,
              },
            },
          },
        },
        template: true,
      },
    });
    if (!cert) {
      throw new NotFoundException(`Certificate record not found.`);
    }
    const school = await this.prisma.school.findUnique({
      where: { id: validSchoolId },
      select: {
        id: true,
        name: true,
        code: true,
        address: true,
        city: true,
        state: true,
        pinCode: true,
        phone: true,
        email: true,
        affiliationNo: true,
        boardType: true,
        principalName: true,
      },
    });
    return { ...cert, school };
  }

  // ─── 2. CERTIFICATE GENERATION & ISSUANCE ─────────────────────────────────

  async issueCertificate(
    schoolId: string,
    issuedByUserId: string,
    dto: IssueCertificateDto,
  ) {
    const validSchoolId = requireSchoolId(schoolId);

    // 1. Fetch student & school records with tenant verification
    const [student, school] = await Promise.all([
      this.prisma.student.findFirst({
        where: { id: dto.studentId, schoolId: validSchoolId },
        include: {
          user: true,
          guardians: true,
          enrollments: {
            where: { status: 'ACTIVE' },
            include: {
              section: {
                include: { class: true },
              },
            },
            take: 1,
          },
        },
      }),
      this.prisma.school.findUnique({
        where: { id: validSchoolId },
      }),
    ]);

    if (!student) {
      throw new NotFoundException(`Student record not found in this school.`);
    }
    if (!school) {
      throw new NotFoundException(`School record not found.`);
    }

    // Resolve certificate type from DTO or Template
    let resolvedType: any = dto.type;
    let template = null;
    if (dto.templateId) {
      template = await this.prisma.certificateTemplate.findUnique({
        where: { id: dto.templateId },
      });
      if (template && !resolvedType) {
        resolvedType = template.type;
      }
    }
    if (!resolvedType) {
      resolvedType = 'BONAFIDE';
    }

    // 2. Determine Certificate Number
    const count = await this.prisma.issuedCertificate.count({
      where: { schoolId: validSchoolId, type: resolvedType as any },
    });
    const currentYear = new Date().getFullYear();
    const prefix = resolvedType === 'TRANSFER_CERTIFICATE' ? 'TC' : 'CERT';
    const certificateNumber = `${prefix}/${currentYear}/${String(count + 1).padStart(4, '0')}`;

    // 3. Generate Tamper-evident Verification Hash
    const verificationPayload = `${validSchoolId}:${student.id}:${certificateNumber}:${Date.now()}`;
    const verificationHash = crypto
      .createHash('sha256')
      .update(verificationPayload)
      .digest('hex');

    // 4. Generate Verification QR Code Buffer
    const verifyUrl = `${process.env.APP_URL || 'https://schoolerp.internal'}/verify-certificate/${verificationHash}`;
    let qrBuffer: Buffer | null = null;
    try {
      qrBuffer = await QRCode.toBuffer(verifyUrl, {
        width: 120,
        margin: 1,
        color: { dark: '#1e293b', light: '#ffffff' },
      });
    } catch (err: any) {
      this.logger.warn(`Failed to generate QR code: ${err.message}`);
    }

    // 5. Generate PDF Document in Memory
    const currentEnrollment = student.enrollments[0];
    const className = currentEnrollment?.section?.class?.name || 'N/A';
    const sectionName = currentEnrollment?.section?.name || '';
    const father = student.guardians.find((g) =>
      (g.relationship || '').toLowerCase().includes('father'),
    );
    const mother = student.guardians.find((g) =>
      (g.relationship || '').toLowerCase().includes('mother'),
    );

    const pdfBuffer = await this.generateCertificatePdf({
      schoolName: school.name,
      schoolCity: school.city,
      boardType: school.boardType || 'CBSE',
      certificateNumber,
      certificateType: resolvedType,
      studentName:
        (student.user
          ? `${student.user.firstName} ${student.user.lastName || ''}`
          : `${(student as any).firstName || ''} ${(student as any).lastName || ''}`
        ).trim() || 'Student',
      admissionNumber: student.admissionNumber,
      dob: student.dateOfBirth
        ? student.dateOfBirth.toISOString().split('T')[0]
        : 'N/A',
      fatherName: father
        ? `${father.firstName} ${father.lastName}`.trim()
        : 'N/A',
      motherName: mother
        ? `${mother.firstName} ${mother.lastName}`.trim()
        : 'N/A',
      className: `${className} ${sectionName}`.trim(),
      issueDate: new Date().toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      }),
      reason:
        dto.reason || dto.leavingReason || 'Completion of Academic Session',
      conductRemark: dto.conductRemark || 'Good',
      verificationHash,
      qrBuffer,
    });

    // 6. Store PDF in StorageService
    const folder = `schools/${validSchoolId}/certificates`;
    let pdfUrl: string | null = null;
    try {
      if (typeof (this.storage as any).saveFile === 'function') {
        pdfUrl = await (this.storage as any).saveFile(
          `${folder}/${verificationHash}.pdf`,
          pdfBuffer,
          'application/pdf',
        );
      } else {
        const uploadResult = await this.storage.uploadFile(
          pdfBuffer,
          `${verificationHash}.pdf`,
          'application/pdf',
          folder,
        );
        pdfUrl = uploadResult.url;
      }
    } catch (err: any) {
      this.logger.warn(
        `Storage save failed, storing relative path: ${err.message}`,
      );
      pdfUrl = `/${folder}/${verificationHash}.pdf`;
    }

    // 7. Save to Database
    const issuedCert = await this.prisma.issuedCertificate.create({
      data: {
        schoolId: validSchoolId,
        studentId: student.id,
        templateId: dto.templateId,
        certificateNumber,
        type: resolvedType as any,
        reason: dto.reason,
        leavingReason: dto.leavingReason,
        conductRemark: dto.conductRemark || 'Good',
        remarks: dto.remarks,
        verificationHash,
        pdfUrl,
        issuedByUserId,
      },
      include: {
        student: {
          select: {
            admissionNumber: true,
            user: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    // 8. Trigger Notifications to Student & Parents
    const studentDisplayName = (
      student.user
        ? `${student.user.firstName} ${student.user.lastName || ''}`
        : `${(student as any).firstName || ''} ${(student as any).lastName || ''}`
    ).trim() || 'Student';

    // 8a. Notify student account if linked
    if (student.userId) {
      try {
        await this.prisma.notification.create({
          data: {
            schoolId: validSchoolId,
            userId: student.userId,
            type: 'GENERAL',
            title: `Certificate Issued: ${resolvedType.replace(/_/g, ' ')}`,
            message: `Your certificate (${certificateNumber}) has been generated and is available for download.`,
            actionUrl: `/dashboard/certificates`,
            metadata: {
              certificateId: issuedCert.id,
              certificateNumber,
              type: resolvedType,
              verificationHash,
            },
          },
        });
      } catch (err: any) {
        this.logger.warn(`Failed to notify student ${student.userId} about certificate issuance: ${err.message}`);
      }
    }

    // 8b. Notify parent/guardian accounts
    const parentUserIds = Array.from(
      new Set(
        student.guardians
          .map((g) => g.userId)
          .filter((uid): uid is string => Boolean(uid)),
      ),
    );

    for (const parentUid of parentUserIds) {
      try {
        await this.prisma.notification.create({
          data: {
            schoolId: validSchoolId,
            userId: parentUid,
            type: 'GENERAL',
            title: `Certificate Issued for ${studentDisplayName}`,
            message: `A ${resolvedType.replace(/_/g, ' ')} certificate (No: ${certificateNumber}) has been issued for ${studentDisplayName}.`,
            actionUrl: `/dashboard/certificates`,
            metadata: {
              certificateId: issuedCert.id,
              certificateNumber,
              studentId: student.id,
              type: resolvedType,
              verificationHash,
            },
          },
        });
      } catch (err: any) {
        this.logger.warn(`Failed to notify parent ${parentUid} about certificate issuance: ${err.message}`);
      }
    }

    return issuedCert;
  }

  async bulkIssueCertificates(
    schoolId: string,
    issuedByUserId: string,
    dto: BulkIssueCertificateDto,
  ) {
    const validSchoolId = requireSchoolId(schoolId);

    if (!dto.studentIds || dto.studentIds.length === 0) {
      throw new BadRequestException('At least one studentId must be provided.');
    }

    const results: any[] = [];
    const errors: any[] = [];

    for (const sId of dto.studentIds) {
      try {
        const cert = await this.issueCertificate(validSchoolId, issuedByUserId, {
          studentId: sId,
          templateId: dto.templateId,
          type: dto.type,
          reason: dto.reason,
          conductRemark: dto.conductRemark,
          remarks: dto.remarks,
        });
        results.push(cert);
      } catch (err: any) {
        errors.push({ studentId: sId, error: err.message });
      }
    }

    return {
      totalRequested: dto.studentIds.length,
      issuedCount: results.length,
      failedCount: errors.length,
      certificates: results,
      errors,
    };
  }

  // ─── 3. PDF GENERATION ENGINE ─────────────────────────────────────────────

  private async generateCertificatePdf(data: {
    schoolName: string;
    schoolCity?: string | null;
    boardType: string;
    certificateNumber: string;
    certificateType: string;
    studentName: string;
    admissionNumber: string;
    dob: string;
    fatherName: string;
    motherName: string;
    className: string;
    issueDate: string;
    reason: string;
    conductRemark: string;
    verificationHash: string;
    qrBuffer: Buffer | null;
  }): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 40,
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      // ── Outer Decorative Border ──
      doc
        .rect(20, 20, doc.page.width - 40, doc.page.height - 40)
        .lineWidth(2)
        .strokeColor('#0f172a')
        .stroke();
      doc
        .rect(24, 24, doc.page.width - 48, doc.page.height - 48)
        .lineWidth(0.5)
        .strokeColor('#94a3b8')
        .stroke();

      // ── School Header ──
      doc.moveDown(1);
      doc
        .font('Helvetica-Bold')
        .fontSize(20)
        .fillColor('#0f172a')
        .text(data.schoolName.toUpperCase(), { align: 'center' });

      doc
        .font('Helvetica')
        .fontSize(10)
        .fillColor('#475569')
        .text(
          `${data.schoolCity || 'India'} • Affiliated to ${data.boardType} Board`,
          { align: 'center' },
        );

      doc.moveDown(1);

      // ── Title Badge ──
      const certTypeStr = data.certificateType || 'BONAFIDE';
      const title =
        certTypeStr === 'TRANSFER_CERTIFICATE'
          ? 'TRANSFER CERTIFICATE'
          : certTypeStr === 'BONAFIDE'
            ? 'BONAFIDE CERTIFICATE'
            : `${certTypeStr.replace(/_/g, ' ')} CERTIFICATE`;

      doc
        .font('Helvetica-Bold')
        .fontSize(14)
        .fillColor('#1e40af')
        .text(title, { align: 'center', underline: true });

      doc.moveDown(0.5);

      // ── Meta Info (Certificate No & Date) ──
      const yMeta = doc.y;
      doc
        .font('Helvetica-Bold')
        .fontSize(9)
        .fillColor('#334155')
        .text(`Certificate No: ${data.certificateNumber}`, 50, yMeta);
      doc.text(
        `Date of Issue: ${data.issueDate}`,
        doc.page.width - 200,
        yMeta,
        {
          align: 'right',
        },
      );

      doc.moveDown(1.5);

      // ── Certificate Body Content ──
      doc.font('Helvetica').fontSize(11).fillColor('#1e293b');

      const textY = doc.y + 10;
      doc.text(
        `This is to certify that the particulars recorded below are in accordance with the Official School Register and student records of this institution:`,
        50,
        textY,
        { width: doc.page.width - 100, align: 'justify' },
      );

      doc.moveDown(1.5);

      // ── Details Table ──
      const fields = [
        ['1. Admission / Enrollment No:', data.admissionNumber],
        ['2. Full Name of Pupil:', data.studentName],
        ["3. Father's / Guardian's Name:", data.fatherName],
        ["4. Mother's Name:", data.motherName],
        ['5. Date of Birth:', data.dob],
        ['6. Class in which Last Studied:', data.className],
        ['7. General Conduct & Character:', data.conductRemark],
        ['8. Reason for Certificate / Leaving:', data.reason],
      ];

      const startY = doc.y + 10;
      let currentY = startY;

      for (const [label, val] of fields) {
        doc
          .font('Helvetica-Bold')
          .fontSize(10)
          .fillColor('#334155')
          .text(label, 60, currentY);
        doc
          .font('Helvetica')
          .fontSize(10)
          .fillColor('#0f172a')
          .text(val, 280, currentY);
        currentY += 24;
      }

      // ── Signatures & QR Code ──
      const footerY = doc.page.height - 140;

      // QR Code on Left
      if (data.qrBuffer) {
        doc.image(data.qrBuffer, 60, footerY - 10, { width: 70 });
        doc
          .font('Helvetica')
          .fontSize(7)
          .fillColor('#64748b')
          .text(`Scan to verify authenticity`, 50, footerY + 65, {
            width: 90,
            align: 'center',
          });
      }

      // Signatures on Right
      doc
        .font('Helvetica-Bold')
        .fontSize(9)
        .fillColor('#334155')
        .text('Class Teacher', 250, footerY + 40, { align: 'center' });
      doc.text('Principal / Head of Institution', 400, footerY + 40, {
        align: 'center',
      });

      // Verification Hash at bottom
      doc
        .font('Courier')
        .fontSize(6)
        .fillColor('#94a3b8')
        .text(
          `Tamper-evident verification hash: ${data.verificationHash}`,
          50,
          doc.page.height - 32,
          { align: 'center' },
        );

      doc.end();
    });
  }

  // ─── 4. PUBLIC TAMPER-EVIDENT VERIFICATION ────────────────────────────────

  async verifyCertificateByHash(verificationHash: string) {
    const cert = await this.prisma.issuedCertificate.findUnique({
      where: { verificationHash },
      include: {
        student: {
          select: {
            admissionNumber: true,
            user: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    if (!cert) {
      throw new NotFoundException({
        isValid: false,
        message:
          'Invalid certificate. No record found matching this verification hash.',
      });
    }

    const school = await this.prisma.school.findUnique({
      where: { id: cert.schoolId },
      select: { name: true, city: true, boardType: true },
    });

    return {
      isValid: !cert.isRevoked,
      isRevoked: cert.isRevoked,
      certificateNumber: cert.certificateNumber,
      type: cert.type,
      issueDate: cert.issueDate,
      studentName:
        (cert.student?.user
          ? `${cert.student.user.firstName} ${cert.student.user.lastName || ''}`
          : `${(cert.student as any)?.firstName || ''} ${(cert.student as any)?.lastName || ''}`
        ).trim() || 'Student',
      admissionNumber: cert.student.admissionNumber,
      conductRemark: cert.conductRemark,
      schoolName: school?.name || 'Verified Educational Institution',
      schoolCity: school?.city,
      verificationHash: cert.verificationHash,
    };
  }

  // ─── 5. STUDENT & PARENT ACCESS ───────────────────────────────────────────

  async getStudentCertificates(
    schoolId: string,
    studentId: string,
    requestingUserId: string,
    requestingUserRole: string,
  ) {
    const validSchoolId = requireSchoolId(schoolId);

    const student = await this.prisma.student.findFirst({
      where: { id: studentId, schoolId: validSchoolId },
      include: { guardians: true },
    });
    if (!student) {
      throw new NotFoundException(`Student record not found.`);
    }

    // Role verification: Student, Parent or Admin
    const isElevated = [
      'SUPER_ADMIN',
      'SCHOOL_ADMIN',
      'PRINCIPAL',
      'TEACHER',
    ].includes(requestingUserRole);

    if (!isElevated) {
      const isStudentUser = student.userId === requestingUserId;
      const isGuardianUser = student.guardians.some(
        (g) => g.userId === requestingUserId,
      );
      if (!isStudentUser && !isGuardianUser) {
        throw new ForbiddenException(
          `You are not authorized to view these certificates.`,
        );
      }
    }

    return this.prisma.issuedCertificate.findMany({
      where: { studentId, schoolId: validSchoolId },
      orderBy: { issueDate: 'desc' },
    });
  }

  async revokeCertificate(
    schoolId: string,
    certificateId: string,
    dto: RevokeCertificateDto,
  ) {
    const validSchoolId = requireSchoolId(schoolId);

    const cert = await this.prisma.issuedCertificate.findFirst({
      where: { id: certificateId, schoolId: validSchoolId },
    });
    if (!cert) {
      throw new NotFoundException(`Certificate record not found.`);
    }

    return this.prisma.issuedCertificate.update({
      where: { id: certificateId },
      data: {
        isRevoked: true,
        remarks: cert.remarks
          ? `${cert.remarks} | REVOKED: ${dto.reason}`
          : `REVOKED: ${dto.reason}`,
      },
    });
  }

  async getCertificateStream(schoolId: string, certificateId: string) {
    const validSchoolId = requireSchoolId(schoolId);
    const cert = await this.prisma.issuedCertificate.findFirst({
      where: { id: certificateId, schoolId: validSchoolId },
    });
    if (!cert || !cert.pdfUrl) {
      throw new NotFoundException(`Certificate or PDF document not found.`);
    }

    return this.storage.getFileStream(cert.pdfUrl);
  }
}
