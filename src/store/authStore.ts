import { create } from 'zustand';
import axios from 'axios';
import * as Sentry from '@sentry/react';
import type { AuthUser } from '@/types/auth';
import { decodeJwt } from '@/lib/jwt';

function sentryUser(user: AuthUser): Parameters<typeof Sentry.setUser>[0] {
  return { id: user.id, email: user.email, companyId: user.companyId ?? null };
}

const AUTH_KEY = 'sgd-auth';
const COMPANIES_CACHE_KEY = 'sgd-companies-cache';
const CSRF_STORAGE_KEY = 'sgd_csrf';
const CSRF_COOKIE_NAME = 'sgd_csrf_token';

function readCsrfToken(): string | null {
  const stored = sessionStorage.getItem(CSRF_STORAGE_KEY);
  if (stored) return stored;
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${CSRF_COOKIE_NAME}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

// ── In-memory token storage ────────────────────────────────────────────────
// Access tokens are NOT written to localStorage.  If an XSS payload runs
// it cannot read the token via localStorage.getItem().  The httpOnly
// refresh-token cookie lets the silent-refresh interceptor (client.ts)
// renew the access token on every 401 or page reload.
//
// The super-admin access token is kept in a module-level variable so that
// enterCompany() / exitCompany() works within the same tab session.
// After a page reload exitCompany() calls /auth/exit-company, which uses the
// httpOnly company cookie and the server-side stored global refresh token.
let _superAdminToken: string | null = null;

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
  setAuth: (user: AuthUser, accessToken: string, isSuperAdmin: boolean) => void;
  updateAccessToken: (accessToken: string) => void;
  clearAuth: () => void;
  /** Switch into a company context */
  enterCompany: (companyId: string, companyName: string, companyToken: string) => void;
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

    setAuth: (user, accessToken, isSuperAdmin) => {
      localStorage.setItem(
        AUTH_KEY,
        JSON.stringify({
          user,
          isAuthenticated: true,
          isSuperAdmin,
          hasSuperAdminContext: false,
        } satisfies PersistedAuth),
      );
      // Keep the global token in memory so enterCompany + exitCompany works
      // within the same tab session without touching localStorage.
      if (isSuperAdmin && !user.companyId) {
        _superAdminToken = accessToken;
      }
      Sentry.setUser(sentryUser(user));
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

    clearAuth: () => {
      localStorage.removeItem(AUTH_KEY);
      localStorage.removeItem(COMPANIES_CACHE_KEY);
      _superAdminToken = null;
      Sentry.setUser(null);
      set({
        user: null,
        accessToken: null,
        isAuthenticated: false,
        isSuperAdmin: false,
        hasSuperAdminContext: false,
      });
    },

    enterCompany: (companyId, companyName, companyToken) => {
      const stored = readPersistedAuth();
      if (!stored) return;
      // Capture the current in-memory access token before it is replaced
      const {
        accessToken: currentToken,
        isSuperAdmin: wasAdmin,
        hasSuperAdminContext: hadContext,
      } = get();
      // Only preserve the global super-admin token if the user actually is a super admin.
      // Regular users switching between their companies must not pollute _superAdminToken.
      if (currentToken && !_superAdminToken && wasAdmin) {
        _superAdminToken = currentToken;
      }
      const decoded = decodeJwt(companyToken);
      const isSuperAdmin = decoded?.isSuperAdmin === true;
      // Only carry the super-admin context forward if the user actually had it.
      // Regular users switching between their own companies must NOT get this flag,
      // otherwise they would see the "Switch to Super Admin" option in the profile.
      const hasSuperAdminContext = wasAdmin || hadContext || !!_superAdminToken;
      const updatedUser: AuthUser = { ...stored.user, companyId, companyName };
      localStorage.setItem(
        AUTH_KEY,
        JSON.stringify({
          user: updatedUser,
          isAuthenticated: true,
          isSuperAdmin,
          hasSuperAdminContext,
        } satisfies PersistedAuth),
      );
      Sentry.setUser(sentryUser(updatedUser));
      set({
        user: updatedUser,
        accessToken: companyToken,
        isSuperAdmin,
        hasSuperAdminContext,
      });
    },

    exitCompany: async () => {
      const { user } = get();

      // Strategy (in order):
      //   1. Cached access token (_superAdminToken) — fast path, same-session.
      //   2. POST /auth/exit-company — the httpOnly company cookie is sent
      //      automatically; the server recovers the global refresh token it
      //      persisted at switch-company time and issues a new global pair.
      let globalToken = _superAdminToken;

      // Step 1: discard the cached access token if it is expired or not global.
      if (globalToken) {
        const decoded = decodeJwt(globalToken);
        const isExpired =
          !decoded || typeof decoded.exp !== 'number' || decoded.exp * 1000 < Date.now();
        if (isExpired || decoded?.isSuperAdmin !== true) {
          globalToken = null;
          _superAdminToken = null;
        }
      }

      // Step 2: call exit-company (cookie carries the company refresh token).
      // The endpoint enforces double-submit CSRF, so we must include the token
      // from sessionStorage or the non-httpOnly cookie (same value, cross-tab).
      if (!globalToken) {
        try {
          const csrfToken = readCsrfToken();
          const { data } = await axios.post<{ accessToken: string }>(
            `${_baseURL()}/auth/exit-company`,
            undefined,
            {
              // 8 s — shorter than the default 15 s so the caller can show a
              // recoverable error toast before the user gives up.
              timeout: 8_000,
              withCredentials: true,
              headers: { ...(csrfToken && { 'x-csrf-token': csrfToken }) },
            },
          );
          globalToken = data.accessToken;
          _superAdminToken = data.accessToken;
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
        return false;
      }

      const stored = readPersistedAuth();
      const baseUser = stored?.user ?? user;
      if (!baseUser) {
        _superAdminToken = null;
        return false;
      }
      const updatedUser: AuthUser = {
        ...baseUser,
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
      _superAdminToken = globalToken;
      Sentry.setUser(sentryUser(updatedUser));
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
