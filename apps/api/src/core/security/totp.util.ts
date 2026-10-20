import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function generateTotpSecret(bytes = 20): string {
  return encodeBase32(randomBytes(bytes));
}

export function generateTotpUri(options: {
  secret: string;
  issuer: string;
  label: string;
}) {
  const account = encodeURIComponent(`${options.issuer}:${options.label}`);
  const query = new URLSearchParams({
    secret: options.secret,
    issuer: options.issuer,
    algorithm: 'SHA1',
    digits: '6',
    period: '30',
  });
  return `otpauth://totp/${account}?${query.toString()}`;
}

export function verifyTotp(
  secret: string,
  token: string,
  now = Date.now(),
  window = 1,
): boolean {
  const normalized = token.replace(/\s/g, '');
  if (!/^\d{6}$/.test(normalized)) return false;
  const supplied = Buffer.from(normalized, 'ascii');
  const counter = Math.floor(now / 30_000);
  for (let offset = -window; offset <= window; offset += 1) {
    const expected = Buffer.from(
      generateToken(secret, counter + offset),
      'ascii',
    );
    if (timingSafeEqual(supplied, expected)) return true;
  }
  return false;
}

function generateToken(secret: string, counter: number): string {
  const key = decodeBase32(secret);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac('sha1', key).update(counterBuffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const code =
    (((digest[offset] & 0x7f) << 24) |
      ((digest[offset + 1] & 0xff) << 16) |
      ((digest[offset + 2] & 0xff) << 8) |
      (digest[offset + 3] & 0xff)) %
    1_000_000;
  return code.toString().padStart(6, '0');
}

function encodeBase32(input: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of input) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

function decodeBase32(input: string): Buffer {
  let bits = 0;
  let value = 0;
  const output: number[] = [];
  for (const character of input.toUpperCase().replace(/=+$/, '')) {
    const index = ALPHABET.indexOf(character);
    if (index < 0) throw new Error('Invalid base32 TOTP secret');
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(output);
}
