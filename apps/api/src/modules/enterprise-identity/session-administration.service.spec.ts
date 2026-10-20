import { SessionAdministrationService } from './session-administration.service';

describe('Privileged session administration', () => {
  function setup() {
    const tx = {
      user: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: 'target', role: 'TEACHER' }),
      },
      userSession: {
        findFirst: jest.fn().mockResolvedValue({ id: 'actor-session' }),
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: 'target-session', status: 'ACTIVE' }]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const db = {
      ...tx,
      $transaction: jest.fn((work: (transaction: typeof tx) => unknown) =>
        work(tx),
      ),
    };
    const audit = { recordMutation: jest.fn() };
    return {
      service: new SessionAdministrationService(db as never, audit as never),
      tx,
      audit,
    };
  }

  it('requires recent MFA before revoking another user sessions', async () => {
    const { service, tx } = setup();
    tx.userSession.findFirst.mockResolvedValue(null);
    await expect(
      service.revoke(
        'school',
        'target',
        'actor',
        'actor-session',
        'Investigating a lost device',
      ),
    ).rejects.toThrow('MFA');
    expect(tx.userSession.updateMany).not.toHaveBeenCalled();
  });

  it('rejects a target outside the actor school', async () => {
    const { service, tx } = setup();
    tx.user.findFirst.mockResolvedValue(null);
    await expect(service.list('school', 'outside-user')).rejects.toThrow(
      'not found',
    );
    expect(tx.userSession.findMany).not.toHaveBeenCalled();
  });

  it('blocks school-level administration of platform administrator sessions', async () => {
    const { service, tx } = setup();
    tx.user.findFirst.mockResolvedValue({ id: 'target', role: 'SUPER_ADMIN' });
    await expect(service.list('school', 'target')).rejects.toThrow(
      'Platform administrator',
    );
  });

  it('records before and after revocation in the mutation transaction', async () => {
    const { service, tx, audit } = setup();
    expect(
      await service.revoke(
        'school',
        'target',
        'actor',
        'actor-session',
        'Investigating a lost device',
      ),
    ).toEqual({ count: 1 });
    expect(audit.recordMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        before: [{ id: 'target-session', status: 'ACTIVE' }],
        after: { revokedSessionIds: ['target-session'] },
      }),
      tx,
    );
  });
});
