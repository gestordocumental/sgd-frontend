import { create } from 'zustand';
import axios from 'axios';
import type { AuthUser } from '@/types/auth';
import { decodeJwt } from '@/lib/jwt';

const AUTH_KEY = 'sgd-auth';

// ── In-memory token storage ────────────────────────────────────────────────
// Access tokens are NOT written to localStorage.  If an XSS payload runs
// it cannot read the token via localStorage.getItem().  The httpOnly
// refresh-token cookie lets the silent-refresh interceptor (client.ts)
// renew the access token on every 401 or page reload.
//
// The super-admin token is kept in this module-level variable so that
// enterCompany() / exitCompany() works within the same tab session.
// After a page reload it is re-obtained via a plain /auth/refresh call.
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

    setAuth: (user, accessToken, _refreshToken, isSuperAdmin) => {
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
      // within the same tab session without touching localStorage
      if (isSuperAdmin && !user.companyId) {
        _superAdminToken = accessToken;
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

    updateTokenPair: (accessToken, _refreshToken) => {
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
      _superAdminToken = null;
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

      // --- Obtain the global super-admin token ---
      // Primary: use the in-memory backup set by setAuth / enterCompany
      // Fallback: /auth/refresh (used after a page reload when memory is gone)
      let globalToken = _superAdminToken;

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
        } catch {
          return false;
        }
      }

      // Validate the token is a live super-admin token
      const decoded = decodeJwt(globalToken);
      if (
        !decoded ||
        typeof decoded.exp !== 'number' ||
        decoded.exp * 1000 < Date.now() ||
        decoded.isSuperAdmin !== true
      ) {
        _superAdminToken = null;
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
      // Retain global token in memory for the next enterCompany cycle
      _superAdminToken = globalToken;
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
