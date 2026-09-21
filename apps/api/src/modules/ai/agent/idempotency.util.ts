import { BadRequestException } from '@nestjs/common';
import { createHash } from 'crypto';
import { AGENT_ERRORS } from './agent-types';

/**
 * Validates the format, length, and character set of client-supplied Idempotency-Key.
 * Enforces:
 * - 1 to 128 characters
 * - Safe character set: alphanumeric, underscores, hyphens, periods, colons
 * - Rejects whitespace-only or oversized strings
 */
export function validateIdempotencyKey(key?: string): void {
  if (key === undefined || key === null) {
    return;
  }

  if (typeof key !== 'string') {
    throw new BadRequestException(
      `${AGENT_ERRORS.ACTION_IDEMPOTENCY_KEY_INVALID}: Idempotency-Key must be a string`,
    );
  }

  const trimmed = key.trim();
  if (trimmed.length === 0) {
    throw new BadRequestException(
      `${AGENT_ERRORS.ACTION_IDEMPOTENCY_KEY_INVALID}: Idempotency-Key cannot be empty or whitespace-only`,
    );
  }

  if (key.length < 1 || key.length > 128) {
    throw new BadRequestException(
      `${AGENT_ERRORS.ACTION_IDEMPOTENCY_KEY_INVALID}: Idempotency-Key length must be between 1 and 128 characters`,
    );
  }

  const SAFE_KEY_REGEX = /^[A-Za-z0-9_\-\.:]{1,128}$/;
  if (!SAFE_KEY_REGEX.test(key)) {
    throw new BadRequestException(
      `${AGENT_ERRORS.ACTION_IDEMPOTENCY_KEY_INVALID}: Idempotency-Key contains invalid characters. Allowed: [A-Za-z0-9_\\-\\.:]`,
    );
  }
}

/**
 * Computes a deterministic, server-derived idempotency scope.
 * Prevents key collision across tenants, users, and different tools.
 */
export function deriveIdempotencyScope(
  schoolId: string,
  userId: string,
  toolName: string,
): string {
  return `${schoolId}:${userId}:${toolName}`;
}

/**
 * Recursively canonicalizes any JSON-compatible structure into a deterministic string.
 *
 * Rules:
 * 1. Object keys are recursively sorted lexicographically.
 * 2. Array ordering is preserved (never arbitrarily sorted).
 * 3. Primitives and null format identically to standard JSON.
 * 4. Date objects serialize to ISO-8601 strings.
 * 5. Undefined values are omitted.
 */
export function canonicalJson(val: unknown): string {
  if (val === null || val === undefined) {
    return 'null';
  }

  if (typeof val === 'number' || typeof val === 'boolean') {
    return JSON.stringify(val);
  }

  if (typeof val === 'string') {
    return JSON.stringify(val);
  }

  if (val instanceof Date) {
    return JSON.stringify(val.toISOString());
  }

  if (Array.isArray(val)) {
    return `[${val.map((item) => canonicalJson(item)).join(',')}]`;
  }

  if (typeof val === 'object') {
    const keys = Object.keys(val as Record<string, unknown>).sort();
    const parts: string[] = [];
    for (const key of keys) {
      const item = (val as Record<string, unknown>)[key];
      if (item !== undefined) {
        parts.push(`${JSON.stringify(key)}:${canonicalJson(item)}`);
      }
    }
    return `{${parts.join(',')}}`;
  }

  return JSON.stringify(String(val));
}

/**
 * Computes a cryptographic SHA-256 hash of the canonical validated request.
 * Used to detect when a client reuses the same Idempotency-Key with a different payload.
 */
export function computeRequestFingerprint(
  schoolId: string,
  userId: string,
  toolName: string,
  rawArgs: Record<string, unknown>,
): string {
  const canonicalPayload = canonicalJson(rawArgs);
  return createHash('sha256')
    .update(`${schoolId}:${userId}:${toolName}:${canonicalPayload}`)
    .digest('hex');
}
