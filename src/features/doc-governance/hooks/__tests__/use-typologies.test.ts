import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';

// ── Module mocks — declared before any import that triggers them ───────────────

const mockList = vi.fn().mockResolvedValue([]);
const mockCreate = vi.fn();

vi.mock('@/lib/api/typologies', () => ({
  typologiesApi: {
    list: (...args: unknown[]) => mockList(...args),
    create: (...args: unknown[]) => mockCreate(...args),
  },
}));

vi.mock('@/lib/api/org-structure', () => ({
  orgStructureApi: {
    listDepartamentos: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('@/store/authStore', () => ({
  useAuthStore: (selector: (s: { user: { companyName: string } }) => unknown) =>
    selector({ user: { companyName: 'Test Org' } }),
}));

// ── Imports after mocks ───────────────────────────────────────────────────────

import { useTypologies } from '../use-typologies';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

function makeWrapper(client: QueryClient = makeClient()) {
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockList.mockResolvedValue([]);
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useTypologies — status filter', () => {
  it('defaults to ACTIVE and only requests active typologies', async () => {
    renderHook(() => useTypologies('org-1'), { wrapper: makeWrapper() });

    await waitFor(() => expect(mockList).toHaveBeenCalled());

    expect(mockList).toHaveBeenCalledWith(
      'org-1',
      { limit: 100, status: 'ACTIVE' },
      expect.anything(),
    );
  });

  it('drops the status filter when set to "all", requesting every typology', async () => {
    const { result } = renderHook(() => useTypologies('org-1'), { wrapper: makeWrapper() });
    await waitFor(() => expect(mockList).toHaveBeenCalled());
    mockList.mockClear();

    act(() => result.current.setStatusFilter('all'));

    await waitFor(() => expect(mockList).toHaveBeenCalled());
    expect(mockList).toHaveBeenCalledWith('org-1', { limit: 100 }, expect.anything());
  });

  it('requests a specific status when the filter is changed to it', async () => {
    const { result } = renderHook(() => useTypologies('org-1'), { wrapper: makeWrapper() });
    await waitFor(() => expect(mockList).toHaveBeenCalled());
    mockList.mockClear();

    act(() => result.current.setStatusFilter('ARCHIVED'));

    await waitFor(() => expect(mockList).toHaveBeenCalled());
    expect(mockList).toHaveBeenCalledWith(
      'org-1',
      { limit: 100, status: 'ARCHIVED' },
      expect.anything(),
    );
  });
});

// ── createMutation — cache invalidation ───────────────────────────────────────
// Regression: after creating a typology, the dashboard "Resumen" (typology-stats)
// and "Auditoría" (audit-logs) views used to keep serving stale cached data
// until a full page reload, because only the typology list/history were
// invalidated.

describe('useTypologies — createMutation invalidation', () => {
  it('invalidates typology list, history, stats and both audit-logs caches after a successful create', async () => {
    mockCreate.mockResolvedValue({ id: 'ty-new' });
    const client = makeClient();
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');

    const { result } = renderHook(() => useTypologies('org-1'), { wrapper: makeWrapper(client) });
    await waitFor(() => expect(mockList).toHaveBeenCalled());

    await act(async () => {
      await result.current.createMutation.mutateAsync({
        departamentoId: 'dep-1',
        areaId: '',
        cargoId: '',
        nombre: 'Contrato',
        codigo: 'CT-001',
        version: 'v1',
        reviewCycleEnabled: false,
      });
    });

    const invalidatedKeys = invalidateSpy.mock.calls.map((call) => call[0]?.queryKey);
    expect(invalidatedKeys).toEqual(
      expect.arrayContaining([
        ['typologies', 'org-1'],
        ['typologies-history', 'org-1'],
        ['typology-stats', 'org-1'],
        // Org-scoped audit view (use-audit.ts keys on the orgId)...
        ['audit-logs', 'org-1'],
        // ...and the super-admin's cross-org view, which keys on 'all' instead
        // of an orgId — a separate cache entry the line above doesn't match.
        ['audit-logs', 'all'],
      ]),
    );
  });
});
