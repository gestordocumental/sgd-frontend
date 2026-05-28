import { create } from 'zustand';
import axios from 'axios';
import type { AuthUser } from '@/types/auth';
import { decodeJwt } from '@/lib/jwt';

const AUTH_KEY = 'sgd-auth';

// sessionStorage key for the global super-admin refresh token.
// sessionStorage is used (not localStorage) so it is scoped to the tab and
// cleared automatically when the tab is closed.  It survives page refreshes,
// which is the critical difference from the in-memory variable: after a
// reload the refresh cookie is company-scoped, so exitCompany() needs this
// token to call /auth/refresh with a body parameter and obtain a global token.
const SA_REFRESH_KEY = 'sgd-sar';

// ── In-memory token storage ────────────────────────────────────────────────
// Access tokens are NOT written to localStorage.  If an XSS payload runs
// it cannot read the token via localStorage.getItem().  The httpOnly
// refresh-token cookie lets the silent-refresh interceptor (client.ts)
// renew the access token on every 401 or page reload.
//
// The super-admin tokens are kept in module-level variables so that
// enterCompany() / exitCompany() works within the same tab session.
// After a page reload the access token is re-obtained via /auth/refresh.
// The refresh token backup allows exitCompany() to recover a global token
// even after the access token has expired during a company context session.
let _superAdminToken: string | null = null;
// Initialized from sessionStorage so exitCompany() can recover a global
// token even after a page refresh (when the cookie is company-scoped).
let _superAdminRefreshToken: string | null = sessionStorage.getItem(SA_REFRESH_KEY);

interface PersistedAuth {
  user: AuthUser;
  isAuthenticated: boolean;
  isSuperAdmin: boolean;
  /** true while a super-admin is in a company context and can return to global view */
  hasSuperAdminContext: boolean;
}

interface AuthStore {
  user: AuthUser | null;
  /** Memory-only — never written to localStorage */
  accessToken: string | null;
  isAuthenticated: boolean;
  isSuperAdmin: boolean;
  /** Persisted flag: true when the super-admin has entered a company context */
  hasSuperAdminContext: boolean;
  setAuth: (
    user: AuthUser,
    accessToken: string,
    refreshToken: string,
    isSuperAdmin: boolean,
  ) => void;
  updateAccessToken: (accessToken: string) => void;
  /** Updates both access and refresh tokens after a silent refresh */
  updateTokenPair: (accessToken: string, refreshToken: string) => void;
  clearAuth: () => void;
  /** Switch into a company context */
  enterCompany: (
    companyId: string,
    companyName: string,
    companyToken: string,
    refreshToken?: string,
  ) => void;
  /** Restore the global super-admin context. Returns false if restoration fails. */
  exitCompany: () => Promise<boolean>;
}

function hydrate(): Partial<
  Pick<PersistedAuth, 'user' | 'isAuthenticated' | 'isSuperAdmin' | 'hasSuperAdminContext'>
> {
  const raw = localStorage.getItem(AUTH_KEY);
  if (!raw) return {};
  try {
    const parsed: PersistedAuth = JSON.parse(raw);
    if (!parsed.user || !parsed.isAuthenticated) return {};
    return {
      user: parsed.user,
      isAuthenticated: parsed.isAuthenticated,
      isSuperAdmin: parsed.isSuperAdmin ?? false,
      hasSuperAdminContext: parsed.hasSuperAdminContext ?? false,
    };
  } catch {
    return {};
  }
}

function readPersistedAuth(): PersistedAuth | null {
  const raw = localStorage.getItem(AUTH_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PersistedAuth;
  } catch {
    return null;
  }
}

const _baseURL = () => import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

export const useAuthStore = create<AuthStore>()((set, get) => {
  const stored = hydrate();
  return {
    user: stored.user ?? null,
    accessToken: null, // always null at init; filled by login or silent refresh
    isAuthenticated: stored.isAuthenticated ?? false,
    isSuperAdmin: stored.isSuperAdmin ?? false,
    hasSuperAdminContext: stored.hasSuperAdminContext ?? false,

    setAuth: (user, accessToken, refreshToken, isSuperAdmin) => {
      localStorage.setItem(
        AUTH_KEY,
        JSON.stringify({
          user,
          isAuthenticated: true,
          isSuperAdmin,
          hasSuperAdminContext: false,
        } satisfies PersistedAuth),
      );
      // Keep the global tokens in memory so enterCompany + exitCompany works
      // within the same tab session without touching localStorage.
      // The refresh token backup lets exitCompany() recover a global token
      // even when the access token has expired mid-company-session.
      if (isSuperAdmin && !user.companyId) {
        _superAdminToken = accessToken;
        _superAdminRefreshToken = refreshToken;
        sessionStorage.setItem(SA_REFRESH_KEY, refreshToken);
      }
      set({ user, accessToken, isAuthenticated: true, isSuperAdmin, hasSuperAdminContext: false });
    },

    updateAccessToken: (accessToken) => {
      const decoded = decodeJwt(accessToken);
      const isSuperAdmin = decoded?.isSuperAdmin === true;
      const raw = localStorage.getItem(AUTH_KEY);
      if (raw) {
        try {
          const existing: PersistedAuth = JSON.parse(raw);
          localStorage.setItem(AUTH_KEY, JSON.stringify({ ...existing, isSuperAdmin }));
        } catch {
          /* ignore */
        }
      }
      const { user } = get();
      if (isSuperAdmin && !user?.companyId) {
        _superAdminToken = accessToken;
      }
      set({ accessToken, isSuperAdmin });
    },

    updateTokenPair: (accessToken, refreshToken) => {
      const decoded = decodeJwt(accessToken);
      const isSuperAdmin = decoded?.isSuperAdmin === true;
      const raw = localStorage.getItem(AUTH_KEY);
      if (raw) {
        try {
          const existing: PersistedAuth = JSON.parse(raw);
          localStorage.setItem(AUTH_KEY, JSON.stringify({ ...existing, isSuperAdmin }));
        } catch {
          /* ignore */
        }
      }
      const { user } = get();
      if (isSuperAdmin && !user?.companyId) {
        // Keep both tokens in sync so exitCompany() always has a valid
        // global refresh token even after the access token has been silently
        // renewed one or more times while in the global (non-company) context.
        _superAdminToken = accessToken;
        _superAdminRefreshToken = refreshToken;
        sessionStorage.setItem(SA_REFRESH_KEY, refreshToken);
      }
      set({ accessToken, isSuperAdmin });
    },

    clearAuth: () => {
      localStorage.removeItem(AUTH_KEY);
      sessionStorage.removeItem(SA_REFRESH_KEY);
      _superAdminToken = null;
      _superAdminRefreshToken = null;
      set({
        user: null,
        accessToken: null,
        isAuthenticated: false,
        isSuperAdmin: false,
        hasSuperAdminContext: false,
      });
    },

    enterCompany: (companyId, companyName, companyToken, _refreshToken?) => {
      const stored = readPersistedAuth();
      if (!stored) return;
      // Capture the current in-memory access token before it is replaced
      const { accessToken: currentToken } = get();
      if (currentToken && !_superAdminToken) {
        _superAdminToken = currentToken;
      }
      const decoded = decodeJwt(companyToken);
      const isSuperAdmin = decoded?.isSuperAdmin === true;
      const updatedUser: AuthUser = { ...stored.user, companyId, companyName };
      localStorage.setItem(
        AUTH_KEY,
        JSON.stringify({
          user: updatedUser,
          isAuthenticated: true,
          isSuperAdmin,
          hasSuperAdminContext: true,
        } satisfies PersistedAuth),
      );
      set({
        user: updatedUser,
        accessToken: companyToken,
        isSuperAdmin,
        hasSuperAdminContext: true,
      });
    },

    exitCompany: async () => {
      const { user } = get();

      // --- Obtain a live global super-admin token ---
      // Strategy (in order):
      //   1. Cached access token (_superAdminToken) — fast path, same-session.
      //   2. Cached global refresh token (_superAdminRefreshToken) — handles the
      //      common case where the access token expired during a long company
      //      session.  Sent in the request body so the cookie (company-scoped)
      //      is not used.
      //   3. Cookie-based /auth/refresh — post-reload fallback when both
      //      in-memory tokens are gone (the cookie holds whatever token was last
      //      issued, which may or may not be global).
      let globalToken = _superAdminToken;

      // Step 1: discard the cached access token if it is expired or not global.
      // Without this check an expired-but-truthy string would bypass step 2/3.
      if (globalToken) {
        const decoded = decodeJwt(globalToken);
        const isExpired =
          !decoded || typeof decoded.exp !== 'number' || decoded.exp * 1000 < Date.now();
        if (isExpired || decoded?.isSuperAdmin !== true) {
          globalToken = null;
          _superAdminToken = null;
        }
      }

      // Step 2: renew using the stored global refresh token (body, not cookie).
      // _superAdminRefreshToken survives page refreshes via sessionStorage (SA_REFRESH_KEY).
      let newRefreshToken: string | null = null;
      if (!globalToken && _superAdminRefreshToken) {
        try {
          const { data } = await axios.post<{ accessToken: string; refreshToken: string }>(
            `${_baseURL()}/auth/refresh`,
            { refreshToken: _superAdminRefreshToken },
            {
              headers: { 'Content-Type': 'application/json' },
              timeout: 15000,
              withCredentials: true,
            },
          );
          globalToken = data.accessToken;
          newRefreshToken = data.refreshToken;
          _superAdminToken = data.accessToken;
          _superAdminRefreshToken = data.refreshToken;
        } catch {
          _superAdminRefreshToken = null;
          sessionStorage.removeItem(SA_REFRESH_KEY);
          // Fall through to the cookie-based path.
        }
      }

      // Step 3: cookie-based fallback (post-reload, in-memory state is gone).
      if (!globalToken) {
        try {
          const { data } = await axios.post<{ accessToken: string; refreshToken: string }>(
            `${_baseURL()}/auth/refresh`,
            undefined,
            {
              headers: { 'Content-Type': 'application/json' },
              timeout: 15000,
              withCredentials: true,
            },
          );
          globalToken = data.accessToken;
          newRefreshToken = data.refreshToken;
        } catch {
          return false;
        }
      }

      // Validate the token we ended up with is a live super-admin global token.
      const decoded = decodeJwt(globalToken);
      if (
        !decoded ||
        typeof decoded.exp !== 'number' ||
        decoded.exp * 1000 < Date.now() ||
        decoded.isSuperAdmin !== true ||
        decoded.companyId // reject company-scoped tokens
      ) {
        _superAdminToken = null;
        _superAdminRefreshToken = null;
        sessionStorage.removeItem(SA_REFRESH_KEY);
        return false;
      }

      const stored = readPersistedAuth();
      const baseUser = stored?.user ?? user;
      const updatedUser: AuthUser = {
        ...baseUser!,
        companyId: undefined,
        companyName: undefined,
      };
      localStorage.setItem(
        AUTH_KEY,
        JSON.stringify({
          user: updatedUser,
          isAuthenticated: true,
          isSuperAdmin: true,
          hasSuperAdminContext: false,
        } satisfies PersistedAuth),
      );
      // Retain global token in memory for the next enterCompany cycle.
      // Also persist the new refresh token so a subsequent page refresh
      // keeps the super-admin context recoverable.
      _superAdminToken = globalToken;
      if (newRefreshToken) {
        _superAdminRefreshToken = newRefreshToken;
        sessionStorage.setItem(SA_REFRESH_KEY, newRefreshToken);
      }
      set({
        user: updatedUser,
        accessToken: globalToken,
        isSuperAdmin: true,
        hasSuperAdminContext: false,
      });
      return true;
    },
  };
});
