import { IdentityProviderService } from './identity-provider.service';
import { IdentityProviderPatchSchema } from './identity.schemas';

describe('Identity provider partial updates', () => {
  const before = {
    id: 'provider',
    schoolId: 'school',
    name: 'Corporate identity',
    slug: 'corporate',
    type: 'OIDC',
    issuer: 'https://identity.example.org' as string | null,
    clientId: 'client' as string | null,
    clientSecretEncrypted: 'private',
    enabled: true,
    allowedDomains: ['example.org'],
    defaultRole: 'TEACHER',
    jitProvisioning: true,
    enforceSso: true,
    samlEntityId: null as string | null,
    samlSsoUrl: null as string | null,
    samlCertificate: null as string | null,
  };
  function setup(provider = before) {
    const tx = {
      identityProvider: {
        findFirst: jest.fn().mockResolvedValue(provider),
        update: jest.fn(({ data }) =>
          Promise.resolve({ ...provider, ...data }),
        ),
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

  it('updates a stored SAML provider with null unused OIDC fields', async () => {
    const { service, tx } = setup({
      ...before,
      type: 'SAML',
      issuer: null,
      clientId: null,
      samlEntityId: 'urn:school:saml',
      samlSsoUrl: 'https://identity.example.org/saml',
      samlCertificate: 'public-certificate',
    });
    await expect(
      service.update('school', 'provider', 'admin', { enabled: false }),
    ).resolves.toMatchObject({ type: 'SAML', enabled: false });
    expect(tx.identityProvider.update).toHaveBeenCalledTimes(1);
  });

  it('does not treat explicit null patch input as an omitted stored field', async () => {
    const { service, tx, audit } = setup();
    await expect(
      service.update('school', 'provider', 'admin', { issuer: null }),
    ).rejects.toThrow();
    expect(tx.identityProvider.update).not.toHaveBeenCalled();
    expect(audit.recordMutation).not.toHaveBeenCalled();
  });

  it('enables an existing pilot without JIT, password enforcement or credential replacement', async () => {
    const { service, tx, audit } = setup({
      ...before,
      enabled: false,
      jitProvisioning: false,
      enforceSso: false,
    });
    const result = await service.update('school', 'provider', 'admin', {
      enabled: true,
    });
    expect(tx.identityProvider.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          enabled: true,
          jitProvisioning: false,
          enforceSso: false,
          clientSecretEncrypted: undefined,
        }) as unknown,
      }),
    );
    expect(result).not.toHaveProperty('clientSecretEncrypted');
    expect(audit.recordMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        before: expect.objectContaining({ enabled: false }) as unknown,
        after: expect.objectContaining({
          enabled: true,
          jitProvisioning: false,
          enforceSso: false,
        }) as unknown,
      }),
      tx,
    );
  });
});
