import { Test, TestingModule } from '@nestjs/testing';
import { FeesService } from './fees.service';
import { PrismaService } from '../../core/database/prisma.service';
import { ConfigService } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';

describe('FeesService - Formal Receipt Details', () => {
  let service: FeesService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      feePayment: {
        findFirst: jest.fn(),
      },
      school: {
        findUnique: jest.fn(),
      },
      academicYear: {
        findUnique: jest.fn(),
      },
      feeHead: {
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeesService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();

    service = module.get<FeesService>(FeesService);
  });

  it('fetches complete receipt details with student and school letterhead info', async () => {
    prisma.feePayment.findFirst.mockResolvedValue({
      id: 'pay-999',
      academicYearId: 'ay-1',
      paidAmount: 15000,
      paymentMode: 'ONLINE_UPI',
      transactionRef: 'pay_rzp_test_123',
      paymentDate: new Date('2026-08-10'),
      remarks: 'Term 1 Tuition Fee',
      receipt: {
        id: 'rcpt-123',
        receiptNumber: 'RCT-2026-0042',
        issuedAt: new Date('2026-08-10'),
      },
      items: [
        { id: 'item-1', feeHeadId: 'fh-1', amount: 15000, period: 'TERM_1' },
      ],
      student: {
        id: 'std-1',
        admissionNumber: '2026001',
        rollNumber: '10',
        user: {
          firstName: 'Aarav',
          lastName: 'Sharma',
          email: 'aarav@student.com',
        },
        enrollments: [
          {
            section: {
              name: 'A',
              class: { name: 'Class 10' },
            },
          },
        ],
        guardians: [
          { firstName: 'Rajesh', lastName: 'Sharma', phone: '+91 9876543210' },
        ],
      },
    });

    prisma.school.findUnique.mockResolvedValue({
      id: 'school-1',
      name: 'Sunrise International School',
      affiliationNo: 'CBSE-2026-DEL-09',
      phone: '+91 11 23456789',
      email: 'admin@sunriseschool.edu.in',
    });

    prisma.academicYear.findUnique.mockResolvedValue({
      id: 'ay-1',
      name: '2026-27',
    });

    prisma.feeHead.findMany.mockResolvedValue([
      { id: 'fh-1', name: 'Tuition Fee' },
    ]);

    const res = await service.getReceiptDetails('school-1', 'RCT-2026-0042');

    expect(res.receiptNumber).toBe('RCT-2026-0042');
    expect(res.payment.amount).toBe(15000);
    expect(res.student.name).toBe('Aarav Sharma');
    expect(res.student.class).toBe('Class 10 - A');
    expect(res.student.parentName).toBe('Rajesh Sharma');
    expect(res.school?.name).toBe('Sunrise International School');
    expect(res.breakdown[0].head).toBe('Tuition Fee');
  });

  it('throws NotFoundException if receipt does not exist', async () => {
    prisma.feePayment.findFirst.mockResolvedValue(null);

    await expect(
      service.getReceiptDetails('school-1', 'invalid-rcpt'),
    ).rejects.toThrow(NotFoundException);
  });
});
