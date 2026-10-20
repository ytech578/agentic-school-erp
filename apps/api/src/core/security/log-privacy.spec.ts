import { safeRequestLog } from './log-privacy';
describe('HTTP log privacy', () => {
  it('does not serialize headers, credentials or query values', () => {
    const input = {
      method: 'GET',
      url: '/sso/oidc/callback?code=secret&state=private',
      headers: { authorization: 'Bearer secret', cookie: 'refresh=private' },
      body: { password: 'private' },
    };
    const output = JSON.stringify(safeRequestLog(input));
    expect(output).toContain('/sso/oidc/callback');
    for (const secret of [
      'secret',
      'private',
      'authorization',
      'cookie',
      'password',
    ])
      expect(output).not.toContain(secret);
  });
});
