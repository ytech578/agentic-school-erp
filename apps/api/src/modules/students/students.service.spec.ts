import { StudentsService } from './students.service';

describe('StudentsService - calculateRiskScores (Part 1 Issue 2)', () => {
  let service: StudentsService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      academicYear: {
        findFirst: jest.fn(),
      },
      student: {
        findMany: jest.fn(),
        update: jest.fn(),
      },
      feeStructure: {
        findMany: jest.fn(),
      },
    };

    service = new StudentsService(mockPrisma);
  });

  it('calculates HIGH risk when attendance is below 75% and fees are severely defaulted', async () => {
    const schoolId = 'school-abc';
    const activeYear = { id: 'ay-2026' };
    mockPrisma.academicYear.findFirst.mockResolvedValue(activeYear);

    // Fee structure for Class 10 is 20,000
    mockPrisma.feeStructure.findMany.mockResolvedValue([
      {
        classId: 'class-10',
        items: [{ amount: 20000 }],
      },
    ]);

    // Student has 50% attendance (5 present out of 10 days) and paid 0 fees
    mockPrisma.student.findMany.mockResolvedValue([
      {
        id: 'student-1',
        attendance: [
          { status: 'PRESENT' },
          { status: 'PRESENT' },
          { status: 'PRESENT' },
          { status: 'PRESENT' },
          { status: 'PRESENT' },
          { status: 'ABSENT' },
          { status: 'ABSENT' },
          { status: 'ABSENT' },
          { status: 'ABSENT' },
          { status: 'ABSENT' },
        ],
        enrollments: [{ section: { classId: 'class-10' } }],
        feePayments: [],
      },
    ]);

    mockPrisma.student.update.mockResolvedValue({});

    const result = await service.calculateRiskScores(schoolId);

    expect(result.updatedCount).toBe(1);
    // Attendance risk (<75%): +30
    // Fee default risk (20,000 unpaid, >50% & >=10k): +25
    // Total score = 55 -> HIGH
    expect(mockPrisma.student.update).toHaveBeenCalledWith({
      where: { id: 'student-1' },
      data: { riskScore: 55, riskLevel: 'HIGH' },
    });
  });

  it('calculates NONE risk for student with full attendance and fully paid fees', async () => {
    const schoolId = 'school-abc';
    const activeYear = { id: 'ay-2026' };
    mockPrisma.academicYear.findFirst.mockResolvedValue(activeYear);

    mockPrisma.feeStructure.findMany.mockResolvedValue([
      {
        classId: 'class-10',
        items: [{ amount: 15000 }],
      },
    ]);

    // 100% attendance, fee fully paid
    mockPrisma.student.findMany.mockResolvedValue([
      {
        id: 'student-good',
        attendance: [
          { status: 'PRESENT' },
          { status: 'PRESENT' },
          { status: 'PRESENT' },
        ],
        enrollments: [{ section: { classId: 'class-10' } }],
        feePayments: [{ paymentStatus: 'PAID', paidAmount: 15000 }],
      },
    ]);

    mockPrisma.student.update.mockResolvedValue({});

    const result = await service.calculateRiskScores(schoolId);

    expect(result.updatedCount).toBe(1);
    // Attendance = 100% -> 0
    // Pending fees = 0 -> 0
    // Total = 0 -> NONE
    expect(mockPrisma.student.update).toHaveBeenCalledWith({
      where: { id: 'student-good' },
      data: { riskScore: 0, riskLevel: 'NONE' },
    });
  });
});
