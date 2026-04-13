import axios from 'axios'
import { useAuthStore } from '@/store/authStore'

const baseURL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'
// Paths checked against the end of the request URL (baseURL-independent)
const PUBLIC_PATHS = ['/auth/login', '/users/complete-registration']

function isPublicEndpoint(url?: string) {
  if (!url) return false
  return PUBLIC_PATHS.some((p) => url === p || url.endsWith(p))
}

export const apiClient = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
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

// Si el servidor responde 401 en endpoints protegidos, limpia la sesiÃ³n y redirige al login.
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const isPublicRequest = isPublicEndpoint(error.config?.url)
    if (error.response?.status === 401 && !isPublicRequest) {
      useAuthStore.getState().clearAuth()
      window.location.href = '/login'
    }
    return Promise.reject(error)
  },
)
