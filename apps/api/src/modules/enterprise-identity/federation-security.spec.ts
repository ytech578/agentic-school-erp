import { UnauthorizedException } from '@nestjs/common';
import { FederationService, providerVerifiedMfa } from './federation.service';

describe('Federation MFA and exchange replay protection', () => {
  it('does not infer MFA from federation or password alone', () => {
    expect(providerVerifiedMfa(undefined)).toBe(false);
    expect(providerVerifiedMfa(['pwd'])).toBe(false);
    expect(providerVerifiedMfa(['otp'])).toBe(false);
    expect(providerVerifiedMfa(['mfa'])).toBe(true);
    expect(providerVerifiedMfa(['pwd', 'otp'])).toBe(true);
  });

  function setup(verify = jest.fn().mockResolvedValue(false)) {
    let state: string | null = JSON.stringify({
      userId: 'u1',
      method: 'OIDC',
      ipAddress: '127.0.0.1',
      userAgent: 'test',
      providerMfa: false,
    });
    const redis = {
      get: jest.fn(() => Promise.resolve(state)),
      getAndDelete: jest.fn(() => {
        const result = state;
        state = null;
        return Promise.resolve(result);
      }),
    };
    const auth = {
      verifyFederatedMfa: verify,
      issueFederatedSession: jest
        .fn()
        .mockResolvedValue({ accessToken: 'test' }),
    };
    const service = new FederationService(
      {} as never,
      redis as never,
      {} as never,
      auth as never,
      {} as never,
    );
    return { service, auth, redis };
  }

  it('keeps a challenge available when local MFA is required', async () => {
    const { service, auth, redis } = setup(
      jest
        .fn()
        .mockRejectedValue(new UnauthorizedException({ code: 'MFA_REQUIRED' })),
    );
    await expect(service.exchange('A'.repeat(43))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(redis.getAndDelete).not.toHaveBeenCalled();
    expect(auth.issueFederatedSession).not.toHaveBeenCalled();
  });

  it('consumes an exchange once and preserves the actual MFA result', async () => {
    const { service, auth } = setup();
    await service.exchange('A'.repeat(43));
    expect(auth.issueFederatedSession).toHaveBeenCalledWith(
      'u1',
      'OIDC',
      '127.0.0.1',
      'test',
      false,
    );
    await expect(service.exchange('A'.repeat(43))).rejects.toThrow(
      'invalid or expired',
    );
    expect(auth.issueFederatedSession).toHaveBeenCalledTimes(1);
  });
});
