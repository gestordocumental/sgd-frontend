import axios from 'axios'
import axiosRetry from 'axios-retry'
import { useAuthStore } from '@/store/authStore'

const baseURL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'
// Paths checked against the end of the request URL (baseURL-independent)
const PUBLIC_PATHS = ['/auth/login', '/users/complete-registration']
// Paths that must NOT trigger a silent refresh on 401 (would cause infinite loops)
const SKIP_REFRESH_PATHS = ['/auth/refresh', '/auth/login', '/users/complete-registration']

function isPublicEndpoint(url?: string) {
  if (!url) return false
  return PUBLIC_PATHS.some((p) => url === p || url.endsWith(p))
}

function shouldSkipRefresh(url?: string) {
  if (!url) return true
  return SKIP_REFRESH_PATHS.some((p) => url === p || url.endsWith(p))
}

export const apiClient = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
})

// Retry automático para errores de red transitorios y respuestas 5xx.
// Excluye errores 4xx (son definitivos — no vale la pena reintentar).
axiosRetry(apiClient, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error) =>
    axiosRetry.isNetworkError(error) ||
    (error.response !== undefined && error.response.status >= 500),
})

// Adjunta el JWT en cada request autenticada.
apiClient.interceptors.request.use((config) => {
  if (isPublicEndpoint(config.url)) {
    delete config.headers.Authorization
    return config
  }

  const token = useAuthStore.getState().accessToken
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// ── Silent refresh ────────────────────────────────────────────────────────────
// When a 401 is received on a protected endpoint:
//   1. Attempt to refresh using the stored refresh token.
//   2. On success: update both tokens and retry the original request.
//   3. On failure: clear auth and redirect to /login.
// Concurrent requests that arrive while a refresh is in flight are queued and
// replayed with the new token once the refresh completes.

interface QueueEntry {
  resolve: (token: string) => void
  reject: (err: unknown) => void
}

let isRefreshing = false
let pendingQueue: QueueEntry[] = []

function flushQueue(error: unknown, token: string | null) {
  pendingQueue.forEach((entry) => {
    if (error) entry.reject(error)
    else entry.resolve(token!)
  })
  pendingQueue = []
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config as typeof error.config & { _retry?: boolean }
    const status: number | undefined = error.response?.status

    // Only intercept 401s on protected endpoints, and only once per request
    if (status !== 401 || shouldSkipRefresh(original?.url) || original?._retry) {
      return Promise.reject(error)
    }

    // If a refresh is already in flight, queue this request
    if (isRefreshing) {
      return new Promise<string>((resolve, reject) => {
        pendingQueue.push({ resolve, reject })
      }).then((newToken) => {
        original.headers.Authorization = `Bearer ${newToken}`
        return apiClient(original)
      })
    }

    original._retry = true
    isRefreshing = true

    try {
      const storedRefresh = localStorage.getItem('sgd-refresh-token')
      if (!storedRefresh) throw new Error('no_refresh_token')

      // Use a plain axios call (not apiClient) to avoid triggering this interceptor again
      const { data } = await axios.post<{ accessToken: string; refreshToken: string }>(
        `${baseURL}/auth/refresh`,
        { refreshToken: storedRefresh },
        { headers: { 'Content-Type': 'application/json' }, timeout: 15000 },
      )

      useAuthStore.getState().updateTokenPair(data.accessToken, data.refreshToken)
      flushQueue(null, data.accessToken)

      original.headers.Authorization = `Bearer ${data.accessToken}`
      return apiClient(original)
    } catch (refreshError) {
      flushQueue(refreshError, null)
      useAuthStore.getState().clearAuth()
      window.location.href = '/login'
      return Promise.reject(refreshError)
    } finally {
      isRefreshing = false
    }
  },
)
