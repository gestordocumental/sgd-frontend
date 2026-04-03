import { create } from 'zustand'
import type { AuthUser } from '@/types/auth'
import { decodeJwt } from '@/lib/jwt'

const AUTH_KEY = 'sgd-auth'

interface PersistedAuth {
  user: AuthUser
  accessToken: string
  isAuthenticated: boolean
  isSuperAdmin: boolean
}

interface AuthStore {
  user: AuthUser | null
  accessToken: string | null
  isAuthenticated: boolean
  isSuperAdmin: boolean
  setAuth: (user: AuthUser, accessToken: string, refreshToken: string, isSuperAdmin: boolean) => void
  updateAccessToken: (accessToken: string) => void
  clearAuth: () => void
}

function hydrate(): Partial<PersistedAuth> {
  const raw = localStorage.getItem(AUTH_KEY)
  if (!raw) return {}
  try {
    const parsed: PersistedAuth = JSON.parse(raw)
    const decoded = decodeJwt(parsed.accessToken)
    if (!decoded || decoded.exp * 1000 < Date.now()) {
      localStorage.removeItem(AUTH_KEY)
      localStorage.removeItem('sgd-refresh-token')
      return {}
    }
    return parsed
  } catch {
    return {}
  }
}

export const useAuthStore = create<AuthStore>()((set) => {
  const stored = hydrate()
  return {
    user: stored.user ?? null,
    accessToken: stored.accessToken ?? null,
    isAuthenticated: stored.isAuthenticated ?? false,
    isSuperAdmin: stored.isSuperAdmin ?? false,

    setAuth: (user, accessToken, refreshToken, isSuperAdmin) => {
      localStorage.setItem(
        AUTH_KEY,
        JSON.stringify({ user, accessToken, isAuthenticated: true, isSuperAdmin } satisfies PersistedAuth),
      )
      localStorage.setItem('sgd-refresh-token', refreshToken)
      set({ user, accessToken, isAuthenticated: true, isSuperAdmin })
    },

    updateAccessToken: (accessToken) => {
      const raw = localStorage.getItem(AUTH_KEY)
      if (raw) {
        try {
          localStorage.setItem(AUTH_KEY, JSON.stringify({ ...JSON.parse(raw), accessToken }))
        } catch { /* ignore */ }
      }
      set({ accessToken })
    },

    clearAuth: () => {
      localStorage.removeItem(AUTH_KEY)
      localStorage.removeItem('sgd-refresh-token')
      set({ user: null, accessToken: null, isAuthenticated: false, isSuperAdmin: false })
    },
  }
})
