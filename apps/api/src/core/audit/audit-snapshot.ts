/** Persist domain state, never reusable credentials or authentication material. */
export function sanitizeAuditSnapshot(value: unknown): unknown {
  if (value === undefined || value === null) return null;
  return JSON.parse(
    JSON.stringify(value, (key, item: unknown) =>
      /password|secret|token|recovery.?codes|otpauth|qrCodeDataUrl/i.test(key)
        ? '[REDACTED]'
        : item,
    ),
  );
}
