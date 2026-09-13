import { generateNextSequence } from './sequence.util';

describe('SequenceUtil (FIX-02)', () => {
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      $transaction: jest.fn(async (cb: any) => {
        return cb(mockTx);
      }),
    };
  });

  const mockTx = {
    systemConfig: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    admissionApplication: {
      count: jest.fn(),
      findFirst: jest.fn(),
    },
    student: {
      count: jest.fn(),
      findFirst: jest.fn(),
    },
    receipt: {
      count: jest.fn(),
      findFirst: jest.fn(),
    },
  };

  it('generates next sequential application number and records current state in systemConfig', async () => {
    mockTx.systemConfig.findUnique.mockResolvedValue(null);
    mockTx.admissionApplication.count.mockResolvedValue(4);
    mockTx.admissionApplication.findFirst.mockResolvedValue(null);
    mockTx.systemConfig.upsert.mockResolvedValue({});

    const result = await generateNextSequence(mockPrisma, 'school-1', 'APP', 2026);

    expect(result).toBe('APP-2026-0005');
    expect(mockTx.systemConfig.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { schoolId_key: { schoolId: 'school-1', key: 'seq_app_2026' } },
        update: { value: { current: 5 } },
      }),
    );
  });

  it('generates next sequential fee receipt number (RCT prefix)', async () => {
    mockTx.systemConfig.findUnique.mockResolvedValue(null);
    mockTx.receipt.count.mockResolvedValue(18);
    mockTx.receipt.findFirst.mockResolvedValue(null);
    mockTx.systemConfig.upsert.mockResolvedValue({});

    const result = await generateNextSequence(mockPrisma, 'school-1', 'RCT', 2026);

    expect(result).toBe('RCT-2026-0019');
    expect(mockTx.systemConfig.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { schoolId_key: { schoolId: 'school-1', key: 'seq_rct_2026' } },
        update: { value: { current: 19 } },
      }),
    );
  });

  it('increments existing sequence state monotonically', async () => {
    mockTx.systemConfig.findUnique.mockResolvedValue({
      value: { current: 42 },
    });
    mockTx.admissionApplication.findFirst.mockResolvedValue(null);
    mockTx.systemConfig.upsert.mockResolvedValue({});

    const result = await generateNextSequence(mockPrisma, 'school-1', 'APP', 2026);

    expect(result).toBe('APP-2026-0043');
  });

  it('skips numbers if a historical record exists with the candidate identifier', async () => {
    mockTx.systemConfig.findUnique.mockResolvedValue({
      value: { current: 10 },
    });
    // Candidate APP-2026-0011 exists, candidate APP-2026-0012 does not exist
    mockTx.admissionApplication.findFirst
      .mockResolvedValueOnce({ id: 'existing-app' })
      .mockResolvedValueOnce(null);

    const result = await generateNextSequence(mockPrisma, 'school-1', 'APP', 2026);

    expect(result).toBe('APP-2026-0012');
  });
});
