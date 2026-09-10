import * as crypto from 'crypto';

/**
 * Computes a deterministic SHA-256 cryptographic hash (fingerprint) of a refresh token.
 *
 * This one-way digest is used for secure persistence and lookup in the `user_sessions`
 * table, ensuring that raw refresh tokens are never persisted in the database, caches,
 * or server logs.
 *
 * @param token - The raw plaintext refresh token string
 * @returns 64-character lowercase hexadecimal SHA-256 digest
 * @throws TypeError if token is not a non-empty string (without leaking token content)
 */
export function hashRefreshToken(token: string): string {
  if (typeof token !== 'string' || token.trim().length === 0) {
    throw new TypeError(
      'Invalid refresh token: token must be a non-empty string',
    );
  }

  return crypto.createHash('sha256').update(token).digest('hex');
}
