import { Test, TestingModule } from '@nestjs/testing';
import { FeesService, normalizeFeePaymentMode } from './fees.service';
import { PrismaService } from '../../core/database/prisma.service';
import { FeePaymentMode } from '@prisma/client';

describe('FeesService', () => {
  let service: FeesService;
  let prisma: jest.Mocked<any>;

  const mockSchoolId = 'school-delhi-01';

  beforeEach(async () => {
    prisma = {
      feePayment: {
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      student: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      academicYear: {
        findFirst: jest.fn(),
      },
      feeStructure: {
        findMany: jest.fn(),
      },
      feeHead: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      school: {
        findUnique: jest.fn().mockResolvedValue({
          id: mockSchoolId,
          name: 'Delhi Public Academy',
          affiliationNo: 'CBSE-9912',
          address: 'Main Street',
          city: 'New Delhi',
          state: 'Delhi',
          pinCode: '110001',
          phone: '011-23456789',
          email: 'admin@dpa.edu',
        }),
      },
      $transaction: jest.fn((cb) => cb(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<FeesService>(FeesService);
  });

  describe('normalizeFeePaymentMode', () => {
    it('should map CASH or missing to CASH', () => {
      expect(normalizeFeePaymentMode('CASH')).toBe(FeePaymentMode.CASH);
      expect(normalizeFeePaymentMode(undefined)).toBe(FeePaymentMode.CASH);
    });

    it('should map ONLINE, UPI, and CARD to ONLINE_UPI', () => {
      expect(normalizeFeePaymentMode('UPI')).toBe(FeePaymentMode.ONLINE_UPI);
      expect(normalizeFeePaymentMode('online')).toBe(FeePaymentMode.ONLINE_UPI);
      expect(normalizeFeePaymentMode('RAZORPAY')).toBe(FeePaymentMode.ONLINE_UPI);
    });

    it('should map CHEQUE, NEFT, and RTGS', () => {
      expect(normalizeFeePaymentMode('CHEQUE')).toBe(FeePaymentMode.CHEQUE);
      expect(normalizeFeePaymentMode('NEFT')).toBe(FeePaymentMode.NEFT);
      expect(normalizeFeePaymentMode('RTGS')).toBe(FeePaymentMode.RTGS);
    });
  });

  describe('getFeeInvoices', () => {
    it('should query payments and map into structured enterprise invoices', async () => {
      const mockPayments = [
        {
          id: 'pay-1',
          schoolId: mockSchoolId,
          receiptNumber: 'RCP-2026-0001',
          studentId: 'student-1',
          amountPaid: 15000,
          paymentDate: new Date('2026-04-10'),
          paymentMode: 'ONLINE_UPI',
          transactionReference: 'TXN123456',
          status: 'SUCCESS',
          remarks: 'Term 1 tuition fee',
          student: {
            id: 'student-1',
            admissionNumber: 'ADM-2024-001',
            firstName: 'Aarav',
            lastName: 'Sharma',
            guardianName: 'Vikram Sharma',
            guardianPhone: '9876543210',
            guardianEmail: 'vikram.sharma@example.com',
            class: { name: 'Class 10-A' },
            feeStructures: [
              {
                academicYearId: 'ay-2026',
                feeStructure: {
                  totalAmount: 15000,
                  academicYear: { name: '2026-2027' },
                  components: [
                    { name: 'Tuition Fee', amount: 10000 },
                    { name: 'Computer Lab Fee', amount: 3000 },
                    { name: 'Library & Activities', amount: 2000 },
                  ],
                },
              },
            ],
          },
        },
      ];

      prisma.feePayment.findMany.mockResolvedValue(mockPayments);
      prisma.feePayment.count.mockResolvedValue(1);

      const res = await service.getFeeInvoices(mockSchoolId, {
        page: 1,
        limit: 10,
      });

      expect(res).toBeDefined();
      expect(Array.isArray(res)).toBe(true);
      expect(res).toHaveLength(1);
      expect(res[0].invoiceNumber).toBeDefined();
      expect(res[0].paidAmount).toBe(15000);
      expect(res[0].student).toBeDefined();
      expect(res[0].breakdown).toBeDefined();
      expect(res[0].school).toBeDefined();
    });
  });
});
