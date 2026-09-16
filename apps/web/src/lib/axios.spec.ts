import { apiClient } from './axios';

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
});
