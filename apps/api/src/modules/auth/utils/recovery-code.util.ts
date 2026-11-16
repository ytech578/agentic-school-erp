import { createHmac } from 'node:crypto';

export interface RecoveryCodePepperOptions {
  current?: string;
  previous?: string;
  developmentFallback?: string;
  production: boolean;
}

/** Previous peppers are verification-only; newly issued codes use index zero. */
export function recoveryCodePeppers(
  options: RecoveryCodePepperOptions,
): string[] {
  if (options.production && !options.current) {
    throw new Error('MFA_RECOVERY_CODE_PEPPER is required in production');
  }
  const current = options.current || options.developmentFallback;
  if (!current) throw new Error('MFA recovery-code pepper is not configured');
  if (options.production && current.length < 32) {
    throw new Error(
      'MFA_RECOVERY_CODE_PEPPER must contain at least 32 characters',
    );
  }
  if (options.previous && options.previous.length < 32) {
    throw new Error(
      'MFA_RECOVERY_CODE_PEPPER_PREV must contain at least 32 characters',
    );
  }
  return [
    ...new Set([current, options.previous].filter((v): v is string => !!v)),
  ];
}

export function hashMfaRecoveryCode(code: string, pepper: string): string {
  return createHmac('sha256', pepper)
    .update(code.trim().toUpperCase())
    .digest('hex');
}
