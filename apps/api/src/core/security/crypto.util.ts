import * as crypto from 'crypto';

const PREFIX = 'enc:v1:';

/**
 * Derives a 32-byte encryption key from environment variable.
 * Supported env vars: PII_ENCRYPTION_KEY or AADHAAR_ENCRYPTION_KEY.
 * Falls back to a deterministic 32-byte test key in non-production test environments.
 */
export function getPiiEncryptionKey(): Buffer {
  const envKey =
    process.env.PII_ENCRYPTION_KEY ||
    process.env.AADHAAR_ENCRYPTION_KEY ||
    process.env.JWT_SECRET;

  if (envKey) {
    if (envKey.length === 64 && /^[0-9a-fA-F]+$/.test(envKey)) {
      return Buffer.from(envKey, 'hex');
    }
    // Hash key to ensure exact 32-byte length for AES-256
    return crypto.createHash('sha256').update(envKey).digest();
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'PII_ENCRYPTION_KEY is required in production environment (AES-256-GCM)',
    );
  }

  // Safe deterministic key for local unit tests / dev
  return crypto
    .createHash('sha256')
    .update('development-default-pii-key-do-not-use-in-prod-32bytes')
    .digest();
}

/**
 * Checks if a stored string is already AES-256-GCM encrypted.
 */
export function isEncrypted(value?: string | null): boolean {
  return typeof value === 'string' && value.startsWith(PREFIX);
}

/**
 * Encrypts a sensitive string using AES-256-GCM.
 * Format: enc:v1:<iv_hex>:<authTag_hex>:<ciphertext_hex>
 */
export function encryptSensitiveField(
  plaintext?: string | null,
): string | null {
  if (!plaintext || plaintext.trim() === '') return null;
  if (isEncrypted(plaintext)) return plaintext; // Prevent double encryption

  const key = getPiiEncryptionKey();
  const iv = crypto.randomBytes(12); // 96-bit IV recommended for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return `${PREFIX}${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext.toString('hex')}`;
}

/**
 * Decrypts an AES-256-GCM encrypted string.
 * Returns plaintext if not encrypted.
 */
export function decryptSensitiveField(
  ciphertext?: string | null,
): string | null {
  if (!ciphertext || ciphertext.trim() === '') return null;
  if (!isEncrypted(ciphertext)) return ciphertext; // Return as-is if unencrypted

  const parts = ciphertext.slice(PREFIX.length).split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted field format');
  }

  const [ivHex, authTagHex, cipherHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const cipherBuffer = Buffer.from(cipherHex, 'hex');

  const tryDecrypt = (keyBuffer: Buffer): string => {
    const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([
      decipher.update(cipherBuffer),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  };

  try {
    const primaryKey = getPiiEncryptionKey();
    return tryDecrypt(primaryKey);
  } catch (primaryErr) {
    const prevKeyRaw =
      process.env.PII_ENCRYPTION_KEY_PREV ||
      process.env.AADHAAR_ENCRYPTION_KEY_PREV;
    if (prevKeyRaw) {
      try {
        const prevKey =
          prevKeyRaw.length === 64 && /^[0-9a-fA-F]+$/.test(prevKeyRaw)
            ? Buffer.from(prevKeyRaw, 'hex')
            : crypto.createHash('sha256').update(prevKeyRaw).digest();
        return tryDecrypt(prevKey);
      } catch {
        // Fall back to rethrow primary error
      }
    }
    throw primaryErr;
  }
}

/**
 * Returns a masked representation of an Aadhaar number for display (e.g. XXXX-XXXX-1234).
 */
export function maskAadhaarNumber(aadhaar?: string | null): string | null {
  if (!aadhaar || aadhaar.trim() === '') return null;

  const raw = isEncrypted(aadhaar) ? decryptSensitiveField(aadhaar) : aadhaar;
  if (!raw) return null;

  const clean = raw.replace(/\D/g, '');
  if (clean.length === 12) {
    return `XXXX-XXXX-${clean.slice(8)}`;
  }
  if (clean.length >= 4) {
    return `XXXX-${clean.slice(-4)}`;
  }
  return 'XXXX';
}
