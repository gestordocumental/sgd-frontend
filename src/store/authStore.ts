import { create } from 'zustand'
import type { AuthUser } from '@/types/auth'
import { decodeJwt } from '@/lib/jwt'

const AUTH_KEY = 'sgd-auth'
const SUPER_ADMIN_TOKEN_KEY = 'sgd-super-admin-token'

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
  /** Switch into a company context (saves current token as super-admin token if applicable) */
  enterCompany: (companyId: string, companyName: string, companyToken: string) => void
  /** Restore the global super-admin context */
  exitCompany: () => boolean
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
    return { ...parsed, isSuperAdmin: decoded.isSuperAdmin === true }
  } catch {
    return {}
  }
}

export const useAuthStore = create<AuthStore>()((set, get) => {
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
      // Persist the global token so we can restore it after entering a company
      if (isSuperAdmin) {
        localStorage.setItem(SUPER_ADMIN_TOKEN_KEY, accessToken)
      }
      set({ user, accessToken, isAuthenticated: true, isSuperAdmin })
    },

    updateAccessToken: (accessToken) => {
      const decoded = decodeJwt(accessToken)
      const isSuperAdmin = decoded?.isSuperAdmin === true
      const raw = localStorage.getItem(AUTH_KEY)
      if (raw) {
        try {
          localStorage.setItem(AUTH_KEY, JSON.stringify({ ...JSON.parse(raw), accessToken, isSuperAdmin }))
        } catch { /* ignore */ }
      }
      const { user } = get()
      if (isSuperAdmin && !user?.companyId) {
        localStorage.setItem(SUPER_ADMIN_TOKEN_KEY, accessToken)
      }
      set({ accessToken, isSuperAdmin })
    },

    clearAuth: () => {
      localStorage.removeItem(AUTH_KEY)
      localStorage.removeItem('sgd-refresh-token')
      localStorage.removeItem(SUPER_ADMIN_TOKEN_KEY)
      set({ user: null, accessToken: null, isAuthenticated: false, isSuperAdmin: false })
    },

    enterCompany: (companyId, companyName, companyToken) => {
      const raw = localStorage.getItem(AUTH_KEY)
      const stored: PersistedAuth | null = raw ? JSON.parse(raw) : null
      if (!stored) return
      const decoded = decodeJwt(companyToken)
      const updatedUser: AuthUser = { ...stored.user, companyId, companyName }
      const isSuperAdmin = decoded?.isSuperAdmin === true
      localStorage.setItem(
        AUTH_KEY,
        JSON.stringify({ user: updatedUser, accessToken: companyToken, isAuthenticated: true, isSuperAdmin } satisfies PersistedAuth),
      )
      set({ user: updatedUser, accessToken: companyToken, isSuperAdmin })
    },

    exitCompany: () => {
      const superAdminToken = localStorage.getItem(SUPER_ADMIN_TOKEN_KEY)
      if (!superAdminToken) return false
      const raw = localStorage.getItem(AUTH_KEY)
      const stored: PersistedAuth | null = raw ? JSON.parse(raw) : null
      if (!stored) return false
      const decoded = decodeJwt(superAdminToken)
      const updatedUser: AuthUser = { ...stored.user, companyId: undefined, companyName: undefined }
      const isSuperAdmin = decoded?.isSuperAdmin === true
      localStorage.setItem(
        AUTH_KEY,
        JSON.stringify({ user: updatedUser, accessToken: superAdminToken, isAuthenticated: true, isSuperAdmin } satisfies PersistedAuth),
      )
      set({ user: updatedUser, accessToken: superAdminToken, isSuperAdmin })
      return true
    },
  }
})
