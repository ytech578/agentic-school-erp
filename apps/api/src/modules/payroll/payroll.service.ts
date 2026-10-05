import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { requireSchoolId } from '../../core/tenant/tenant.util';
import {
  UpsertSalaryStructureDto,
  CreatePayrollCycleDto,
  ProcessPayrollCycleDto,
  MarkPayslipPaidDto,
} from './dto/payroll.dto';
import PDFDocument from 'pdfkit';

@Injectable()
export class PayrollService {
  private readonly logger = new Logger(PayrollService.name);

  constructor(private readonly prisma: PrismaService) { }

  // ─── 1. SALARY STRUCTURE MANAGEMENT ────────────────────────────────────────

  async upsertSalaryStructure(
    schoolId: string,
    staffId: string,
    dto: UpsertSalaryStructureDto,
  ) {
    const validSchoolId = requireSchoolId(schoolId);

    // Verify staff belongs to this school
    const staff = await this.prisma.staff.findFirst({
      where: { id: staffId, schoolId: validSchoolId },
    });
    if (!staff) {
      throw new NotFoundException(`Staff record not found in this school.`);
    }

    const basicSalary = Number(dto.basicSalary);
    const da = Number(dto.da || 0);
    const hra = Number(dto.hra || 0);
    const conveyance = Number(dto.conveyance || 0);
    const medicalAllowance = Number(dto.medicalAllowance || 0);
    const specialAllowance = Number(dto.specialAllowance || 0);
    const epfApplicable =
      dto.epfApplicable !== undefined
        ? dto.epfApplicable
        : dto.epfEnrolled !== undefined
          ? dto.epfEnrolled
          : true;
    const esiApplicable =
      dto.esiApplicable !== undefined
        ? dto.esiApplicable
        : dto.esiEnrolled !== undefined
          ? dto.esiEnrolled
          : false;
    const professionalTax =
      dto.professionalTax !== undefined
        ? Number(dto.professionalTax)
        : dto.profTax !== undefined
          ? Number(dto.profTax)
          : 200;
    const tdsMonthly = Number(dto.tdsMonthly || 0);

    return this.prisma.salaryStructure.upsert({
      where: { staffId },
      update: {
        basicSalary,
        da,
        hra,
        conveyance,
        medicalAllowance,
        specialAllowance,
        epfApplicable,
        esiApplicable,
        professionalTax,
        tdsMonthly,
        schoolId: validSchoolId,
      },
      create: {
        schoolId: validSchoolId,
        staffId,
        basicSalary,
        da,
        hra,
        conveyance,
        medicalAllowance,
        specialAllowance,
        epfApplicable,
        esiApplicable,
        professionalTax,
        tdsMonthly,
      },
      include: {
        staff: {
          select: {
            id: true,
            employeeId: true,
            user: { select: { firstName: true, lastName: true, email: true } },
            designation: { select: { name: true } },
            department: { select: { name: true } },
          },
        },
      },
    });
  }

  async getSalaryStructure(schoolId: string, staffId: string) {
    const validSchoolId = requireSchoolId(schoolId);
    const structure = await this.prisma.salaryStructure.findFirst({
      where: { staffId, schoolId: validSchoolId },
      include: {
        staff: {
          select: {
            id: true,
            employeeId: true,
            user: { select: { firstName: true, lastName: true, email: true } },
            designation: { select: { name: true } },
            department: { select: { name: true } },
          },
        },
      },
    });
    if (!structure) {
      throw new NotFoundException(
        `Salary structure not configured for this staff.`,
      );
    }
    return structure;
  }

  async listSalaryStructures(schoolId: string | null) {
    const where: any = schoolId ? { schoolId } : {};
    return this.prisma.salaryStructure.findMany({
      where,
      include: {
        staff: {
          select: {
            id: true,
            employeeId: true,
            user: { select: { firstName: true, lastName: true } },
            designation: { select: { name: true } },
            department: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─── 2. PAYROLL CYCLE OPERATIONS ──────────────────────────────────────────

  async createPayrollCycle(schoolId: string, dto: CreatePayrollCycleDto) {
    const validSchoolId = requireSchoolId(schoolId);

    const existing = await this.prisma.payrollCycle.findUnique({
      where: {
        schoolId_month_year: {
          schoolId: validSchoolId,
          month: dto.month,
          year: dto.year,
        },
      },
    });

    if (existing) {
      throw new ConflictException(
        `Payroll cycle for ${dto.month}/${dto.year} already exists in this school.`,
      );
    }

    return this.prisma.payrollCycle.create({
      data: {
        schoolId: validSchoolId,
        month: dto.month,
        year: dto.year,
        workingDays: dto.workingDays || 30,
        status: 'DRAFT',
      },
    });
  }

  async listPayrollCycles(schoolId: string | null) {
    const where: any = schoolId ? { schoolId } : {};
    const cycles = await this.prisma.payrollCycle.findMany({
      where,
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      include: {
        _count: { select: { payslips: true } },
        payslips: {
          select: {
            grossSalary: true,
            netSalary: true,
            totalDeductions: true,
            epfDeduction: true,
            esiDeduction: true,
            ptDeduction: true,
            tdsDeduction: true,
          },
        },
      },
    });

    return cycles.map((c) => {
      const epfSum = c.payslips.reduce(
        (sum, p) => sum + (p.epfDeduction || 0),
        0,
      );
      const esiSum = c.payslips.reduce(
        (sum, p) => sum + (p.esiDeduction || 0),
        0,
      );
      const ptSum = c.payslips.reduce(
        (sum, p) => sum + (p.ptDeduction || 0),
        0,
      );
      const tdsSum = c.payslips.reduce(
        (sum, p) => sum + (p.tdsDeduction || 0),
        0,
      );
      const grossSum = c.payslips.reduce(
        (sum, p) => sum + (p.grossSalary || 0),
        0,
      );
      const netSum = c.payslips.reduce((sum, p) => sum + (p.netSalary || 0), 0);
      const deductionsSum = c.payslips.reduce(
        (sum, p) => sum + (p.totalDeductions || 0),
        0,
      );

      return {
        id: c.id,
        schoolId: c.schoolId,
        month: c.month,
        year: c.year,
        workingDays: c.workingDays,
        status: c.status,
        totalGross: c.payslips.length > 0 ? grossSum : c.totalGross,
        totalDeductions:
          c.payslips.length > 0 ? deductionsSum : c.totalDeductions,
        totalNet: c.payslips.length > 0 ? netSum : c.totalNet,
        totalEpf: epfSum,
        totalEsi: esiSum,
        totalPt: ptSum,
        totalTds: tdsSum,
        payslipsCount: c._count.payslips,
        processedBy: c.processedBy,
        approvedBy: c.approvedBy,
        processedAt: c.processedAt,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      };
    });
  }

  async getPayrollCycle(schoolId: string, cycleId: string) {
    const validSchoolId = requireSchoolId(schoolId);
    const cycle = await this.prisma.payrollCycle.findFirst({
      where: { id: cycleId, schoolId: validSchoolId },
      include: {
        payslips: {
          include: {
            staff: {
              select: {
                id: true,
                employeeId: true,
                bankName: true,
                bankAccountNo: true,
                bankIfscCode: true,
                panNumber: true,
                user: {
                  select: { firstName: true, lastName: true, email: true },
                },
                designation: { select: { name: true } },
                department: { select: { name: true } },
                salaryStructure: true,
              },
            },
          },
        },
      },
    });
    if (!cycle) {
      throw new NotFoundException(`Payroll cycle not found.`);
    }

    const mappedPayslips = (cycle.payslips || []).map((p) => {
      const struct = (p.staff as any)?.salaryStructure;
      const conveyance = struct?.conveyance || 0;
      const medicalAllowance = struct?.medicalAllowance || 0;
      const specialAllowance =
        struct?.specialAllowance ||
        Math.max(0, p.allowances - (conveyance + medicalAllowance));

      return {
        ...p,
        month: cycle.month,
        year: cycle.year,
        workingDays: cycle.workingDays,
        unpaidLeaveDays: p.lossOfPayDays,
        conveyance,
        medicalAllowance,
        specialAllowance,
        profTaxDeduction: p.ptDeduction,
        lopDeduction: p.otherDeductions,
      };
    });

    return {
      ...cycle,
      payslips: mappedPayslips,
    };
  }

  // ─── 3. PROCESS & CALCULATE PAYROLL ───────────────────────────────────────

  async processPayrollCycle(
    schoolId: string,
    cycleId: string,
    processedByUserId: string,
    dto?: ProcessPayrollCycleDto,
  ) {
    const validSchoolId = requireSchoolId(schoolId);

    const cycle = await this.prisma.payrollCycle.findFirst({
      where: { id: cycleId, schoolId: validSchoolId },
    });
    if (!cycle) {
      throw new NotFoundException(`Payroll cycle not found.`);
    }
    if (cycle.status === 'PAID') {
      throw new BadRequestException(
        `Cannot re-process a cycle that is already marked as PAID.`,
      );
    }

    const workingDays = dto?.workingDays || cycle.workingDays || 30;

    // Fetch all active staff with defined salary structures in this school
    const activeStaff = await this.prisma.staff.findMany({
      where: { schoolId: validSchoolId, isActive: true },
      include: {
        salaryStructure: true,
        user: { select: { firstName: true, lastName: true } },
      },
    });

    const staffWithSalary = activeStaff.filter(
      (s) => s.salaryStructure !== null,
    );
    if (staffWithSalary.length === 0) {
      throw new BadRequestException(
        `No active staff with configured salary structures found to process.`,
      );
    }

    // Determine month bounds for attendance & leave deduction calculation
    const cycleStart = new Date(cycle.year, cycle.month - 1, 1);
    const cycleEnd = new Date(cycle.year, cycle.month, 0, 23, 59, 59);

    let totalCycleGross = 0;
    let totalCycleDeductions = 0;
    let totalCycleNet = 0;

    const payslipDataToCreate: any[] = [];

    for (const staff of staffWithSalary) {
      const struct = staff.salaryStructure!;

      // 1. Calculate Loss of Pay (LOP) from Unpaid Leaves / Absences
      let lopDays = 0;
      if (
        dto?.unpaidLeaveDaysByStaff &&
        typeof dto.unpaidLeaveDaysByStaff[staff.id] === 'number'
      ) {
        lopDays = Math.max(0, Number(dto.unpaidLeaveDaysByStaff[staff.id]));
      } else {
        // Check approved unpaid leave requests
        const unpaidLeaves = await this.prisma.leaveRequest.findMany({
          where: {
            staffId: staff.id,
            schoolId: validSchoolId,
            status: 'APPROVED',
            leaveType: 'UNPAID',
            startDate: { lte: cycleEnd },
            endDate: { gte: cycleStart },
          },
        });

        for (const leave of unpaidLeaves) {
          const start =
            leave.startDate < cycleStart ? cycleStart : leave.startDate;
          const end = leave.endDate > cycleEnd ? cycleEnd : leave.endDate;
          const diffDays =
            Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) +
            1;
          lopDays += Math.max(0, diffDays);
        }
      }
      lopDays = Math.min(lopDays, workingDays);
      const presentDays = Math.max(0, workingDays - lopDays);

      // 2. Earnings Components
      const basic = struct.basicSalary;
      const da = struct.da;
      const hra = struct.hra;
      const allowances =
        struct.conveyance + struct.medicalAllowance + struct.specialAllowance;
      const gross = basic + da + hra + allowances;

      // 3. Indian Statutory Deductions
      // EPF: 12% of (Basic + DA) if applicable
      const epfDeduction = struct.epfApplicable
        ? Math.round((basic + da) * 0.12)
        : 0;

      // ESI: 0.75% of Gross if applicable and Gross <= 21,000 INR
      const esiDeduction =
        struct.esiApplicable && gross <= 21000 ? Math.round(gross * 0.0075) : 0;

      // Professional Tax (PT): standard ₹200 or defined
      const ptDeduction = struct.professionalTax;

      // Income Tax (TDS): monthly estimated
      const tdsDeduction = struct.tdsMonthly;

      // Loss of Pay Deduction
      const perDaySalary = gross / workingDays;
      const lopDeduction = Math.round(perDaySalary * lopDays);

      const totalDeductions =
        epfDeduction + esiDeduction + ptDeduction + tdsDeduction + lopDeduction;

      const netSalary = Math.max(0, Math.round(gross - totalDeductions));

      const payslipNumber = `PAY/${cycle.year}/${String(cycle.month).padStart(2, '0')}/${staff.employeeId}`;

      totalCycleGross += gross;
      totalCycleDeductions += totalDeductions;
      totalCycleNet += netSalary;

      payslipDataToCreate.push({
        schoolId: validSchoolId,
        cycleId: cycle.id,
        staffId: staff.id,
        payslipNumber,
        presentDays,
        lossOfPayDays: lopDays,
        basicSalary: basic,
        da,
        hra,
        allowances,
        grossSalary: gross,
        epfDeduction,
        esiDeduction,
        ptDeduction,
        tdsDeduction,
        otherDeductions: lopDeduction,
        totalDeductions,
        netSalary,
        paymentStatus: 'PENDING',
      });
    }

    // Execute atomically in a transaction: delete old draft payslips, re-insert, update cycle
    await this.prisma.$transaction(async (tx) => {
      await tx.payslip.deleteMany({
        where: { cycleId: cycle.id, schoolId: validSchoolId },
      });

      for (const p of payslipDataToCreate) {
        await tx.payslip.create({ data: p });
      }

      await tx.payrollCycle.update({
        where: { id: cycle.id },
        data: {
          status: 'APPROVED',
          workingDays,
          totalGross: totalCycleGross,
          totalDeductions: totalCycleDeductions,
          totalNet: totalCycleNet,
          processedBy: processedByUserId,
          processedAt: new Date(),
        },
      });
    });

    this.logger.log(
      `Processed payroll cycle ${cycle.month}/${cycle.year} for school ${validSchoolId}: ${payslipDataToCreate.length} payslips generated, Net Total: ₹${totalCycleNet}`,
    );

    return this.getPayrollCycle(validSchoolId, cycle.id);
  }

  // ─── 4. PAYSLIP RETRIEVAL & DISBURSEMENT ──────────────────────────────────

  async getPayslip(
    schoolId: string,
    payslipId: string,
    requestingUserId: string,
    requestingUserRole: string,
  ) {
    const validSchoolId = requireSchoolId(schoolId);

    const payslip = await this.prisma.payslip.findFirst({
      where: { id: payslipId, schoolId: validSchoolId },
      include: {
        cycle: true,
        staff: {
          select: {
            id: true,
            userId: true,
            employeeId: true,
            bankName: true,
            bankAccountNo: true,
            bankIfscCode: true,
            panNumber: true,
            user: { select: { firstName: true, lastName: true, email: true } },
            designation: { select: { name: true } },
            department: { select: { name: true } },
            salaryStructure: true,
          },
        },
      },
    });

    if (!payslip) {
      throw new NotFoundException(`Payslip not found.`);
    }

    // Role-based authorization: Teachers/Staff can only access their OWN payslip
    const isElevated = [
      'SUPER_ADMIN',
      'SCHOOL_ADMIN',
      'PRINCIPAL',
      'ACCOUNTANT',
    ].includes(requestingUserRole);

    if (!isElevated && payslip.staff.userId !== requestingUserId) {
      throw new ForbiddenException(
        `You are not authorized to view this payslip.`,
      );
    }

    const struct = (payslip.staff as any)?.salaryStructure;
    const conveyance = struct?.conveyance || 0;
    const medicalAllowance = struct?.medicalAllowance || 0;
    const specialAllowance =
      struct?.specialAllowance ||
      Math.max(0, payslip.allowances - (conveyance + medicalAllowance));

    return {
      ...payslip,
      month: payslip.cycle?.month,
      year: payslip.cycle?.year,
      workingDays: payslip.cycle?.workingDays || (payslip.presentDays + payslip.lossOfPayDays),
      unpaidLeaveDays: payslip.lossOfPayDays,
      conveyance,
      medicalAllowance,
      specialAllowance,
      profTaxDeduction: payslip.ptDeduction,
      lopDeduction: payslip.otherDeductions,
    };
  }

  async listAllPayslips(
    schoolId: string,
    filters?: {
      month?: number;
      year?: number;
      cycleId?: string;
      search?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const validSchoolId = requireSchoolId(schoolId);
    const where: any = { schoolId: validSchoolId };
    if (filters?.cycleId) where.cycleId = filters.cycleId;
    if (filters?.month || filters?.year) {
      where.cycle = {};
      if (filters?.month) where.cycle.month = Number(filters.month);
      if (filters?.year) where.cycle.year = Number(filters.year);
    }
    if (filters?.search) {
      const q = filters.search.trim();
      where.OR = [
        { payslipNumber: { contains: q, mode: 'insensitive' } },
        { staff: { employeeId: { contains: q, mode: 'insensitive' } } },
        { staff: { user: { firstName: { contains: q, mode: 'insensitive' } } } },
        { staff: { user: { lastName: { contains: q, mode: 'insensitive' } } } },
      ];
    }

    const payslips = await this.prisma.payslip.findMany({
      where,
      include: {
        cycle: true,
        staff: {
          select: {
            id: true,
            employeeId: true,
            bankName: true,
            bankAccountNo: true,
            bankIfscCode: true,
            panNumber: true,
            user: { select: { firstName: true, lastName: true, email: true } },
            designation: { select: { name: true } },
            department: { select: { name: true } },
            salaryStructure: true,
          },
        },
      },
      orderBy: [
        { cycle: { year: 'desc' } },
        { cycle: { month: 'desc' } },
        { staff: { employeeId: 'asc' } },
      ],
      take: filters?.limit ? Math.min(Number(filters.limit), 500) : 200,
      skip:
        filters?.page && filters?.limit
          ? (Number(filters.page) - 1) * Number(filters.limit)
          : undefined,
    });

    return payslips.map((p) => {
      const struct = (p.staff as any)?.salaryStructure;
      const conveyance = struct?.conveyance || 0;
      const medicalAllowance = struct?.medicalAllowance || 0;
      const specialAllowance =
        struct?.specialAllowance ||
        Math.max(0, p.allowances - (conveyance + medicalAllowance));

      return {
        ...p,
        month: p.cycle.month,
        year: p.cycle.year,
        workingDays: p.cycle.workingDays,
        unpaidLeaveDays: p.lossOfPayDays,
        conveyance,
        medicalAllowance,
        specialAllowance,
        profTaxDeduction: p.ptDeduction,
        lopDeduction: p.otherDeductions,
      };
    });
  }

  async getStaffPayslips(
    schoolId: string,
    staffId: string,
    requestingUserId: string,
    requestingUserRole: string,
  ) {
    const validSchoolId = requireSchoolId(schoolId);

    const staff = await this.prisma.staff.findFirst({
      where: { id: staffId, schoolId: validSchoolId },
      include: { salaryStructure: true },
    });
    if (!staff) {
      throw new NotFoundException(`Staff record not found.`);
    }

    const isElevated = [
      'SUPER_ADMIN',
      'SCHOOL_ADMIN',
      'PRINCIPAL',
      'ACCOUNTANT',
    ].includes(requestingUserRole);

    if (!isElevated && staff.userId !== requestingUserId) {
      throw new ForbiddenException(
        `You are not authorized to view payslips for this staff member.`,
      );
    }

    const payslips = await this.prisma.payslip.findMany({
      where: { staffId, schoolId: validSchoolId },
      include: { cycle: true },
      orderBy: { createdAt: 'desc' },
    });

    const struct = staff.salaryStructure;
    const conveyance = struct?.conveyance || 0;
    const medicalAllowance = struct?.medicalAllowance || 0;

    return payslips.map((p) => {
      const specialAllowance =
        struct?.specialAllowance ||
        Math.max(0, p.allowances - (conveyance + medicalAllowance));

      return {
        ...p,
        month: p.cycle?.month,
        year: p.cycle?.year,
        workingDays: p.cycle?.workingDays || (p.presentDays + p.lossOfPayDays),
        unpaidLeaveDays: p.lossOfPayDays,
        conveyance,
        medicalAllowance,
        specialAllowance,
        profTaxDeduction: p.ptDeduction,
        lopDeduction: p.otherDeductions,
      };
    });
  }

  async markPayslipPaid(
    schoolId: string,
    payslipId: string,
    dto: MarkPayslipPaidDto,
  ) {
    const validSchoolId = requireSchoolId(schoolId);

    const payslip = await this.prisma.payslip.findFirst({
      where: { id: payslipId, schoolId: validSchoolId },
      include: { cycle: true },
    });
    if (!payslip) {
      throw new NotFoundException(`Payslip not found.`);
    }

    const updated = await this.prisma.payslip.update({
      where: { id: payslipId },
      data: {
        paymentStatus: 'PAID',
        paymentMethod: dto.paymentMethod,
        paymentRef: dto.paymentRef,
        remarks: dto.remarks,
        paidAt: new Date(),
      },
    });

    // If all payslips in this cycle are paid, mark the cycle as PAID
    const remainingPending = await this.prisma.payslip.count({
      where: { cycleId: payslip.cycleId, paymentStatus: 'PENDING' },
    });

    if (remainingPending === 0) {
      await this.prisma.payrollCycle.update({
        where: { id: payslip.cycleId },
        data: { status: 'PAID' },
      });
    }

    return updated;
  }

  // ─── 5. PAYSLIP PDF DOCUMENT GENERATION ────────────────────────────────────

  async generatePayslipPdf(
    schoolId: string,
    payslipId: string,
    requestingUserId: string,
    requestingUserRole: string,
  ): Promise<{ buffer: Buffer; fileName: string }> {
    const validSchoolId = requireSchoolId(schoolId);

    const payslip = await this.prisma.payslip.findFirst({
      where: { id: payslipId, schoolId: validSchoolId },
      include: {
        cycle: true,
        staff: {
          select: {
            id: true,
            userId: true,
            employeeId: true,
            bankName: true,
            bankAccountNo: true,
            bankIfscCode: true,
            panNumber: true,
            user: { select: { firstName: true, lastName: true, email: true } },
            designation: { select: { name: true } },
            department: { select: { name: true } },
            salaryStructure: true,
          },
        },
      },
    });

    if (!payslip) {
      throw new NotFoundException(`Payslip not found.`);
    }

    const isElevated = [
      'SUPER_ADMIN',
      'SCHOOL_ADMIN',
      'PRINCIPAL',
      'ACCOUNTANT',
    ].includes(requestingUserRole);

    if (!isElevated && payslip.staff.userId !== requestingUserId) {
      throw new ForbiddenException(
        `You are not authorized to download this payslip.`,
      );
    }

    const school = await this.prisma.school.findUnique({
      where: { id: validSchoolId },
      select: {
        name: true,
        address: true,
        city: true,
        state: true,
        pinCode: true,
        phone: true,
        email: true,
        affiliationNo: true,
      },
    });

    const monthNames = [
      '',
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];
    const monthName = monthNames[payslip.cycle.month] || `Month ${payslip.cycle.month}`;
    const employeeName = payslip.staff.user
      ? `${payslip.staff.user.firstName} ${payslip.staff.user.lastName || ''}`.trim()
      : 'Staff Member';
    const employeeId = payslip.staff.employeeId || payslip.staff.id.substring(0, 8);

    const buffer = await new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 35,
        info: {
          Title: `Salary Slip - ${employeeName} - ${monthName} ${payslip.cycle.year}`,
          Author: school?.name || 'Agentic School ERP',
        },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      const pageWidth = doc.page.width;
      const contentWidth = pageWidth - 70; // 525 pt

      // ── Outer Border ──
      doc
        .rect(20, 20, pageWidth - 40, doc.page.height - 40)
        .lineWidth(1.5)
        .strokeColor('#1e293b')
        .stroke();
      doc
        .rect(23, 23, pageWidth - 46, doc.page.height - 46)
        .lineWidth(0.5)
        .strokeColor('#94a3b8')
        .stroke();

      // ── School Header ──
      let y = 35;
      doc
        .font('Helvetica-Bold')
        .fontSize(16)
        .fillColor('#0f172a')
        .text((school?.name || 'AGENTIC INTERNATIONAL SCHOOL').toUpperCase(), 35, y, {
          width: contentWidth,
          align: 'center',
        });

      y += 20;
      const locationParts = [
        school?.address,
        school?.city,
        school?.state,
        school?.pinCode,
      ].filter(Boolean);
      if (locationParts.length > 0) {
        doc
          .font('Helvetica')
          .fontSize(8.5)
          .fillColor('#475569')
          .text(locationParts.join(', '), 35, y, {
            width: contentWidth,
            align: 'center',
          });
        y += 12;
      }

      const contactParts: string[] = [];
      if (school?.phone) contactParts.push(`Phone: ${school.phone}`);
      if (school?.email) contactParts.push(`Email: ${school.email}`);
      if (school?.affiliationNo) contactParts.push(`Affiliation No: ${school.affiliationNo}`);

      if (contactParts.length > 0) {
        doc
          .font('Helvetica')
          .fontSize(8)
          .fillColor('#64748b')
          .text(contactParts.join('  |  '), 35, y, {
            width: contentWidth,
            align: 'center',
          });
        y += 12;
      }

      // ── Title Banner ──
      y += 4;
      doc
        .rect(35, y, contentWidth, 22)
        .fillColor('#1e293b')
        .fill();

      doc
        .font('Helvetica-Bold')
        .fontSize(10.5)
        .fillColor('#ffffff')
        .text(
          `SALARY SLIP FOR THE MONTH OF ${monthName.toUpperCase()} ${payslip.cycle.year}`,
          35,
          y + 6,
          { width: contentWidth, align: 'center' },
        );

      y += 28;

      // ── Employee Particulars Table ──
      const empBoxY = y;
      const empBoxH = 68;
      doc
        .rect(35, empBoxY, contentWidth, empBoxH)
        .lineWidth(0.75)
        .fillAndStroke('#f8fafc', '#cbd5e1');

      const colW = contentWidth / 4;
      const empRows = [
        [
          { label: 'Employee ID:', value: employeeId },
          { label: 'Employee Name:', value: employeeName },
        ],
        [
          { label: 'Designation:', value: payslip.staff.designation?.name || 'Faculty' },
          { label: 'Department:', value: payslip.staff.department?.name || 'Academics' },
        ],
        [
          { label: 'Bank Name:', value: payslip.staff.bankName || 'N/A' },
          { label: 'Bank A/C No:', value: payslip.staff.bankAccountNo ? `••••${payslip.staff.bankAccountNo.slice(-4)}` : 'N/A' },
        ],
        [
          { label: 'PAN Number:', value: payslip.staff.panNumber || 'N/A' },
          {
            label: 'Working / Paid Days:',
            value: `${payslip.cycle.workingDays} / ${payslip.presentDays} (LOP: ${payslip.lossOfPayDays})`,
          },
        ],
      ];

      let rY = empBoxY + 6;
      for (const row of empRows) {
        // Col 1 & 2
        doc
          .font('Helvetica-Bold')
          .fontSize(8)
          .fillColor('#475569')
          .text(row[0].label, 42, rY, { width: 90 });
        doc
          .font('Helvetica')
          .fontSize(8)
          .fillColor('#0f172a')
          .text(row[0].value, 135, rY, { width: 140 });

        // Col 3 & 4
        doc
          .font('Helvetica-Bold')
          .fontSize(8)
          .fillColor('#475569')
          .text(row[1].label, 305, rY, { width: 105 });
        doc
          .font('Helvetica')
          .fontSize(8)
          .fillColor('#0f172a')
          .text(row[1].value, 415, rY, { width: 140 });

        rY += 15;
      }

      y = empBoxY + empBoxH + 12;

      // ── Earnings & Deductions Tables ──
      const tblW = (contentWidth - 10) / 2; // ~257 pt each
      const tblH = 135;
      const leftColX = 35;
      const rightColX = 35 + tblW + 10;

      // Header Boxes
      doc.rect(leftColX, y, tblW, 18).fillAndStroke('#f1f5f9', '#94a3b8');
      doc.rect(rightColX, y, tblW, 18).fillAndStroke('#f1f5f9', '#94a3b8');

      doc
        .font('Helvetica-Bold')
        .fontSize(8.5)
        .fillColor('#0f172a')
        .text('EARNINGS', leftColX + 8, y + 5)
        .text('AMOUNT (₹)', leftColX + tblW - 75, y + 5, { width: 65, align: 'right' });

      doc
        .font('Helvetica-Bold')
        .fontSize(8.5)
        .fillColor('#0f172a')
        .text('DEDUCTIONS', rightColX + 8, y + 5)
        .text('AMOUNT (₹)', rightColX + tblW - 75, y + 5, { width: 65, align: 'right' });

      // Body Outlines
      doc.rect(leftColX, y + 18, tblW, tblH - 18).strokeColor('#cbd5e1').stroke();
      doc.rect(rightColX, y + 18, tblW, tblH - 18).strokeColor('#cbd5e1').stroke();

      const fmt = (n: number) =>
        n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

      const struct = (payslip.staff as any)?.salaryStructure;
      const conv = struct?.conveyance || 0;
      const med = struct?.medicalAllowance || 0;
      const spl = struct?.specialAllowance ?? Math.max(0, payslip.allowances - (conv + med));

      const earningsItems: [string, string][] = [
        ['Basic Salary', fmt(payslip.basicSalary)],
        ['Dearness Allowance (DA)', fmt(payslip.da)],
        ['House Rent Allowance (HRA)', fmt(payslip.hra)],
      ];
      if (conv > 0) earningsItems.push(['Conveyance Allowance', fmt(conv)]);
      if (med > 0) earningsItems.push(['Medical Allowance', fmt(med)]);
      if (spl > 0 || (conv === 0 && med === 0)) earningsItems.push(['Special Allowance', fmt(spl > 0 ? spl : payslip.allowances)]);

      const deductionsItems: [string, string][] = [
        ['Provident Fund (EPF 12%)', fmt(payslip.epfDeduction)],
        ['ESI Contribution (0.75%)', fmt(payslip.esiDeduction)],
        ['Professional Tax (PT)', fmt(payslip.ptDeduction)],
        ['TDS / Income Tax', fmt(payslip.tdsDeduction)],
      ];
      if (payslip.otherDeductions > 0 || payslip.lossOfPayDays > 0) {
        deductionsItems.push(['Loss of Pay (LOP)', fmt(payslip.otherDeductions)]);
      }

      let rowY = y + 24;
      for (const item of earningsItems) {
        doc.font('Helvetica').fontSize(8).fillColor('#334155').text(item[0], leftColX + 8, rowY);
        doc.font('Helvetica').fontSize(8).fillColor('#0f172a').text(item[1], leftColX + tblW - 75, rowY, {
          width: 65,
          align: 'right',
        });
        rowY += 18;
      }

      rowY = y + 24;
      for (const item of deductionsItems) {
        doc.font('Helvetica').fontSize(8).fillColor('#334155').text(item[0], rightColX + 8, rowY);
        doc.font('Helvetica').fontSize(8).fillColor('#0f172a').text(item[1], rightColX + tblW - 75, rowY, {
          width: 65,
          align: 'right',
        });
        rowY += 18;
      }

      // Totals Row
      const totalY = y + tblH - 22;
      doc.rect(leftColX, totalY, tblW, 22).fillAndStroke('#f8fafc', '#94a3b8');
      doc.rect(rightColX, totalY, tblW, 22).fillAndStroke('#f8fafc', '#94a3b8');

      doc
        .font('Helvetica-Bold')
        .fontSize(8.5)
        .fillColor('#0f172a')
        .text('TOTAL GROSS EARNINGS', leftColX + 8, totalY + 6)
        .text(`₹ ${fmt(payslip.grossSalary)}`, leftColX + tblW - 90, totalY + 6, {
          width: 80,
          align: 'right',
        });

      doc
        .font('Helvetica-Bold')
        .fontSize(8.5)
        .fillColor('#0f172a')
        .text('TOTAL DEDUCTIONS', rightColX + 8, totalY + 6)
        .text(`₹ ${fmt(payslip.totalDeductions)}`, rightColX + tblW - 90, totalY + 6, {
          width: 80,
          align: 'right',
        });

      y += tblH + 12;

      // ── Net Salary Box ──
      const netBoxH = 46;
      doc
        .rect(35, y, contentWidth, netBoxH)
        .lineWidth(1)
        .fillAndStroke('#ecfdf5', '#10b981');

      doc
        .font('Helvetica-Bold')
        .fontSize(12)
        .fillColor('#047857')
        .text(
          `NET SALARY PAYABLE:  ₹ ${fmt(payslip.netSalary)}`,
          48,
          y + 10,
        );

      doc
        .font('Helvetica-Oblique')
        .fontSize(8.5)
        .fillColor('#1e293b')
        .text(
          `(${numberToWords(Math.round(payslip.netSalary))})`,
          48,
          y + 28,
        );

      y += netBoxH + 12;

      // ── Disbursement & Settlement Summary ──
      const disH = 34;
      doc
        .rect(35, y, contentWidth, disH)
        .lineWidth(0.5)
        .fillAndStroke('#f8fafc', '#cbd5e1');

      doc
        .font('Helvetica-Bold')
        .fontSize(8)
        .fillColor('#475569')
        .text('Payment Status:', 45, y + 11);
      doc
        .font('Helvetica-Bold')
        .fontSize(8)
        .fillColor(payslip.paymentStatus === 'PAID' ? '#16a34a' : '#ea580c')
        .text(payslip.paymentStatus, 115, y + 11);

      doc
        .font('Helvetica-Bold')
        .fontSize(8)
        .fillColor('#475569')
        .text('Payment Mode:', 170, y + 11);
      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor('#0f172a')
        .text(payslip.paymentMethod || 'Direct Bank Transfer', 238, y + 11);

      doc
        .font('Helvetica-Bold')
        .fontSize(8)
        .fillColor('#475569')
        .text('Reference / UTR:', 340, y + 11);
      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor('#0f172a')
        .text(payslip.paymentRef || 'N/A', 415, y + 11);

      y += disH + 45;

      // ── Signatures ──
      doc
        .font('Helvetica')
        .fontSize(8.5)
        .fillColor('#334155')
        .text('__________________________________', 50, y)
        .text('__________________________________', pageWidth - 230, y);

      y += 12;
      doc
        .font('Helvetica-Bold')
        .fontSize(8.5)
        .fillColor('#0f172a')
        .text('Employee Signature', 80, y)
        .text('Authorized Signatory / Principal', pageWidth - 200, y);

      // ── Footer Note ──
      y = doc.page.height - 48;
      doc
        .font('Helvetica-Oblique')
        .fontSize(7)
        .fillColor('#94a3b8')
        .text(
          `This document is system-generated by Agentic School ERP. Verification reference: ${payslip.payslipNumber} | Printed: ${new Date().toLocaleString('en-IN')}`,
          35,
          y,
          { width: contentWidth, align: 'center' },
        );

      doc.end();
    });

    const safeEmpId = (employeeId || 'STAFF').replace(/[^a-zA-Z0-9_-]/g, '');
    const fileName = `payslip-${safeEmpId}-${monthName}-${payslip.cycle.year}.pdf`;

    return { buffer, fileName };
  }

  // ─── 7. BANK NEFT BULK DISBURSEMENT EXPORT ──────────────────────────────────

  async exportNeftCsv(
    schoolId: string,
    cycleId: string,
  ): Promise<{
    csv: string;
    fileName: string;
    processedCount: number;
    skippedCount: number;
    skippedStaff?: string[];
  }> {
    const validSchoolId = requireSchoolId(schoolId);

    const cycle = await this.prisma.payrollCycle.findFirst({
      where: { id: cycleId, schoolId: validSchoolId },
      include: {
        payslips: {
          include: {
            staff: {
              include: {
                user: true,
                designation: true,
              },
            },
          },
        },
      },
    });

    if (!cycle) {
      throw new NotFoundException('Payroll cycle not found in this school.');
    }

    const monthNames = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];
    const monthName = monthNames[cycle.month - 1] || `Month-${cycle.month}`;

    const headers = [
      'Transaction Type',
      'Beneficiary Account Number',
      'Beneficiary Name',
      'IFSC Code',
      'Amount (INR)',
      'Remark / Narrative',
      'Employee Code',
      'Payment Reference',
    ];

    const rows: string[] = [];
    const skippedStaff: string[] = [];

    for (const ps of cycle.payslips) {
      const staffName = ps.staff?.user
        ? `${ps.staff.user.firstName} ${ps.staff.user.lastName || ''}`.trim()
        : 'Staff';
      const accNo = (ps.staff as any)?.bankAccountNo;
      const ifsc = (ps.staff as any)?.bankIfsc;

      // Skip payslips with missing bank details — do NOT silently insert wrong routing
      if (!accNo || !ifsc) {
        skippedStaff.push(
          `${staffName} (${ps.staff?.employeeId || ps.staffId}): Missing bank account/IFSC`,
        );
        continue;
      }

      const amount = Number(ps.netSalary).toFixed(2);
      const remark = `Salary ${monthName} ${cycle.year}`;
      const empCode = ps.staff?.employeeId || ps.staffId.slice(0, 8);
      const refNo = ps.payslipNumber || `SAL-${ps.id.slice(0, 8)}`;

      rows.push(
        [
          'NEFT',
          `"${accNo}"`,
          `"${staffName}"`,
          `"${ifsc}"`,
          amount,
          `"${remark}"`,
          `"${empCode}"`,
          `"${refNo}"`,
        ].join(','),
      );
    }

    const csv = [headers.join(','), ...rows].join('\n');
    const fileName = `NEFT-Disbursement-${monthName}-${cycle.year}.csv`;

    return {
      csv,
      fileName,
      processedCount: rows.length,
      skippedCount: skippedStaff.length,
      skippedStaff: skippedStaff.length > 0 ? skippedStaff : undefined,
    };
  }

  // ─── 8. FORM 16 ANNUAL TAX & TDS SUMMARY ───────────────────────────────────

  async generateForm16Summary(
    schoolId: string,
    staffId: string,
    financialYear: string,
  ) {
    const validSchoolId = requireSchoolId(schoolId);

    const [startYearStr, endYearStr] = (financialYear || '').split('-');
    const startYear =
      parseInt(startYearStr, 10) || new Date().getFullYear() - 1;
    const endYear = parseInt(endYearStr, 10) || startYear + 1;

    const [staff, school] = await Promise.all([
      this.prisma.staff.findFirst({
        where: { id: staffId, schoolId: validSchoolId },
        include: {
          user: true,
          designation: true,
        },
      }),
      this.prisma.school.findUnique({
        where: { id: validSchoolId },
      }),
    ]);

    if (!staff) {
      throw new NotFoundException('Staff member not found.');
    }

    const payslips = await this.prisma.payslip.findMany({
      where: {
        staffId,
        schoolId: validSchoolId,
        OR: [
          { cycle: { year: startYear, month: { gte: 4, lte: 12 } } },
          { cycle: { year: endYear, month: { gte: 1, lte: 3 } } },
        ],
      },
      include: {
        cycle: true,
      },
      orderBy: [{ cycle: { year: 'asc' } }, { cycle: { month: 'asc' } }],
    });

    let totalGrossSalary = 0;
    let totalBasic = 0;
    let totalHra = 0;
    let totalDa = 0;
    let totalAllowances = 0;
    let totalEpfDeduction = 0;
    let totalEsiDeduction = 0;
    let totalProfTax = 0;
    let totalTdsDeduction = 0;
    let totalNetSalary = 0;

    for (const ps of payslips) {
      totalGrossSalary += Number(ps.grossSalary || 0);
      totalBasic += Number(ps.basicSalary || 0);
      totalHra += Number(ps.hra || 0);
      totalDa += Number(ps.da || 0);
      totalAllowances += Number(ps.allowances || 0);
      totalEpfDeduction += Number(ps.epfDeduction || 0);
      totalEsiDeduction += Number(ps.esiDeduction || 0);
      totalProfTax += Number(ps.ptDeduction || 0);
      totalTdsDeduction += Number(ps.tdsDeduction || 0);
      totalNetSalary += Number(ps.netSalary || 0);
    }

    const standardDeduction = Math.min(50000, totalGrossSalary);
    const section80C = Math.min(150000, totalEpfDeduction);
    const section16iii = totalProfTax;

    const totalChapterVIA = section80C;
    const totalDeductions = standardDeduction + section16iii + totalChapterVIA;
    const taxableIncome = Math.max(0, totalGrossSalary - totalDeductions);

    return {
      financialYear: `${startYear}-${endYear}`,
      assessmentYear: `${startYear + 1}-${endYear + 1}`,
      school: {
        name: school?.name || 'School ERP Institution',
        address: school?.address || 'India',
        // PAN/TAN are mandatory for Form 16 — raise clear error if missing
        pan: (school as any)?.pan || null,
        tan: (school as any)?.tan || null,
        panStatus: (school as any)?.pan ? 'REGISTERED' : 'NOT_CONFIGURED',
        tanStatus: (school as any)?.tan ? 'REGISTERED' : 'NOT_CONFIGURED',
      },
      staff: {
        id: staff.id,
        employeeId: staff.employeeId || staff.id.slice(0, 8),
        name: staff.user
          ? `${staff.user.firstName} ${staff.user.lastName || ''}`.trim()
          : 'Staff Member',
        // PAN is required for Form 16 — never use fake placeholder
        pan: (staff as any)?.pan || null,
        panStatus: (staff as any)?.pan ? 'REGISTERED' : 'NOT_CONFIGURED',
        designation: staff.designation?.name || 'Staff',
      },
      monthsCount: payslips.length,
      earnings: {
        basicSalary: totalBasic,
        hra: totalHra,
        da: totalDa,
        specialAllowances: totalAllowances,
        grossSalary: totalGrossSalary,
      },
      deductions: {
        epf: totalEpfDeduction,
        esi: totalEsiDeduction,
        professionalTax: totalProfTax,
        standardDeduction,
        section80C,
        section16iii,
        totalChapterVIADeductions: totalChapterVIA,
        totalExemptionsAndDeductions: totalDeductions,
      },
      taxSummary: {
        grossTotalIncome: totalGrossSalary,
        taxableIncome,
        totalTdsDeducted: totalTdsDeduction,
        netDisbursed: totalNetSalary,
      },
      monthlyBreakdown: payslips.map((ps) => ({
        month: ps.cycle.month,
        year: ps.cycle.year,
        grossSalary: Number(ps.grossSalary),
        netSalary: Number(ps.netSalary),
        tds: Number(ps.tdsDeduction),
        epf: Number(ps.epfDeduction),
        pt: Number(ps.ptDeduction),
      })),
    };
  }
}


// ─── UTILITY HELPERS ────────────────────────────────────────────────────────

function numberToWords(num: number): string {
  if (num === 0) return 'Rupees Zero Only';
  const a = [
    '',
    'One',
    'Two',
    'Three',
    'Four',
    'Five',
    'Six',
    'Seven',
    'Eight',
    'Nine',
    'Ten',
    'Eleven',
    'Twelve',
    'Thirteen',
    'Fourteen',
    'Fifteen',
    'Sixteen',
    'Seventeen',
    'Eighteen',
    'Nineteen',
  ];
  const b = [
    '',
    '',
    'Twenty',
    'Thirty',
    'Forty',
    'Fifty',
    'Sixty',
    'Seventy',
    'Eighty',
    'Ninety',
  ];

  const inWords = (n: number): string => {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : '');
    if (n < 1000)
      return (
        a[Math.floor(n / 100)] +
        ' Hundred' +
        (n % 100 !== 0 ? ' and ' + inWords(n % 100) : '')
      );
    if (n < 100000)
      return (
        inWords(Math.floor(n / 1000)) +
        ' Thousand' +
        (n % 1000 !== 0 ? ' ' + inWords(n % 1000) : '')
      );
    if (n < 10000000)
      return (
        inWords(Math.floor(n / 100000)) +
        ' Lakh' +
        (n % 100000 !== 0 ? ' ' + inWords(n % 100000) : '')
      );
    return (
      inWords(Math.floor(n / 10000000)) +
      ' Crore' +
      (n % 10000000 !== 0 ? ' ' + inWords(n % 10000000) : '')
    );
  };

  return `Rupees ${inWords(Math.floor(Math.abs(num)))} Only`;
}
