import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import '@/i18n';

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock('@/lib/api/roles', () => ({
  rolesApi: {
    listPermissions: vi.fn(),
    listRoles: vi.fn().mockResolvedValue([]),
    createRole: vi.fn(),
    updateRole: vi.fn(),
    deleteRole: vi.fn(),
    assignPermissions: vi.fn(),
  },
}));

vi.mock('@/lib/api/users', () => ({
  usersApi: {
    assignUserToOrg: vi.fn(),
    removeUserFromRole: vi.fn(),
  },
}));

// ── Imports after mocks ───────────────────────────────────────────────────────

import { useRoles } from '../use-roles';
import { rolesApi, type ApiPermission } from '@/lib/api/roles';

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
}

const PERMISSIONS: ApiPermission[] = [
  { id: 'wf-read', module: 'WORKFLOWS', action: 'READ', description: null },
  { id: 'wf-write', module: 'WORKFLOWS', action: 'WRITE', description: null },
  { id: 'wf-approve', module: 'WORKFLOWS', action: 'APPROVE', description: null },
  { id: 'doc-read', module: 'DOCUMENTS', action: 'READ', description: null },
  { id: 'doc-write', module: 'DOCUMENTS', action: 'WRITE', description: null },
];

async function renderRolesHook() {
  vi.mocked(rolesApi.listPermissions).mockResolvedValue(PERMISSIONS);
  const { result } = renderHook(() => useRoles('org-1'), { wrapper: makeWrapper() });
  await waitFor(() => expect(result.current.permissions).toEqual(PERMISSIONS));
  return result;
}

describe('useRoles — togglePerm proactively enforces the READ-required-for-actions rule', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('auto-checks READ for the module when checking an action permission', async () => {
    // Mirrors RolePolicy.validatePermissionSet on the backend — this is the
    // proactive UX half of the fix; the backend rejection is the actual
    // enforcement (see roles/domain/role.policy.ts).
    const result = await renderRolesHook();

    act(() => result.current.togglePerm('wf-approve'));

    expect(result.current.selectedPermIds).toEqual(
      expect.arrayContaining(['wf-approve', 'wf-read']),
    );
  });

  it('does not duplicate READ if it is already selected when checking an action', async () => {
    const result = await renderRolesHook();

    act(() => result.current.togglePerm('wf-read'));
    act(() => result.current.togglePerm('wf-approve'));

    const reads = result.current.selectedPermIds.filter((id) => id === 'wf-read');
    expect(reads).toHaveLength(1);
  });

  it('cascades to unchecking every other permission on the module when unchecking READ', async () => {
    const result = await renderRolesHook();

    act(() => result.current.togglePerm('wf-read'));
    act(() => result.current.togglePerm('wf-write'));
    act(() => result.current.togglePerm('wf-approve'));
    expect(result.current.selectedPermIds).toEqual(
      expect.arrayContaining(['wf-read', 'wf-write', 'wf-approve']),
    );

    act(() => result.current.togglePerm('wf-read')); // uncheck READ

    expect(result.current.selectedPermIds).not.toContain('wf-read');
    expect(result.current.selectedPermIds).not.toContain('wf-write');
    expect(result.current.selectedPermIds).not.toContain('wf-approve');
  });

  it('unchecking READ on one module does not affect a different module', async () => {
    const result = await renderRolesHook();

    act(() => result.current.togglePerm('wf-read'));
    act(() => result.current.togglePerm('wf-approve'));
    act(() => result.current.togglePerm('doc-read'));
    act(() => result.current.togglePerm('doc-write'));

    act(() => result.current.togglePerm('wf-read')); // uncheck WORKFLOWS's READ

    expect(result.current.selectedPermIds).toEqual(
      expect.arrayContaining(['doc-read', 'doc-write']),
    );
  });

  it('unchecking a plain action permission only removes that one permission', async () => {
    const result = await renderRolesHook();

    act(() => result.current.togglePerm('wf-read'));
    act(() => result.current.togglePerm('wf-write'));
    act(() => result.current.togglePerm('wf-approve'));

    act(() => result.current.togglePerm('wf-write')); // uncheck one action

    expect(result.current.selectedPermIds).toEqual(
      expect.arrayContaining(['wf-read', 'wf-approve']),
    );
    expect(result.current.selectedPermIds).not.toContain('wf-write');
  });
});
