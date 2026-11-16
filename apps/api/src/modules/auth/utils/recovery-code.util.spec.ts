import { hashMfaRecoveryCode, recoveryCodePeppers } from './recovery-code.util';

describe('MFA recovery-code key transition', () => {
  const current = 'a'.repeat(64);
  const previous = 'b'.repeat(64);

  it('issues current-pepper hashes first and keeps previous-pepper verification', () => {
    const peppers = recoveryCodePeppers({
      current,
      previous,
      production: true,
    });
    expect(peppers).toEqual([current, previous]);
    expect(hashMfaRecoveryCode(' aBc123 ', current)).toBe(
      hashMfaRecoveryCode('ABC123', peppers[0]),
    );
    expect(hashMfaRecoveryCode('ABC123', current)).not.toBe(
      hashMfaRecoveryCode('ABC123', previous),
    );
  });

  it('does not duplicate identical peppers', () => {
    expect(
      recoveryCodePeppers({ current, previous: current, production: true }),
    ).toEqual([current]);
  });

  it('keeps the existing development fallback without allowing it in production', () => {
    expect(
      recoveryCodePeppers({ developmentFallback: previous, production: false }),
    ).toEqual([previous]);
    expect(() =>
      recoveryCodePeppers({
        developmentFallback: previous,
        previous,
        production: true,
      }),
    ).toThrow('required in production');
  });

  it('refuses missing and weak configuration', () => {
    expect(() => recoveryCodePeppers({ production: false })).toThrow(
      'not configured',
    );
    expect(() =>
      recoveryCodePeppers({ current: 'short', production: true }),
    ).toThrow('at least 32');
    expect(() =>
      recoveryCodePeppers({ current, previous: 'short', production: true }),
    ).toThrow('PREV');
  });
});
