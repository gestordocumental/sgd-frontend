import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import '@/i18n';

// ── Module mocks — declared before any import that triggers them ───────────────

vi.mock('@/router', () => ({
  router: { navigate: vi.fn(), update: vi.fn() },
}));

const mockFetchAllUsersByOrg = vi.fn();

vi.mock('@/lib/api/users', () => ({
  usersApi: {
    fetchAllUsersByOrg: (...args: unknown[]) => mockFetchAllUsersByOrg(...args),
    create: vi.fn(),
    update: vi.fn().mockResolvedValue({}),
    remove: vi.fn(),
    removeUserFromOrg: vi.fn(),
    restore: vi.fn(),
    disable: vi.fn(),
    enable: vi.fn(),
    resendInvitation: vi.fn(),
    assignUserToOrg: vi.fn(),
    setOptionalReviewer: vi.fn(),
  },
}));

vi.mock('@/lib/api/roles', () => ({
  rolesApi: { listRoles: vi.fn().mockResolvedValue([]) },
}));

vi.mock('@/lib/api/companies', () => ({
  companiesApi: { getById: vi.fn().mockResolvedValue({ id: 'org-1', name: 'Acme' }) },
}));

vi.mock('@/lib/api/org-structure', () => ({
  orgStructureApi: {
    listAllCargos: vi.fn().mockResolvedValue([]),
    listDepartamentos: vi.fn().mockResolvedValue([]),
    listAreas: vi.fn().mockResolvedValue([]),
    listDeptCargos: vi.fn().mockResolvedValue([]),
    listCargos: vi.fn().mockResolvedValue([]),
  },
}));

// ── Imports after mocks ───────────────────────────────────────────────────────

import { CompanyUsersTable } from '../CompanyUsersTable';
import { useCompanyUsers } from '@/features/company-users/hooks/use-company-users';
import { useAuthStore } from '@/store/authStore';
import type { ApiUserWithRoles } from '@/lib/api/users';
import { mockImageLoad } from '@/test/mock-image';

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
    roles: [],
    orgRemovedAt: null,
    isOptionalReviewer: false,
    ...overrides,
  };
}

function CompanyUsersTableHarness() {
  const hook = useCompanyUsers('org-1');
  return <CompanyUsersTable hook={hook} canWrite />;
}

afterEach(() => {
  useAuthStore.setState({ user: null });
  vi.clearAllMocks();
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('CompanyUsersTable — self row actions', () => {
  it("shows all actions for another user's row", async () => {
    mockFetchAllUsersByOrg.mockResolvedValue({
      data: [makeUser()],
      nextCursor: null,
      hasMore: false,
    });
    const user = userEvent.setup();

    render(<CompanyUsersTableHarness />, { wrapper: makeWrapper() });
    await screen.findByText('Alice Smith');

    await user.click(screen.getByRole('button', { name: 'Actions for Alice Smith' }));

    expect(await screen.findByRole('menuitem', { name: /^Edit$/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Disable/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Delete/ })).toBeInTheDocument();
  });

  it("shows only Edit for the logged-in user's own row", async () => {
    useAuthStore.setState({
      user: { id: 'u-1', email: 'alice@company.com', name: 'Alice', role: 'user' },
    });
    mockFetchAllUsersByOrg.mockResolvedValue({
      data: [makeUser()],
      nextCursor: null,
      hasMore: false,
    });
    const user = userEvent.setup();

    render(<CompanyUsersTableHarness />, { wrapper: makeWrapper() });
    await screen.findByText('Alice Smith');

    await user.click(screen.getByRole('button', { name: 'Actions for Alice Smith' }));

    expect(await screen.findByRole('menuitem', { name: /^Edit$/ })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /Disable/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /Delete/ })).not.toBeInTheDocument();
  });
});

describe('CompanyUsersTable — pending-credentials row actions', () => {
  it('hides Edit, Disable/Enable and optional-reviewer toggle for a user still completing registration', async () => {
    mockFetchAllUsersByOrg.mockResolvedValue({
      data: [makeUser({ registrationStatus: 'pending_credentials' })],
      nextCursor: null,
      hasMore: false,
    });
    const user = userEvent.setup();

    render(<CompanyUsersTableHarness />, { wrapper: makeWrapper() });
    await screen.findByText('Alice Smith');

    await user.click(screen.getByRole('button', { name: 'Actions for Alice Smith' }));

    expect(screen.queryByRole('menuitem', { name: /^Edit$/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /Disable/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /Enable/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /optional reviewer/i })).not.toBeInTheDocument();
    // Resend invitation and Delete remain the only available actions.
    expect(await screen.findByRole('menuitem', { name: /Resend invitation/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Delete/ })).toBeInTheDocument();
  });
});

describe('CompanyUsersTable — avatar', () => {
  beforeEach(() => mockImageLoad());
  afterEach(() => vi.unstubAllGlobals());

  it('shows the profile picture instead of the generic initial when the user has one configured', async () => {
    mockFetchAllUsersByOrg.mockResolvedValue({
      data: [makeUser({ avatarUrl: 'https://cdn.example.com/alice.png' })],
      nextCursor: null,
      hasMore: false,
    });

    render(<CompanyUsersTableHarness />, { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(screen.getByAltText('Alice Smith')).toHaveAttribute(
        'src',
        'https://cdn.example.com/alice.png',
      );
    });
  });

  it('falls back to the generic initial avatar when the user has no profile picture', async () => {
    mockFetchAllUsersByOrg.mockResolvedValue({
      data: [makeUser({ avatarUrl: null })],
      nextCursor: null,
      hasMore: false,
    });

    render(<CompanyUsersTableHarness />, { wrapper: makeWrapper() });
    await screen.findByText('Alice Smith');

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('A')).toBeInTheDocument();
  });
});
