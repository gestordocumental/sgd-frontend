import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import type { UserOrgRoleResponseDto } from '@/lib/api/users';
import type { ApiRole } from '@/lib/api/roles';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockGetMyOrgRoles = vi.fn<() => Promise<UserOrgRoleResponseDto[]>>();
const mockListRoles = vi.fn<() => Promise<ApiRole[]>>();

vi.mock('@/lib/api/users', () => ({
  usersApi: { getMyOrgRoles: () => mockGetMyOrgRoles() },
}));

vi.mock('@/lib/api/roles', () => ({
  rolesApi: { listRoles: () => mockListRoles() },
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ORG_ROLE: UserOrgRoleResponseDto = {
  id: 'uor-1',
  userId: 'u-1',
  orgId: 'org-1',
  roleId: 'role-1',
  assignedBy: null,
  createdAt: '2024-01-01T00:00:00Z',
};

const ROLE_WITH_PERMS: ApiRole = {
  id: 'role-1',
  name: 'Editor',
  description: null,
  orgId: 'org-1',
  createdAt: '2024-01-01T00:00:00Z',
  permissions: [
    { id: 'p-1', module: 'DOCUMENTS', action: 'READ', description: null },
    { id: 'p-2', module: 'DOCUMENTS', action: 'WRITE', description: null },
    { id: 'p-3', module: 'WORKFLOWS', action: 'READ', description: null },
  ],
};

// ── Wrapper ───────────────────────────────────────────────────────────────────

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
}

// ── Import hook AFTER mocks ───────────────────────────────────────────────────

import { useMyPermissions } from '../use-my-permissions';

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

// ── 1. Super admin bypass ─────────────────────────────────────────────────────

describe('useMyPermissions — isSuperAdmin', () => {
  it('never calls the API when user is super admin', async () => {
    const { result } = renderHook(() => useMyPermissions('org-1', true), {
      wrapper: makeWrapper(),
    });

    // Queries are disabled — no network calls expected
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockGetMyOrgRoles).not.toHaveBeenCalled();
    expect(mockListRoles).not.toHaveBeenCalled();
  });

  it('hasPermission always returns true for super admin regardless of module/action', () => {
    const { result } = renderHook(() => useMyPermissions('org-1', true), {
      wrapper: makeWrapper(),
    });

    expect(result.current.hasPermission('DOCUMENTS', 'DELETE')).toBe(true);
    expect(result.current.hasPermission('ORG_STRUCTURE', 'WRITE')).toBe(true);
    expect(result.current.hasPermission('AUDIT', 'READ')).toBe(true);
  });

  it('isLoading is false for super admin', () => {
    const { result } = renderHook(() => useMyPermissions('org-1', true), {
      wrapper: makeWrapper(),
    });
    expect(result.current.isLoading).toBe(false);
  });
});

// ── 2. No company context ─────────────────────────────────────────────────────

describe('useMyPermissions — companyId null', () => {
  it('never calls the API when companyId is null', async () => {
    const { result } = renderHook(() => useMyPermissions(null, false), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockGetMyOrgRoles).not.toHaveBeenCalled();
    expect(mockListRoles).not.toHaveBeenCalled();
  });

  it('hasPermission returns false for all checks when companyId is null', () => {
    const { result } = renderHook(() => useMyPermissions(null, false), { wrapper: makeWrapper() });

    expect(result.current.hasPermission('DOCUMENTS', 'READ')).toBe(false);
  });
});

// ── 3. Normal user — with role and permissions ────────────────────────────────

describe('useMyPermissions — user with role and permissions', () => {
  beforeEach(() => {
    mockGetMyOrgRoles.mockResolvedValue([ORG_ROLE]);
    mockListRoles.mockResolvedValue([ROLE_WITH_PERMS]);
  });

  it('fetches org roles and all roles', async () => {
    const { result } = renderHook(() => useMyPermissions('org-1', false), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockGetMyOrgRoles).toHaveBeenCalledOnce();
    expect(mockListRoles).toHaveBeenCalledOnce();
  });

  it('hasPermission returns true for granted permissions', async () => {
    const { result } = renderHook(() => useMyPermissions('org-1', false), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.hasPermission('DOCUMENTS', 'READ')).toBe(true);
    expect(result.current.hasPermission('DOCUMENTS', 'WRITE')).toBe(true);
    expect(result.current.hasPermission('WORKFLOWS', 'READ')).toBe(true);
  });

  it('hasPermission returns false for non-granted permissions', async () => {
    const { result } = renderHook(() => useMyPermissions('org-1', false), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.hasPermission('DOCUMENTS', 'DELETE')).toBe(false);
    expect(result.current.hasPermission('USERS', 'READ')).toBe(false);
    expect(result.current.hasPermission('AUDIT', 'READ')).toBe(false);
  });

  it('only grants permissions from roles the user actually holds', async () => {
    const otherRole: ApiRole = {
      ...ROLE_WITH_PERMS,
      id: 'role-999',
      permissions: [{ id: 'p-99', module: 'USERS', action: 'MANAGE', description: null }],
    };
    mockListRoles.mockResolvedValue([ROLE_WITH_PERMS, otherRole]);

    const { result } = renderHook(() => useMyPermissions('org-1', false), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // role-999 is not in the user's assignments
    expect(result.current.hasPermission('USERS', 'MANAGE')).toBe(false);
    // role-1 perms are still granted
    expect(result.current.hasPermission('DOCUMENTS', 'READ')).toBe(true);
  });

  it('accumulates permissions from multiple roles', async () => {
    const secondOrgRole: UserOrgRoleResponseDto = { ...ORG_ROLE, id: 'uor-2', roleId: 'role-2' };
    const secondRole: ApiRole = {
      ...ROLE_WITH_PERMS,
      id: 'role-2',
      permissions: [
        { id: 'p-10', module: 'USERS', action: 'READ', description: null },
        { id: 'p-11', module: 'USERS', action: 'WRITE', description: null },
      ],
    };
    mockGetMyOrgRoles.mockResolvedValue([ORG_ROLE, secondOrgRole]);
    mockListRoles.mockResolvedValue([ROLE_WITH_PERMS, secondRole]);

    const { result } = renderHook(() => useMyPermissions('org-1', false), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // From role-1
    expect(result.current.hasPermission('DOCUMENTS', 'READ')).toBe(true);
    // From role-2
    expect(result.current.hasPermission('USERS', 'READ')).toBe(true);
    expect(result.current.hasPermission('USERS', 'WRITE')).toBe(true);
  });
});

// ── 4. User with no role assignments ─────────────────────────────────────────

describe('useMyPermissions — user with no role assignments', () => {
  beforeEach(() => {
    mockGetMyOrgRoles.mockResolvedValue([]);
    // listRoles should NOT be called because myRoleIds.size === 0
    mockListRoles.mockResolvedValue([]);
  });

  it('does not call listRoles when the user has no assigned roles', async () => {
    const { result } = renderHook(() => useMyPermissions('org-1', false), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => {
      expect(mockGetMyOrgRoles).toHaveBeenCalledOnce();
    });

    // Give time for any accidental listRoles call to happen
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockListRoles).not.toHaveBeenCalled();
  });

  it('hasPermission returns false for all checks', async () => {
    const { result } = renderHook(() => useMyPermissions('org-1', false), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.hasPermission('DOCUMENTS', 'READ')).toBe(false);
    expect(result.current.hasPermission('USERS', 'MANAGE')).toBe(false);
  });
});

// ── 5. Roles with null roleId are ignored ────────────────────────────────────

describe('useMyPermissions — org role with null roleId', () => {
  it('filters out org-role entries that have a null roleId', async () => {
    const nullRoleEntry = { ...ORG_ROLE, roleId: null as unknown as string };
    mockGetMyOrgRoles.mockResolvedValue([nullRoleEntry]);
    mockListRoles.mockResolvedValue([ROLE_WITH_PERMS]);

    const { result } = renderHook(() => useMyPermissions('org-1', false), {
      wrapper: makeWrapper(),
    });

    // myRoleIds.size === 0 after filter → allRoles query disabled
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockListRoles).not.toHaveBeenCalled();
    expect(result.current.hasPermission('DOCUMENTS', 'READ')).toBe(false);
  });
});
