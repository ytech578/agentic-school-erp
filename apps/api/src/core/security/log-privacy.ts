/** Tokens, passwords, SCIM filters and student query values do not belong in HTTP logs. */
export function safeRequestLog(request: {
  id?: unknown;
  method?: unknown;
  url?: unknown;
  remoteAddress?: unknown;
}) {
  return {
    id: request.id,
    method: request.method,
    url:
      typeof request.url === 'string' ? request.url.split('?')[0] : undefined,
    remoteAddress: request.remoteAddress,
  };
}
export const privateLogPaths = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  'req.body.password',
  'req.body.otp',
  'req.body.token',
  'req.body.refreshToken',
];
