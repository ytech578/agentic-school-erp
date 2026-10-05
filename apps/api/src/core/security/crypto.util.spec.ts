import {
  encryptSensitiveField,
  decryptSensitiveField,
  maskAadhaarNumber,
  isEncrypted,
} from './crypto.util';

describe('CryptoUtil - AES-256-GCM Aadhaar & PII Encryption', () => {
  const sampleAadhaar = '987654321098';

  it('encrypts plaintext into enc:v1 format and decrypts back to original', () => {
    const encrypted = encryptSensitiveField(sampleAadhaar);
    expect(encrypted).toBeDefined();
    expect(encrypted).toMatch(/^enc:v1:[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/);
    expect(isEncrypted(encrypted)).toBe(true);

    const decrypted = decryptSensitiveField(encrypted);
    expect(decrypted).toBe(sampleAadhaar);
  });

  it('is idempotent when encrypting already encrypted text', () => {
    const encryptedOnce = encryptSensitiveField(sampleAadhaar);
    const encryptedTwice = encryptSensitiveField(encryptedOnce);
    expect(encryptedTwice).toBe(encryptedOnce);
  });

  it('returns plaintext if trying to decrypt an unencrypted string', () => {
    const unencrypted = '123456789012';
    expect(decryptSensitiveField(unencrypted)).toBe(unencrypted);
  });

  it('masks Aadhaar number properly for both plaintext and encrypted input', () => {
    expect(maskAadhaarNumber('987654321098')).toBe('XXXX-XXXX-1098');

    const encrypted = encryptSensitiveField('987654321098');
    expect(maskAadhaarNumber(encrypted)).toBe('XXXX-XXXX-1098');
  });

  it('handles null and empty values gracefully', () => {
    expect(encryptSensitiveField(null)).toBeNull();
    expect(decryptSensitiveField(null)).toBeNull();
    expect(maskAadhaarNumber(null)).toBeNull();
    expect(encryptSensitiveField('')).toBeNull();
  });

  it('fails decryption if ciphertext or authTag is tampered', () => {
    const encrypted = encryptSensitiveField(sampleAadhaar)!;
    const parts = encrypted.split(':');
    // Tamper with the ciphertext byte
    const tamperedCipher = parts[4].slice(0, -2) + 'ff';
    const tampered = `${parts[0]}:${parts[1]}:${parts[2]}:${parts[3]}:${tamperedCipher}`;

    expect(() => decryptSensitiveField(tampered)).toThrow();
  });

  it('decrypts ciphertext encrypted with old key using AADHAAR_ENCRYPTION_KEY_PREV during secret rotation', () => {
    const oldKey = 'old-key-prior-to-secret-rotation-32-bytes-long!';
    const newKey = 'new-rotated-key-after-secret-rotation-32bytes!';

    // Encrypt with old key
    process.env.AADHAAR_ENCRYPTION_KEY = oldKey;
    delete process.env.AADHAAR_ENCRYPTION_KEY_PREV;
    const encryptedWithOld = encryptSensitiveField(sampleAadhaar)!;

    // Rotate keys: new key is primary, old key becomes PREV
    process.env.AADHAAR_ENCRYPTION_KEY = newKey;
    process.env.AADHAAR_ENCRYPTION_KEY_PREV = oldKey;

    // Decrypting data encrypted before rotation succeeds via PREV key fallback
    const decrypted = decryptSensitiveField(encryptedWithOld);
    expect(decrypted).toBe(sampleAadhaar);

    // Clean up env
    delete process.env.AADHAAR_ENCRYPTION_KEY;
    delete process.env.AADHAAR_ENCRYPTION_KEY_PREV;
  });
});
