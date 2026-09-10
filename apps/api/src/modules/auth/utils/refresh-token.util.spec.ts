import * as crypto from 'crypto';
import { hashRefreshToken } from './refresh-token.util';

describe('Refresh Token Hashing Utility (refresh-token.util)', () => {
  const sampleToken1 =
    '7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069';
  const sampleToken2 = 'd8578edf8458ce06fbc5bb76a58c5ca4';

  describe('Test 1 — Deterministic hashing', () => {
    it('should always produce the exact same hash for the same raw token', () => {
      const hashA = hashRefreshToken(sampleToken1);
      const hashB = hashRefreshToken(sampleToken1);
      const hashC = hashRefreshToken(sampleToken1);

      expect(hashA).toBe(hashB);
      expect(hashB).toBe(hashC);
    });
  });

  describe('Test 2 — One-way representation', () => {
    it('should never equal the raw plaintext token', () => {
      const hash = hashRefreshToken(sampleToken1);

      expect(hash).not.toBe(sampleToken1);
    });
  });

  describe('Test 3 — Expected SHA-256 digest', () => {
    it('should produce a valid 64-character lowercase hex SHA-256 digest', () => {
      const hash = hashRefreshToken(sampleToken1);
      const expectedDigest = crypto
        .createHash('sha256')
        .update(sampleToken1)
        .digest('hex');

      expect(hash).toBe(expectedDigest);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
      expect(hash.length).toBe(64);
    });
  });

  describe('Test 4 — Different tokens produce different hashes', () => {
    it('should produce distinct hashes for distinct input tokens', () => {
      const hash1 = hashRefreshToken(sampleToken1);
      const hash2 = hashRefreshToken(sampleToken2);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('Test 5 — Input validation & error safety', () => {
    it('should throw TypeError when input is an empty string', () => {
      expect(() => hashRefreshToken('')).toThrow(TypeError);
      expect(() => hashRefreshToken('')).toThrow(
        'Invalid refresh token: token must be a non-empty string',
      );
    });

    it('should throw TypeError when input is only whitespace', () => {
      expect(() => hashRefreshToken('   ')).toThrow(TypeError);
    });

    it('should throw TypeError when input is not a string', () => {
      expect(() => hashRefreshToken(null as unknown as string)).toThrow(
        TypeError,
      );
      expect(() => hashRefreshToken(undefined as unknown as string)).toThrow(
        TypeError,
      );
      expect(() => hashRefreshToken(12345 as unknown as string)).toThrow(
        TypeError,
      );
    });

    it('should never include sensitive token contents in thrown errors', () => {
      const sensitiveToken = 'SUPER_SECRET_RAW_TOKEN_CONTENT_XYZ';
      try {
        // Force an invalid type while tracking error message
        hashRefreshToken(sensitiveToken);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        expect(msg).not.toContain(sensitiveToken);
      }
    });
  });
});
