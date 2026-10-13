import { registerAs } from '@nestjs/config';

function requireEnv(key: string, fallback?: string): string {
  const value = process.env[key] || fallback;
  if (!value && process.env.NODE_ENV === 'production') {
    throw new Error(`Missing required environment variable: ${key} in production`);
  }
  return value || '';
}

export default registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  name: process.env.APP_NAME || 'AI School ERP',
  port: parseInt(process.env.PORT || '4000', 10),
  apiPrefix: process.env.API_PREFIX || 'api',
  appUrl: requireEnv('APP_URL', 'http://localhost:3000'),
  apiUrl: requireEnv('API_URL', 'http://localhost:4000'),
  corsOrigin: requireEnv('CORS_ORIGIN', 'http://localhost:3000'),
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  authRateLimitMax: parseInt(process.env.AUTH_RATE_LIMIT_MAX || '5', 10),
  sessionTimeoutHours: parseInt(process.env.SESSION_TIMEOUT_HOURS || '24', 10),
  uploadMaxSize: 10 * 1024 * 1024, // 10MB
  uploadAllowedMimeTypes: [
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
}));
