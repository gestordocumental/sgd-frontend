import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, useEffect } from 'react';
import '@/i18n';

// ── Module mocks — declared before any import that triggers them ───────────────

// Prevent client.ts from failing when it imports @/router at load time
vi.mock('@/router', () => ({
  router: { navigate: vi.fn(), update: vi.fn() },
}));

vi.mock('@/store/authStore', () => ({
  useAuthStore: Object.assign(
    vi.fn(() => vi.fn()),
    {
      getState: () => ({ accessToken: null, clearAuth: vi.fn(), updateTokenPair: vi.fn() }),
    },
  ),
}));

// ── API mocks ─────────────────────────────────────────────────────────────────

const mockCreate = vi.fn();
const mockAssignUserToOrg = vi.fn();
const mockToggleSuperAdmin = vi.fn();

vi.mock('@/lib/api/users', () => ({
  usersApi: {
    list: vi.fn().mockResolvedValue([]),
    listSuperAdmin: vi.fn().mockResolvedValue({ data: [], total: 0 }),
    create: (...args: unknown[]) => mockCreate(...args),
    update: vi.fn().mockResolvedValue({}),
    remove: vi.fn().mockResolvedValue({}),
    restore: vi.fn().mockResolvedValue({}),
    resendInvitation: vi
      .fn()
      .mockResolvedValue({ email: 'x@x.com', invitationToken: 't', invitationResent: true }),
    assignUserToOrg: (...args: unknown[]) => mockAssignUserToOrg(...args),
    toggleSuperAdmin: (...args: unknown[]) => mockToggleSuperAdmin(...args),
  },
}));

vi.mock('@/lib/api/roles', () => ({
  rolesApi: { listRoles: vi.fn().mockResolvedValue([]) },
}));

vi.mock('@/lib/api/org-structure', () => ({
  orgStructureApi: {
    listDepartamentos: vi.fn().mockResolvedValue([]),
    listAreas: vi.fn().mockResolvedValue([]),
    listCargos: vi.fn().mockResolvedValue([]),
  },
}));

// ── Imports after mocks ───────────────────────────────────────────────────────

import { UserDialogs } from '../UserDialogs';
import { useAdminUsers } from '@/features/users/hooks/use-admin-users';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
}

/**
 * Renders the create-user dialog by composing the real hook with
 * the UserDialogs component inside a test harness.
 */
function CreateDialogHarness({ context = 'super-admin' as const } = {}) {
  const hook = useAdminUsers();

  useEffect(() => {
    hook.openCreate(context);
    // openCreate is stable across renders — safe to run once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <UserDialogs hook={hook} />;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Tests — dialog visibility ─────────────────────────────────────────────────

describe('CreateUserDialog — visibility', () => {
  it('shows the dialog when createOpen is true', async () => {
    render(<CreateDialogHarness />, { wrapper: makeWrapper() });
    expect(await screen.findByText('New user')).toBeInTheDocument();
  });

  it('closes the dialog when Cancel is clicked', async () => {
    const user = userEvent.setup();
    render(<CreateDialogHarness />, { wrapper: makeWrapper() });
    await screen.findByText('New user');

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => {
      expect(screen.queryByText('New user')).not.toBeInTheDocument();
    });
  });
});

// ── Tests — email validation ──────────────────────────────────────────────────

describe('CreateUserDialog — email validation', () => {
  it('disables submit button when email is empty', async () => {
    render(<CreateDialogHarness />, { wrapper: makeWrapper() });
    await screen.findByText('New user');
    expect(screen.getByRole('button', { name: 'Create user' })).toBeDisabled();
  });

  it('disables submit button when email format is invalid', async () => {
    const user = userEvent.setup();
    render(<CreateDialogHarness />, { wrapper: makeWrapper() });
    await screen.findByText('New user');

    await user.type(screen.getByPlaceholderText('user@company.com'), 'not-an-email');
    expect(screen.getByRole('button', { name: 'Create user' })).toBeDisabled();
  });

  it('enables submit button with a valid email', async () => {
    const user = userEvent.setup();
    render(<CreateDialogHarness />, { wrapper: makeWrapper() });
    await screen.findByText('New user');

    await user.type(screen.getByPlaceholderText('user@company.com'), 'valid@company.com');
    expect(screen.getByRole('button', { name: 'Create user' })).not.toBeDisabled();
  });
});

// ── Tests — submit ────────────────────────────────────────────────────────────

describe('CreateUserDialog — submit', () => {
  it('calls usersApi.create with the entered email and isSuperAdmin:true when context is super-admin', async () => {
    mockCreate.mockResolvedValue({
      id: 'u-new',
      email: 'new@company.com',
      invitationToken: 'token-abc',
      invitationResent: false,
    });

    const user = userEvent.setup();
    render(<CreateDialogHarness context="super-admin" />, { wrapper: makeWrapper() });
    await screen.findByText('New user');

    await user.type(screen.getByPlaceholderText('user@company.com'), 'new@company.com');
    await user.click(screen.getByRole('button', { name: 'Create user' }));

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'new@company.com',
          isSuperAdmin: true,
        }),
      );
    });
  });

  it('shows the invitation dialog after successful creation', async () => {
    mockCreate.mockResolvedValue({
      id: 'u-new',
      email: 'invited@company.com',
      invitationToken: 'token-xyz',
      invitationResent: false,
    });

    const user = userEvent.setup();
    render(<CreateDialogHarness />, { wrapper: makeWrapper() });
    await screen.findByText('New user');

    await user.type(screen.getByPlaceholderText('user@company.com'), 'invited@company.com');
    await user.click(screen.getByRole('button', { name: 'Create user' }));

    await waitFor(() => {
      expect(screen.getByText('Invitation sent')).toBeInTheDocument();
    });
  });

  it('handles 409 conflict by promoting the existing user to super-admin', async () => {
    mockCreate.mockRejectedValue({
      response: { status: 409, data: { userId: 'existing-u' } },
    });
    mockToggleSuperAdmin.mockResolvedValue({});

    const user = userEvent.setup();
    render(<CreateDialogHarness context="super-admin" />, { wrapper: makeWrapper() });
    await screen.findByText('New user');

    await user.type(screen.getByPlaceholderText('user@company.com'), 'existing@company.com');
    await user.click(screen.getByRole('button', { name: 'Create user' }));

    await waitFor(() => {
      expect(mockToggleSuperAdmin).toHaveBeenCalledWith('existing-u', true);
    });
  });
});
