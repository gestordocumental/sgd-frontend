import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@/i18n';
import { UsersTable } from '../UsersTable';
import type { AdminUsersHook } from '@/features/users/hooks/use-admin-users';
import type { ApiUser } from '@/lib/api/users';
import { useAuthStore } from '@/store/authStore';

// jsdom has zero-height elements — the virtualizer renders 0 items unless we
// make it believe all items are visible regardless of scroll position.
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count, estimateSize }: { count: number; estimateSize: () => number }) => {
    const size = estimateSize();
    return {
      getVirtualItems: () =>
        Array.from({ length: count }, (_, i) => ({
          index: i,
          key: i,
          start: i * size,
          end: (i + 1) * size,
          lane: 0,
          size,
        })),
      getTotalSize: () => count * size,
    };
  },
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeUser(overrides: Partial<ApiUser> = {}): ApiUser {
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
    ...overrides,
  };
}

function makeHook(overrides: Partial<AdminUsersHook> = {}): AdminUsersHook {
  return {
    users: [],
    superAdmins: [],
    superAdminsTotal: 0,
    superAdminsTotalPages: 1,
    superAdminsActiveTotal: 0,
    superAdminsInactiveTotal: 0,
    superAdminsLoading: false,
    superAdminsIsFetching: false,
    superAdminsDataUpdatedAt: Date.now(),
    refreshSuperAdmins: vi.fn(),
    saSearch: '',
    setSaSearch: vi.fn(),
    saStatus: 'all' as const,
    setSaStatus: vi.fn(),
    saPage: 1,
    setSaPage: vi.fn(),
    createOpen: false,
    setCreateOpen: vi.fn(),
    invitedUser: null,
    setInvitedUser: vi.fn(),
    createUserContext: 'super-admin' as const,
    companyRoles: [],
    departamentos: [],
    areas: [],
    cargos: [],
    selectedDeptId: '',
    setSelectedDeptId: vi.fn(),
    selectedAreaId: '',
    setSelectedAreaId: vi.fn(),
    editUser: null,
    setEditUser: vi.fn(),
    deleteUser: null,
    setDeleteUser: vi.fn(),
    openCreate: vi.fn(),
    openEdit: vi.fn(),
    onCreateSubmit: vi.fn(),
    onEditSubmit: vi.fn(),
    createForm: {} as AdminUsersHook['createForm'],
    editForm: {} as AdminUsersHook['editForm'],
    createMutation: {
      mutate: vi.fn(),
      isPending: false,
    } as unknown as AdminUsersHook['createMutation'],
    editMutation: {
      mutate: vi.fn(),
      isPending: false,
    } as unknown as AdminUsersHook['editMutation'],
    deleteMutation: {
      mutate: vi.fn(),
      isPending: false,
    } as unknown as AdminUsersHook['deleteMutation'],
    restoreMutation: {
      mutate: vi.fn(),
      isPending: false,
    } as unknown as AdminUsersHook['restoreMutation'],
    disableMutation: {
      mutate: vi.fn(),
      isPending: false,
    } as unknown as AdminUsersHook['disableMutation'],
    enableMutation: {
      mutate: vi.fn(),
      isPending: false,
    } as unknown as AdminUsersHook['enableMutation'],
    toggleSuperAdminMutation: {
      mutate: vi.fn(),
      isPending: false,
    } as unknown as AdminUsersHook['toggleSuperAdminMutation'],
    resendInvitationMutation: {
      mutate: vi.fn(),
      isPending: false,
    } as unknown as AdminUsersHook['resendInvitationMutation'],
    ...overrides,
  } as AdminUsersHook;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

describe('UsersTable — loading state', () => {
  it('shows loading message while data is being fetched', () => {
    render(<UsersTable hook={makeHook({ superAdminsLoading: true })} />);
    expect(screen.getByText('Loading users...')).toBeInTheDocument();
  });
});

describe('UsersTable — empty state', () => {
  it('shows empty message when no users and no active filter', () => {
    render(<UsersTable hook={makeHook({ superAdmins: [], superAdminsTotal: 0 })} />);
    expect(screen.getByText('There are no registered users')).toBeInTheDocument();
  });

  it('shows "no results" message when search is active', () => {
    render(<UsersTable hook={makeHook({ superAdmins: [], saSearch: 'xyz' })} />);
    expect(screen.getByText('No results found')).toBeInTheDocument();
  });

  it('shows "no results" message when a status filter is active', () => {
    render(<UsersTable hook={makeHook({ superAdmins: [], saStatus: 'deleted' })} />);
    expect(screen.getByText('No results found')).toBeInTheDocument();
  });
});

describe('UsersTable — data rows', () => {
  it('renders a row for each user', () => {
    const users = [
      makeUser({ id: 'u-1', firstName: 'Alice', lastName: 'Smith', email: 'alice@co.com' }),
      makeUser({ id: 'u-2', firstName: 'Bob', lastName: 'Jones', email: 'bob@co.com' }),
    ];
    render(<UsersTable hook={makeHook({ superAdmins: users, superAdminsTotal: 2 })} />);
    expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    expect(screen.getByText('Bob Jones')).toBeInTheDocument();
  });

  it('renders Super Admin badge for super-admin users', () => {
    const user = makeUser({ isSuperAdmin: true });
    render(<UsersTable hook={makeHook({ superAdmins: [user] })} />);
    expect(screen.getByText('Super Admin')).toBeInTheDocument();
  });

  it('renders User badge for non-super-admin users', () => {
    const user = makeUser({ isSuperAdmin: false });
    render(<UsersTable hook={makeHook({ superAdmins: [user] })} />);
    // The table header and the badge both contain "User" — check for the badge specifically
    const matches = screen.getAllByText('User');
    const badge = matches.find((el) => el.dataset['slot'] === 'badge' || el.tagName === 'SPAN');
    expect(badge).toBeInTheDocument();
  });

  it('applies opacity to deleted user rows', () => {
    const deleted = makeUser({ deletedAt: '2024-06-01T00:00:00Z' });
    render(<UsersTable hook={makeHook({ superAdmins: [deleted] })} />);
    // The row should have opacity-50 class
    const rows = document.querySelectorAll('tr.opacity-50');
    expect(rows.length).toBeGreaterThan(0);
  });
});

describe('UsersTable — search', () => {
  it('calls setSaSearch when the search input changes', () => {
    const setSaSearch = vi.fn();
    render(<UsersTable hook={makeHook({ setSaSearch })} />);
    const input = screen.getByPlaceholderText('Search');
    fireEvent.change(input, { target: { value: 'alice' } });
    expect(setSaSearch).toHaveBeenCalledWith('alice');
  });

  it('reflects the current saSearch value in the input', () => {
    render(<UsersTable hook={makeHook({ saSearch: 'prefilled' })} />);
    expect(screen.getByPlaceholderText('Search')).toHaveValue('prefilled');
  });
});

describe('UsersTable — status filter', () => {
  it('calls setSaStatus when the filter changes', () => {
    const setSaStatus = vi.fn();
    render(<UsersTable hook={makeHook({ setSaStatus })} />);
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'deleted' } });
    expect(setSaStatus).toHaveBeenCalledWith('deleted');
  });
});

// The local Pager inside UsersTable.tsx renders "page / totalPages" text
// and two icon-only buttons (no aria-label). We locate them by their position.
function getPagerButtons() {
  // The pager renders after the table. Its two buttons are the last two buttons in the DOM
  // (after the Refresh button in the header). Filter to icon-only size-7 buttons.
  return Array.from(document.querySelectorAll<HTMLButtonElement>('button.size-7')).filter((btn) =>
    btn.querySelector('svg'),
  );
}

describe('UsersTable — pagination', () => {
  it('hides the pager when there is only one page', () => {
    render(<UsersTable hook={makeHook({ superAdminsTotalPages: 1 })} />);
    // No "X / Y" pager text visible
    expect(screen.queryByText(/\d+ \/ \d+/)).not.toBeInTheDocument();
  });

  it('shows the pager when there are multiple pages', () => {
    render(
      <UsersTable
        hook={makeHook({
          superAdmins: [makeUser()],
          superAdminsTotal: 50,
          superAdminsTotalPages: 3,
          saPage: 2,
        })}
      />,
    );
    expect(screen.getByText('2 / 3')).toBeInTheDocument();
  });

  it('calls setSaPage with next page when the next-page button is clicked', () => {
    const setSaPage = vi.fn();
    render(
      <UsersTable
        hook={makeHook({
          superAdmins: [makeUser()],
          superAdminsTotal: 50,
          superAdminsTotalPages: 3,
          saPage: 1,
          setSaPage,
        })}
      />,
    );
    // The last icon button in the pager is the "next" button
    const pagerBtns = getPagerButtons();
    fireEvent.click(pagerBtns[pagerBtns.length - 1]);
    expect(setSaPage).toHaveBeenCalledWith(2);
  });

  it('disables the previous button on the first page', () => {
    render(
      <UsersTable
        hook={makeHook({
          superAdmins: [makeUser()],
          superAdminsTotal: 50,
          superAdminsTotalPages: 3,
          saPage: 1,
        })}
      />,
    );
    const pagerBtns = getPagerButtons();
    // The second-to-last icon button is "previous"
    expect(pagerBtns[pagerBtns.length - 2]).toBeDisabled();
  });

  it('disables the next button on the last page', () => {
    render(
      <UsersTable
        hook={makeHook({
          superAdmins: [makeUser()],
          superAdminsTotal: 50,
          superAdminsTotalPages: 3,
          saPage: 3,
        })}
      />,
    );
    const pagerBtns = getPagerButtons();
    expect(pagerBtns[pagerBtns.length - 1]).toBeDisabled();
  });
});

describe('UsersTable — self row actions', () => {
  afterEach(() => {
    useAuthStore.setState({ user: null });
  });

  it("shows all actions for another user's row", async () => {
    const user = userEvent.setup();
    const other = makeUser({ id: 'u-1', firstName: 'Alice' });
    render(<UsersTable hook={makeHook({ superAdmins: [other] })} />);

    await user.click(screen.getByRole('button', { name: 'Actions for Alice' }));

    expect(await screen.findByRole('menuitem', { name: /^Edit$/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Disable/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Super Admin/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Delete/ })).toBeInTheDocument();
  });

  it("shows only Edit for the logged-in user's own row", async () => {
    useAuthStore.setState({
      user: { id: 'u-1', email: 'alice@co.com', name: 'Alice', role: 'user' },
    });
    const user = userEvent.setup();
    const self = makeUser({ id: 'u-1', firstName: 'Alice' });
    render(<UsersTable hook={makeHook({ superAdmins: [self] })} />);

    await user.click(screen.getByRole('button', { name: 'Actions for Alice' }));

    expect(await screen.findByRole('menuitem', { name: /^Edit$/ })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /Disable/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /Super Admin/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /Delete/ })).not.toBeInTheDocument();
  });
});
