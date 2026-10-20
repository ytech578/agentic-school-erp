import { apiClient, shouldAttemptSessionRefresh } from './axios';

describe('Axios Client Configuration (FIX-04)', () => {
  it('creates an axios instance configured with default JSON headers and credentials', () => {
    expect(apiClient).toBeDefined();
    expect(apiClient.defaults.withCredentials).toBe(true);
    expect(apiClient.defaults.headers['Content-Type']).toBe('application/json');
    expect(apiClient.defaults.headers['Accept']).toBe('application/json');
  });

  it('configures a 45-second baseline timeout (45,000ms) to prevent hanging connections while supporting deep AI pipelines', () => {
    expect(apiClient.defaults.timeout).toBe(45000);
  });

  it('has request and response interceptors registered', () => {
    // Interceptor managers should have registered handlers
    expect((apiClient.interceptors.request as any).handlers.length).toBeGreaterThanOrEqual(1);
    expect((apiClient.interceptors.response as any).handlers.length).toBeGreaterThanOrEqual(1);
  });

  it('does not replace authentication-entry 401 responses with refresh errors', () => {
    expect(shouldAttemptSessionRefresh(401, '/auth/login', false, true)).toBe(false);
    expect(shouldAttemptSessionRefresh(401, '/auth/forgot-password', false, true)).toBe(false);
    expect(shouldAttemptSessionRefresh(401, '/auth/reset-password', false, true)).toBe(false);
    expect(shouldAttemptSessionRefresh(401, '/sso/exchange', false, true)).toBe(false);
  });

  it('only refreshes a 401 for an established authenticated session', () => {
    expect(shouldAttemptSessionRefresh(401, '/students', false, true)).toBe(true);
    expect(shouldAttemptSessionRefresh(401, '/students', false, false)).toBe(false);
    expect(shouldAttemptSessionRefresh(403, '/students', false, true)).toBe(false);
    expect(shouldAttemptSessionRefresh(401, '/students', true, true)).toBe(false);
  });
});
