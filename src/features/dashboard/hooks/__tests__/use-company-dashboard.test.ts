import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { TabId } from '../use-company-dashboard';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockHasPermission = vi.fn((_module: string, _action: string) => false);
const permissionsState = { isLoading: false };

vi.mock('@/store/authStore', () => ({
  useAuthStore: () => ({ user: { companyId: 'org-1' }, isSuperAdmin: false }),
}));

vi.mock('@/features/profile/hooks/use-my-permissions', () => ({
  useMyPermissions: () => ({
    hasPermission: mockHasPermission,
    isLoading: permissionsState.isLoading,
  }),
}));

vi.mock('@/features/company-users/hooks/use-company-users', () => ({
  useCompanyUsers: () => ({ users: [] }),
}));

vi.mock('@/features/roles/hooks/use-roles', () => ({
  useRoles: () => ({}),
}));

vi.mock('@/features/org-structure/hooks/use-org-structure', () => ({
  useOrgStructure: () => ({}),
}));

vi.mock('@/features/doc-governance/hooks/use-typologies', () => ({
  useTypologies: () => ({}),
}));

vi.mock('@/features/workflows/hooks/use-workflows', () => ({
  useWorkflows: () => ({ actions: { openDetailById: vi.fn() } }),
}));

vi.mock('@/features/audit/hooks/use-audit', () => ({
  useAudit: () => ({}),
}));

vi.mock('../use-org-dashboard', () => ({
  useOrgDashboard: () => ({}),
}));

vi.mock('@/lib/formatters', () => ({
  isDeleted: () => false,
}));

// Import AFTER mocks
import { useCompanyDashboard } from '../use-company-dashboard';

// ── Helpers ───────────────────────────────────────────────────────────────────

function navigateTo(
  result: ReturnType<typeof renderHook<ReturnType<typeof useCompanyDashboard>, unknown>>['result'],
  tab: TabId,
) {
  act(() => {
    result.current.handleTabChange(tab);
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockHasPermission.mockReturnValue(false);
  permissionsState.isLoading = false;
});

// ── effectiveTab fallback logic ───────────────────────────────────────────────

describe('useCompanyDashboard — effectiveTab', () => {
  it('starts on overview', () => {
    const { result } = renderHook(() => useCompanyDashboard());
    expect(result.current.effectiveTab).toBe('overview');
  });

  it('does not fall back while permissions are loading (avoids flash to overview)', () => {
    permissionsState.isLoading = true;

    const { result } = renderHook(() => useCompanyDashboard());
    navigateTo(result, 'users');

    // All hasPermission() calls return false, but loading guard must short-circuit
    expect(result.current.effectiveTab).toBe('users');
  });

  it.each([
    ['users', 'USERS', 'READ'],
    ['roles', 'ORGS', 'READ'],
    ['org-structure', 'ORG_STRUCTURE', 'READ'],
    ['workflows', 'WORKFLOWS', 'READ'],
    ['audit', 'AUDIT', 'READ'],
  ] as const)('falls back to overview on %s when the required permission is denied', (tab) => {
    const { result } = renderHook(() => useCompanyDashboard());
    navigateTo(result, tab);
    expect(result.current.effectiveTab).toBe('overview');
  });

  it.each([
    ['users', 'USERS', 'READ'],
    ['roles', 'ORGS', 'READ'],
    ['org-structure', 'ORG_STRUCTURE', 'READ'],
    ['workflows', 'WORKFLOWS', 'READ'],
    ['audit', 'AUDIT', 'READ'],
  ] as const)('stays on %s when the user holds %s:%s', (tab, module, action) => {
    mockHasPermission.mockImplementation((m, a) => m === module && a === action);
    const { result } = renderHook(() => useCompanyDashboard());
    navigateTo(result, tab);
    expect(result.current.effectiveTab).toBe(tab);
  });

  it('never gates overview or company tabs', () => {
    const { result } = renderHook(() => useCompanyDashboard());

    navigateTo(result, 'overview');
    expect(result.current.effectiveTab).toBe('overview');

    navigateTo(result, 'company');
    expect(result.current.effectiveTab).toBe('company');
  });
});

// ── Lazy-mount behaviour ──────────────────────────────────────────────────────

describe('useCompanyDashboard — mountedTabs', () => {
  it('mounts only overview on initial render', () => {
    const { result } = renderHook(() => useCompanyDashboard());
    expect(result.current.mountedTabs.has('overview')).toBe(true);
    expect(result.current.mountedTabs.size).toBe(1);
  });

  it('mounts a tab on first visit and keeps it alive after switching away', () => {
    const { result } = renderHook(() => useCompanyDashboard());

    navigateTo(result, 'users');
    expect(result.current.mountedTabs.has('users')).toBe(true);

    navigateTo(result, 'overview');
    expect(result.current.mountedTabs.has('users')).toBe(true);
  });

  it('does not duplicate entries for a tab already in the set', () => {
    const { result } = renderHook(() => useCompanyDashboard());

    navigateTo(result, 'users');
    const sizeAfterFirst = result.current.mountedTabs.size;

    navigateTo(result, 'users');
    expect(result.current.mountedTabs.size).toBe(sizeAfterFirst);
  });
});
