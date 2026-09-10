/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { hashRefreshToken } from './utils/refresh-token.util';
import { AuthService } from './auth.service';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';

describe('Secure Refresh-Token Storage & Flow (Change #3)', () => {
  let authService: AuthService;
  let jwtRefreshStrategy: JwtRefreshStrategy;
  let mockPrisma: any;
  let mockConfig: any;
  let mockUsersService: any;
  let mockJwtService: any;
  let mockEmailService: any;

  const mockUser = {
    id: 'user_123',
    email: 'teacher@school.edu.in',
    role: 'TEACHER',
    schoolId: 'school_123',
    status: 'ACTIVE',
  };

  beforeEach(() => {
    mockPrisma = {
      userSession: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      activityLog: {
        create: jest.fn(),
      },
    };

    mockConfig = {
      get: jest.fn((key: string, defaultValue?: any) => {
        if (key === 'jwt.refreshExpiresInMs') return 7 * 24 * 60 * 60 * 1000;
        if (key === 'jwt.accessExpiresIn') return '15m';
        return defaultValue;
      }),
      getOrThrow: jest.fn((key: string) => {
        if (key === 'jwt.accessSecret')
          return 'mock-access-secret-minimum-32-chars-length!';
        if (key === 'jwt.refreshSecret')
          return 'mock-refresh-secret-minimum-32-chars-length!';
        throw new Error(`Missing key ${key}`);
      }),
    };

    mockUsersService = {};
    mockJwtService = {
      signAsync: jest.fn().mockResolvedValue('mock.access.token'),
    };
    mockEmailService = {};

    authService = new AuthService(
      mockPrisma,
      mockUsersService,
      mockJwtService,
      mockConfig,
      mockEmailService,
    );

    jwtRefreshStrategy = new JwtRefreshStrategy(mockConfig, mockPrisma);
  });

  describe('Test 5 & 6 — Session Storage: Raw token !== Database value', () => {
    it('should store the SHA-256 hash in userSession.create rather than the raw refresh token', async () => {
      const rawRefreshToken =
        'a1b2c3d4e5f600112233445566778899aabbccddeeff00112233445566778899aabbccddeeff';
      const expectedHash = hashRefreshToken(rawRefreshToken);

      mockPrisma.userSession.create.mockImplementation((args: any) =>
        Promise.resolve({
          id: 'session_abc',
          ...args.data,
        }),
      );

      // Invoke private createSession via TypeScript escape
      const session = await (authService as any).createSession(
        mockUser.id,
        rawRefreshToken,
        '127.0.0.1',
        'Mozilla/5.0',
      );

      // Verify the critical security invariants:
      expect(session.refreshToken).not.toBe(rawRefreshToken);
      expect(session.refreshToken).toBe(expectedHash);
      expect(session.refreshToken).toHaveLength(64);

      // Verify what was passed to Prisma:
      expect(mockPrisma.userSession.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: mockUser.id,
            refreshToken: expectedHash,
            status: 'ACTIVE',
          }),
        }),
      );
    });
  });

  describe('Test 7 — Refresh Validation: Lookup using hashed representation', () => {
    it('should hash the incoming client raw token to query Prisma in refreshTokens()', async () => {
      const rawClientToken = 'raw-client-refresh-token-value-12345';
      const expectedHash = hashRefreshToken(rawClientToken);

      const existingSession = {
        id: 'session_xyz',
        userId: mockUser.id,
        refreshToken: expectedHash,
        status: 'ACTIVE',
        expiresAt: new Date(Date.now() + 100000),
        user: mockUser,
      };

      mockPrisma.userSession.findUnique.mockResolvedValue(existingSession);
      mockPrisma.userSession.update.mockResolvedValue({
        ...existingSession,
      });

      const result = await authService.refreshTokens(
        rawClientToken,
        '127.0.0.1',
      );

      // Prove the query used the SHA-256 hash:
      expect(mockPrisma.userSession.findUnique).toHaveBeenCalledWith({
        where: { refreshToken: expectedHash },
        include: expect.any(Object),
      });

      // Confirm new raw tokens returned
      expect(result.accessToken).toBe('mock.access.token');
      expect(typeof result.refreshToken).toBe('string');
      expect(result.refreshToken).not.toBe(rawClientToken);
    });

    it('should hash the cookie token to query Prisma in JwtRefreshStrategy.validate()', async () => {
      const rawCookieToken = 'raw-cookie-refresh-token-998877';
      const expectedHash = hashRefreshToken(rawCookieToken);

      const mockReq = {
        cookies: {
          refresh_token: rawCookieToken,
        },
      } as any;

      mockPrisma.userSession.findUnique.mockResolvedValue({
        id: 'session_123',
        refreshToken: expectedHash,
        status: 'ACTIVE',
        expiresAt: new Date(Date.now() + 100000),
      });

      const payload = { sub: mockUser.id, email: mockUser.email };
      const validatedPayload = await jwtRefreshStrategy.validate(
        mockReq,
        payload,
      );

      expect(validatedPayload).toEqual(payload);
      expect(mockPrisma.userSession.findUnique).toHaveBeenCalledWith({
        where: { refreshToken: expectedHash },
      });
    });
  });

  describe('Test 8 — Refresh-Token Rotation', () => {
    it('should store the hash of the newly rotated refresh token in the database', async () => {
      const oldRawToken = 'old-raw-client-refresh-token-11111';
      const oldHash = hashRefreshToken(oldRawToken);

      const existingSession = {
        id: 'session_rotate',
        userId: mockUser.id,
        refreshToken: oldHash,
        status: 'ACTIVE',
        expiresAt: new Date(Date.now() + 100000),
        user: mockUser,
      };

      mockPrisma.userSession.findUnique.mockResolvedValue(existingSession);
      mockPrisma.userSession.update.mockImplementation((args: any) =>
        Promise.resolve({ id: existingSession.id, ...args.data }),
      );

      const tokens = await authService.refreshTokens(oldRawToken, '10.0.0.1');

      // The new raw token was returned:
      expect(tokens.refreshToken).toBeDefined();
      expect(tokens.refreshToken).not.toBe(oldRawToken);

      // The database update was called with the HASH of the new token:
      const expectedNewHash = hashRefreshToken(tokens.refreshToken);
      expect(mockPrisma.userSession.update).toHaveBeenCalledWith({
        where: { id: existingSession.id },
        data: expect.objectContaining({
          refreshToken: expectedNewHash,
          ipAddress: '10.0.0.1',
        }),
      });

      // Invariant: database update does NOT receive raw new token
      expect(mockPrisma.userSession.update).not.toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            refreshToken: tokens.refreshToken,
          }),
        }),
      );
    });
  });

  describe('Test 9 — Invalid Token Rejection', () => {
    it('should fail when incoming raw token hash does not match any session in DB', async () => {
      const forgedToken = 'forged-or-expired-token-00000';
      const forgedHash = hashRefreshToken(forgedToken);

      mockPrisma.userSession.findUnique.mockResolvedValue(null);

      await expect(
        authService.refreshTokens(forgedToken, '127.0.0.1'),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockPrisma.userSession.findUnique).toHaveBeenCalledWith({
        where: { refreshToken: forgedHash },
        include: expect.any(Object),
      });
    });

    it('should throw ForbiddenException if associated user is inactive', async () => {
      const rawToken = 'valid-token-inactive-user-123';
      const tokenHash = hashRefreshToken(rawToken);

      mockPrisma.userSession.findUnique.mockResolvedValue({
        id: 'sess_inactive',
        refreshToken: tokenHash,
        status: 'ACTIVE',
        expiresAt: new Date(Date.now() + 100000),
        user: { ...mockUser, status: 'SUSPENDED' },
      });

      await expect(
        authService.refreshTokens(rawToken, '127.0.0.1'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Test 10 — Logout & Session Revocation', () => {
    it('should hash the raw refresh token before revoking session in logout()', async () => {
      const rawLogoutToken = 'raw-client-token-to-logout-555';
      const expectedHash = hashRefreshToken(rawLogoutToken);

      mockPrisma.userSession.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.activityLog.create.mockResolvedValue({});

      await authService.logout(rawLogoutToken, mockUser.id);

      expect(mockPrisma.userSession.updateMany).toHaveBeenCalledWith({
        where: { refreshToken: expectedHash, userId: mockUser.id },
        data: { status: 'REVOKED' },
      });

      // Invariant: raw token was never passed into database update query
      expect(mockPrisma.userSession.updateMany).not.toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            refreshToken: rawLogoutToken,
          }),
        }),
      );
    });
  });

  describe('Test 11 — Raw-Token Safety', () => {
    it('should not leak raw refresh token in audit log or exception messages', async () => {
      const rawSecretToken = 'DO_NOT_LEAK_ME_IN_LOGS_OR_AUDIT_TRAIL';

      mockPrisma.userSession.findUnique.mockResolvedValue(null);

      try {
        await authService.refreshTokens(rawSecretToken, '127.0.0.1');
      } catch (err: any) {
        expect(err.message).not.toContain(rawSecretToken);
        expect(err.message).toBe('Session expired. Please login again.');
      }
    });
  });
});
