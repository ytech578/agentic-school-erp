import { IdentityProviderService } from './identity-provider.service';
import { IdentityProviderPatchSchema } from './identity.schemas';

describe('Identity provider partial updates', () => {
  const before = {
    id: 'provider',
    schoolId: 'school',
    name: 'Corporate identity',
    slug: 'corporate',
    type: 'OIDC',
    issuer: 'https://identity.example.org',
    clientId: 'client',
    clientSecretEncrypted: 'private',
    enabled: true,
    allowedDomains: ['example.org'],
    defaultRole: 'TEACHER',
    jitProvisioning: true,
    enforceSso: true,
  };
  function setup() {
    const tx = {
      identityProvider: {
        findFirst: jest.fn().mockResolvedValue(before),
        update: jest.fn(({ data }) => Promise.resolve({ ...before, ...data })),
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
      service: new IdentityProviderService(db as never, audit as never),
      tx,
      audit,
    };
  }

  it('does not inject create defaults into a partial update', () => {
    expect(
      IdentityProviderPatchSchema.parse({ name: 'Renamed identity' }),
    ).toEqual({ name: 'Renamed identity' });
  });

  it('preserves SSO enforcement and encrypted credentials when renaming', async () => {
    const { service, tx, audit } = setup();
    const result = await service.update('school', 'provider', 'admin', {
      name: 'Renamed identity',
    });
    expect(tx.identityProvider.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          enabled: true,
          enforceSso: true,
          jitProvisioning: true,
          clientSecretEncrypted: undefined,
        }) as unknown,
      }),
    );
    expect(result).not.toHaveProperty('clientSecretEncrypted');
    expect(audit.recordMutation).toHaveBeenCalled();
  });

  it('validates the merged provider configuration before changing protocol', async () => {
    const { service, tx } = setup();
    await expect(
      service.update('school', 'provider', 'admin', { type: 'SAML' }),
    ).rejects.toThrow();
    expect(tx.identityProvider.update).not.toHaveBeenCalled();
  });
});
