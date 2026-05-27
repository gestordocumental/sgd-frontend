import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AuthUser } from '@/types/auth';
import type { JwtPayload } from '@/types/auth';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return { id: 'u1', email: 'a@b.com', name: 'Alice', role: 'USER', ...overrides };
}

function makePayload(overrides: Partial<JwtPayload> = {}): JwtPayload {
  return {
    sub: 'u1',
    email: 'a@b.com',
    iss: 'sgd',
    iat: 1_000_000,
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...overrides,
  };
}

// ── Mocks ─────────────────────────────────────────────────────────────────────

// Mock decodeJwt so we control token parsing without real JWTs
const mockDecodeJwt = vi.fn<(token: string) => JwtPayload | null>();

vi.mock('@/lib/jwt', () => ({
  decodeJwt: (token: string) => mockDecodeJwt(token),
}));

// Mock axios for the /auth/refresh call inside exitCompany (post-reload path)
const mockAxiosPost = vi.fn();
vi.mock('axios', () => ({
  default: { post: (...args: unknown[]) => mockAxiosPost(...args) },
}));

// ── Import store AFTER mocks are registered ───────────────────────────────────
// useAuthStore is a module-level singleton; reset it between tests via clearAuth
// which also zeroes out the module-level _superAdminToken.
import { useAuthStore } from '../authStore';

function resetStore() {
  useAuthStore.getState().clearAuth();
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('authStore — setAuth', () => {
  beforeEach(() => {
    resetStore();
    mockDecodeJwt.mockReturnValue(makePayload());
  });

  it('sets user and accessToken in state', () => {
    const user = makeUser();
    useAuthStore.getState().setAuth(user, 'access-token', 'refresh-token', false);

    const state = useAuthStore.getState();
    expect(state.user).toEqual(user);
    expect(state.accessToken).toBe('access-token');
    expect(state.isAuthenticated).toBe(true);
  });

  it('does NOT persist accessToken to localStorage (token lives in memory only)', () => {
    const user = makeUser();
    useAuthStore.getState().setAuth(user, 'access-token', 'refresh-token', false);

    const stored = JSON.parse(localStorage.getItem('sgd-auth')!);
    expect(stored.accessToken).toBeUndefined();
    expect(localStorage.getItem('sgd-refresh-token')).toBeNull();
  });

  it('persists user metadata and isAuthenticated to localStorage', () => {
    const user = makeUser();
    useAuthStore.getState().setAuth(user, 'access-token', 'refresh-token', false);

    const stored = JSON.parse(localStorage.getItem('sgd-auth')!);
    expect(stored.user).toEqual(user);
    expect(stored.isAuthenticated).toBe(true);
    expect(stored.isSuperAdmin).toBe(false);
    expect(stored.hasSuperAdminContext).toBe(false);
  });

  it('does NOT save super-admin token to a separate localStorage key', () => {
    const user = makeUser({ isSuperAdmin: true });
    useAuthStore.getState().setAuth(user, 'sa-token', 'refresh-token', true);

    // The old sgd-super-admin-token key must NOT be written
    expect(localStorage.getItem('sgd-super-admin-token')).toBeNull();
    expect(useAuthStore.getState().isSuperAdmin).toBe(true);
    // But the token IS in memory (accessToken state)
    expect(useAuthStore.getState().accessToken).toBe('sa-token');
  });
});

describe('authStore — clearAuth', () => {
  beforeEach(() => {
    resetStore();
    mockDecodeJwt.mockReturnValue(makePayload());
    useAuthStore.getState().setAuth(makeUser(), 'at', 'rt', false);
  });

  it('clears state', () => {
    useAuthStore.getState().clearAuth();
    const { user, accessToken, isAuthenticated, hasSuperAdminContext } = useAuthStore.getState();
    expect(user).toBeNull();
    expect(accessToken).toBeNull();
    expect(isAuthenticated).toBe(false);
    expect(hasSuperAdminContext).toBe(false);
  });

  it('removes sgd-auth from localStorage', () => {
    useAuthStore.getState().clearAuth();
    expect(localStorage.getItem('sgd-auth')).toBeNull();
  });
});

describe('authStore — updateTokenPair', () => {
  beforeEach(() => {
    resetStore();
    mockDecodeJwt.mockReturnValue(makePayload());
    useAuthStore.getState().setAuth(makeUser(), 'old-at', 'old-rt', false);
  });

  it('updates accessToken in state (refresh token managed by httpOnly cookie)', () => {
    mockDecodeJwt.mockReturnValue(makePayload({ isSuperAdmin: false }));
    useAuthStore.getState().updateTokenPair('new-at', 'new-rt');

    expect(useAuthStore.getState().accessToken).toBe('new-at');
    expect(localStorage.getItem('sgd-refresh-token')).toBeNull();
  });

  it('does not write the new accessToken to localStorage', () => {
    mockDecodeJwt.mockReturnValue(makePayload({ isSuperAdmin: false }));
    useAuthStore.getState().updateTokenPair('new-at', 'new-rt');

    const stored = JSON.parse(localStorage.getItem('sgd-auth')!);
    expect(stored.accessToken).toBeUndefined();
  });

  it('updates isSuperAdmin based on new token payload', () => {
    mockDecodeJwt.mockReturnValue(makePayload({ isSuperAdmin: true }));
    useAuthStore.getState().updateTokenPair('sa-at', 'sa-rt');

    expect(useAuthStore.getState().isSuperAdmin).toBe(true);
  });
});

describe('authStore — updateAccessToken', () => {
  beforeEach(() => {
    resetStore();
    mockDecodeJwt.mockReturnValue(makePayload());
    useAuthStore.getState().setAuth(makeUser(), 'old-at', 'rt', false);
  });

  it('replaces accessToken in state', () => {
    mockDecodeJwt.mockReturnValue(makePayload());
    useAuthStore.getState().updateAccessToken('newer-at');
    expect(useAuthStore.getState().accessToken).toBe('newer-at');
  });

  it('does not write the new accessToken to localStorage', () => {
    mockDecodeJwt.mockReturnValue(makePayload());
    useAuthStore.getState().updateAccessToken('newer-at');

    const stored = JSON.parse(localStorage.getItem('sgd-auth')!);
    expect(stored.accessToken).toBeUndefined();
  });
});

describe('authStore — enterCompany / exitCompany', () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
    mockDecodeJwt.mockReturnValue(makePayload({ isSuperAdmin: true }));
    useAuthStore.getState().setAuth(makeUser(), 'sa-token', 'rt', true);
  });

  it('enterCompany updates user with companyId and switches token', () => {
    mockDecodeJwt.mockReturnValue(makePayload({ isSuperAdmin: false, companyId: 'org-1' }));
    useAuthStore.getState().enterCompany('org-1', 'Acme', 'company-token');

    const { user, accessToken, hasSuperAdminContext } = useAuthStore.getState();
    expect(user?.companyId).toBe('org-1');
    expect(user?.companyName).toBe('Acme');
    expect(accessToken).toBe('company-token');
    expect(hasSuperAdminContext).toBe(true);
  });

  it('enterCompany sets hasSuperAdminContext: true in localStorage', () => {
    mockDecodeJwt.mockReturnValue(makePayload({ isSuperAdmin: false, companyId: 'org-1' }));
    useAuthStore.getState().enterCompany('org-1', 'Acme', 'company-token');

    const stored = JSON.parse(localStorage.getItem('sgd-auth')!);
    expect(stored.hasSuperAdminContext).toBe(true);
    expect(stored.accessToken).toBeUndefined();
  });

  it('exitCompany restores super-admin token from memory and returns true', async () => {
    mockDecodeJwt.mockReturnValue(makePayload({ isSuperAdmin: false, companyId: 'org-1' }));
    useAuthStore.getState().enterCompany('org-1', 'Acme', 'company-token');

    // Decode mock: restore correct behaviour per token
    mockDecodeJwt.mockImplementation((token) => {
      if (token === 'sa-token') return makePayload({ isSuperAdmin: true });
      return makePayload({ isSuperAdmin: false });
    });

    const result = await useAuthStore.getState().exitCompany();
    expect(result).toBe(true);
    expect(useAuthStore.getState().accessToken).toBe('sa-token');
    expect(useAuthStore.getState().isSuperAdmin).toBe(true);
    expect(useAuthStore.getState().hasSuperAdminContext).toBe(false);
    // localStorage should NOT have the token
    const stored = JSON.parse(localStorage.getItem('sgd-auth')!);
    expect(stored.accessToken).toBeUndefined();
    expect(stored.hasSuperAdminContext).toBe(false);
  });

  it('exitCompany calls /auth/refresh when in-memory token is gone (post-reload) and succeeds', async () => {
    // Simulate page reload: clear store (zeroes _superAdminToken) then restore
    // persisted state manually, as hydrate() would on a real reload.
    resetStore();
    useAuthStore.setState({
      user: makeUser({ companyId: 'org-1', companyName: 'Acme' }),
      isAuthenticated: true,
      hasSuperAdminContext: true,
    });

    mockAxiosPost.mockResolvedValue({
      data: { accessToken: 'refreshed-sa-token', refreshToken: 'new-rt' },
    });
    mockDecodeJwt.mockReturnValue(makePayload({ isSuperAdmin: true }));

    const result = await useAuthStore.getState().exitCompany();

    expect(mockAxiosPost).toHaveBeenCalledWith(
      expect.stringContaining('/auth/refresh'),
      undefined,
      expect.objectContaining({ withCredentials: true }),
    );
    expect(result).toBe(true);
    expect(useAuthStore.getState().accessToken).toBe('refreshed-sa-token');
    expect(useAuthStore.getState().isSuperAdmin).toBe(true);
    expect(useAuthStore.getState().hasSuperAdminContext).toBe(false);
  });

  it('exitCompany returns false when no in-memory token and /auth/refresh fails', async () => {
    resetStore();
    useAuthStore.setState({ hasSuperAdminContext: true });
    mockAxiosPost.mockRejectedValue(new Error('Network error'));

    const result = await useAuthStore.getState().exitCompany();
    expect(result).toBe(false);
  });
});
