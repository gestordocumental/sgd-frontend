import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockWorkflowsList = vi.fn();
const mockMyTasks = vi.fn();
const mockMyAvailable = vi.fn();
const mockGetTimeline = vi.fn();
const mockGetById = vi.fn();
const mockCreate = vi.fn();
const mockApprove = vi.fn();
const mockReject = vi.fn();
const mockDelete = vi.fn();
const mockUpdate = vi.fn();
const mockStartApproval = vi.fn();
const mockCreateAdminCycle = vi.fn();
const mockSkipReviewCycle = vi.fn();
const mockCompleteAdminStep = vi.fn();
const mockNotifyNoFinalUsers = vi.fn();

vi.mock('@/lib/api/workflows', () => ({
  workflowsApi: {
    list: () => mockWorkflowsList(),
    myTasks: () => mockMyTasks(),
    myAvailable: () => mockMyAvailable(),
    getTimeline: (id: string) => mockGetTimeline(id),
    getById: (id: string) => mockGetById(id),
    create: (dto: unknown) => mockCreate(dto),
    approve: (id: string, dto: unknown) => mockApprove(id, dto),
    reject: (id: string, dto: unknown) => mockReject(id, dto),
    remove: (id: string) => mockDelete(id),
    update: (id: string, dto: unknown) => mockUpdate(id, dto),
    startApproval: (id: string) => mockStartApproval(id),
    createAdminCycle: (id: string, dto: unknown) => mockCreateAdminCycle(id, dto),
    skipReviewCycle: (id: string) => mockSkipReviewCycle(id),
    completeAdminStep: (wId: string, cId: string, sId: string, dto: unknown) =>
      mockCompleteAdminStep(wId, cId, sId, dto),
    notifyNoFinalUsers: (dto: unknown) => mockNotifyNoFinalUsers(dto),
  },
}));

const mockTypologiesList = vi.fn();
vi.mock('@/lib/api/typologies', () => ({
  typologiesApi: {
    list: () => mockTypologiesList(),
    previewExtract: vi.fn(),
  },
}));

const mockListUsersByOrg = vi.fn();
vi.mock('@/lib/api/users', () => ({
  usersApi: { listUsersByOrg: () => mockListUsersByOrg() },
}));

const mockListRoles = vi.fn();
vi.mock('@/lib/api/roles', () => ({
  rolesApi: { listRoles: () => mockListRoles() },
}));

vi.mock('@/lib/api/workflow-files', () => ({
  workflowFilesApi: { upload: vi.fn() },
}));

// ── Import hook AFTER mocks ───────────────────────────────────────────────────

import { useWorkflows } from '../use-workflows';
import type { ApiWorkflow } from '@/lib/api/workflows';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
}

const BASE_TYPOLOGY = {
  id: 'typ-1',
  typologyStatus: 'ACTIVE' as const,
  datosDeclarados: { nombre: 'Contrato Marco', codigo: 'CM-001', version: 'v1' },
  estructuraOrg: { departamentoId: 'dep-1', areaId: 'area-1', cargoId: null },
};

const APPROVER_ROLE = {
  id: 'role-1',
  name: 'Aprobador',
  orgId: 'org-1',
  description: null,
  createdAt: '2024-01-01T00:00:00Z',
  permissions: [{ id: 'p-1', module: 'WORKFLOWS', action: 'APPROVE', description: null }],
};

const READER_ROLE = {
  id: 'role-2',
  name: 'Lector',
  orgId: 'org-1',
  description: null,
  createdAt: '2024-01-01T00:00:00Z',
  permissions: [{ id: 'p-2', module: 'DOCUMENTS', action: 'READ', description: null }],
};

const ADMIN_ROLE = {
  id: 'role-3',
  name: 'Administrador',
  orgId: 'org-1',
  description: null,
  createdAt: '2024-01-01T00:00:00Z',
  permissions: [{ id: 'p-3', module: 'USERS', action: 'WRITE', description: null }],
};

function makeUser(overrides = {}) {
  return {
    id: 'u-1',
    email: 'test@test.com',
    firstName: 'Juan',
    lastName: 'Perez',
    position: 'Dev',
    isActive: true,
    registrationStatus: 'active' as const,
    deletedAt: null,
    departamentoId: 'dep-1',
    areaId: 'area-1',
    cargoId: null,
    roles: [{ roleId: 'role-1', roleName: 'Aprobador' }],
    idNumber: null,
    isSuperAdmin: false,
    avatarUrl: null,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  // Default empty responses so queries don't block
  mockWorkflowsList.mockResolvedValue({ data: [], total: 0 });
  mockMyTasks.mockResolvedValue([]);
  mockMyAvailable.mockResolvedValue([]);
});

// ── 1. approverEligibleUsers ──────────────────────────────────────────────────

describe('useWorkflows — approverEligibleUsers', () => {
  it('returns only users with WORKFLOWS:APPROVE role when create dialog is open', async () => {
    mockListUsersByOrg.mockResolvedValue({
      data: [
        makeUser({ id: 'u-1', roles: [{ roleId: 'role-1', roleName: 'Aprobador' }] }),
        makeUser({ id: 'u-2', roles: [{ roleId: 'role-2', roleName: 'Lector' }] }),
      ],
      total: 2,
    });
    mockListRoles.mockResolvedValue([APPROVER_ROLE, READER_ROLE]);
    mockTypologiesList.mockResolvedValue([BASE_TYPOLOGY]);

    const { result } = renderHook(() => useWorkflows('org-1'), { wrapper: makeWrapper() });

    // Open create to trigger queries
    act(() => {
      result.current.actions.openCreate();
    });

    await waitFor(() =>
      expect(result.current.queries.approverEligibleUsers.length).toBeGreaterThan(0),
    );

    expect(result.current.queries.approverEligibleUsers.map((u) => u.id)).toEqual(['u-1']);
  });

  it('excludes inactive users from eligible approvers', async () => {
    mockListUsersByOrg.mockResolvedValue({
      data: [
        makeUser({
          id: 'u-1',
          isActive: false,
          roles: [{ roleId: 'role-1', roleName: 'Aprobador' }],
        }),
        makeUser({
          id: 'u-2',
          isActive: true,
          roles: [{ roleId: 'role-1', roleName: 'Aprobador' }],
        }),
      ],
      total: 2,
    });
    mockListRoles.mockResolvedValue([APPROVER_ROLE]);
    mockTypologiesList.mockResolvedValue([BASE_TYPOLOGY]);

    const { result } = renderHook(() => useWorkflows('org-1'), { wrapper: makeWrapper() });
    act(() => {
      result.current.actions.openCreate();
    });

    await waitFor(() =>
      expect(result.current.queries.approverEligibleUsers.length).toBeGreaterThan(0),
    );

    expect(result.current.queries.approverEligibleUsers.map((u) => u.id)).toEqual(['u-2']);
  });
});

// ── 1b. adminEligibleUsers ────────────────────────────────────────────────────

describe('useWorkflows — adminEligibleUsers', () => {
  it('returns only users with USERS:WRITE role, not the global isSuperAdmin flag', async () => {
    mockListUsersByOrg.mockResolvedValue({
      data: [
        makeUser({ id: 'u-1', roles: [{ roleId: 'role-3', roleName: 'Administrador' }] }),
        makeUser({ id: 'u-2', roles: [{ roleId: 'role-2', roleName: 'Lector' }] }),
        // isSuperAdmin alone must NOT make a user count as an admin — that flag
        // belongs to the global seeded superuser, not an org-level admin role.
        makeUser({
          id: 'u-3',
          isSuperAdmin: true,
          roles: [{ roleId: 'role-2', roleName: 'Lector' }],
        }),
      ],
      total: 3,
    });
    mockListRoles.mockResolvedValue([READER_ROLE, ADMIN_ROLE]);
    mockTypologiesList.mockResolvedValue([BASE_TYPOLOGY]);

    const { result } = renderHook(() => useWorkflows('org-1'), { wrapper: makeWrapper() });
    act(() => {
      result.current.actions.openCreate();
    });

    await waitFor(() =>
      expect(result.current.queries.adminEligibleUsers.length).toBeGreaterThan(0),
    );

    expect(result.current.queries.adminEligibleUsers.map((u) => u.id)).toEqual(['u-1']);
  });

  it('returns empty array when no org user has a USERS:WRITE role', async () => {
    mockListUsersByOrg.mockResolvedValue({
      data: [makeUser({ id: 'u-1', roles: [{ roleId: 'role-2', roleName: 'Lector' }] })],
      total: 1,
    });
    mockListRoles.mockResolvedValue([READER_ROLE]);
    mockTypologiesList.mockResolvedValue([BASE_TYPOLOGY]);

    const { result } = renderHook(() => useWorkflows('org-1'), { wrapper: makeWrapper() });
    act(() => {
      result.current.actions.openCreate();
    });

    await waitFor(() => expect(result.current.queries.activeOrgUsers.length).toBeGreaterThan(0));

    expect(result.current.queries.adminEligibleUsers).toEqual([]);
  });
});

// ── 2. finalUserEligibleUsers ─────────────────────────────────────────────────

describe('useWorkflows — finalUserEligibleUsers', () => {
  it('returns empty array when no typology is selected', async () => {
    mockListUsersByOrg.mockResolvedValue({ data: [makeUser()], total: 1 });
    mockListRoles.mockResolvedValue([APPROVER_ROLE]);
    mockTypologiesList.mockResolvedValue([BASE_TYPOLOGY]);

    const { result } = renderHook(() => useWorkflows('org-1'), { wrapper: makeWrapper() });
    act(() => {
      result.current.actions.openCreate();
    });

    // No typology selected → empty
    await waitFor(() => expect(result.current.queries.activeTypologies.length).toBeGreaterThan(0));
    expect(result.current.queries.finalUserEligibleUsers).toHaveLength(0);
  });

  it('filters users by departamentoId from the selected typology', async () => {
    mockListUsersByOrg.mockResolvedValue({
      data: [
        makeUser({ id: 'u-match', departamentoId: 'dep-1', areaId: 'area-1' }),
        makeUser({ id: 'u-nomatch', departamentoId: 'dep-2', areaId: 'area-1' }),
      ],
      total: 2,
    });
    mockListRoles.mockResolvedValue([APPROVER_ROLE]);
    mockTypologiesList.mockResolvedValue([BASE_TYPOLOGY]);

    const { result } = renderHook(() => useWorkflows('org-1'), { wrapper: makeWrapper() });
    act(() => {
      result.current.actions.openCreate();
    });

    await waitFor(() => expect(result.current.queries.activeTypologies.length).toBeGreaterThan(0));

    act(() => {
      result.current.dialogs.setSelectedTypologyId('typ-1');
    });

    await waitFor(() =>
      expect(result.current.queries.finalUserEligibleUsers.length).toBeGreaterThan(0),
    );
    expect(result.current.queries.finalUserEligibleUsers.map((u) => u.id)).toEqual(['u-match']);
  });

  it('further filters by areaId when typology has areaId defined', async () => {
    mockListUsersByOrg.mockResolvedValue({
      data: [
        makeUser({ id: 'u-right-area', departamentoId: 'dep-1', areaId: 'area-1' }),
        makeUser({ id: 'u-wrong-area', departamentoId: 'dep-1', areaId: 'area-2' }),
      ],
      total: 2,
    });
    mockListRoles.mockResolvedValue([APPROVER_ROLE]);
    mockTypologiesList.mockResolvedValue([BASE_TYPOLOGY]); // areaId: 'area-1'

    const { result } = renderHook(() => useWorkflows('org-1'), { wrapper: makeWrapper() });
    act(() => {
      result.current.actions.openCreate();
    });

    await waitFor(() => expect(result.current.queries.activeTypologies.length).toBeGreaterThan(0));
    act(() => {
      result.current.dialogs.setSelectedTypologyId('typ-1');
    });

    await waitFor(() =>
      expect(result.current.queries.finalUserEligibleUsers.length).toBeGreaterThan(0),
    );
    expect(result.current.queries.finalUserEligibleUsers.map((u) => u.id)).toEqual([
      'u-right-area',
    ]);
  });

  it('does not filter by areaId when typology areaId is null', async () => {
    const typNoArea = {
      ...BASE_TYPOLOGY,
      estructuraOrg: { departamentoId: 'dep-1', areaId: null, cargoId: null },
    };
    mockListUsersByOrg.mockResolvedValue({
      data: [
        makeUser({ id: 'u-a', departamentoId: 'dep-1', areaId: 'area-1' }),
        makeUser({ id: 'u-b', departamentoId: 'dep-1', areaId: 'area-2' }),
      ],
      total: 2,
    });
    mockListRoles.mockResolvedValue([APPROVER_ROLE]);
    mockTypologiesList.mockResolvedValue([typNoArea]);

    const { result } = renderHook(() => useWorkflows('org-1'), { wrapper: makeWrapper() });
    act(() => {
      result.current.actions.openCreate();
    });

    await waitFor(() => expect(result.current.queries.activeTypologies.length).toBeGreaterThan(0));
    act(() => {
      result.current.dialogs.setSelectedTypologyId('typ-1');
    });

    await waitFor(() =>
      expect(result.current.queries.finalUserEligibleUsers.length).toBeGreaterThan(0),
    );
    expect(result.current.queries.finalUserEligibleUsers.map((u) => u.id)).toContain('u-a');
    expect(result.current.queries.finalUserEligibleUsers.map((u) => u.id)).toContain('u-b');
  });
});

// ── 3. createBlocked ──────────────────────────────────────────────────────────

describe('useWorkflows — createBlocked', () => {
  it('is false when no document has been uploaded', () => {
    const { result } = renderHook(() => useWorkflows('org-1'), { wrapper: makeWrapper() });
    expect(result.current.extraction.createBlocked).toBe(false);
  });

  it('is false initially when no extraction has started', () => {
    const { result } = renderHook(() => useWorkflows('org-1'), { wrapper: makeWrapper() });

    expect(result.current.extraction.createBlocked).toBe(false);
    expect(result.current.extraction.documentExtractionLoading).toBe(false);
  });
});

// ── 4. addApprover / removeApprover ──────────────────────────────────────────

describe('useWorkflows — addApprover / removeApprover', () => {
  it('adds an approver to the list', () => {
    const { result } = renderHook(() => useWorkflows('org-1'), { wrapper: makeWrapper() });
    act(() => {
      result.current.actions.openCreate();
    });

    act(() => {
      result.current.dialogs.addApprover('u-1');
    });
    expect(result.current.dialogs.approverIds).toContain('u-1');
  });

  it('does not add the same approver twice', () => {
    const { result } = renderHook(() => useWorkflows('org-1'), { wrapper: makeWrapper() });
    act(() => {
      result.current.actions.openCreate();
    });

    act(() => {
      result.current.dialogs.addApprover('u-1');
      result.current.dialogs.addApprover('u-1');
    });
    expect(result.current.dialogs.approverIds.filter((id) => id === 'u-1')).toHaveLength(1);
  });

  it('removes a specific approver', () => {
    const { result } = renderHook(() => useWorkflows('org-1'), { wrapper: makeWrapper() });
    act(() => {
      result.current.actions.openCreate();
    });

    act(() => {
      result.current.dialogs.addApprover('u-1');
      result.current.dialogs.addApprover('u-2');
    });
    act(() => {
      result.current.dialogs.removeApprover('u-1');
    });

    expect(result.current.dialogs.approverIds).not.toContain('u-1');
    expect(result.current.dialogs.approverIds).toContain('u-2');
  });
});

// ── 5. openCreate resets all state ────────────────────────────────────────────

describe('useWorkflows — openCreate', () => {
  it('resets approvers, typology, finalUsers and errors on open', () => {
    const { result } = renderHook(() => useWorkflows('org-1'), { wrapper: makeWrapper() });

    // Add some state first
    act(() => {
      result.current.actions.openCreate();
    });
    act(() => {
      result.current.dialogs.addApprover('u-1');
      result.current.dialogs.setSelectedTypologyId('typ-1');
    });

    // Open again — should reset
    act(() => {
      result.current.actions.openCreate();
    });

    expect(result.current.dialogs.approverIds).toHaveLength(0);
    expect(result.current.dialogs.selectedTypologyId).toBe('');
    expect(result.current.dialogs.createError).toBeNull();
    expect(result.current.dialogs.createOpen).toBe(true);
  });
});

// ── 6. openDetailById ─────────────────────────────────────────────────────────

describe('useWorkflows — openDetailById', () => {
  it('fetches the workflow by ID when not found in cache', async () => {
    const fakeWorkflow = { id: 'wf-99', title: 'Test' } as ApiWorkflow;
    mockGetById.mockResolvedValue(fakeWorkflow);

    const { result } = renderHook(() => useWorkflows('org-1'), { wrapper: makeWrapper() });

    await act(async () => {
      await result.current.actions.openDetailById('wf-99');
    });

    expect(mockGetById).toHaveBeenCalledWith('wf-99');
    expect(result.current.dialogs.detailWorkflow?.id).toBe('wf-99');
  });

  it('reactively replaces a cached (name-less) row with the fully-resolved detail once GET /workflows/:id settles', async () => {
    // Regression guard: list rows never carry participantNames (only a
    // dedicated GET /workflows/:id resolves those). openDetailById's
    // cache-hit path just sets the cached row instantly — the exposed
    // detailWorkflow (dialogs.detailWorkflow, overridden with
    // queries.detailWorkflowFull ?? dialogs.detailWorkflow) is what
    // reactively fetches and prefers the fresh, fully-resolved version once
    // detailWorkflowId is derived from that row's id. Without this, a
    // viewer lacking USERS:READ would permanently see "Unknown user" for
    // createdBy/approval steps/final users.
    const cachedWorkflow = { id: 'wf-1', title: 'Cached', participantNames: {} } as ApiWorkflow;
    const freshWorkflow = {
      id: 'wf-1',
      title: 'Cached',
      participantNames: { 'user-1': 'Ada Lovelace' },
    } as unknown as ApiWorkflow;
    mockWorkflowsList.mockResolvedValue({ data: [cachedWorkflow], total: 1 });
    mockGetById.mockResolvedValue(freshWorkflow);

    const { result } = renderHook(() => useWorkflows('org-1'), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.queries.workflows).toContainEqual(cachedWorkflow));

    act(() => {
      result.current.actions.openDetailById('wf-1');
    });

    await waitFor(() => expect(mockGetById).toHaveBeenCalledWith('wf-1'));
    await waitFor(() =>
      expect(result.current.dialogs.detailWorkflow?.participantNames).toEqual({
        'user-1': 'Ada Lovelace',
      }),
    );
  });
});

// ── 7. orgUsersMap ────────────────────────────────────────────────────────────

describe('useWorkflows — orgUsersMap', () => {
  it('builds a map of userId → full name', async () => {
    mockListUsersByOrg.mockResolvedValue({
      data: [
        makeUser({ id: 'u-1', firstName: 'Ana', lastName: 'García' }),
        makeUser({ id: 'u-2', firstName: null, lastName: null, email: 'solo@email.com' }),
      ],
      total: 2,
    });
    mockListRoles.mockResolvedValue([]);
    mockTypologiesList.mockResolvedValue([]);

    const { result } = renderHook(() => useWorkflows('org-1'), { wrapper: makeWrapper() });
    act(() => {
      result.current.actions.openCreate();
    });

    await waitFor(() => expect(result.current.queries.orgUsersMap.size).toBeGreaterThan(0));

    expect(result.current.queries.orgUsersMap.get('u-1')).toBe('Ana García');
    expect(result.current.queries.orgUsersMap.get('u-2')).toBe('solo@email.com');
  });
});
