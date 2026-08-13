import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { CreateFeeStructureInput, CollectFeeInput } from '@school-erp/shared';
import { FeePaymentStatus, FeePaymentMode, FeeFrequency } from '@prisma/client';

@Injectable()
export class FeesService {
  constructor(private prisma: PrismaService) {}

  private async resolveAcademicYearId(schoolId: string, providedId?: string): Promise<string> {
    if (providedId && !providedId.startsWith('AY')) return providedId;
    const activeYear = await this.prisma.academicYear.findFirst({ where: { schoolId, isActive: true } });
    if (!activeYear) throw new BadRequestException('No active academic year found');
    return activeYear.id;
  }

  async getFeeHeads(schoolId: string) {
    return this.prisma.feeHead.findMany({
      where: { schoolId, isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async createFeeHead(schoolId: string, data: { name: string; description?: string }) {
    const maxOrder = await this.prisma.feeHead.count({ where: { schoolId } });
    return this.prisma.feeHead.create({
      data: {
        schoolId,
        name: data.name,
        description: data.description || null,
        isActive: true,
        sortOrder: maxOrder + 1,
      },
    });
  }

  async getStructuresByClass(schoolId: string, academicYearId: string, classId: string) {
    const resolvedYearId = await this.resolveAcademicYearId(schoolId, academicYearId);
    return this.prisma.feeStructure.findFirst({
      where: { schoolId, academicYearId: resolvedYearId, classId, isActive: true },
      include: {
        items: {
          include: { feeHead: true }
        }
      }
    });
  }

  async createOrUpdateStructure(schoolId: string, data: CreateFeeStructureInput) {
    const resolvedYearId = await this.resolveAcademicYearId(schoolId, data.academicYearId);
    // Delete existing structure for this class and year if it exists
    const existing = await this.prisma.feeStructure.findFirst({
      where: { schoolId, academicYearId: resolvedYearId, classId: data.classId }
    });

    if (existing) {
      await this.prisma.feeStructureItem.deleteMany({
        where: { feeStructureId: existing.id }
      });
      await this.prisma.feeStructure.delete({
        where: { id: existing.id }
      });
    }

    // Create new structure
    return this.prisma.feeStructure.create({
      data: {
        schoolId,
        academicYearId: resolvedYearId,
        classId: data.classId,
        name: data.name,
        description: data.description,
        items: {
          create: data.items.map((item: any) => ({
            feeHeadId: item.feeHeadId,
            amount: item.amount,
            frequency: FeeFrequency.ANNUAL,
          }))
        }
      },
      include: {
        items: true
      }
    });
  }

  async getStudentFeeSummary(schoolId: string, academicYearId: string) {
    const resolvedYearId = await this.resolveAcademicYearId(schoolId, academicYearId);
    // Fetch all active students with their class and payments for the year
    const students = await this.prisma.student.findMany({
      where: { schoolId, isActive: true },
      include: {
        user: { select: { firstName: true, lastName: true } },
        enrollments: {
          where: { status: 'ACTIVE' },
          include: { section: { include: { class: true } } },
          take: 1
        },
        feePayments: {
          where: { academicYearId: resolvedYearId }
        }
      }
    });

    // We also need all fee structures to calculate dues
    const structures = await this.prisma.feeStructure.findMany({
      where: { schoolId, academicYearId: resolvedYearId, isActive: true },
      include: { items: true }
    });

    return students.map(student => {
      const classId = student.enrollments[0]?.section?.class.id;
      const structure = structures.find(s => s.classId === classId);
      
      const totalFee = structure?.items.reduce((sum, item) => sum + Number(item.amount), 0) || 0;
      
      const totalPaid = student.feePayments
        .filter(p => p.paymentStatus === 'PAID' || p.paymentStatus === 'PARTIAL')
        .reduce((sum, p) => sum + Number(p.paidAmount), 0);
        
      return {
        id: student.id,
        admissionNumber: student.admissionNumber,
        firstName: student.user.firstName,
        lastName: student.user.lastName,
        class: student.enrollments[0]?.section?.class.name || 'N/A',
        totalFee,
        totalPaid,
        outstandingDue: totalFee - totalPaid > 0 ? totalFee - totalPaid : 0
      };
    });
  }

  async collectFee(schoolId: string, userId: string, data: CollectFeeInput) {
    const resolvedYearId = await this.resolveAcademicYearId(schoolId, data.academicYearId);
    if (data.amountPaid <= 0) {
      throw new BadRequestException("Amount must be greater than zero");
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Create Payment Record
      const payment = await tx.feePayment.create({
        data: {
          schoolId,
          studentId: data.studentId,
          academicYearId: resolvedYearId,
          totalAmount: data.amountPaid, // In MVP, assume they pay what they want
          paidAmount: data.amountPaid,
          paymentMode: data.paymentMode as FeePaymentMode,
          paymentStatus: FeePaymentStatus.PAID,
          transactionRef: data.transactionRef,
          remarks: data.remarks,
          collectedById: userId,
        }
      });

      // 2. Generate Receipt
      const receiptNumber = `RCT-${new Date().getTime().toString().slice(-6)}`;
      const receipt = await tx.receipt.create({
        data: {
          feePaymentId: payment.id,
          receiptNumber
        }
      });

      return {
        payment,
        receipt
      };
    });
  }
}
