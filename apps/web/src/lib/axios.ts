import axios from 'axios';
import { useAuthStore } from '../store/auth.store';

const API_URL =
  typeof window !== 'undefined'
    ? (!process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_URL.includes('localhost')
        ? '/api'
        : process.env.NEXT_PUBLIC_API_URL)
    : (process.env.INTERNAL_API_URL || 'http://127.0.0.1:4000/api');

export const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 45000, // 45s baseline timeout for reliable cloud and local network operations
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  withCredentials: true, // Crucial for refresh tokens stored in HttpOnly cookies
});

// Request interceptor: Attach access token, active school context, and AI timeout scaling
apiClient.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().accessToken;
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    if (typeof window !== 'undefined' && config.headers) {
      const selectedSchoolId = localStorage.getItem('selected_school_id');
      if (selectedSchoolId) {
        config.headers['x-school-id'] = selectedSchoolId;
      }
    }
    // Generative AI inference pipelines (question-papers, rubrics, lesson plans) need generous execution time
    if (config.url?.includes('/ai/') && (!config.timeout || config.timeout === 45000)) {
      config.timeout = 90000;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Refresh token mutex to prevent concurrent refresh race conditions
let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

function subscribeTokenRefresh(cb: (token: string) => void) {
  refreshSubscribers.push(cb);
}

function onRefreshed(token: string) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

function onRefreshFailed() {
  refreshSubscribers = [];
}

// Response interceptor: Handle 401s and token refresh with mutex
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // Handle 401 Unauthorized with single-flight mutex
    if (error.response?.status === 401 && !originalRequest._retry && !originalRequest.url?.includes('/auth/refresh')) {
      if (isRefreshing) {
        // Queue concurrent requests behind the active refresh promise
        return new Promise((resolve, reject) => {
          subscribeTokenRefresh((newToken: string) => {
            if (!newToken) {
              reject(error);
              return;
            }
            originalRequest.headers = originalRequest.headers || {};
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            resolve(apiClient(originalRequest));
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const state = useAuthStore.getState();
        const currentRefreshToken = state.refreshToken;

        // If no refresh token exists in state or cookies, session cannot be refreshed
        if (!currentRefreshToken) {
          onRefreshFailed();
          state.logout();
          return Promise.reject(error);
        }

        const response = await axios.post(
          `${API_URL}/auth/refresh`,
          { refreshToken: currentRefreshToken },
          {
            headers: { 'x-refresh-token': currentRefreshToken },
            withCredentials: true,
            timeout: 15000,
          }
        );

        const newAccessToken = response.data?.data?.accessToken || response.data?.accessToken;
        const newRefreshToken = response.data?.data?.refreshToken || response.data?.refreshToken;

        if (newAccessToken) {
          state.setTokens(newAccessToken, newRefreshToken || currentRefreshToken || undefined);
          onRefreshed(newAccessToken);
          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          return apiClient(originalRequest);
        } else {
          throw new Error('No access token returned from refresh');
        }
      } catch (refreshError: any) {
        onRefreshFailed();
        // Only log out if backend explicitly rejected with 401 (invalid/expired session)
        // Do NOT log out on network disconnects or transient server timeouts!
        if (refreshError.response?.status === 401) {
          console.warn('[apiClient] Refresh token expired or revoked. Logging out user.');
          useAuthStore.getState().logout();
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // ── Transient Retry for Idempotent GET Requests on Network Glitches / Server Restarts ──
    const isNetworkError = !error.response && (error.message === 'Network Error' || error.code === 'ERR_NETWORK');
    if (
      isNetworkError &&
      originalRequest &&
      originalRequest.method?.toLowerCase() === 'get' &&
      (!originalRequest._retryCount || originalRequest._retryCount < 3)
    ) {
      originalRequest._retryCount = (originalRequest._retryCount || 0) + 1;
      const delay = originalRequest._retryCount * 1200;
      console.info(`[apiClient] Backend reconnecting: GET ${originalRequest.url}. Attempt ${originalRequest._retryCount}/3 (retrying in ${delay}ms)...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return apiClient(originalRequest);
    }

    // ── Human-Readable Diagnostics for Timeout and Network Errors ──
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      const timeoutSec = Math.round((originalRequest?.timeout || 45000) / 1000);
      console.warn(
        `[apiClient] Request Timeout: ${originalRequest?.method?.toUpperCase()} ${originalRequest?.url || 'endpoint'} ` +
        `exceeded the ${timeoutSec}-second threshold. The backend server might be under heavy load or restarting.`
      );
      error.message = `The server took too long to respond (${timeoutSec}s timeout exceeded). Please verify your connection and try again.`;
    } else if (isNetworkError) {
      console.warn(
        `[apiClient] Network Error: Unable to reach ${originalRequest?.url || 'API'}. ` +
        `Ensure the NestJS backend is running on http://localhost:4000 and CORS allows requests from this origin.`
      );
    }

    return Promise.reject(error);
  }
);
