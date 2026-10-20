import { AuditAction, Prisma } from '@prisma/client';
import { AuditService } from './audit.service';

describe('AuditService', () => {
  it('acquires the advisory lock without selecting PostgreSQL void', async () => {
    const queryRawUnsafe = jest.fn().mockResolvedValue([{ locked: 1 }]);
    const createAudit = jest.fn().mockResolvedValue({ id: 'audit-1' });
    const transaction = {
      $queryRawUnsafe: queryRawUnsafe,
      activityLog: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: createAudit,
      },
    } as unknown as Prisma.TransactionClient;
    const service = new AuditService({} as never);

    await service.recordMutation(
      {
        schoolId: 'school-1',
        userId: 'user-1',
        action: AuditAction.LOGIN,
        module: 'AUTH',
        description: 'Login session created',
      },
      transaction,
    );

    expect(queryRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining(
        'SELECT 1 AS "locked" FROM pg_advisory_xact_lock',
      ),
      'school-1',
    );
    expect(createAudit).toHaveBeenCalledTimes(1);
  });
});
