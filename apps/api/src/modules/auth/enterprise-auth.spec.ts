import { AuthService } from './auth.service';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

describe('Enterprise authentication policy', () => {
  it('blocks password login for an SSO-enforced tenant', async () => {
    const hash = await bcrypt.hash('test-password', 4);
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'u1',
          schoolId: 's1',
          role: 'TEACHER',
          status: 'ACTIVE',
          passwordHash: hash,
        }),
      },
      identityProvider: {
        findFirst: jest.fn().mockResolvedValue({ id: 'idp1' }),
      },
    };
    const jwt = { signAsync: jest.fn() };
    const service = new AuthService(
      prisma as never,
      {} as never,
      jwt as never,
      {} as never,
      {} as never,
      {} as never,
    );
    await expect(
      service.login(
        {
          email: 'test@example.com',
          password: 'test-password',
          rememberMe: false,
        },
        '127.0.0.1',
        'test',
      ),
    ).rejects.toThrow('Use enterprise SSO');
    expect(jwt.signAsync).not.toHaveBeenCalled();
  });
  it('does not create a federated session for an MFA-enrolled account without proof', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'u1',
          status: 'ACTIVE',
          twoFactorEnabled: true,
        }),
      },
    };
    const jwt = { signAsync: jest.fn() };
    const service = new AuthService(
      prisma as never,
      {} as never,
      jwt as never,
      {} as never,
      {} as never,
      {} as never,
    );
    await expect(
      service.issueFederatedSession('u1', 'SAML', '127.0.0.1', 'test'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(jwt.signAsync).not.toHaveBeenCalled();
  });
});
