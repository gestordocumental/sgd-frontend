import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import '@/i18n';

// ── Module mocks — declared before any import that triggers them ───────────────

const mockFetchAllUsersByOrg = vi.fn();

vi.mock('@/lib/api/users', () => ({
  usersApi: {
    fetchAllUsersByOrg: (...args: unknown[]) => mockFetchAllUsersByOrg(...args),
  },
}));

// ── Imports after mocks ───────────────────────────────────────────────────────

import { CompanyUsersRow } from '../CompanyUsersRow';
import { useAuthStore } from '@/store/authStore';
import type { ApiUserWithRoles } from '@/lib/api/users';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
}

function makeUser(overrides: Partial<ApiUserWithRoles> = {}): ApiUserWithRoles {
  return {
    id: 'u-1',
    email: 'alice@company.com',
    firstName: 'Alice',
    lastName: 'Smith',
    position: 'Developer',
    idNumber: null,
    departamentoId: null,
    areaId: null,
    cargoId: null,
    isActive: true,
    isSuperAdmin: false,
    registrationStatus: 'active',
    avatarUrl: null,
    deletedAt: null,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    roles: [{ roleId: 'role-1', roleName: 'Editor' }],
    orgRemovedAt: null,
    isOptionalReviewer: false,
    ...overrides,
  };
}

function renderRow(users: ApiUserWithRoles[], onToggleUserStatus = vi.fn()) {
  mockFetchAllUsersByOrg.mockResolvedValue({ data: users, nextCursor: null, hasMore: false });
  return render(
    createElement(
      'table',
      null,
      createElement(
        'tbody',
        null,
        createElement(CompanyUsersRow, {
          id: 'row-1',
          companyId: 'org-1',
          onEditUser: vi.fn(),
          onToggleUserStatus,
        }),
      ),
    ),
    { wrapper: makeWrapper() },
  );
}

afterEach(() => {
  useAuthStore.setState({ user: null });
  vi.clearAllMocks();
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('CompanyUsersRow — status action menu', () => {
  it('offers Deactivate user for an active, non-self user', async () => {
    const user = userEvent.setup();
    renderRow([makeUser()]);

    await screen.findByText('Alice Smith');
    await user.click(screen.getByRole('button', { name: 'Actions for Alice Smith' }));

    expect(await screen.findByRole('menuitem', { name: /Deactivate user/ })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /Activate user/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /Restore user/ })).not.toBeInTheDocument();
  });

  it('offers Activate user for an inactive, non-removed user', async () => {
    const user = userEvent.setup();
    renderRow([makeUser({ isActive: false })]);

    await screen.findByText('Alice Smith');
    await user.click(screen.getByRole('button', { name: 'Actions for Alice Smith' }));

    expect(await screen.findByRole('menuitem', { name: /Activate user/ })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /Deactivate user/ })).not.toBeInTheDocument();
  });

  it('offers Restore user (not Activate) for a user removed from the org', async () => {
    const user = userEvent.setup();
    renderRow([makeUser({ orgRemovedAt: '2024-06-01T00:00:00Z' })]);

    await screen.findByText('Alice Smith');
    await user.click(screen.getByRole('button', { name: 'Actions for Alice Smith' }));

    expect(await screen.findByRole('menuitem', { name: /Restore user/ })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /Activate user/ })).not.toBeInTheDocument();
  });

  it('offers Restore user for a soft-deleted user', async () => {
    const user = userEvent.setup();
    renderRow([makeUser({ deletedAt: '2024-06-01T00:00:00Z' })]);

    await screen.findByText('Alice Smith');
    await user.click(screen.getByRole('button', { name: 'Actions for Alice Smith' }));

    expect(await screen.findByRole('menuitem', { name: /Restore user/ })).toBeInTheDocument();
  });

  it("hides the status action entirely for the logged-in user's own row", async () => {
    useAuthStore.setState({
      user: { id: 'u-1', email: 'alice@company.com', name: 'Alice', role: 'user' },
    });
    const user = userEvent.setup();
    renderRow([makeUser()]);

    await screen.findByText('Alice Smith');
    await user.click(screen.getByRole('button', { name: 'Actions for Alice Smith' }));

    expect(await screen.findByRole('menuitem', { name: /Edit user/ })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /Deactivate user/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /Activate user/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /Restore user/ })).not.toBeInTheDocument();
  });

  it('calls onToggleUserStatus with the user and companyId when clicked', async () => {
    const onToggleUserStatus = vi.fn();
    const user = userEvent.setup();
    renderRow([makeUser()], onToggleUserStatus);

    await screen.findByText('Alice Smith');
    await user.click(screen.getByRole('button', { name: 'Actions for Alice Smith' }));
    await user.click(await screen.findByRole('menuitem', { name: /Deactivate user/ }));

    expect(onToggleUserStatus).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'u-1' }),
      'org-1',
    );
  });

  it('calls onToggleUserStatus with the user and companyId when Restore is clicked', async () => {
    const onToggleUserStatus = vi.fn();
    const user = userEvent.setup();
    renderRow([makeUser({ orgRemovedAt: '2024-06-01T00:00:00Z' })], onToggleUserStatus);

    await screen.findByText('Alice Smith');
    await user.click(screen.getByRole('button', { name: 'Actions for Alice Smith' }));
    await user.click(await screen.findByRole('menuitem', { name: /Restore user/ }));

    expect(onToggleUserStatus).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'u-1', orgRemovedAt: '2024-06-01T00:00:00Z' }),
      'org-1',
    );
  });

  it('hides the actions menu entirely for a user still completing registration', async () => {
    renderRow([makeUser({ registrationStatus: 'pending_credentials' })]);

    await screen.findByText('Alice Smith');

    // No actions are available for a pending user, so the trigger itself
    // shouldn't render — an empty popover would be a dead-end for admins.
    expect(
      screen.queryByRole('button', { name: 'Actions for Alice Smith' }),
    ).not.toBeInTheDocument();
  });
});
