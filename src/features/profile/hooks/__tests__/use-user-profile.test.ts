import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';

// ── Mocks ─────────────────────────────────────────────────────────────────────
// authState is mutable so individual tests can opt into a signed-in,
// super-admin session (needed to exercise the company-switcher logic) while
// the default (accessToken: null) keeps every data-fetching query disabled —
// which is what the forced-logout tests rely on.

const mockClearAuth = vi.fn();
const mockNavigate = vi.fn();

let authState: {
  user: { id?: string; companyId?: string | null; companyName?: string } | null;
  isSuperAdmin: boolean;
  accessToken: string | null;
  hasSuperAdminContext: boolean;
};

function resetAuthState() {
  authState = {
    user: null,
    isSuperAdmin: false,
    accessToken: null,
    hasSuperAdminContext: false,
  };
}
resetAuthState();

vi.mock('@/store/authStore', () => ({
  useAuthStore: () => ({
    ...authState,
    enterCompany: vi.fn(),
    exitCompany: vi.fn(),
    clearAuth: mockClearAuth,
  }),
}));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('@/lib/jwt', () => ({
  decodeJwt: vi.fn().mockReturnValue(null),
}));

const mockGetMyCompanies = vi.fn();
vi.mock('@/lib/api/auth', () => ({
  authApi: {
    getMyCompanies: (...args: unknown[]) => mockGetMyCompanies(...args),
    switchCompany: vi.fn(),
  },
}));

const mockFetchAllCompanies = vi.fn();
const mockGetMyOrgs = vi.fn();
vi.mock('@/lib/api/companies', () => ({
  companiesApi: { getMyOrgs: (...args: unknown[]) => mockGetMyOrgs(...args) },
  fetchAllCompanies: (...args: unknown[]) => mockFetchAllCompanies(...args),
}));

vi.mock('@/lib/api/users', () => ({
  usersApi: { getMe: vi.fn() },
}));

// ── Wrapper ───────────────────────────────────────────────────────────────────

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
  return { client, wrapper };
}

// ── Import hook AFTER mocks ───────────────────────────────────────────────────

import { useUserProfile } from '../use-user-profile';

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  resetAuthState();
});

describe('useUserProfile — forced logout on sgd:account-disabled', () => {
  it('clears the query cache, logs out and redirects to /login', () => {
    const { client, wrapper } = makeWrapper();
    const clearSpy = vi.spyOn(client, 'clear');
    renderHook(() => useUserProfile(), { wrapper });

    act(() => {
      window.dispatchEvent(new Event('sgd:account-disabled'));
    });

    expect(clearSpy).toHaveBeenCalledOnce();
    expect(mockClearAuth).toHaveBeenCalledOnce();
    expect(mockNavigate).toHaveBeenCalledWith({ to: '/login', replace: true });
  });

  it('sets the sgd-account-disabled flag for the login page banner', () => {
    const { wrapper } = makeWrapper();
    renderHook(() => useUserProfile(), { wrapper });

    act(() => {
      window.dispatchEvent(new Event('sgd:account-disabled'));
    });

    expect(localStorage.getItem('sgd-account-disabled')).toBe('1');
  });

  it('removes the sgd:account-disabled listener on unmount', () => {
    const { wrapper } = makeWrapper();
    const { unmount } = renderHook(() => useUserProfile(), { wrapper });

    unmount();

    act(() => {
      window.dispatchEvent(new Event('sgd:account-disabled'));
    });

    expect(mockClearAuth).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});

// ── switchableCompanyIds — excludes inactive/deleted companies ────────────────

describe('useUserProfile — switchableCompanyIds', () => {
  beforeEach(() => {
    authState = {
      user: { id: 'user-1', companyId: null },
      isSuperAdmin: true,
      accessToken: 'fake.jwt.token',
      hasSuperAdminContext: false,
    };
    mockGetMyCompanies.mockResolvedValue(['org-active', 'org-inactive']);
    mockFetchAllCompanies.mockResolvedValue([
      { id: 'org-active', name: 'Active Co', status: 'active' },
      { id: 'org-inactive', name: 'Inactive Co', status: 'inactive' },
    ]);
  });

  it('excludes an inactive company from the switch-target list, even for a super admin', async () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useUserProfile(), { wrapper });

    await waitFor(() => {
      expect(result.current.companies.length).toBeGreaterThan(0);
    });

    expect(result.current.switchableCompanyIds).toContain('org-active');
    expect(result.current.switchableCompanyIds).not.toContain('org-inactive');
    // companies (used for display/name lookups) still has both — only the
    // switch-target list is filtered.
    expect(result.current.companies.map((c) => c.id)).toEqual(
      expect.arrayContaining(['org-active', 'org-inactive']),
    );
  });

  it('keeps the currently-entered company in the switch list even if it has since gone inactive', async () => {
    authState.user = { id: 'user-1', companyId: 'org-inactive' };

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useUserProfile(), { wrapper });

    await waitFor(() => {
      expect(result.current.companies.length).toBeGreaterThan(0);
    });

    // Still switchable — the user is already inside it; the menu shouldn't
    // hide their current context, only block switching *into* new inactive ones.
    expect(result.current.switchableCompanyIds).toContain('org-inactive');
  });

  it('does not offer the switch-context menu when every other membership is inactive', async () => {
    // Regression: canSwitchContext must key off switchableCompanyIds, not the
    // raw companyIds — otherwise a non-super-admin user whose only other
    // memberships are all inactive would see a "switch context" menu with
    // nothing real to switch to.
    authState = {
      user: { id: 'user-1', companyId: 'org-active' },
      isSuperAdmin: false,
      accessToken: 'fake.jwt.token',
      hasSuperAdminContext: false,
    };
    mockGetMyCompanies.mockResolvedValue(['org-active', 'org-inactive']);
    mockGetMyOrgs.mockResolvedValue([
      { id: 'org-active', name: 'Active Co', status: 'active' },
      { id: 'org-inactive', name: 'Inactive Co', status: 'inactive' },
    ]);

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useUserProfile(), { wrapper });

    await waitFor(() => {
      expect(result.current.switchableCompanyIds).toEqual(['org-active']);
    });

    expect(result.current.canSwitchContext).toBe(false);
  });
});
