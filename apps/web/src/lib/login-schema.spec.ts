import { LoginSchema } from '@school-erp/shared/src/schemas/auth.schema';

describe('Login MFA validation', () => {
  it('accepts first-stage credentials when no MFA code has been requested yet', () => {
    const result = LoginSchema.safeParse({
      email: 'admin@sunriseschool.edu.in',
      password: 'valid-password',
      rememberMe: false,
    });

    expect(result.success).toBe(true);
  });

  it('validates an MFA code when the field is present', () => {
    expect(
      LoginSchema.safeParse({
        email: 'admin@sunriseschool.edu.in',
        password: 'valid-password',
        otp: '123',
      }).success,
    ).toBe(false);

    expect(
      LoginSchema.safeParse({
        email: 'admin@sunriseschool.edu.in',
        password: 'valid-password',
        otp: '123456',
      }).success,
    ).toBe(true);
  });
});
