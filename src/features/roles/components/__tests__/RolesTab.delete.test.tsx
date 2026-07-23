import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import i18n from '@/i18n';
import { RolesTab } from '../RolesTab';
import { RoleDialogs } from '../RoleDialogs';
import { useRoles } from '@/features/roles/hooks/use-roles';
import type { ApiRole } from '@/lib/api/roles';

const mockListRoles = vi.fn();
const mockListPermissions = vi.fn();
const mockDeleteRole = vi.fn();
vi.mock('@/lib/api/roles', () => ({
  rolesApi: {
    listRoles: (...args: unknown[]) => mockListRoles(...args),
    listPermissions: (...args: unknown[]) => mockListPermissions(...args),
    deleteRole: (...args: unknown[]) => mockDeleteRole(...args),
    createRole: vi.fn(),
    updateRole: vi.fn(),
    assignPermissions: vi.fn(),
    removePermission: vi.fn(),
  },
}));

vi.mock('@/lib/api/users', () => ({
  usersApi: {
    assignUserToOrg: vi.fn(),
    removeUserFromRole: vi.fn(),
  },
}));

const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }));
vi.mock('sonner', () => ({
  toast: { error: toastError, success: vi.fn() },
}));

function makeRole(overrides: Partial<ApiRole> = {}): ApiRole {
  return {
    id: 'role-1',
    name: 'Approvers',
    description: 'Can approve workflows',
    permissions: [],
    orgId: 'org-1',
    isSystem: false,
    createdAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

// Mirrors the real composition (OrgDashboard renders RolesTab and RoleDialogs
// side by side, both bound to the same useRoles(companyId) instance) closely
// enough to reproduce the actual click-delete-confirm flow, without pulling
// in the rest of the dashboard's unrelated hooks.
function TestHarness() {
  const hook = useRoles('org-1');
  return (
    <>
      <RolesTab hook={hook} users={[]} canWrite />
      <RoleDialogs hook={hook} activeUsers={[]} allUsers={[]} />
    </>
  );
}

function renderHarness() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <TestHarness />
    </QueryClientProvider>,
  );
}

describe('Deleting a role that still has assigned users', () => {
  beforeEach(() => {
    toastError.mockClear();
    mockDeleteRole.mockReset();
    mockListRoles.mockResolvedValue([makeRole()]);
    mockListPermissions.mockResolvedValue([]);
  });

  it('shows a translated error toast (not the raw English backend string) when the delete is rejected for having assigned users', async () => {
    // Regression: RolesService.remove() used to throw a ConflictException
    // with only a hardcoded English `message`, no `errorCode` — so
    // resolveApiError had nothing to look up in i18n and fell back to that
    // raw string verbatim, showing English text to Spanish-speaking users.
    // The backend now attaches errorCode: 'ROLE_HAS_ASSIGNED_USERS' + params
    // (name, count), which resolveApiError translates via `errors.<code>`.
    mockDeleteRole.mockRejectedValue({
      response: {
        status: 409,
        data: {
          message: 'Role "Approvers" is still assigned to 3 user(s) and cannot be deleted',
          errorCode: 'ROLE_HAS_ASSIGNED_USERS',
          params: { name: 'Approvers', count: 3 },
        },
      },
    });

    renderHarness();

    await screen.findByText('Approvers');
    fireEvent.click(screen.getByLabelText('Actions for role Approvers'));
    fireEvent.click(await screen.findByText('Delete role'));
    const confirmButtons = await screen.findAllByRole('button', { name: 'Delete role' });
    fireEvent.click(confirmButtons[0]);

    await waitFor(() => expect(mockDeleteRole).toHaveBeenCalledWith('role-1'));
    const expectedMessage = i18n.t('errors.ROLE_HAS_ASSIGNED_USERS', {
      name: 'Approvers',
      count: 3,
    });
    await waitFor(() => expect(toastError).toHaveBeenCalledWith(expectedMessage));
    expect(toastError).not.toHaveBeenCalledWith(
      'Role "Approvers" is still assigned to 3 user(s) and cannot be deleted',
    );
  });

  it('falls back to the generic delete-error message when the backend response has no message', async () => {
    mockDeleteRole.mockRejectedValue({ response: { status: 409, data: {} } });

    renderHarness();

    await screen.findByText('Approvers');
    fireEvent.click(screen.getByLabelText('Actions for role Approvers'));
    fireEvent.click(await screen.findByText('Delete role'));
    fireEvent.click(screen.getAllByRole('button', { name: 'Delete role' })[0]);

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith('The role could not be deleted. Please try again.'),
    );
  });
});
