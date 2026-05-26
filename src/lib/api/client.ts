import axios from 'axios';
import axiosRetry from 'axios-retry';
import { useAuthStore } from '@/store/authStore';
import { router } from '@/router';
import { decodeJwt } from '@/lib/jwt';

const baseURL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';
// Paths checked against the end of the request URL (baseURL-independent)
const PUBLIC_PATHS = ['/auth/login', '/users/complete-registration'];
// Paths that must NOT trigger a silent refresh on 401 (would cause infinite loops)
const SKIP_REFRESH_PATHS = ['/auth/refresh', '/auth/login', '/users/complete-registration'];

function isPublicEndpoint(url?: string) {
  if (!url) return false;
  return PUBLIC_PATHS.some((p) => url === p || url.endsWith(p));
}

function shouldSkipRefresh(url?: string) {
  if (!url) return true;
  return SKIP_REFRESH_PATHS.some((p) => url === p || url.endsWith(p));
}

export const apiClient = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
  // Required so the browser sends the httpOnly refresh-token cookie on every request.
  withCredentials: true,
});

// Retry automático para errores de red transitorios y respuestas 5xx.
// Excluye errores 4xx (son definitivos — no vale la pena reintentar).
axiosRetry(apiClient, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error) =>
    axiosRetry.isNetworkError(error) ||
    (error.response !== undefined && error.response.status >= 500),
});

// Adjunta el JWT en cada request autenticada.
apiClient.interceptors.request.use((config) => {
  if (isPublicEndpoint(config.url)) {
    delete config.headers.Authorization;
    return config;
  }

  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Silent refresh ────────────────────────────────────────────────────────────
// When a 401 is received on a protected endpoint:
//   1. Attempt to refresh using the stored refresh token.
//   2. On success: update both tokens and retry the original request.
//   3. On failure: clear auth and redirect to /login.
// Concurrent requests that arrive while a refresh is in flight are queued and
// replayed with the new token once the refresh completes.

interface QueueEntry {
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
}

let isRefreshing = false;
let pendingQueue: QueueEntry[] = [];

function flushQueue(error: unknown, token: string | null) {
  pendingQueue.forEach((entry) => {
    if (error) entry.reject(error);
    else entry.resolve(token!);
  });
  pendingQueue = [];
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config as typeof error.config & { _retry?: boolean };
    const status: number | undefined = error.response?.status;

    // Only intercept 401s on protected endpoints, and only once per request
    if (status !== 401 || shouldSkipRefresh(original?.url) || original?._retry) {
      return Promise.reject(error);
    }

    // If a refresh is already in flight, queue this request
    if (isRefreshing) {
      return new Promise<string>((resolve, reject) => {
        pendingQueue.push({ resolve, reject });
      }).then((newToken) => {
        original.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(original);
      });
    }

    original._retry = true;
    isRefreshing = true;

    try {
      // Use a plain axios call (not apiClient) to avoid triggering this interceptor again.
      // No body needed — the browser sends the httpOnly refresh-token cookie automatically
      // because withCredentials: true is set.
      const { data } = await axios.post<{ accessToken: string; refreshToken: string }>(
        `${baseURL}/auth/refresh`,
        undefined,
        { headers: { 'Content-Type': 'application/json' }, timeout: 15000, withCredentials: true },
      );

      let finalAccessToken = data.accessToken;

      // Safety net: if the refresh returned a token without companyId but the user is
      // in a company context (token missing companyId due to a stale login cookie being
      // used for refresh), re-run switch-company to restore the scoped token.
      const decoded = decodeJwt(finalAccessToken);
      const { user } = useAuthStore.getState();
      if (!decoded?.companyId && user?.companyId) {
        const switchRes = await axios.post<{ accessToken: string; refreshToken: string }>(
          `${baseURL}/auth/switch-company`,
          { companyId: user.companyId },
          {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${finalAccessToken}`,
            },
            timeout: 15000,
            withCredentials: true,
          },
        );
        finalAccessToken = switchRes.data.accessToken;
      }

      useAuthStore.getState().updateTokenPair(finalAccessToken, data.refreshToken);
      flushQueue(null, finalAccessToken);

      original.headers.Authorization = `Bearer ${finalAccessToken}`;
      return apiClient(original);
    } catch (refreshError) {
      flushQueue(refreshError, null);
      useAuthStore.getState().clearAuth();
      void router.navigate({ to: '/login', replace: true });
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);
