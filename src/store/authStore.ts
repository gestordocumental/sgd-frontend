import { create } from 'zustand'
import type { AuthUser } from '@/types/auth'

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
    isSuperAdmin: stored.isSuperAdmin ?? false,

    setAuth: (user, accessToken, refreshToken, isSuperAdmin) => {
      localStorage.setItem(
        AUTH_KEY,
        JSON.stringify({ user, accessToken, isAuthenticated: true, isSuperAdmin } satisfies PersistedAuth),
      )
      localStorage.setItem('sgd-refresh-token', refreshToken)
      set({ user, accessToken, isAuthenticated: true, isSuperAdmin })
    },

    clearAuth: () => {
      localStorage.removeItem(AUTH_KEY)
      localStorage.removeItem('sgd-refresh-token')
      set({ user: null, accessToken: null, isAuthenticated: false, isSuperAdmin: false })
    },
  }
})
