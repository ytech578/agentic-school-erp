import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BreakGlassService } from './break-glass.service';

describe('Break-glass dual control and lifecycle', () => {
  const grant = {
    id: 'grant-1',
    schoolId: 'school-1',
    requesterId: 'requester-1',
    status: 'PENDING',
    reason: 'Recover access during an identity-provider outage',
  };

  function setup() {
    const tx = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([]),
      breakGlassGrant: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(grant),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest
          .fn()
          .mockResolvedValue({ ...grant, status: 'ACTIVE' }),
        update: jest.fn().mockResolvedValue({ ...grant, status: 'REVOKED' }),
      },
    };
    const db = {
      school: { findUnique: jest.fn().mockResolvedValue({ id: 'school-1' }) },
      breakGlassGrant: {
        findUnique: jest.fn().mockResolvedValue(grant),
        findMany: jest.fn().mockResolvedValue([]),
      },
      $transaction: jest.fn((work: (client: typeof tx) => unknown) => work(tx)),
      runAsSystem: jest.fn((work: () => unknown) => work()),
    };
    const audit = { recordMutation: jest.fn().mockResolvedValue(undefined) };
    return {
      service: new BreakGlassService(db as never, audit as never),
      db,
      tx,
      audit,
    };
  }

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-10-20T10:00:00Z'));
  });
  afterEach(() => jest.useRealTimers());

  it('lists a bounded grant history with school and approval identities', async () => {
    const { service, db } = setup();
    db.breakGlassGrant.findMany.mockResolvedValue([grant]);
    expect(await service.list()).toEqual([grant]);
    expect(db.breakGlassGrant.findMany).toHaveBeenCalledWith({
      orderBy: { requestedAt: 'desc' },
      include: {
        school: { select: { id: true, name: true, code: true } },
        requester: { select: { id: true, email: true } },
        approver: { select: { id: true, email: true } },
      },
      take: 200,
    });
  });

  it('refuses requests for a missing school before opening a transaction', async () => {
    const { service, db } = setup();
    db.school.findUnique.mockResolvedValue(null);
    await expect(
      service.request('requester-1', 'missing', grant.reason),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it('serializes duplicate requests and audits creation in the same transaction', async () => {
    const { service, tx, audit } = setup();
    expect(
      await service.request('requester-1', 'school-1', grant.reason),
    ).toEqual(grant);
    expect(tx.$queryRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('pg_advisory_xact_lock'),
      'break-glass:requester-1:school-1',
    );
    expect(tx.$queryRawUnsafe.mock.invocationCallOrder[0]).toBeLessThan(
      tx.breakGlassGrant.findFirst.mock.invocationCallOrder[0],
    );
    expect(tx.breakGlassGrant.findFirst).toHaveBeenCalledWith({
      where: {
        requesterId: 'requester-1',
        schoolId: 'school-1',
        status: { in: ['PENDING', 'ACTIVE'] },
      },
    });
    expect(tx.breakGlassGrant.create).toHaveBeenCalledWith({
      data: {
        requesterId: 'requester-1',
        schoolId: 'school-1',
        reason: grant.reason,
      },
    });
    expect(audit.recordMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        before: null,
        after: grant,
        schoolId: 'school-1',
      }),
      tx,
    );
  });

  it.each(['PENDING', 'ACTIVE'])(
    'rejects an existing %s grant without creating another',
    async (status) => {
      const { service, tx, audit } = setup();
      tx.breakGlassGrant.findFirst.mockResolvedValue({ ...grant, status });
      await expect(
        service.request('requester-1', 'school-1', grant.reason),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(tx.breakGlassGrant.create).not.toHaveBeenCalled();
      expect(audit.recordMutation).not.toHaveBeenCalled();
    },
  );

  it('rejects self approval before any mutation', async () => {
    const { service, db } = setup();
    await expect(
      service.approve(grant.id, grant.requesterId, 30),
    ).rejects.toThrow('different approver');
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it('rejects missing and already resolved approval requests', async () => {
    const { service, db } = setup();
    db.breakGlassGrant.findUnique.mockResolvedValueOnce(null);
    await expect(
      service.approve('missing', 'approver-1', 30),
    ).rejects.toBeInstanceOf(NotFoundException);
    db.breakGlassGrant.findUnique.mockResolvedValueOnce({
      ...grant,
      status: 'REVOKED',
    });
    await expect(service.approve(grant.id, 'approver-1', 30)).rejects.toThrow(
      'not pending',
    );
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it('approves with a separate actor, bounded expiry and transactional audit snapshots', async () => {
    const { service, tx, audit } = setup();
    const approved = { ...grant, status: 'ACTIVE', approverId: 'approver-1' };
    tx.breakGlassGrant.findUniqueOrThrow.mockResolvedValue(approved);
    expect(await service.approve(grant.id, 'approver-1', 30)).toEqual(approved);
    expect(tx.breakGlassGrant.updateMany).toHaveBeenCalledWith({
      where: { id: grant.id, status: 'PENDING' },
      data: {
        status: 'ACTIVE',
        approverId: 'approver-1',
        approvedAt: new Date('2026-10-20T10:00:00Z'),
        expiresAt: new Date('2026-10-20T10:30:00Z'),
      },
    });
    expect(audit.recordMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'approver-1',
        before: grant,
        after: approved,
      }),
      tx,
    );
  });

  it('denies approval if another transaction already consumed the pending request', async () => {
    const { service, tx, audit } = setup();
    tx.breakGlassGrant.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.approve(grant.id, 'approver-1', 30)).rejects.toThrow(
      'no longer pending',
    );
    expect(tx.breakGlassGrant.findUniqueOrThrow).not.toHaveBeenCalled();
    expect(audit.recordMutation).not.toHaveBeenCalled();
  });

  it('propagates an audit failure instead of reporting successful approval', async () => {
    const { service, audit } = setup();
    audit.recordMutation.mockRejectedValue(
      new Error('Audit storage unavailable'),
    );
    await expect(service.approve(grant.id, 'approver-1', 30)).rejects.toThrow(
      'Audit storage unavailable',
    );
  });

  it('revokes access with a reason and before/after audit in the mutation transaction', async () => {
    const { service, tx, audit } = setup();
    const reason = 'Emergency investigation completed';
    await service.revoke(grant.id, 'approver-1', reason);
    expect(tx.breakGlassGrant.update).toHaveBeenCalledWith({
      where: { id: grant.id },
      data: { status: 'REVOKED', revokedAt: new Date(), revokeReason: reason },
    });
    expect(audit.recordMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        before: grant,
        after: { ...grant, status: 'REVOKED' },
      }),
      tx,
    );
  });

  it('rejects revocation of an unknown grant', async () => {
    const { service, db } = setup();
    db.breakGlassGrant.findUnique.mockResolvedValue(null);
    await expect(
      service.revoke('missing', 'actor', 'Investigation completed'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it('expires elapsed grants through the system context and ignores concurrent revocation', async () => {
    const { service, db, tx, audit } = setup();
    const elapsed = { ...grant, status: 'ACTIVE' };
    db.breakGlassGrant.findMany.mockResolvedValue([
      elapsed,
      { ...elapsed, id: 'concurrently-revoked' },
    ]);
    tx.breakGlassGrant.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    const expired = { ...grant, status: 'EXPIRED' };
    tx.breakGlassGrant.findUniqueOrThrow.mockResolvedValue(expired);
    expect(await service.expireElapsedGrants()).toEqual({ count: 1 });
    expect(db.runAsSystem).toHaveBeenCalledTimes(1);
    expect(db.breakGlassGrant.findMany).toHaveBeenCalledWith({
      where: { status: 'ACTIVE', expiresAt: { lte: new Date() } },
      take: 200,
    });
    expect(tx.breakGlassGrant.updateMany).toHaveBeenCalledWith({
      where: { id: grant.id, status: 'ACTIVE', expiresAt: { lte: new Date() } },
      data: { status: 'EXPIRED' },
    });
    expect(audit.recordMutation).toHaveBeenCalledTimes(1);
    expect(audit.recordMutation).toHaveBeenCalledWith(
      expect.objectContaining({ before: elapsed, after: expired }),
      tx,
    );
  });

  it('does not mutate or audit when no grants have elapsed', async () => {
    const { service, db, audit } = setup();
    expect(await service.expireElapsedGrants()).toEqual({ count: 0 });
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(audit.recordMutation).not.toHaveBeenCalled();
  });
});
