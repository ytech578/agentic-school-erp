import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { PrismaService } from '../../core/database/prisma.service';
import { CreateFeeStructureInput, CollectFeeInput } from '@school-erp/shared';
import { FeePaymentStatus, FeePaymentMode, FeeFrequency } from '@prisma/client';
import { requireSchoolId } from '../../core/tenant/tenant.util';
import { generateNextSequence } from '../../core/database/sequence.util';

export function normalizeFeePaymentMode(mode?: string): FeePaymentMode {
  if (!mode) return FeePaymentMode.CASH;
  const upper = mode.trim().toUpperCase();
  switch (upper) {
    case 'ONLINE':
    case 'ONLINE_UPI':
    case 'ONLINE_CARD':
    case 'UPI':
    case 'CARD':
    case 'NETBANKING':
    case 'RAZORPAY':
      return FeePaymentMode.ONLINE_UPI;
    case 'CHEQUE':
    case 'CHECK':
      return FeePaymentMode.CHEQUE;
    case 'DD':
    case 'DEMAND_DRAFT':
      return FeePaymentMode.DEMAND_DRAFT;
    case 'NEFT':
      return FeePaymentMode.NEFT;
    case 'RTGS':
      return FeePaymentMode.RTGS;
    case 'CASH':
    default:
      return FeePaymentMode.CASH;
  }
}

@Injectable()
export class FeesService {
  private readonly logger = new Logger(FeesService.name);

  constructor(
    private prisma: PrismaService,
    @Optional() private configService?: ConfigService,
  ) {}

  private async resolveAcademicYearId(
    schoolId: string,
    providedId?: string,
  ): Promise<string> {
    const validSchoolId = requireSchoolId(schoolId);
    if (
      providedId &&
      providedId !== 'undefined' &&
      providedId !== 'null' &&
      providedId.trim() !== ''
    ) {
      const trimmed = providedId.trim();
      const normalizedName = trimmed.replace(/^AY[-_]?/i, '');
      const year = await this.prisma.academicYear.findFirst({
        where: {
          schoolId: validSchoolId,
          OR: [{ id: trimmed }, { name: trimmed }, { name: normalizedName }],
        },
      });
      if (year) {
        return year.id;
      }
    }
    const activeYear = await this.prisma.academicYear.findFirst({
      where: { schoolId: validSchoolId, isActive: true },
    });
    if (activeYear) {
      return activeYear.id;
    }
    const latestYear = await this.prisma.academicYear.findFirst({
      where: { schoolId: validSchoolId },
      orderBy: { startDate: 'desc' },
    });
    if (latestYear) {
      return latestYear.id;
    }
    throw new BadRequestException(
      'No active academic year found for this school',
    );
  }

  async getFeeHeads(schoolId: string) {
    const validSchoolId = requireSchoolId(schoolId);
    return this.prisma.feeHead.findMany({
      where: { schoolId: validSchoolId, isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async createFeeHead(
    schoolId: string,
    data: { name: string; description?: string },
  ) {
    const validSchoolId = requireSchoolId(schoolId);
    const maxOrder = await this.prisma.feeHead.count({
      where: { schoolId: validSchoolId },
    });
    return this.prisma.feeHead.create({
      data: {
        schoolId: validSchoolId,
        name: data.name,
        description: data.description || null,
        isActive: true,
        sortOrder: maxOrder + 1,
      },
    });
  }

  async getStructuresByClass(
    schoolId: string,
    academicYearId: string,
    classId: string,
  ) {
    const validSchoolId = requireSchoolId(schoolId);
    const resolvedYearId = await this.resolveAcademicYearId(
      validSchoolId,
      academicYearId,
    );
    if (classId) {
      const cls = await this.prisma.class.findFirst({
        where: { id: classId, schoolId: validSchoolId },
      });
      if (!cls) {
        throw new NotFoundException('Class not found');
      }
    }
    return this.prisma.feeStructure.findFirst({
      where: {
        schoolId: validSchoolId,
        academicYearId: resolvedYearId,
        classId,
        isActive: true,
      },
      include: {
        items: {
          include: { feeHead: true },
        },
      },
    });
  }

  async createOrUpdateStructure(
    schoolId: string,
    data: CreateFeeStructureInput,
  ) {
    const validSchoolId = requireSchoolId(schoolId);
    const resolvedYearId = await this.resolveAcademicYearId(
      validSchoolId,
      data.academicYearId,
    );

    // Validate class belongs to school
    const cls = await this.prisma.class.findFirst({
      where: { id: data.classId, schoolId: validSchoolId },
    });
    if (!cls) {
      throw new NotFoundException('Class not found');
    }

    // Validate fee heads belong to school
    if (data.items && data.items.length > 0) {
      const headIds = data.items.map((item: any) => item.feeHeadId);
      const heads = await this.prisma.feeHead.findMany({
        where: { id: { in: headIds }, schoolId: validSchoolId },
      });
      if (heads.length !== headIds.length) {
        throw new BadRequestException(
          'One or more fee heads do not belong to this school',
        );
      }
    }

    // Delete existing structure for this class and year if it exists
    const existing = await this.prisma.feeStructure.findFirst({
      where: {
        schoolId: validSchoolId,
        academicYearId: resolvedYearId,
        classId: data.classId,
      },
    });

    if (existing) {
      await this.prisma.feeStructureItem.deleteMany({
        where: { feeStructureId: existing.id },
      });
      await this.prisma.feeStructure.delete({
        where: { id: existing.id },
      });
    }

    // Create new structure
    return this.prisma.feeStructure.create({
      data: {
        schoolId: validSchoolId,
        academicYearId: resolvedYearId,
        classId: data.classId,
        name: data.name,
        description: data.description,
        items: {
          create: data.items.map((item: any) => ({
            feeHeadId: item.feeHeadId,
            amount: item.amount,
            frequency: FeeFrequency.ANNUAL,
          })),
        },
      },
      include: {
        items: true,
      },
    });
  }

  async getStudentFeeSummary(schoolId: string, academicYearId: string) {
    const validSchoolId = requireSchoolId(schoolId);
    const resolvedYearId = await this.resolveAcademicYearId(
      validSchoolId,
      academicYearId,
    );
    // Fetch all active students with their class and payments for the year
    const students = await this.prisma.student.findMany({
      where: { schoolId: validSchoolId, isActive: true },
      include: {
        user: { select: { firstName: true, lastName: true } },
        enrollments: {
          where: { status: 'ACTIVE' },
          include: { section: { include: { class: true } } },
          take: 1,
        },
        feePayments: {
          where: { academicYearId: resolvedYearId },
        },
      },
    });

    // We also need all fee structures to calculate dues
    const structures = await this.prisma.feeStructure.findMany({
      where: {
        schoolId: validSchoolId,
        academicYearId: resolvedYearId,
        isActive: true,
      },
      include: { items: true },
    });

    return students.map((student) => {
      const classId = student.enrollments[0]?.section?.class.id;
      const structure = structures.find((s) => s.classId === classId);

      const totalFee =
        structure?.items.reduce((sum, item) => sum + Number(item.amount), 0) ||
        0;

      const totalPaid = student.feePayments
        .filter(
          (p) => p.paymentStatus === 'PAID' || p.paymentStatus === 'PARTIAL',
        )
        .reduce((sum, p) => sum + Number(p.paidAmount), 0);

      return {
        id: student.id,
        admissionNumber: student.admissionNumber,
        firstName: student.user.firstName,
        lastName: student.user.lastName,
        class: student.enrollments[0]?.section?.class.name || 'N/A',
        totalFee,
        totalPaid,
        outstandingDue: totalFee - totalPaid > 0 ? totalFee - totalPaid : 0,
      };
    });
  }

  async collectFee(schoolId: string, userId: string, data: CollectFeeInput) {
    const validSchoolId = requireSchoolId(schoolId);
    const resolvedYearId = await this.resolveAcademicYearId(
      validSchoolId,
      data.academicYearId,
    );
    if (data.amountPaid <= 0) {
      throw new BadRequestException('Amount must be greater than zero');
    }

    // Validate student belongs to school
    const student = await this.prisma.student.findFirst({
      where: { id: data.studentId, schoolId: validSchoolId },
    });
    if (!student) {
      throw new NotFoundException('Student not found');
    }

    const year = new Date().getFullYear();
    const receiptNumber = await generateNextSequence(
      this.prisma,
      validSchoolId,
      'RCT',
      year,
    );

    return this.prisma.$transaction(async (tx) => {
      // 1. Create Payment Record
      const payment = await tx.feePayment.create({
        data: {
          schoolId: validSchoolId,
          studentId: data.studentId,
          academicYearId: resolvedYearId,
          totalAmount: data.amountPaid, // In MVP, assume they pay what they want
          paidAmount: data.amountPaid,
          paymentMode: normalizeFeePaymentMode(data.paymentMode),
          paymentStatus: FeePaymentStatus.PAID,
          transactionRef: data.transactionRef,
          remarks: data.remarks,
          collectedById: userId,
        },
      });

      // 2. Generate Sequential Receipt
      const receipt = await tx.receipt.create({
        data: {
          feePaymentId: payment.id,
          receiptNumber,
        },
      });

      return {
        payment,
        receipt,
      };
    });
  }

  async getCashFlowAnalytics(schoolId: string, academicYearId: string) {
    const validSchoolId = requireSchoolId(schoolId);
    const resolvedYearId = await this.resolveAcademicYearId(
      validSchoolId,
      academicYearId,
    );

    const payments = await this.prisma.feePayment.findMany({
      where: {
        schoolId: validSchoolId,
        academicYearId: resolvedYearId,
        paymentStatus: 'PAID',
      },
      select: {
        paidAmount: true,
        createdAt: true,
      },
    });

    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    const monthlyData: Record<string, number> = {};
    months.forEach((m) => (monthlyData[m] = 0));

    payments.forEach((payment) => {
      const monthStr = months[payment.createdAt.getMonth()];
      monthlyData[monthStr] += Number(payment.paidAmount);
    });

    return months.map((month) => ({
      name: month,
      collected: monthlyData[month],
    }));
  }

  async predictDefaulters(schoolId: string, academicYearId: string) {
    const validSchoolId = requireSchoolId(schoolId);
    // Re-use summary logic to find outstanding balances
    const summary = await this.getStudentFeeSummary(
      validSchoolId,
      academicYearId,
    );

    // Get students with actual risk score data to combine
    const studentsWithRisk = await this.prisma.student.findMany({
      where: { schoolId: validSchoolId },
      select: { id: true, riskScore: true, admissionNumber: true },
    });

    const riskMap = new Map();
    studentsWithRisk.forEach((s) => riskMap.set(s.id, s.riskScore));

    const defaulters = summary
      .filter((s) => s.outstandingDue > 0)
      .map((s) => {
        const baseRisk = riskMap.get(s.id) || 0;
        // Simple heuristic: higher due + base risk = higher default probability
        const dueFactor =
          Math.min((s.outstandingDue / s.totalFee) * 50, 50) || 0;
        const defaultProbability = Math.min(
          Math.round(baseRisk + dueFactor),
          99,
        );

        let riskLevel = 'Low';
        if (defaultProbability > 70) riskLevel = 'High';
        else if (defaultProbability > 40) riskLevel = 'Medium';

        return {
          id: s.id,
          admissionNumber: s.admissionNumber,
          firstName: s.firstName,
          lastName: s.lastName,
          class: s.class,
          outstandingDue: s.outstandingDue,
          defaultProbability,
          riskLevel,
        };
      })
      .sort((a, b) => b.defaultProbability - a.defaultProbability);

    // Return top 15 highest risk
    return defaulters.slice(0, 15);
  }

  async getParentDues(schoolId: string, userId: string) {
    const validSchoolId = requireSchoolId(schoolId);
    const guardians = await this.prisma.guardian.findMany({
      where: {
        userId,
        student: { schoolId: validSchoolId },
      },
      include: {
        student: {
          include: {
            user: {
              select: { firstName: true, lastName: true, avatarUrl: true },
            },
            enrollments: {
              where: { status: 'ACTIVE' },
              include: { section: { include: { class: true } } },
            },
          },
        },
      },
    });

    if (!guardians || guardians.length === 0) return [];

    const academicYear =
      (await this.prisma.academicYear.findFirst({
        where: { schoolId: validSchoolId, isActive: true },
      })) ||
      (await this.prisma.academicYear.findFirst({
        where: { schoolId: validSchoolId },
      }));
    if (!academicYear) return [];

    const structures = await this.prisma.feeStructure.findMany({
      where: {
        schoolId: validSchoolId,
        academicYearId: academicYear.id,
        isActive: true,
      },
      include: { items: true },
    });

    const studentsResult = await Promise.all(
      guardians.map(async (g) => {
        const student = g.student;
        const classId = student.enrollments[0]?.section?.class.id;
        const structure = structures.find((s) => s.classId === classId);

        const totalFee =
          structure?.items.reduce(
            (sum, item) => sum + Number(item.amount),
            0,
          ) || 0;

        const payments = await this.prisma.feePayment.findMany({
          where: {
            schoolId: validSchoolId,
            studentId: student.id,
            academicYearId: academicYear.id,
          },
        });

        const totalPaid = payments
          .filter(
            (p) => p.paymentStatus === 'PAID' || p.paymentStatus === 'PARTIAL',
          )
          .reduce((sum, p) => sum + Number(p.paidAmount), 0);

        const outstandingDue = Math.max(0, totalFee - totalPaid);

        return {
          studentId: student.id,
          firstName: student.user.firstName,
          lastName: student.user.lastName,
          avatarUrl: student.user.avatarUrl,
          admissionNumber: student.admissionNumber,
          className: student.enrollments[0]?.section?.class.name || 'N/A',
          totalFee,
          totalPaid,
          outstandingDue,
        };
      }),
    );

    return studentsResult;
  }

  async processParentPayment(
    schoolId: string,
    userId: string,
    data: {
      studentId: string;
      amount: number;
      paymentMode: string;
      transactionRef?: string;
    },
  ) {
    const validSchoolId = requireSchoolId(schoolId);

    // Verify student belongs to school and guardian is linked to student
    const guardian = await this.prisma.guardian.findFirst({
      where: {
        userId,
        studentId: data.studentId,
        student: { schoolId: validSchoolId },
      },
    });
    if (!guardian) {
      throw new NotFoundException('Student not found for this guardian');
    }

    const academicYear =
      (await this.prisma.academicYear.findFirst({
        where: { schoolId: validSchoolId, isActive: true },
      })) ||
      (await this.prisma.academicYear.findFirst({
        where: { schoolId: validSchoolId },
      }));
    if (!academicYear) throw new BadRequestException('No academic year found');

    const year = new Date().getFullYear();
    const receiptNumber = await generateNextSequence(
      this.prisma,
      validSchoolId,
      'RCT',
      year,
    );

    const remarks = data.transactionRef
      ? `Online Payment via Parent Portal (UTR/Ref: ${data.transactionRef})`
      : 'Online Payment via Parent Portal';

    const payment = await this.prisma.feePayment.create({
      data: {
        schoolId: validSchoolId,
        studentId: data.studentId,
        academicYearId: academicYear.id,
        totalAmount: data.amount,
        paidAmount: data.amount,
        outstandingAmount: 0,
        paymentMode: normalizeFeePaymentMode(data.paymentMode),
        paymentStatus: FeePaymentStatus.PAID,
        remarks,
        collectedById: userId,
        paymentDate: new Date(),
      },
    });

    const receipt = await this.prisma.receipt.create({
      data: {
        feePaymentId: payment.id,
        receiptNumber,
      },
    });

    return {
      success: true,
      paymentId: payment.id,
      receiptNumber: receipt.receiptNumber,
    };
  }

  async getPaymentSettings(schoolId: string, userRole?: string) {
    const validSchoolId = requireSchoolId(schoolId, 'Get payment settings');

    const config = await this.prisma.systemConfig?.findUnique?.({
      where: {
        schoolId_key: {
          schoolId: validSchoolId,
          key: 'PAYMENT_SETTINGS',
        },
      },
    });

    const school = await this.prisma.school?.findUnique?.({
      where: { id: validSchoolId },
      select: { name: true, phone: true, email: true, settings: true },
    });

    const defaultPayeeName = school?.name || 'School ERP Fees';
    const settingsVal =
      (config?.value as any) || (school?.settings as any)?.payment || {};

    const upiVpa =
      settingsVal.upiVpa || this.configService?.get<string>('UPI_VPA') || '';
    const payeeName = settingsVal.payeeName || defaultPayeeName;
    const qrCodeImageUrl = settingsVal.qrCodeImageUrl || '';
    const accountNumber = settingsVal.accountNumber || '';
    const ifscCode = settingsVal.ifscCode || '';
    const bankName = settingsVal.bankName || '';
    const branch = settingsVal.branch || '';
    const razorpayEnabled = settingsVal.razorpayEnabled ?? true;
    const razorpayKeyId =
      settingsVal.razorpayKeyId ||
      this.configService?.get<string>('RAZORPAY_KEY_ID') ||
      '';
    const preferredMode = settingsVal.preferredMode || 'DYNAMIC_UPI_QR';
    const customInstructions = settingsVal.customInstructions || '';

    const isAdmin = ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL'].includes(
      userRole || '',
    );

    return {
      upiVpa,
      payeeName,
      qrCodeImageUrl,
      accountNumber,
      ifscCode,
      bankName,
      branch,
      razorpayEnabled,
      razorpayKeyId: isAdmin
        ? razorpayKeyId
        : razorpayKeyId
          ? 'configured'
          : '',
      hasRazorpaySecret: Boolean(
        settingsVal.razorpayKeySecret ||
        this.configService?.get<string>('RAZORPAY_KEY_SECRET'),
      ),
      preferredMode,
      customInstructions,
      updatedAt: config?.updatedAt || new Date(),
    };
  }

  async updatePaymentSettings(
    schoolId: string,
    userId: string,
    data: {
      upiVpa: string;
      payeeName: string;
      qrCodeImageUrl?: string;
      accountNumber?: string;
      ifscCode?: string;
      bankName?: string;
      branch?: string;
      razorpayEnabled?: boolean;
      razorpayKeyId?: string;
      razorpayKeySecret?: string;
      preferredMode?: string;
      customInstructions?: string;
    },
  ) {
    const validSchoolId = requireSchoolId(schoolId, 'Update payment settings');

    if (!data.upiVpa || !data.upiVpa.includes('@')) {
      throw new BadRequestException(
        'A valid UPI ID (e.g. schoolname@bank) is required',
      );
    }

    const cleanPayee = data.payeeName?.trim() || 'School ERP Fees';
    const cleanVpa = data.upiVpa.trim();

    const existing = await this.prisma.systemConfig?.findUnique?.({
      where: {
        schoolId_key: {
          schoolId: validSchoolId,
          key: 'PAYMENT_SETTINGS',
        },
      },
    });

    const existingVal = (existing?.value as any) || {};

    const updatedValue = {
      upiVpa: cleanVpa,
      payeeName: cleanPayee,
      qrCodeImageUrl:
        data.qrCodeImageUrl !== undefined
          ? data.qrCodeImageUrl
          : existingVal.qrCodeImageUrl || '',
      accountNumber:
        data.accountNumber?.trim() || existingVal.accountNumber || '',
      ifscCode:
        data.ifscCode?.trim().toUpperCase() || existingVal.ifscCode || '',
      bankName: data.bankName?.trim() || existingVal.bankName || '',
      branch: data.branch?.trim() || existingVal.branch || '',
      razorpayEnabled:
        data.razorpayEnabled !== undefined
          ? data.razorpayEnabled
          : (existingVal.razorpayEnabled ?? true),
      razorpayKeyId:
        data.razorpayKeyId?.trim() || existingVal.razorpayKeyId || '',
      razorpayKeySecret:
        data.razorpayKeySecret?.trim() || existingVal.razorpayKeySecret || '',
      preferredMode:
        data.preferredMode || existingVal.preferredMode || 'DYNAMIC_UPI_QR',
      customInstructions:
        data.customInstructions?.trim() || existingVal.customInstructions || '',
      updatedBy: userId,
    };

    await this.prisma.systemConfig?.upsert?.({
      where: {
        schoolId_key: {
          schoolId: validSchoolId,
          key: 'PAYMENT_SETTINGS',
        },
      },
      update: {
        value: updatedValue,
        isPublic: true,
      },
      create: {
        schoolId: validSchoolId,
        key: 'PAYMENT_SETTINGS',
        value: updatedValue,
        isPublic: true,
      },
    });

    // Also sync to School.settings
    if (this.prisma.school?.update) {
      const school = await this.prisma.school?.findUnique?.({
        where: { id: validSchoolId },
      });
      const currentSettings = (school?.settings as any) || {};
      await this.prisma.school
        .update({
          where: { id: validSchoolId },
          data: {
            settings: {
              ...currentSettings,
              payment: {
                upiVpa: cleanVpa,
                payeeName: cleanPayee,
                qrCodeImageUrl: updatedValue.qrCodeImageUrl,
                accountNumber: updatedValue.accountNumber,
                ifscCode: updatedValue.ifscCode,
                bankName: updatedValue.bankName,
                branch: updatedValue.branch,
              },
            },
          },
        })
        .catch((e: any) =>
          this.logger.warn(`Could not sync School.settings: ${e.message}`),
        );
    }

    this.logger.log(
      `Payment settings updated for school ${validSchoolId} by user ${userId}`,
    );

    return {
      success: true,
      message: 'Payment settings saved successfully',
      data: {
        upiVpa: cleanVpa,
        payeeName: cleanPayee,
        qrCodeImageUrl: updatedValue.qrCodeImageUrl,
        accountNumber: updatedValue.accountNumber,
        ifscCode: updatedValue.ifscCode,
        bankName: updatedValue.bankName,
        preferredMode: updatedValue.preferredMode,
      },
    };
  }

  async createRazorpayOrder(
    schoolId: string,
    studentId: string,
    amount: number,
    academicYearId?: string,
  ) {
    const validSchoolId = requireSchoolId(schoolId, 'Create Razorpay order');
    if (amount <= 0) {
      throw new BadRequestException('Order amount must be greater than zero');
    }

    const student = await this.prisma.student.findFirst({
      where: { id: studentId, schoolId: validSchoolId },
      include: { user: true },
    });
    if (!student) {
      throw new NotFoundException('Student not found');
    }

    // Retrieve school custom payment settings
    const paymentSettings = await this.getPaymentSettings(
      validSchoolId,
      'SUPER_ADMIN',
    );

    const keyId =
      paymentSettings.razorpayKeyId ||
      this.configService?.get<string>('RAZORPAY_KEY_ID') ||
      'rzp_test_placeholder_key';
    const keySecret =
      this.configService?.get<string>('RAZORPAY_KEY_SECRET') ||
      'rzp_test_secret_placeholder';
    const currency = 'INR';
    const amountInPaise = Math.round(amount * 100);
    const receiptTag = `rcpt_${student.admissionNumber || student.id.slice(-6)}_${Date.now().toString().slice(-4)}`;

    let orderId = `order_${Date.now().toString(36).toUpperCase()}_${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    // If active live credentials configured, call Razorpay Orders API
    if (keyId && keySecret && !keyId.includes('placeholder')) {
      try {
        const authHeader =
          'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64');
        const response = await fetch('https://api.razorpay.com/v1/orders', {
          method: 'POST',
          headers: {
            Authorization: authHeader,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            amount: amountInPaise,
            currency,
            receipt: receiptTag,
            notes: {
              schoolId: validSchoolId,
              studentId,
              studentName:
                `${student.user.firstName} ${student.user.lastName}`.trim(),
            },
          }),
        });
        if (response.ok) {
          const resData: any = await response.json();
          orderId = resData.id;
        }
      } catch (err: any) {
        this.logger.warn(
          `Razorpay API call fallback to order generation: ${err.message}`,
        );
      }
    }

    const schoolName = paymentSettings.payeeName || 'School ERP';
    const upiVpa =
      paymentSettings.upiVpa ||
      this.configService?.get<string>('UPI_VPA') ||
      'schoolfees@razorpay';
    const cleanStudentName =
      `${student.user.firstName} ${student.user.lastName}`.trim();
    const upiTxnNote =
      `Fee - ${student.admissionNumber || cleanStudentName}`.slice(0, 30);
    const upiUri = `upi://pay?pa=${encodeURIComponent(upiVpa)}&pn=${encodeURIComponent(schoolName)}&am=${amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(upiTxnNote)}&tr=${encodeURIComponent(orderId)}`;
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=8&data=${encodeURIComponent(upiUri)}`;

    return {
      orderId,
      amount,
      amountInPaise,
      currency,
      keyId,
      receipt: receiptTag,
      upiVpa,
      payeeName: schoolName,
      upiUri,
      qrCodeUrl,
      uploadedQrImageUrl: paymentSettings.qrCodeImageUrl || null,
      schoolName,
      bankDetails: {
        accountNumber: paymentSettings.accountNumber || '',
        ifscCode: paymentSettings.ifscCode || '',
        bankName: paymentSettings.bankName || '',
        branch: paymentSettings.branch || '',
      },
      preferredMode: paymentSettings.preferredMode || 'DYNAMIC_UPI_QR',
      customInstructions: paymentSettings.customInstructions || '',
      student: {
        id: student.id,
        name: cleanStudentName,
        email: student.user.email,
        admissionNumber: student.admissionNumber,
      },
    };
  }

  async verifyRazorpayPayment(
    schoolId: string,
    userId: string,
    data: {
      orderId: string;
      paymentId: string;
      signature: string;
      studentId: string;
      amount: number;
      academicYearId?: string;
      remarks?: string;
    },
  ) {
    const validSchoolId = requireSchoolId(schoolId, 'Verify Razorpay payment');
    const keySecret =
      this.configService?.get<string>('RAZORPAY_KEY_SECRET') ||
      'rzp_test_secret_placeholder';

    // Verify cryptographic HMAC signature if live secret is available
    if (keySecret && !keySecret.includes('placeholder')) {
      const generatedSignature = crypto
        .createHmac('sha256', keySecret)
        .update(`${data.orderId}|${data.paymentId}`)
        .digest('hex');

      if (generatedSignature !== data.signature) {
        throw new BadRequestException(
          'Invalid Razorpay signature verification failed',
        );
      }
    }

    const resolvedYearId = await this.resolveAcademicYearId(
      validSchoolId,
      data.academicYearId,
    );

    // Automatically record fee collection and issue sequential receipt
    return this.collectFee(validSchoolId, userId, {
      studentId: data.studentId,
      amountPaid: data.amount,
      paymentMode: FeePaymentMode.ONLINE_UPI,
      transactionRef: data.paymentId,
      academicYearId: resolvedYearId,
      remarks:
        data.remarks ||
        `Online payment via Razorpay / UPI (Order: ${data.orderId})`,
    });
  }

  async handleRazorpayWebhook(
    signature: string,
    rawPayload: string,
    eventData: any,
  ) {
    const webhookSecret = this.configService?.get<string>(
      'RAZORPAY_WEBHOOK_SECRET',
    );
    if (webhookSecret && signature) {
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(rawPayload)
        .digest('hex');
      if (expectedSignature !== signature) {
        throw new BadRequestException('Invalid webhook signature');
      }
    }

    if (eventData?.event === 'payment.captured') {
      const paymentEntity = eventData.payload?.payment?.entity;
      const notes = paymentEntity?.notes;
      if (notes?.schoolId && notes?.studentId) {
        const amount = Number(paymentEntity.amount) / 100;
        const resolvedYearId = await this.resolveAcademicYearId(
          notes.schoolId,
          notes.academicYearId,
        );
        await this.collectFee(notes.schoolId, 'SYSTEM_RAZORPAY_WEBHOOK', {
          studentId: notes.studentId,
          academicYearId: resolvedYearId,
          amountPaid: amount,
          paymentMode: FeePaymentMode.ONLINE_UPI,
          transactionRef: paymentEntity.id,
          remarks: `Captured via Razorpay Webhook (Payment ID: ${paymentEntity.id})`,
        });
      }
    }

    return { received: true };
  }

  async getReceiptDetails(schoolId: string, identifier: string) {
    const validSchoolId = requireSchoolId(schoolId, 'Get receipt details');

    const payment = (await this.prisma.feePayment.findFirst({
      where: {
        schoolId: validSchoolId,
        OR: [
          { id: identifier },
          { receipt: { id: identifier } },
          { receipt: { receiptNumber: identifier } },
        ],
      },
      include: {
        receipt: true,
        student: {
          include: {
            user: { select: { firstName: true, lastName: true, email: true } },
            enrollments: {
              where: { status: 'ACTIVE' },
              include: { section: { include: { class: true } } },
              take: 1,
            },
            guardians: {
              where: { isPrimary: true },
              select: {
                firstName: true,
                lastName: true,
                phone: true,
                email: true,
              },
            },
          },
        },
        items: true,
      },
    })) as any;

    if (!payment) {
      throw new NotFoundException('Receipt or payment record not found');
    }

    const [school, academicYear, feeHeads] = await Promise.all([
      this.prisma.school.findUnique({
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
          logoUrl: true,
        },
      }),
      this.prisma.academicYear.findUnique({
        where: { id: payment.academicYearId },
        select: { id: true, name: true },
      }),
      this.prisma.feeHead.findMany({
        where: { schoolId: validSchoolId },
        select: { id: true, name: true },
      }),
    ]);

    const feeHeadMap = new Map(feeHeads.map((h) => [h.id, h.name]));

    const student = payment.student;
    const activeEnrollment = student?.enrollments?.[0];
    const className = activeEnrollment?.section?.class?.name || 'Standard';
    const sectionName = activeEnrollment?.section?.name || 'A';
    const guardian = student?.guardians?.[0];

    const receiptNumber =
      payment.receipt?.receiptNumber ||
      `RCT-${payment.id.slice(-8).toUpperCase()}`;

    return {
      receiptId: payment.receipt?.id || payment.id,
      receiptNumber,
      issuedAt: payment.receipt?.issuedAt || payment.paymentDate,
      payment: {
        id: payment.id,
        amount: Number(payment.paidAmount),
        paymentMode: payment.paymentMode,
        transactionRef: payment.transactionRef,
        paymentDate: payment.paymentDate,
        remarks: payment.remarks,
        academicYear: academicYear?.name,
      },
      breakdown: (payment.items || []).map((it: any) => ({
        id: it.id,
        head: feeHeadMap.get(it.feeHeadId) || 'Academic Fee',
        amount: Number(it.amount),
        period: it.period,
      })),
      student: {
        id: student?.id,
        name: `${student?.user?.firstName || ''} ${student?.user?.lastName || ''}`.trim(),
        admissionNumber: student?.admissionNumber,
        rollNumber: student?.rollNumber,
        class: `${className} - ${sectionName}`,
        parentName: guardian
          ? `${guardian.firstName} ${guardian.lastName}`.trim()
          : null,
        parentPhone: guardian?.phone,
      },
      school,
    };
  }
}
