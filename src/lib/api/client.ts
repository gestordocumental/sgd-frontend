import axios from 'axios';
import axiosRetry from 'axios-retry';
import { useAuthStore } from '@/store/authStore';
import { router } from '@/router';
import { decodeJwt } from '@/lib/jwt';

const baseURL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

const CSRF_COOKIE = 'sgd_csrf_token';
const CSRF_HEADER = 'x-csrf-token';
const CSRF_STORAGE_KEY = 'sgd_csrf';

// Evict the stale CSRF cookie that was previously set with path=/api/v1/auth.
// Without this the browser sends BOTH the old and new cookies; the backend's old
// code picked the more-specific-path one first, causing an "Invalid CSRF token" 401.
// This one-time cleanup runs on every module load (no-op once the old cookie is gone).
document.cookie = `${CSRF_COOKIE}=; path=/api/v1/auth; max-age=0; samesite=strict`;

// In-memory cache — fastest path. sessionStorage survives page reloads (same tab).
let _csrfToken: string | null = null;

function getCsrfToken(): string | null {
  if (_csrfToken) return _csrfToken;
  const stored = sessionStorage.getItem(CSRF_STORAGE_KEY);
  if (stored) {
    _csrfToken = stored;
    return stored;
  }
  // Fallback: cookie is readable after a fresh login with the updated backend
  // (cookie path is now '/').
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${CSRF_COOKIE}=([^;]+)`));
  if (match) {
    const val = decodeURIComponent(match[1]);
    _csrfToken = val;
    sessionStorage.setItem(CSRF_STORAGE_KEY, val);
    return val;
  }
  return null;
}

export function storeCsrfToken(token: string): void {
  _csrfToken = token;
  sessionStorage.setItem(CSRF_STORAGE_KEY, token);
}

// Paths checked against the end of the request URL (baseURL-independent)
const PUBLIC_PATHS = [
  '/auth/login',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/users/complete-registration',
];
// Paths that must NOT trigger a silent refresh on 401 (would cause infinite loops)
const SKIP_REFRESH_PATHS = [
  '/auth/refresh',
  '/auth/exit-company',
  '/auth/login',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/users/complete-registration',
];

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

// Adjunta el JWT y el CSRF token en cada request autenticada.
apiClient.interceptors.request.use((config) => {
  if (isPublicEndpoint(config.url)) {
    delete config.headers.Authorization;
    return config;
  }

  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Double-submit CSRF token for state-changing requests.
  const method = config.method?.toUpperCase();
  if (method && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const csrf = getCsrfToken();
    if (csrf) config.headers[CSRF_HEADER] = csrf;
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

// Capture the csrfToken from any auth response (login, switch-company, exit-company)
// so it's available in sessionStorage on the next page load.
apiClient.interceptors.response.use((response) => {
  const csrf = (response.data as { csrfToken?: string })?.csrfToken;
  if (csrf) storeCsrfToken(csrf);
  return response;
});

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
      // x-csrf-token echoes the non-httpOnly sgd_csrf_token cookie to satisfy the
      // double-submit CSRF check on the /auth/refresh endpoint.
      const csrfToken = getCsrfToken();
      console.debug('[auth:refresh] CSRF token', csrfToken ? '✓ present' : '✗ missing');
      const { data } = await axios.post<{ accessToken: string; csrfToken?: string }>(
        `${baseURL}/auth/refresh`,
        undefined,
        {
          headers: {
            'Content-Type': 'application/json',
            ...(csrfToken && { [CSRF_HEADER]: csrfToken }),
          },
          timeout: 15000,
          withCredentials: true,
        },
      );

      let finalAccessToken = data.accessToken;

      // Persist the fresh CSRF token so the next page reload can send it in the header.
      if (data.csrfToken) storeCsrfToken(data.csrfToken);

      // Safety net: if the refresh returned a token without companyId but the user is
      // in a company context (token missing companyId due to a stale login cookie being
      // used for refresh), re-run switch-company to restore the scoped token.
      const decoded = decodeJwt(finalAccessToken);
      const { user } = useAuthStore.getState();
      if (!decoded?.companyId && user?.companyId) {
        const switchRes = await axios.post<{ accessToken: string; csrfToken?: string }>(
          `${baseURL}/auth/switch-company`,
          { companyId: user.companyId },
          {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${finalAccessToken}`,
              // switch-company bypasses apiClient so we attach the CSRF header manually.
              ...(csrfToken && { [CSRF_HEADER]: csrfToken }),
            },
            timeout: 15000,
            withCredentials: true,
          },
        );
        finalAccessToken = switchRes.data.accessToken;
        if (switchRes.data.csrfToken) storeCsrfToken(switchRes.data.csrfToken);
      }

      useAuthStore.getState().updateAccessToken(finalAccessToken);
      flushQueue(null, finalAccessToken);

      original.headers.Authorization = `Bearer ${finalAccessToken}`;
      return apiClient(original);
    } catch (refreshError) {
      const status = (refreshError as { response?: { status?: number } })?.response?.status;
      console.error('[auth:refresh] Silent refresh failed', { status });
      flushQueue(refreshError, null);
      useAuthStore.getState().clearAuth();
      void router.navigate({ to: '/login', replace: true });
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);
