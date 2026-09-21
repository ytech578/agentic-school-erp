import { FeesService } from './fees.service';
import * as crypto from 'crypto';

describe('FeesService - Razorpay Integration (Part 2)', () => {
  let service: FeesService;
  let mockPrisma: any;
  let mockConfigService: any;

  beforeEach(() => {
    mockPrisma = {
      $transaction: jest.fn(async (cb: any) => {
        return cb(mockTx);
      }),
      student: {
        findFirst: jest.fn(),
      },
      academicYear: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: 'ay-2026', name: '2026-27' }),
      },
      systemConfig: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({}),
      },
      school: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ name: 'Greenfield Public School' }),
      },
    };

    mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'RAZORPAY_KEY_ID') return 'rzp_test_sampleKey123';
        if (key === 'RAZORPAY_KEY_SECRET') return 'secret_key_abc123';
        if (key === 'RAZORPAY_WEBHOOK_SECRET') return 'webhook_secret_xyz';
        return null;
      }),
    };

    service = new FeesService(mockPrisma, mockConfigService);
  });

  const mockTx = {
    feePayment: {
      create: jest.fn().mockResolvedValue({
        id: 'payment-online-1',
        totalAmount: 5000,
        paidAmount: 5000,
      }),
    },
    receipt: {
      count: jest.fn().mockResolvedValue(0),
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({
        id: 'rcpt-1',
        receiptNumber: 'RCT-2026-0001',
      }),
    },
    systemConfig: {
      findUnique: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockResolvedValue({}),
    },
  };

  it('creates a Razorpay payment order with student and amount details', async () => {
    mockPrisma.student.findFirst.mockResolvedValue({
      id: 'student-1',
      admissionNumber: 'ADM-2026-0001',
      user: {
        firstName: 'Rohan',
        lastName: 'Kumar',
        email: 'rohan@example.com',
      },
    });

    const order = await service.createRazorpayOrder(
      'school-1',
      'student-1',
      4500,
    );

    expect(order.amount).toBe(4500);
    expect(order.amountInPaise).toBe(450000);
    expect(order.currency).toBe('INR');
    expect(order.keyId).toBe('rzp_test_sampleKey123');
    expect(order.orderId).toBeDefined();
    expect(order.student.name).toBe('Rohan Kumar');
  });

  it('verifies valid cryptographic HMAC signature and collects fee with sequential receipt', async () => {
    mockPrisma.student.findFirst.mockResolvedValue({
      id: 'student-1',
      user: { firstName: 'Rohan', lastName: 'Kumar' },
    });

    const orderId = 'order_ABC123';
    const paymentId = 'pay_XYZ789';
    const validSignature = crypto
      .createHmac('sha256', 'secret_key_abc123')
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    const result = await service.verifyRazorpayPayment(
      'school-1',
      'parent-user-1',
      {
        orderId,
        paymentId,
        signature: validSignature,
        studentId: 'student-1',
        amount: 5000,
      },
    );

    expect(result.receipt.receiptNumber).toBe('RCT-2026-0001');
    expect(mockTx.feePayment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          paidAmount: 5000,
          paymentMode: 'ONLINE_UPI',
          transactionRef: paymentId,
        }),
      }),
    );
  });

  it('rejects invalid Razorpay signature verification with BadRequestException', async () => {
    mockPrisma.student.findFirst.mockResolvedValue({
      id: 'student-1',
      user: { firstName: 'Rohan', lastName: 'Kumar' },
    });

    await expect(
      service.verifyRazorpayPayment('school-1', 'parent-user-1', {
        orderId: 'order_FAKE',
        paymentId: 'pay_FORGED',
        signature: 'invalid_tampered_signature',
        studentId: 'student-1',
        amount: 5000,
      }),
    ).rejects.toThrow('Invalid Razorpay signature verification failed');
  });

  it('generates dynamic UPI QR and parameters on order creation', async () => {
    mockPrisma.student.findFirst.mockResolvedValue({
      id: 'student-1',
      admissionNumber: 'ADM-2026-0001',
      user: {
        firstName: 'Rohan',
        lastName: 'Kumar',
        email: 'rohan@example.com',
      },
    });
    mockPrisma.school = {
      findUnique: jest
        .fn()
        .mockResolvedValue({ name: 'Greenfield Public School' }),
    };

    const order = await service.createRazorpayOrder(
      'school-1',
      'student-1',
      12500,
    );
    expect(order.upiUri).toContain('upi://pay');
    expect(order.upiUri).toContain('pa=schoolfees%40razorpay');
    expect(order.qrCodeUrl).toContain('api.qrserver.com');
    expect(order.schoolName).toBe('Greenfield Public School');
  });

  it('updates and retrieves school custom payment settings with uploaded QR and VPA', async () => {
    mockPrisma.systemConfig = {
      findUnique: jest.fn().mockResolvedValue({
        value: {
          upiVpa: 'principal.greenfield@icici',
          payeeName: 'Greenfield Public School Account',
          qrCodeImageUrl: 'data:image/png;base64,mockqrimage',
          accountNumber: '123456789012',
          ifscCode: 'ICIC0001234',
          bankName: 'ICICI Bank',
        },
      }),
      upsert: jest.fn().mockResolvedValue({}),
    };

    const updateRes = await service.updatePaymentSettings(
      'school-1',
      'admin-1',
      {
        upiVpa: 'principal.greenfield@icici',
        payeeName: 'Greenfield Public School Account',
        qrCodeImageUrl: 'data:image/png;base64,mockqrimage',
        accountNumber: '123456789012',
        ifscCode: 'ICIC0001234',
        bankName: 'ICICI Bank',
      },
    );

    expect(updateRes.success).toBe(true);
    expect(updateRes.data.upiVpa).toBe('principal.greenfield@icici');

    const settings = await service.getPaymentSettings(
      'school-1',
      'SUPER_ADMIN',
    );
    expect(settings.upiVpa).toBe('principal.greenfield@icici');
    expect(settings.qrCodeImageUrl).toBe('data:image/png;base64,mockqrimage');
    expect(settings.bankName).toBe('ICICI Bank');
  });

  it('processes parent payment with authentic UTR reference and sequential receipt', async () => {
    mockPrisma.guardian = {
      findFirst: jest
        .fn()
        .mockResolvedValue({ id: 'g-1', studentId: 'student-1' }),
    };
    mockPrisma.academicYear.findFirst.mockResolvedValue({ id: 'ay-2026' });
    mockPrisma.feePayment = {
      create: jest
        .fn()
        .mockResolvedValue({ id: 'pay-parent-1', paidAmount: 8500 }),
    };
    mockPrisma.receipt = {
      count: jest.fn().mockResolvedValue(0),
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest
        .fn()
        .mockResolvedValue({ id: 'rcpt-1', receiptNumber: 'RCT-2026-0042' }),
    };

    const res = await service.processParentPayment(
      'school-1',
      'parent-user-1',
      {
        studentId: 'student-1',
        amount: 8500,
        paymentMode: 'ONLINE_UPI',
        transactionRef: 'UPI-UTR-987654321012',
      },
    );

    expect(res.success).toBe(true);
    expect(res.receiptNumber).toBe('RCT-2026-0042');
    expect(mockPrisma.feePayment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          paidAmount: 8500,
          paymentMode: 'ONLINE_UPI',
          remarks: expect.stringContaining('UPI-UTR-987654321012'),
        }),
      }),
    );
  });
});
