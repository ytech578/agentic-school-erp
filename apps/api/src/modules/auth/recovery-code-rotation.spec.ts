import { AuthService } from './auth.service';
import { hashMfaRecoveryCode } from './utils/recovery-code.util';

describe('AuthService recovery-code rotation compatibility', () => {
  const current = 'a'.repeat(64);
  const previous = 'b'.repeat(64);
  const code = 'ABCDE12345FF';

  function setup(stored: string[], changed = 1) {
    const updateMany = jest.fn().mockResolvedValue({ count: changed });
    const configValues: Record<string, string> = {
      'app.nodeEnv': 'production',
      MFA_RECOVERY_CODE_PEPPER: current,
      MFA_RECOVERY_CODE_PEPPER_PREV: previous,
    };
    const config = { get: (name: string) => configValues[name] };
    const service = new AuthService(
      { user: { updateMany } } as never,
      {} as never,
      {} as never,
      config as never,
      {} as never,
      {} as never,
    );
    const user = {
      id: 'synthetic-user',
      twoFactorSecret: null,
      mfaRecoveryCodes: stored,
    };
    const verify = (token?: string) =>
      service['verifyMfaChallenge'](user, token);
    return { service, user, verify, updateMany, configValues };
  }

  it.each([current, previous])(
    'accepts a configured pepper and consumes its exact stored hash',
    async (pepper) => {
      const hash = hashMfaRecoveryCode(code, pepper);
      const other = hashMfaRecoveryCode('OTHER-CODE', current);
      const { verify, updateMany } = setup([hash, other]);
      expect(await verify(code.toLowerCase())).toBe(true);
      expect(updateMany).toHaveBeenCalledWith({
        where: {
          id: 'synthetic-user',
          mfaRecoveryCodes: { equals: [hash, other] },
        },
        data: { mfaRecoveryCodes: [other] },
      });
    },
  );

  it('removes both representations to prevent replay across a key transition', async () => {
    const stored = [
      hashMfaRecoveryCode(code, current),
      hashMfaRecoveryCode(code, previous),
    ];
    const { verify, updateMany } = setup(stored);
    expect(await verify(code)).toBe(true);
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: 'synthetic-user',
        mfaRecoveryCodes: { equals: stored },
      },
      data: { mfaRecoveryCodes: [] },
    });
  });

  it('denies a race loser even when it supplied the correct legacy code', async () => {
    const { verify } = setup([hashMfaRecoveryCode(code, previous)], 0);
    await expect(verify(code)).rejects.toThrow('already used');
  });

  it('does not issue old-pepper hashes', () => {
    const { service } = setup([]);
    expect(service['hashRecoveryCode'](code)).toBe(
      hashMfaRecoveryCode(code, current),
    );
  });

  it('denies unknown and missing codes without a database write', async () => {
    const { verify, updateMany } = setup([hashMfaRecoveryCode(code, previous)]);
    await expect(verify('WRONG')).rejects.toThrow('Invalid MFA');
    await expect(verify()).rejects.toThrow('Multi-factor');
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('fails closed in production even when only a previous pepper is configured', async () => {
    const { verify, configValues, updateMany } = setup([
      hashMfaRecoveryCode(code, previous),
    ]);
    delete configValues.MFA_RECOVERY_CODE_PEPPER;
    await expect(verify(code)).rejects.toThrow('required in production');
    expect(updateMany).not.toHaveBeenCalled();
  });
});
