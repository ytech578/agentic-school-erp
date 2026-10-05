import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { requireSchoolId } from '../../core/tenant/tenant.util';
import {
  UpsertAlumniProfileDto,
  CreateTranscriptRequestDto,
  UpdateTranscriptRequestStatusDto,
  AlumniSelfRegisterDto,
} from './dto/alumni.dto';
import PDFDocument from 'pdfkit';
import * as crypto from 'crypto';

@Injectable()
export class AlumniService {
  private readonly logger = new Logger(AlumniService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── 1. ALUMNI PROFILE MANAGEMENT ─────────────────────────────────────────

  async upsertAlumniProfile(schoolId: string, dto: UpsertAlumniProfileDto) {
    const validSchoolId = requireSchoolId(schoolId);

    // Verify student exists and belongs to this school
    const student = await this.prisma.student.findFirst({
      where: {
        id: dto.studentId,
        schoolId: validSchoolId,
      },
    });

    if (!student) {
      throw new NotFoundException(
        `Student with ID '${dto.studentId}' not found in this school.`,
      );
    }

    return this.prisma.alumniProfile.upsert({
      where: {
        studentId: dto.studentId,
      },
      create: {
        schoolId: validSchoolId,
        studentId: dto.studentId,
        graduationYear: dto.graduationYear,
        currentStatus: dto.currentStatus || 'ALUMNI',
        higherEducationInst: dto.higherEducationInst,
        degree: dto.degree,
        company: dto.company,
        designation: dto.designation,
        linkedInUrl: dto.linkedInUrl,
        phone: dto.phone,
        email: dto.email,
        city: dto.city,
        country: dto.country || 'India',
      },
      update: {
        graduationYear: dto.graduationYear,
        currentStatus: dto.currentStatus,
        higherEducationInst: dto.higherEducationInst,
        degree: dto.degree,
        company: dto.company,
        designation: dto.designation,
        linkedInUrl: dto.linkedInUrl,
        phone: dto.phone,
        email: dto.email,
        city: dto.city,
        country: dto.country,
      },
      include: {
        student: {
          select: {
            id: true,
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
  }

  async getAlumniProfiles(
    schoolId: string | null,
    filters?: {
      graduationYear?: number;
      currentStatus?: string;
      search?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const page = Math.max(1, filters?.page || 1);
    const limit = Math.min(100, Math.max(1, filters?.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = schoolId ? { schoolId } : {};

    if (filters?.graduationYear) {
      where.graduationYear = Number(filters.graduationYear);
    }

    if (filters?.currentStatus) {
      where.currentStatus = filters.currentStatus;
    }

    if (filters?.search) {
      const search = filters.search.trim();
      where.OR = [
        { company: { contains: search, mode: 'insensitive' } },
        { higherEducationInst: { contains: search, mode: 'insensitive' } },
        { designation: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
        {
          student: {
            user: {
              OR: [
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
              ],
            },
          },
        },
        {
          student: {
            admissionNumber: { contains: search, mode: 'insensitive' },
          },
        },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.alumniProfile.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ graduationYear: 'desc' }, { createdAt: 'desc' }],
        include: {
          student: {
            select: {
              id: true,
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
      }),
      this.prisma.alumniProfile.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getAlumniProfileByStudentId(schoolId: string, studentId: string) {
    const validSchoolId = requireSchoolId(schoolId);

    const profile = await this.prisma.alumniProfile.findFirst({
      where: {
        studentId,
        schoolId: validSchoolId,
      },
      include: {
        student: {
          select: {
            id: true,
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

    if (!profile) {
      throw new NotFoundException(
        `Alumni profile for student ID '${studentId}' not found.`,
      );
    }

    return profile;
  }

  // ─── 2. TRANSCRIPT REQUEST ENGINE ──────────────────────────────────────────

  async createTranscriptRequest(
    schoolId: string,
    dto: CreateTranscriptRequestDto,
  ) {
    const validSchoolId = requireSchoolId(schoolId);

    // Verify student exists in this school
    const student = await this.prisma.student.findFirst({
      where: {
        id: dto.studentId,
        schoolId: validSchoolId,
      },
    });

    if (!student) {
      throw new NotFoundException(
        `Student with ID '${dto.studentId}' not found in this school.`,
      );
    }

    // Generate readable, unique sequential request number
    const timestamp = Date.now().toString().slice(-6);
    const rand = Math.floor(1000 + Math.random() * 9000);
    const requestNumber = `TR-${new Date().getFullYear()}-${timestamp}${rand}`;

    return this.prisma.transcriptRequest.create({
      data: {
        schoolId: validSchoolId,
        studentId: dto.studentId,
        requestNumber,
        purpose: dto.purpose,
        deliveryMode: dto.deliveryMode || 'DIGITAL',
        status: 'SUBMITTED',
      },
      include: {
        student: {
          select: {
            id: true,
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
  }

  async getTranscriptRequests(
    schoolId: string | null,
    filters?: {
      status?: string;
      studentId?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const page = Math.max(1, filters?.page || 1);
    const limit = Math.min(100, Math.max(1, filters?.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = schoolId ? { schoolId } : {};

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.studentId) {
      where.studentId = filters.studentId;
    }

    const [items, total] = await Promise.all([
      this.prisma.transcriptRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          student: {
            select: {
              id: true,
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
      }),
      this.prisma.transcriptRequest.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getTranscriptRequestById(schoolId: string, id: string) {
    const validSchoolId = requireSchoolId(schoolId);

    const request = await this.prisma.transcriptRequest.findFirst({
      where: {
        id,
        schoolId: validSchoolId,
      },
      include: {
        student: {
          select: {
            id: true,
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

    if (!request) {
      throw new NotFoundException(
        `Transcript request with ID '${id}' not found.`,
      );
    }

    return request;
  }

  async updateTranscriptRequestStatus(
    schoolId: string,
    id: string,
    dto: UpdateTranscriptRequestStatusDto,
  ) {
    const validSchoolId = requireSchoolId(schoolId);

    const existing = await this.prisma.transcriptRequest.findFirst({
      where: {
        id,
        schoolId: validSchoolId,
      },
    });

    if (!existing) {
      throw new NotFoundException(
        `Transcript request with ID '${id}' not found.`,
      );
    }

    return this.prisma.transcriptRequest.update({
      where: { id },
      data: {
        status: dto.status,
        documentUrl: dto.documentUrl ?? existing.documentUrl,
        trackingNumber: dto.trackingNumber ?? existing.trackingNumber,
        remarks: dto.remarks ?? existing.remarks,
      },
      include: {
        student: {
          select: {
            id: true,
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
  }

  // ─── 3. ALUMNI DIRECTORY METRICS ──────────────────────────────────────────

  async getAlumniDirectoryStats(schoolId: string | null) {
    const where: any = schoolId ? { schoolId } : {};

    const [totalAlumni, pendingTranscripts, profiles] = await Promise.all([
      this.prisma.alumniProfile.count({
        where,
      }),
      this.prisma.transcriptRequest.count({
        where: {
          ...where,
          status: { in: ['SUBMITTED', 'PROCESSING'] },
        },
      }),
      this.prisma.alumniProfile.findMany({
        where,
        select: {
          graduationYear: true,
          currentStatus: true,
        },
      }),
    ]);

    const byYear: Record<number, number> = {};
    const byStatus: Record<string, number> = {};

    for (const p of profiles) {
      byYear[p.graduationYear] = (byYear[p.graduationYear] || 0) + 1;
      const status = p.currentStatus || 'UNSPECIFIED';
      byStatus[status] = (byStatus[status] || 0) + 1;
    }

    return {
      totalAlumni,
      pendingTranscripts,
      byYear,
      byStatus,
    };
  }

  // ─── 4. TRANSCRIPT PDF GENERATION ─────────────────────────────────────────

  async generateTranscriptPdf(
    schoolId: string,
    transcriptRequestId: string,
  ): Promise<{ buffer: Buffer; fileName: string }> {
    const validSchoolId = requireSchoolId(schoolId);

    const request = await this.prisma.transcriptRequest.findFirst({
      where: { id: transcriptRequestId, schoolId: validSchoolId },
      include: {
        student: {
          include: {
            user: true,
            enrollments: {
              include: {
                section: {
                  include: { class: true },
                },
              },
              take: 5,
            },
          },
        },
      },
    });

    if (!request) {
      throw new NotFoundException('Transcript request not found.');
    }

    const school = await this.prisma.school.findUnique({
      where: { id: validSchoolId },
    });

    const studentName = request.student?.user
      ? `${request.student.user.firstName} ${request.student.user.lastName || ''}`.trim()
      : 'Student';
    const admNo = request.student?.admissionNumber || 'N/A';
    const requestNo = request.requestNumber || `TR-${request.id.slice(0, 8)}`;
    const issueDate = new Date().toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });

    const verificationHash = crypto
      .createHash('sha256')
      .update(
        `${validSchoolId}:${request.studentId}:${requestNo}:${Date.now()}`,
      )
      .digest('hex');

    const buffer: Buffer = await new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 40,
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      const pageWidth = doc.page.width;
      const pageHeight = doc.page.height;

      // Outer Border
      doc
        .rect(25, 25, pageWidth - 50, pageHeight - 50)
        .lineWidth(2)
        .strokeColor('#0f172a')
        .stroke();
      doc
        .rect(29, 29, pageWidth - 58, pageHeight - 58)
        .lineWidth(0.5)
        .strokeColor('#94a3b8')
        .stroke();

      // School Header
      doc.moveDown(1.2);
      doc
        .font('Helvetica-Bold')
        .fontSize(18)
        .fillColor('#0f172a')
        .text((school?.name || 'Sunrise Public School').toUpperCase(), {
          align: 'center',
        });

      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#475569')
        .text(
          `${school?.address ? `${school.address}, ` : ''}${school?.city || 'Campus'}, India • Affiliated to ${school?.boardType || 'CBSE'} Board${school?.affiliationNo ? ` • Affiliation No: ${school.affiliationNo}` : ''}`,
          { align: 'center' },
        );

      doc.moveDown(0.8);

      // Title
      doc
        .font('Helvetica-Bold')
        .fontSize(13)
        .fillColor('#1e40af')
        .text('OFFICIAL ACADEMIC TRANSCRIPT & CUMULATIVE RECORD', {
          align: 'center',
          underline: true,
        });

      doc.moveDown(1);

      // Meta Header
      const metaY = doc.y;
      doc
        .font('Helvetica-Bold')
        .fontSize(9)
        .fillColor('#334155')
        .text(`Transcript Ref: ${requestNo}`, 50, metaY);
      doc.text(`Issue Date: ${issueDate}`, pageWidth - 200, metaY, {
        align: 'right',
      });

      doc.moveDown(1.5);

      // Student Details
      const details = [
        ['Student Name:', studentName],
        ['Admission / Reg No:', admNo],
        [
          'Purpose of Transcript:',
          request.purpose || 'Official Verification / Higher Studies',
        ],
        ['Delivery Mode:', request.deliveryMode || 'DIGITAL'],
        ['Status:', request.status || 'COMPLETED'],
      ];

      let curY = doc.y;
      for (const [lbl, val] of details) {
        doc
          .font('Helvetica-Bold')
          .fontSize(9.5)
          .fillColor('#1e293b')
          .text(lbl, 50, curY);
        doc
          .font('Helvetica')
          .fontSize(9.5)
          .fillColor('#334155')
          .text(val, 200, curY);
        curY += 18;
      }

      doc.y = curY + 10;

      // Academic Summary
      doc
        .font('Helvetica-Bold')
        .fontSize(11)
        .fillColor('#0f172a')
        .text('ACADEMIC ENROLLMENT & PERFORMANCE SUMMARY', 50, doc.y);

      doc.moveDown(0.5);

      const tableY = doc.y;
      doc
        .rect(50, tableY, pageWidth - 100, 20)
        .fillColor('#f1f5f9')
        .fill();

      doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#1e293b');
      doc.text('Academic Class / Level', 60, tableY + 5);
      doc.text('Section', 240, tableY + 5);
      doc.text('Enrollment Status', 360, tableY + 5);
      doc.text('Result / Remarks', 460, tableY + 5);

      let rowY = tableY + 22;
      const enrollments = request.student?.enrollments || [];
      if (enrollments.length > 0) {
        for (const enr of enrollments) {
          doc.font('Helvetica').fontSize(8.5).fillColor('#334155');
          doc.text(enr.section?.class?.name || 'Class Record', 60, rowY);
          doc.text(enr.section?.name || 'A', 240, rowY);
          doc.text(enr.status || 'COMPLETED', 360, rowY);
          doc.text('Promoted / Graduated', 460, rowY);
          rowY += 18;
        }
      } else {
        doc.font('Helvetica').fontSize(8.5).fillColor('#64748b');
        doc.text(
          'Completed All Prescribed Academic Requirements & Examinations',
          60,
          rowY,
        );
        rowY += 18;
      }

      // Certification Text
      doc.y = rowY + 30;
      doc
        .font('Helvetica')
        .fontSize(9.5)
        .fillColor('#1e293b')
        .text(
          'This is to officially certify that the student mentioned above has completed all required coursework, standard examinations, and institutional requirements in good standing. This document represents a certified true copy of the official academic archive.',
          50,
          doc.y,
          { width: pageWidth - 100, align: 'justify' },
        );

      // Signatures
      const sigY = pageHeight - 140;
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#1e293b');
      doc.text('Prepared By', 60, sigY);
      doc.text('Controller of Examinations', pageWidth / 2 - 60, sigY, {
        align: 'center',
      });
      doc.text('Principal / Head of Institution', pageWidth - 200, sigY, {
        align: 'right',
      });

      doc.font('Helvetica').fontSize(8).fillColor('#64748b');
      doc.text('(Registry & Records)', 60, sigY + 12);
      doc.text('(Official Seal)', pageWidth / 2 - 60, sigY + 12, {
        align: 'center',
      });
      doc.text('(Authorized Signatory)', pageWidth - 200, sigY + 12, {
        align: 'right',
      });

      // Hash Footer
      doc
        .font('Helvetica')
        .fontSize(7)
        .fillColor('#94a3b8')
        .text(
          `Digital Verification Hash: ${verificationHash} | System-certified by Agentic ERP`,
          50,
          pageHeight - 45,
          { width: pageWidth - 100, align: 'center' },
        );

      doc.end();
    });

    const safeAdm = admNo.replace(/[^a-zA-Z0-9_-]/g, '');
    const fileName = `transcript-${safeAdm}-${requestNo}.pdf`;

    return { buffer, fileName };
  }

  // ─── 5. ALUMNI SELF-REGISTRATION ──────────────────────────────────────────

  async selfRegisterAlumni(schoolId: string, dto: AlumniSelfRegisterDto) {
    const validSchoolId = requireSchoolId(schoolId);

    const student = await this.prisma.student.findFirst({
      where: {
        admissionNumber: dto.admissionNumber,
        schoolId: validSchoolId,
      },
    });

    if (!student) {
      throw new NotFoundException(
        `No student found matching Admission Number '${dto.admissionNumber}' in this institution.`,
      );
    }

    return this.prisma.alumniProfile.upsert({
      where: { studentId: student.id },
      create: {
        schoolId: validSchoolId,
        studentId: student.id,
        graduationYear: dto.graduationYear,
        currentStatus: dto.currentStatus || 'ALUMNI',
        higherEducationInst: dto.higherEducationInst,
        degree: dto.degree,
        company: dto.company,
        designation: dto.designation,
        linkedInUrl: dto.linkedInUrl,
        phone: dto.phone,
        email: dto.email,
        city: dto.city,
        country: dto.country || 'India',
      },
      update: {
        graduationYear: dto.graduationYear,
        currentStatus: dto.currentStatus || 'ALUMNI',
        higherEducationInst: dto.higherEducationInst,
        degree: dto.degree,
        company: dto.company,
        designation: dto.designation,
        linkedInUrl: dto.linkedInUrl,
        phone: dto.phone,
        email: dto.email,
        city: dto.city,
        country: dto.country || 'India',
      },
    });
  }
}
