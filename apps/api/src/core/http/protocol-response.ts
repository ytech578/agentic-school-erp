/** Protocol endpoints must not receive the ERP JSON envelope. */
export function isScimRequest(request?: {
  originalUrl?: string;
  url?: string;
}): boolean {
  const pathname = (request?.originalUrl || request?.url || '').split('?')[0];
  return /(?:^|\/)scim\/v2(?:\/|$)/.test(pathname);
}
