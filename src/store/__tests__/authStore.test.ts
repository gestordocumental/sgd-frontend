import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { AuthUser } from '@/types/auth'
import type { JwtPayload } from '@/types/auth'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return { id: 'u1', email: 'a@b.com', name: 'Alice', role: 'USER', ...overrides }
}

function makePayload(overrides: Partial<JwtPayload> = {}): JwtPayload {
  return {
    sub: 'u1',
    email: 'a@b.com',
    iss: 'sgd',
    iat: 1_000_000,
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...overrides,
  }
}

// ── Mocks ─────────────────────────────────────────────────────────────────────

// Mock decodeJwt so we control token parsing without real JWTs
const mockDecodeJwt = vi.fn<[string], JwtPayload | null>()

vi.mock('@/lib/jwt', () => ({
  decodeJwt: (token: string) => mockDecodeJwt(token),
}))

// ── Import store AFTER mocks are registered ───────────────────────────────────
// useAuthStore is a module-level singleton; we need to reset it between tests.
import { useAuthStore } from '../authStore'

function resetStore() {
  useAuthStore.setState({
    user: null,
    accessToken: null,
    isAuthenticated: false,
    isSuperAdmin: false,
  })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('authStore — setAuth', () => {
  beforeEach(() => {
    resetStore()
    mockDecodeJwt.mockReturnValue(makePayload())
  })

  it('sets user and accessToken in state', () => {
    const user = makeUser()
    useAuthStore.getState().setAuth(user, 'access-token', 'refresh-token', false)

    const state = useAuthStore.getState()
    expect(state.user).toEqual(user)
    expect(state.accessToken).toBe('access-token')
    expect(state.isAuthenticated).toBe(true)
  })

  it('persists to localStorage', () => {
    const user = makeUser()
    useAuthStore.getState().setAuth(user, 'access-token', 'refresh-token', false)

    expect(localStorage.getItem('sgd-refresh-token')).toBe('refresh-token')
    const stored = JSON.parse(localStorage.getItem('sgd-auth')!)
    expect(stored.accessToken).toBe('access-token')
  })

  it('saves super-admin token to a separate key when isSuperAdmin is true', () => {
    const user = makeUser({ isSuperAdmin: true })
    useAuthStore.getState().setAuth(user, 'sa-token', 'refresh-token', true)

    expect(localStorage.getItem('sgd-super-admin-token')).toBe('sa-token')
    expect(useAuthStore.getState().isSuperAdmin).toBe(true)
  })
})

describe('authStore — clearAuth', () => {
  beforeEach(() => {
    resetStore()
    mockDecodeJwt.mockReturnValue(makePayload())
    useAuthStore.getState().setAuth(makeUser(), 'at', 'rt', false)
  })

  it('clears state', () => {
    useAuthStore.getState().clearAuth()
    const { user, accessToken, isAuthenticated } = useAuthStore.getState()
    expect(user).toBeNull()
    expect(accessToken).toBeNull()
    expect(isAuthenticated).toBe(false)
  })

  it('removes all auth keys from localStorage', () => {
    useAuthStore.getState().clearAuth()
    expect(localStorage.getItem('sgd-auth')).toBeNull()
    expect(localStorage.getItem('sgd-refresh-token')).toBeNull()
  })
})

describe('authStore — updateTokenPair', () => {
  beforeEach(() => {
    resetStore()
    mockDecodeJwt.mockReturnValue(makePayload())
    useAuthStore.getState().setAuth(makeUser(), 'old-at', 'old-rt', false)
  })

  it('updates accessToken in state and refresh token in localStorage', () => {
    mockDecodeJwt.mockReturnValue(makePayload({ isSuperAdmin: false }))
    useAuthStore.getState().updateTokenPair('new-at', 'new-rt')

    expect(useAuthStore.getState().accessToken).toBe('new-at')
    expect(localStorage.getItem('sgd-refresh-token')).toBe('new-rt')
  })

  it('updates isSuperAdmin based on new token payload', () => {
    mockDecodeJwt.mockReturnValue(makePayload({ isSuperAdmin: true }))
    useAuthStore.getState().updateTokenPair('sa-at', 'sa-rt')

    expect(useAuthStore.getState().isSuperAdmin).toBe(true)
  })
})

describe('authStore — updateAccessToken', () => {
  beforeEach(() => {
    resetStore()
    mockDecodeJwt.mockReturnValue(makePayload())
    useAuthStore.getState().setAuth(makeUser(), 'old-at', 'rt', false)
  })

  it('replaces accessToken in state', () => {
    mockDecodeJwt.mockReturnValue(makePayload())
    useAuthStore.getState().updateAccessToken('newer-at')
    expect(useAuthStore.getState().accessToken).toBe('newer-at')
  })
})

describe('authStore — enterCompany / exitCompany', () => {
  beforeEach(() => {
    resetStore()
    mockDecodeJwt.mockReturnValue(makePayload({ isSuperAdmin: true }))
    useAuthStore.getState().setAuth(makeUser(), 'sa-token', 'rt', true)
  })

  it('enterCompany updates user with companyId and switches token', () => {
    mockDecodeJwt.mockReturnValue(makePayload({ isSuperAdmin: false, companyId: 'org-1' }))
    useAuthStore.getState().enterCompany('org-1', 'Acme', 'company-token')

    const { user, accessToken } = useAuthStore.getState()
    expect(user?.companyId).toBe('org-1')
    expect(user?.companyName).toBe('Acme')
    expect(accessToken).toBe('company-token')
  })

  it('exitCompany restores super-admin token and returns true', () => {
    mockDecodeJwt.mockReturnValue(makePayload({ isSuperAdmin: false, companyId: 'org-1' }))
    useAuthStore.getState().enterCompany('org-1', 'Acme', 'company-token')

    // Mock decode for sa-token (valid, not expired, isSuperAdmin: true)
    mockDecodeJwt.mockImplementation((token) => {
      if (token === 'sa-token') return makePayload({ isSuperAdmin: true })
      return makePayload({ isSuperAdmin: false })
    })

    const result = useAuthStore.getState().exitCompany()
    expect(result).toBe(true)
    expect(useAuthStore.getState().accessToken).toBe('sa-token')
    expect(useAuthStore.getState().isSuperAdmin).toBe(true)
  })

  it('exitCompany returns false when no super-admin token exists', () => {
    localStorage.removeItem('sgd-super-admin-token')
    const result = useAuthStore.getState().exitCompany()
    expect(result).toBe(false)
  })
})
