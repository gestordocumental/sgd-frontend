import { create } from 'zustand'
import type { AuthUser } from '@/types/auth'

const AUTH_KEY = 'sgd-auth'

interface PersistedAuth {
  user: AuthUser
  accessToken: string
  isAuthenticated: boolean
}

interface AuthStore {
  user: AuthUser | null
  accessToken: string | null
  isAuthenticated: boolean
  setAuth: (user: AuthUser, accessToken: string, refreshToken: string) => void
  clearAuth: () => void
}

function hydrate(): Partial<PersistedAuth> {
  const raw = localStorage.getItem(AUTH_KEY)
  if (!raw) return {}
  try {
    return JSON.parse(raw)
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

    setAuth: (user, accessToken, refreshToken) => {
      localStorage.setItem(AUTH_KEY, JSON.stringify({ user, accessToken, isAuthenticated: true } satisfies PersistedAuth))
      localStorage.setItem('sgd-refresh-token', refreshToken)
      set({ user, accessToken, isAuthenticated: true })
    },

    clearAuth: () => {
      localStorage.removeItem(AUTH_KEY)
      localStorage.removeItem('sgd-refresh-token')
      set({ user: null, accessToken: null, isAuthenticated: false })
    },
  }
})
