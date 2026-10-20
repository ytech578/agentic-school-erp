import { ScimService } from './scim.service';

describe('SCIM provisioning security', () => {
  const before = {
    id: 'u1',
    schoolId: 's1',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    scimExternalId: null,
    role: 'TEACHER' as const,
    status: 'ACTIVE',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  function setup() {
    const tx = {
      user: {
        findFirst: jest.fn().mockResolvedValue(before),
        update: jest
          .fn()
          .mockImplementation(({ data }) =>
            Promise.resolve({ ...before, ...data }),
          ),
      },
      userSession: { updateMany: jest.fn() },
    };
    const db = {
      ...tx,
      $transaction: jest.fn((fn: (value: typeof tx) => unknown) => fn(tx)),
    };
    const audit = { recordMutation: jest.fn() };
    const service = new ScimService(db as never, {} as never, audit as never);
    return { service, tx, audit };
  }

  it('handles the pathless activation format and revokes sessions atomically', async () => {
    const { service, tx, audit } = setup();
    const result = await service.patchUser('s1', 'admin', 'u1', {
      Operations: [{ op: 'Replace', value: { active: false } }],
    });
    expect(result.active).toBe(false);
    expect(tx.user.findFirst).toHaveBeenCalledWith({
      where: { id: 'u1', schoolId: 's1' },
    });
    expect(tx.userSession.updateMany).toHaveBeenCalled();
    expect(audit.recordMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        before: expect.anything() as unknown,
        after: expect.anything() as unknown,
      }),
      tx,
    );
  });

  it('rejects unsupported patch operations rather than silently succeeding', async () => {
    const { service, tx } = setup();
    await expect(
      service.patchUser('s1', 'admin', 'u1', {
        Operations: [{ op: 'replace', path: 'unknown', value: true }],
      }),
    ).rejects.toThrow('Unsupported');
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it('supports full user replacement without accepting role escalation to SUPER_ADMIN', async () => {
    const { service, tx } = setup();
    await service.replaceUser('s1', 'admin', 'u1', {
      userName: 'new@example.com',
      name: { givenName: 'New', familyName: 'User' },
      roles: ['SUPER_ADMIN'],
    });
    expect(tx.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          role: 'TEACHER',
          email: 'new@example.com',
        }) as unknown,
      }),
    );
  });
});
