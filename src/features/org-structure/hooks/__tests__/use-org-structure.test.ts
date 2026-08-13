import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import '@/i18n';

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockDeleteDepartamento = vi.fn();
const mockDeleteArea = vi.fn();

vi.mock('@/lib/api/org-structure', () => ({
  orgStructureApi: {
    listDepartamentos: vi.fn().mockResolvedValue([]),
    listAreas: vi.fn().mockResolvedValue([]),
    listCargos: vi.fn().mockResolvedValue([]),
    listDeptCargos: vi.fn().mockResolvedValue([]),
    createDepartamento: vi.fn(),
    updateDepartamento: vi.fn(),
    deleteDepartamento: (...args: unknown[]) => mockDeleteDepartamento(...args),
    createArea: vi.fn(),
    updateArea: vi.fn(),
    deleteArea: (...args: unknown[]) => mockDeleteArea(...args),
    createCargo: vi.fn(),
    updateCargo: vi.fn(),
    deleteCargo: vi.fn(),
    createDeptCargo: vi.fn(),
    updateDeptCargo: vi.fn(),
    deleteDeptCargo: vi.fn(),
    bulkImportStructure: vi.fn(),
  },
}));

const mockToastError = vi.fn();
vi.mock('sonner', () => ({
  toast: { error: (...args: unknown[]) => mockToastError(...args) },
}));

// ── Import hook AFTER mocks ───────────────────────────────────────────────────

import { useOrgStructure } from '../use-org-structure';

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
}

describe('useOrgStructure — delete error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows a toast with the translated dependency message when deleting a departamento fails with DEPARTMENT_HAS_DEPENDENCIES', async () => {
    // Regression: deleteDeptMutation had no onError handler at all — a
    // rejected deletion (e.g. the backend now correctly refusing to delete a
    // departamento that still has areas/cargos) used to fail completely
    // silently, leaving the user with no explanation.
    mockDeleteDepartamento.mockRejectedValue({
      response: {
        data: {
          errorCode: 'DEPARTMENT_HAS_DEPENDENCIES',
          message:
            'Cannot delete departamento "Finanzas": it still has 2 area(s) and 1 cargo(s) associated',
          params: { id: 'dep-1', areasCount: 2, cargosCount: 1 },
        },
      },
    });

    const { result } = renderHook(() => useOrgStructure('org-1'), { wrapper: makeWrapper() });

    act(() => {
      result.current.deleteDeptMutation.mutate('dep-1');
    });

    await waitFor(() => expect(mockToastError).toHaveBeenCalledTimes(1));
    const shown = mockToastError.mock.calls[0][0] as string;
    expect(shown).toContain('2 areas');
    expect(shown).toContain('1 position');
  });

  it('shows a toast with the translated dependency message when deleting an area fails with AREA_HAS_DEPENDENCIES', async () => {
    mockDeleteArea.mockRejectedValue({
      response: {
        data: {
          errorCode: 'AREA_HAS_DEPENDENCIES',
          message: 'Cannot delete area "Pagos": it still has 3 cargo(s) associated',
          params: { id: 'area-1', cargosCount: 3 },
        },
      },
    });

    const { result } = renderHook(() => useOrgStructure('org-1'), { wrapper: makeWrapper() });

    act(() => {
      result.current.deleteAreaMutation.mutate({
        id: 'area-1',
        orgId: 'org-1',
        departamentoId: 'dep-1',
        name: 'Pagos',
        description: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      });
    });

    await waitFor(() => expect(mockToastError).toHaveBeenCalledTimes(1));
    expect(mockToastError.mock.calls[0][0]).toContain('3 positions');
  });

  it('falls back to the generic delete-error message when the response has no errorCode', async () => {
    mockDeleteDepartamento.mockRejectedValue(new Error('network down'));

    const { result } = renderHook(() => useOrgStructure('org-1'), { wrapper: makeWrapper() });

    act(() => {
      result.current.deleteDeptMutation.mutate('dep-1');
    });

    await waitFor(() => expect(mockToastError).toHaveBeenCalledTimes(1));
    expect(mockToastError).toHaveBeenCalledWith("Couldn't delete it. Please try again.");
  });
});
