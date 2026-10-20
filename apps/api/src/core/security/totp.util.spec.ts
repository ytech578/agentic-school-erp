import { generateTotpSecret, generateTotpUri, verifyTotp } from './totp.util';

describe('TOTP utilities', () => {
  it('verifies the RFC 6238 SHA-1 vector reduced to six digits', () => {
    const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
    expect(verifyTotp(secret, '287082', 59_000, 0)).toBe(true);
    expect(verifyTotp(secret, '287083', 59_000, 0)).toBe(false);
  });

  it('generates an authenticator-compatible secret and URI', () => {
    const secret = generateTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    const uri = generateTotpUri({
      issuer: 'Agentic School ERP',
      label: 'admin@example.com',
      secret,
    });
    expect(uri).toContain('otpauth://totp/');
    expect(uri).toContain(`secret=${secret}`);
    expect(uri).toContain('digits=6');
  });
});
