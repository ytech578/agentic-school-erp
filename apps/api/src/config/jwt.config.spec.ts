import { validateJwtConfig } from './jwt.config';
import { JwtService } from '@nestjs/jwt';

interface TestTokenPayload {
  sub: string;
  email: string;
  role: string;
  schoolId: string;
}

describe('JWT Secret Fallback & Configuration Hardening', () => {
  const validAccessSecret =
    'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';
  const validRefreshSecret =
    'f6e5d4c3b2a1f6e5d4c3b2a1f6e5d4c3b2a1f6e5d4c3b2a1f6e5d4c3b2a1f6e5';

  describe('Test 1 — Missing access secret', () => {
    it('should throw when JWT_ACCESS_SECRET is undefined', () => {
      expect(() =>
        validateJwtConfig({
          JWT_REFRESH_SECRET: validRefreshSecret,
        }),
      ).toThrow(
        /JWT configuration validation failed: JWT_ACCESS_SECRET is required/,
      );
    });

    it('should throw when JWT_ACCESS_SECRET is empty or whitespace', () => {
      expect(() =>
        validateJwtConfig({
          JWT_ACCESS_SECRET: '   ',
          JWT_REFRESH_SECRET: validRefreshSecret,
        }),
      ).toThrow(
        /JWT configuration validation failed: JWT_ACCESS_SECRET is required/,
      );
    });
  });

  describe('Test 2 — Missing refresh secret', () => {
    it('should throw when JWT_REFRESH_SECRET is undefined', () => {
      expect(() =>
        validateJwtConfig({
          JWT_ACCESS_SECRET: validAccessSecret,
        }),
      ).toThrow(
        /JWT configuration validation failed: JWT_REFRESH_SECRET is required/,
      );
    });

    it('should throw when JWT_REFRESH_SECRET is empty or whitespace', () => {
      expect(() =>
        validateJwtConfig({
          JWT_ACCESS_SECRET: validAccessSecret,
          JWT_REFRESH_SECRET: '',
        }),
      ).toThrow(
        /JWT configuration validation failed: JWT_REFRESH_SECRET is required/,
      );
    });
  });

  describe('Test 3 — Weak secret (too short or obvious placeholder)', () => {
    it('should reject secret that is too short (< 32 chars)', () => {
      expect(() =>
        validateJwtConfig({
          JWT_ACCESS_SECRET: 'too-short-key',
          JWT_REFRESH_SECRET: validRefreshSecret,
        }),
      ).toThrow(/must be at least 32 characters long/);
    });

    it('should reject access secret containing placeholder "secret"', () => {
      expect(() =>
        validateJwtConfig({
          JWT_ACCESS_SECRET: 'my-super-long-development-secret-key-32chars',
          JWT_REFRESH_SECRET: validRefreshSecret,
        }),
      ).toThrow(/contains obvious placeholder or default text/);
    });

    it('should reject refresh secret containing placeholder "changeme"', () => {
      expect(() =>
        validateJwtConfig({
          JWT_ACCESS_SECRET: validAccessSecret,
          JWT_REFRESH_SECRET:
            'changeme_to_something_else_longer_than_32_characters',
        }),
      ).toThrow(/contains obvious placeholder or default text/);
    });

    it('should reject placeholder "dev-access-secret"', () => {
      expect(() =>
        validateJwtConfig({
          JWT_ACCESS_SECRET: 'dev-access-secret-change-in-production-123456',
          JWT_REFRESH_SECRET: validRefreshSecret,
        }),
      ).toThrow(/contains obvious placeholder or default text/);
    });
  });

  describe('Test 4 — Identical secrets', () => {
    it('should reject when access and refresh secrets are identical', () => {
      expect(() =>
        validateJwtConfig({
          JWT_ACCESS_SECRET: validAccessSecret,
          JWT_REFRESH_SECRET: validAccessSecret,
        }),
      ).toThrow(
        /JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must not be identical/,
      );
    });
  });

  describe('Test 5 — Valid secrets', () => {
    it('should successfully return validated configuration with valid distinct secrets', () => {
      const config = validateJwtConfig({
        JWT_ACCESS_SECRET: validAccessSecret,
        JWT_REFRESH_SECRET: validRefreshSecret,
      });

      expect(config.accessSecret).toBe(validAccessSecret);
      expect(config.refreshSecret).toBe(validRefreshSecret);
      expect(config.accessExpiresIn).toBe('15m');
      expect(config.refreshExpiresIn).toBe('7d');
      expect(config.refreshExpiresInMs).toBe(7 * 24 * 60 * 60 * 1000);
    });

    it('should never expose secret values in error messages', () => {
      try {
        validateJwtConfig({
          JWT_ACCESS_SECRET: 'secret',
          JWT_REFRESH_SECRET: validRefreshSecret,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        expect(message).not.toContain('secret=');
        expect(message).toMatch(/JWT configuration validation failed/);
      }
    });
  });

  describe('Test 6 — Existing authentication behavior (signing & verification)', () => {
    it('should successfully sign and verify tokens using the validated access secret', async () => {
      const config = validateJwtConfig({
        JWT_ACCESS_SECRET: validAccessSecret,
        JWT_REFRESH_SECRET: validRefreshSecret,
      });

      const jwtService = new JwtService({
        secret: config.accessSecret,
        signOptions: { expiresIn: '15m' },
      });

      const payload: TestTokenPayload = {
        sub: 'usr_123456',
        email: 'test@example.com',
        role: 'SCHOOL_ADMIN',
        schoolId: 'sch_123',
      };

      const token = await jwtService.signAsync(payload);
      expect(typeof token).toBe('string');
      expect(token.split('.').length).toBe(3);

      const decoded: TestTokenPayload =
        await jwtService.verifyAsync<TestTokenPayload>(token, {
          secret: config.accessSecret,
        });

      expect(decoded.sub).toBe(payload.sub);
      expect(decoded.email).toBe(payload.email);
      expect(decoded.role).toBe(payload.role);
      expect(decoded.schoolId).toBe(payload.schoolId);
    });

    it('should fail token verification when signed with a different secret', async () => {
      const config = validateJwtConfig({
        JWT_ACCESS_SECRET: validAccessSecret,
        JWT_REFRESH_SECRET: validRefreshSecret,
      });

      const jwtService = new JwtService({
        secret: config.accessSecret,
      });

      const token = await jwtService.signAsync({ sub: 'usr_123' });

      await expect(
        jwtService.verifyAsync(token, {
          secret: config.refreshSecret, // Different secret
        }),
      ).rejects.toThrow();
    });
  });
});
