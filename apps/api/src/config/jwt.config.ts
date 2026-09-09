import { registerAs } from '@nestjs/config';

const KNOWN_PLACEHOLDERS = [
  'secret',
  'password',
  'changeme',
  'your_secret_here',
  'your_secret',
  'your-secret',
  'change_this',
  'change-this',
  'development-secret',
  'development_secret',
  'test-secret',
  'test_secret',
  'dev-access-secret',
  'dev-refresh-secret',
  'default-secret',
  'default_secret',
  'placeholder',
];

export interface ValidatedJwtConfig {
  accessSecret: string;
  refreshSecret: string;
  accessExpiresIn: string;
  refreshExpiresIn: string;
  refreshExpiresInMs: number;
}

export function validateJwtConfig(
  env: Record<string, string | undefined> = process.env,
): ValidatedJwtConfig {
  const rawAccess = env.JWT_ACCESS_SECRET;
  const rawRefresh = env.JWT_REFRESH_SECRET;

  const accessSecret: string =
    typeof rawAccess === 'string' ? rawAccess.trim() : '';
  const refreshSecret: string =
    typeof rawRefresh === 'string' ? rawRefresh.trim() : '';

  // 1. Existence check
  if (!accessSecret) {
    throw new Error(
      'JWT configuration validation failed: JWT_ACCESS_SECRET is required. ' +
        'Please configure a strong secret in your environment before starting the API.',
    );
  }

  if (!refreshSecret) {
    throw new Error(
      'JWT configuration validation failed: JWT_REFRESH_SECRET is required. ' +
        'Please configure a strong secret in your environment before starting the API.',
    );
  }

  // 2. Minimum length check (at least 32 characters)
  if (accessSecret.length < 32) {
    throw new Error(
      `JWT configuration validation failed: JWT_ACCESS_SECRET must be at least 32 characters long (received ${accessSecret.length} characters).`,
    );
  }

  if (refreshSecret.length < 32) {
    throw new Error(
      `JWT configuration validation failed: JWT_REFRESH_SECRET must be at least 32 characters long (received ${refreshSecret.length} characters).`,
    );
  }

  // 3. Known placeholder / weak pattern check
  const accessLower: string = accessSecret.toLowerCase();
  for (const placeholder of KNOWN_PLACEHOLDERS) {
    if (accessLower.includes(placeholder)) {
      throw new Error(
        'JWT configuration validation failed: JWT_ACCESS_SECRET contains obvious placeholder or default text. ' +
          'A secure, random secret is required.',
      );
    }
  }

  const refreshLower: string = refreshSecret.toLowerCase();
  for (const placeholder of KNOWN_PLACEHOLDERS) {
    if (refreshLower.includes(placeholder)) {
      throw new Error(
        'JWT configuration validation failed: JWT_REFRESH_SECRET contains obvious placeholder or default text. ' +
          'A secure, random secret is required.',
      );
    }
  }

  // 4. Distinct secrets check
  if (accessSecret === refreshSecret) {
    throw new Error(
      'JWT configuration validation failed: JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must not be identical. ' +
        'Access and refresh tokens must use distinct secrets.',
    );
  }

  return {
    accessSecret,
    refreshSecret,
    accessExpiresIn: env.JWT_ACCESS_EXPIRES || '15m',
    refreshExpiresIn: env.JWT_REFRESH_EXPIRES || '7d',
    refreshExpiresInMs: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
  };
}

export default registerAs('jwt', () => validateJwtConfig(process.env));
