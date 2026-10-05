import { Test, TestingModule } from '@nestjs/testing';
import { PayrollService } from './payroll.service';
import { PrismaService } from '../../core/database/prisma.service';
import {
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';

describe('PayrollService', () => {
  let service: PayrollService;
  let prisma: jest.Mocked<any>;

  const mockSchoolId = 'school-delhi-01';
  const mockStaffId = 'staff-001';

  beforeEach(async () => {
    prisma = {
      staff: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      salaryStructure: {
        upsert: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      payrollCycle: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      leaveRequest: {
        findMany: jest.fn(),
      },
      payslip: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        deleteMany: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [PayrollService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<PayrollService>(PayrollService);
  });

  describe('upsertSalaryStructure', () => {
    it('should throw NotFoundException if staff is not in the school', async () => {
      prisma.staff.findFirst.mockResolvedValue(null);

      await expect(
        service.upsertSalaryStructure(mockSchoolId, mockStaffId, {
          basicSalary: 30000,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should upsert salary structure successfully with default EPF and PT', async () => {
      prisma.staff.findFirst.mockResolvedValue({
        id: mockStaffId,
        schoolId: mockSchoolId,
      });
      prisma.salaryStructure.upsert.mockResolvedValue({
        id: 'struct-1',
        basicSalary: 30000,
        da: 5000,
        hra: 10000,
        epfApplicable: true,
        professionalTax: 200,
      });

      const res = await service.upsertSalaryStructure(
        mockSchoolId,
        mockStaffId,
        {
          basicSalary: 30000,
          da: 5000,
          hra: 10000,
        },
      );

      expect(res.basicSalary).toBe(30000);
      expect(prisma.salaryStructure.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { staffId: mockStaffId },
          create: expect.objectContaining({
            basicSalary: 30000,
            da: 5000,
            hra: 10000,
            epfApplicable: true,
            professionalTax: 200,
          }),
        }),
      );
    });
  });

  describe('createPayrollCycle', () => {
    it('should throw ConflictException if cycle already exists for month/year', async () => {
      prisma.payrollCycle.findUnique.mockResolvedValue({
        id: 'existing-cycle',
      });

      await expect(
        service.createPayrollCycle(mockSchoolId, { month: 9, year: 2026 }),
      ).rejects.toThrow(ConflictException);
    });

    it('should create new cycle in DRAFT status', async () => {
      prisma.payrollCycle.findUnique.mockResolvedValue(null);
      prisma.payrollCycle.create.mockResolvedValue({
        id: 'cycle-sep-2026',
        month: 9,
        year: 2026,
        status: 'DRAFT',
      });

      const res = await service.createPayrollCycle(mockSchoolId, {
        month: 9,
        year: 2026,
      });
      expect(res.status).toBe('DRAFT');
    });
  });

  describe('processPayrollCycle', () => {
    it('should calculate EPF (12% of basic+da), PT (200), and net salary', async () => {
      const mockCycle = {
        id: 'cycle-1',
        schoolId: mockSchoolId,
        month: 9,
        year: 2026,
        workingDays: 30,
        status: 'DRAFT',
      };
      prisma.payrollCycle.findFirst.mockResolvedValue(mockCycle);

      const mockStaffList = [
        {
          id: 'staff-1',
          employeeId: 'EMP001',
          isActive: true,
          schoolId: mockSchoolId,
          salaryStructure: {
            basicSalary: 30000,
            da: 6000,
            hra: 12000,
            conveyance: 2000,
            medicalAllowance: 1000,
            specialAllowance: 0,
            epfApplicable: true,
            esiApplicable: false,
            professionalTax: 200,
            tdsMonthly: 1500,
          },
          user: { firstName: 'Ravi', lastName: 'Kumar' },
        },
      ];
      prisma.staff.findMany.mockResolvedValue(mockStaffList);
      prisma.leaveRequest.findMany.mockResolvedValue([]); // No unpaid leave

      await service.processPayrollCycle(mockSchoolId, 'cycle-1', 'admin-user');

      // Gross = 30000 + 6000 + 12000 + 2000 + 1000 = 51,000
      // EPF = 12% of (30000 + 6000) = 4,320
      // PT = 200
      // TDS = 1500
      // Total deductions = 4320 + 200 + 1500 = 6,020
      // Net = 51,000 - 6,020 = 44,980
      expect(prisma.payslip.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            grossSalary: 51000,
            epfDeduction: 4320,
            ptDeduction: 200,
            tdsDeduction: 1500,
            totalDeductions: 6020,
            netSalary: 44980,
            payslipNumber: 'PAY/2026/09/EMP001',
          }),
        }),
      );
    });

    it('should calculate ESI (0.75%) if applicable and gross <= 21,000', async () => {
      const mockCycle = {
        id: 'cycle-1',
        schoolId: mockSchoolId,
        month: 9,
        year: 2026,
        workingDays: 30,
        status: 'DRAFT',
      };
      prisma.payrollCycle.findFirst.mockResolvedValue(mockCycle);

      const mockStaffList = [
        {
          id: 'staff-2',
          employeeId: 'EMP002',
          isActive: true,
          schoolId: mockSchoolId,
          salaryStructure: {
            basicSalary: 15000,
            da: 0,
            hra: 3000,
            conveyance: 1000,
            medicalAllowance: 1000,
            specialAllowance: 0,
            epfApplicable: false,
            esiApplicable: true,
            professionalTax: 200,
            tdsMonthly: 0,
          },
          user: { firstName: 'Anita', lastName: 'Sharma' },
        },
      ];
      prisma.staff.findMany.mockResolvedValue(mockStaffList);
      prisma.leaveRequest.findMany.mockResolvedValue([]);

      await service.processPayrollCycle(mockSchoolId, 'cycle-1', 'admin-user');

      // Gross = 20,000 (<= 21,000)
      // ESI = 0.75% of 20,000 = 150
      // PT = 200
      // Total deductions = 350
      // Net = 19,650
      expect(prisma.payslip.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            grossSalary: 20000,
            esiDeduction: 150,
            ptDeduction: 200,
            totalDeductions: 350,
            netSalary: 19650,
          }),
        }),
      );
    });

    it('should respect unpaidLeaveDaysByStaff override and compute LOP deduction', async () => {
      const mockCycle = {
        id: 'cycle-1',
        schoolId: mockSchoolId,
        month: 9,
        year: 2026,
        workingDays: 30,
        status: 'DRAFT',
      };
      prisma.payrollCycle.findFirst.mockResolvedValue(mockCycle);

      const mockStaffList = [
        {
          id: 'staff-3',
          employeeId: 'EMP003',
          isActive: true,
          schoolId: mockSchoolId,
          salaryStructure: {
            basicSalary: 30000,
            da: 0,
            hra: 0,
            conveyance: 0,
            medicalAllowance: 0,
            specialAllowance: 0,
            epfApplicable: false,
            esiApplicable: false,
            professionalTax: 0,
            tdsMonthly: 0,
          },
          user: { firstName: 'Vikram', lastName: 'Singh' },
        },
      ];
      prisma.staff.findMany.mockResolvedValue(mockStaffList);

      // Pass unpaidLeaveDaysByStaff with 3 days unpaid leave
      // Gross = 30000. Working days = 30 => Per day = 1000.
      // LOP deduction = 3 * 1000 = 3000. Net = 27000.
      await service.processPayrollCycle(mockSchoolId, 'cycle-1', 'admin-user', {
        unpaidLeaveDaysByStaff: { 'staff-3': 3 },
      });

      expect(prisma.payslip.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            grossSalary: 30000,
            lossOfPayDays: 3,
            otherDeductions: 3000,
            totalDeductions: 3000,
            netSalary: 27000,
          }),
        }),
      );
    });
  });

  describe('getPayslip', () => {
    it('should throw ForbiddenException if a non-elevated user tries to view someone elses payslip', async () => {
      prisma.payslip.findFirst.mockResolvedValue({
        id: 'pay-1',
        schoolId: mockSchoolId,
        staff: { userId: 'teacher-user-1' },
      });

      await expect(
        service.getPayslip(mockSchoolId, 'pay-1', 'intruder-user-2', 'TEACHER'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should permit staff to view their own payslip', async () => {
      const mockPayslip = {
        id: 'pay-1',
        schoolId: mockSchoolId,
        staff: { userId: 'teacher-user-1' },
      };
      prisma.payslip.findFirst.mockResolvedValue(mockPayslip);

      const res = await service.getPayslip(
        mockSchoolId,
        'pay-1',
        'teacher-user-1',
        'TEACHER',
      );
      expect(res).toMatchObject(mockPayslip);
    });

    it('should permit ADMIN to view any payslip in their school', async () => {
      const mockPayslip = {
        id: 'pay-1',
        schoolId: mockSchoolId,
        staff: { userId: 'teacher-user-1' },
      };
      prisma.payslip.findFirst.mockResolvedValue(mockPayslip);

      const res = await service.getPayslip(
        mockSchoolId,
        'pay-1',
        'admin-user',
        'SCHOOL_ADMIN',
      );
      expect(res).toMatchObject(mockPayslip);
    });
  });

  describe('markPayslipPaid', () => {
    it('should mark payslip as paid and close cycle when all are paid', async () => {
      prisma.payslip.findFirst.mockResolvedValue({
        id: 'pay-1',
        cycleId: 'cycle-1',
        schoolId: mockSchoolId,
      });
      prisma.payslip.update.mockResolvedValue({
        id: 'pay-1',
        paymentStatus: 'PAID',
      });
      prisma.payslip.count.mockResolvedValue(0); // 0 remaining pending

      await service.markPayslipPaid(mockSchoolId, 'pay-1', {
        paymentMethod: 'NEFT',
        paymentRef: 'NEFT20260901',
      });

      expect(prisma.payslip.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'pay-1' },
          data: expect.objectContaining({
            paymentStatus: 'PAID',
            paymentMethod: 'NEFT',
          }),
        }),
      );
      expect(prisma.payrollCycle.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'cycle-1' },
          data: { status: 'PAID' },
        }),
      );
    });
  });
});
