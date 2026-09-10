import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { CreateFeeStructureInput, CollectFeeInput } from '@school-erp/shared';
import { FeePaymentStatus, FeePaymentMode, FeeFrequency } from '@prisma/client';
import { requireSchoolId } from '../../core/tenant/tenant.util';

@Injectable()
export class FeesService {
  constructor(private prisma: PrismaService) {}

  private async resolveAcademicYearId(
    schoolId: string,
    providedId?: string,
  ): Promise<string> {
    const validSchoolId = requireSchoolId(schoolId);
    if (providedId) {
      const year = await this.prisma.academicYear.findFirst({
        where: { id: providedId, schoolId: validSchoolId },
      });
      if (!year) {
        throw new NotFoundException('Academic year not found');
      }
      return year.id;
    }
    const activeYear = await this.prisma.academicYear.findFirst({
      where: { schoolId: validSchoolId, isActive: true },
    });
    if (!activeYear)
      throw new BadRequestException('No active academic year found');
    return activeYear.id;
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
    const maxOrder = await this.prisma.feeHead.count({ where: { schoolId: validSchoolId } });
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
        throw new BadRequestException('One or more fee heads do not belong to this school');
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
      where: { schoolId: validSchoolId, academicYearId: resolvedYearId, isActive: true },
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

    return this.prisma.$transaction(async (tx) => {
      // 1. Create Payment Record
      const payment = await tx.feePayment.create({
        data: {
          schoolId: validSchoolId,
          studentId: data.studentId,
          academicYearId: resolvedYearId,
          totalAmount: data.amountPaid, // In MVP, assume they pay what they want
          paidAmount: data.amountPaid,
          paymentMode: data.paymentMode as FeePaymentMode,
          paymentStatus: FeePaymentStatus.PAID,
          transactionRef: data.transactionRef,
          remarks: data.remarks,
          collectedById: userId,
        },
      });

      // 2. Generate Receipt
      const receiptNumber = `RCT-${new Date().getTime().toString().slice(-6)}`;
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

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
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
    const summary = await this.getStudentFeeSummary(validSchoolId, academicYearId);
    
    // Get students with actual risk score data to combine
    const studentsWithRisk = await this.prisma.student.findMany({
      where: { schoolId: validSchoolId },
      select: { id: true, riskScore: true, admissionNumber: true }
    });

    const riskMap = new Map();
    studentsWithRisk.forEach(s => riskMap.set(s.id, s.riskScore));

    const defaulters = summary
      .filter((s) => s.outstandingDue > 0)
      .map((s) => {
        const baseRisk = riskMap.get(s.id) || 0;
        // Simple heuristic: higher due + base risk = higher default probability
        const dueFactor = Math.min((s.outstandingDue / s.totalFee) * 50, 50) || 0; 
        const defaultProbability = Math.min(Math.round(baseRisk + dueFactor), 99);
        
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
            user: { select: { firstName: true, lastName: true, avatarUrl: true } },
            enrollments: {
              where: { status: 'ACTIVE' },
              include: { section: { include: { class: true } } },
            },
          }
        }
      }
    });

    if (!guardians || guardians.length === 0) return [];

    const academicYear = await this.prisma.academicYear.findFirst({
      where: { schoolId: validSchoolId, isActive: true },
    }) || await this.prisma.academicYear.findFirst({ where: { schoolId: validSchoolId } });
    if (!academicYear) return [];

    const structures = await this.prisma.feeStructure.findMany({
      where: { schoolId: validSchoolId, academicYearId: academicYear.id, isActive: true },
      include: { items: true },
    });

    const studentsResult = await Promise.all(guardians.map(async (g) => {
      const student = g.student;
      const classId = student.enrollments[0]?.section?.class.id;
      const structure = structures.find(s => s.classId === classId);
      
      const totalFee = structure?.items.reduce((sum, item) => sum + Number(item.amount), 0) || 0;

      const payments = await this.prisma.feePayment.findMany({
        where: {
          schoolId: validSchoolId,
          studentId: student.id,
          academicYearId: academicYear.id,
        },
      });

      const totalPaid = payments
        .filter(p => p.paymentStatus === 'PAID' || p.paymentStatus === 'PARTIAL')
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
    }));

    return studentsResult;
  }

  async processParentPayment(schoolId: string, userId: string, data: { studentId: string; amount: number; paymentMode: string }) {
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

    const academicYear = await this.prisma.academicYear.findFirst({
      where: { schoolId: validSchoolId, isActive: true },
    }) || await this.prisma.academicYear.findFirst({ where: { schoolId: validSchoolId } });
    if (!academicYear) throw new BadRequestException('No academic year found');

    const payment = await this.prisma.feePayment.create({
      data: {
        schoolId: validSchoolId,
        studentId: data.studentId,
        academicYearId: academicYear.id,
        totalAmount: data.amount,
        paidAmount: data.amount,
        outstandingAmount: 0,
        paymentMode: data.paymentMode as any,
        paymentStatus: 'PAID',
        remarks: 'Online Payment via Parent Portal',
        collectedById: userId,
        paymentDate: new Date(),
      }
    });

    const receipt = await this.prisma.receipt.create({
      data: {
        feePaymentId: payment.id,
        receiptNumber: `RCPT-ONL-${Date.now().toString().slice(-6)}`,
      }
    });

    return { success: true, paymentId: payment.id, receiptNumber: receipt.receiptNumber };
  }
}
