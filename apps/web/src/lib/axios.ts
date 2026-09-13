import axios from 'axios';
import { useAuthStore } from '../store/auth.store';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 20000, // 20s timeout to prevent hanging connections
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  withCredentials: true, // Crucial for refresh tokens stored in HttpOnly cookies
});

// Request interceptor: Attach access token and active school context
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
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: Handle 401s and token refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // Prevent infinite loops if refresh fails
    if (error.response?.status === 401 && !originalRequest._retry && originalRequest.url !== '/auth/refresh') {
      originalRequest._retry = true;
      try {
        const response = await axios.post(`${API_URL}/auth/refresh`, {}, { withCredentials: true, timeout: 10000 });
        const newAccessToken = response.data?.data?.accessToken || response.data?.accessToken;
        if (newAccessToken) {
          // Update store with new access token
          useAuthStore.getState().setTokens(newAccessToken);
          // Retry the original request
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          return apiClient(originalRequest);
        }
      } catch (refreshError) {
        // If refresh fails, log the user out
        useAuthStore.getState().logout();
        return Promise.reject(refreshError);
      }
    }

    // ── Transient Retry for Idempotent GET Requests on Network Glitches / Server Restarts ──
    const isNetworkError = !error.response && (error.message === 'Network Error' || error.code === 'ERR_NETWORK');
    if (
      isNetworkError &&
      originalRequest &&
      originalRequest.method?.toLowerCase() === 'get' &&
      !originalRequest._hasRetriedOnce
    ) {
      originalRequest._hasRetriedOnce = true;
      console.info(`[apiClient] Transient network disconnect on GET ${originalRequest.url}. Retrying in 1s...`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return apiClient(originalRequest);
    }

    // ── Human-Readable Diagnostics for Timeout and Network Errors ──
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      console.warn(
        `[apiClient] Request Timeout: ${originalRequest?.method?.toUpperCase()} ${originalRequest?.url || 'endpoint'} ` +
        `exceeded the 20-second threshold. The backend server might be under heavy load or restarting.`
      );
      error.message = 'The server took too long to respond (20s timeout exceeded). Please verify your connection and try again.';
    } else if (isNetworkError) {
      console.warn(
        `[apiClient] Network Error: Unable to reach ${originalRequest?.url || 'API'}. ` +
        `Ensure the NestJS backend is running on http://localhost:4000 and CORS allows requests from this origin.`
      );
    }

    return Promise.reject(error);
  }
);
