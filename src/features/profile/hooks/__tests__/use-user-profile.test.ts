import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';

// ── Mocks ─────────────────────────────────────────────────────────────────────
// accessToken/user stay null so every data-fetching query in the hook is
// disabled — this test only exercises the forced-logout event handlers.

const mockClearAuth = vi.fn();
const mockNavigate = vi.fn();

vi.mock('@/store/authStore', () => ({
  useAuthStore: () => ({
    user: null,
    isSuperAdmin: false,
    accessToken: null,
    enterCompany: vi.fn(),
    exitCompany: vi.fn(),
    clearAuth: mockClearAuth,
    hasSuperAdminContext: false,
  }),
}));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('@/lib/jwt', () => ({
  decodeJwt: vi.fn().mockReturnValue(null),
}));

vi.mock('@/lib/api/auth', () => ({
  authApi: { getMyCompanies: vi.fn(), switchCompany: vi.fn() },
}));

vi.mock('@/lib/api/companies', () => ({
  companiesApi: { getMyOrgs: vi.fn() },
  fetchAllCompanies: vi.fn(),
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
