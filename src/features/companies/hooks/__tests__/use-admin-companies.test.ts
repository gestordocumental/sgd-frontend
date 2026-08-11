import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import '@/i18n';

// ── Module mocks — declared before any import that triggers them ───────────────

const mockList = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockRemove = vi.fn();
const mockRestore = vi.fn();

vi.mock('@/lib/api/companies', () => ({
  companiesApi: {
    list: (...args: unknown[]) => mockList(...args),
    create: (...args: unknown[]) => mockCreate(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
    remove: (...args: unknown[]) => mockRemove(...args),
    restore: (...args: unknown[]) => mockRestore(...args),
  },
}));

// ── Imports after mocks ───────────────────────────────────────────────────────

import { useAdminCompanies, type CompanyForm } from '../use-admin-companies';
import type { ApiCompany } from '@/lib/api/companies';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeCompany(overrides: Partial<ApiCompany> = {}): ApiCompany {
  return {
    id: 'org-1',
    name: 'Acme',
    nit: '900123456',
    address: 'Main St',
    phone: '5551234',
    status: 'active',
    createdBy: 'user-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    ...overrides,
  };
}

function makePage(data: ApiCompany[] = [makeCompany()], nextCursor: string | null = null) {
  return { data, nextCursor, hasMore: nextCursor !== null };
}

function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function makeWrapper(client: QueryClient = makeClient()) {
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockList.mockResolvedValue(makePage());
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useAdminCompanies — list query', () => {
  it('loads the first page of companies', async () => {
    const page = makePage([makeCompany({ id: 'org-1' }), makeCompany({ id: 'org-2' })]);
    mockList.mockResolvedValue(page);

    const { result } = renderHook(() => useAdminCompanies(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.companies).toHaveLength(2));
    expect(mockList).toHaveBeenCalledWith(
      { cursor: undefined, limit: 20, search: undefined, status: undefined },
      expect.anything(),
    );
  });

  it('resets to the first page and requests the new filter when search changes', async () => {
    const { result } = renderHook(() => useAdminCompanies(), { wrapper: makeWrapper() });
    await waitFor(() => expect(mockList).toHaveBeenCalled());
    mockList.mockClear();

    act(() => result.current.setSearch('acme'));
    // Search is debounced 400ms — advance past it to trigger the query.
    await waitFor(
      () =>
        expect(mockList).toHaveBeenCalledWith(
          expect.objectContaining({ search: 'acme' }),
          expect.anything(),
        ),
      { timeout: 1000 },
    );
  });

  it('resets to the first page when the status filter changes', async () => {
    const { result } = renderHook(() => useAdminCompanies(), { wrapper: makeWrapper() });
    await waitFor(() => expect(mockList).toHaveBeenCalled());
    mockList.mockClear();

    act(() => result.current.setStatusFilter('inactive'));

    await waitFor(() =>
      expect(mockList).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'inactive' }),
        expect.anything(),
      ),
    );
  });

  it('drops the status filter (sends undefined) when set to "all"', async () => {
    // The default statusFilter is already 'all', so switching straight to
    // 'inactive' then back would hit react-query's staleTime cache for the
    // already-fetched 'all' key and never re-invoke the queryFn — going
    // 'inactive' → a fresh 'active' key instead proves the mapping without
    // relying on a second, cached 'all' fetch.
    const { result } = renderHook(() => useAdminCompanies(), { wrapper: makeWrapper() });
    await waitFor(() =>
      expect(mockList).toHaveBeenCalledWith(
        expect.objectContaining({ status: undefined }),
        expect.anything(),
      ),
    );
    mockList.mockClear();

    act(() => result.current.setStatusFilter('active'));
    await waitFor(() =>
      expect(mockList).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'active' }),
        expect.anything(),
      ),
    );
  });

  it('advances and goes back through cursor pages', async () => {
    mockList.mockResolvedValueOnce(makePage([makeCompany({ id: 'org-1' })], 'cursor-2'));
    const { result } = renderHook(() => useAdminCompanies(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.hasNextPage).toBe(true));

    mockList.mockResolvedValueOnce(makePage([makeCompany({ id: 'org-2' })], null));
    act(() => result.current.goNextPage());

    await waitFor(() =>
      expect(mockList).toHaveBeenCalledWith(
        expect.objectContaining({ cursor: 'cursor-2' }),
        expect.anything(),
      ),
    );
    expect(result.current.hasPrevPage).toBe(true);

    act(() => result.current.goPrevPage());
    await waitFor(() => expect(result.current.hasPrevPage).toBe(false));
  });

  it('goNextPage is a no-op without a nextCursor', async () => {
    const { result } = renderHook(() => useAdminCompanies(), { wrapper: makeWrapper() });
    await waitFor(() => expect(mockList).toHaveBeenCalled());
    mockList.mockClear();

    act(() => result.current.goNextPage());

    expect(mockList).not.toHaveBeenCalled();
  });

  it('refreshCompanies resets the cursor and invalidates the companies cache', async () => {
    mockList.mockResolvedValueOnce(makePage([makeCompany({ id: 'org-1' })], 'cursor-2'));
    const { result } = renderHook(() => useAdminCompanies(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.hasNextPage).toBe(true));
    mockList.mockResolvedValueOnce(makePage([makeCompany({ id: 'org-2' })], null));
    act(() => result.current.goNextPage());
    await waitFor(() => expect(result.current.hasPrevPage).toBe(true));

    mockList.mockClear();
    mockList.mockResolvedValue(makePage());
    act(() => result.current.refreshCompanies());

    await waitFor(() => expect(result.current.hasPrevPage).toBe(false));
    expect(mockList).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: undefined }),
      expect.anything(),
    );
  });
});

describe('useAdminCompanies — create', () => {
  it('creates a company and closes the dialog on success', async () => {
    mockCreate.mockResolvedValue(makeCompany());
    const { result } = renderHook(() => useAdminCompanies(), { wrapper: makeWrapper() });
    act(() => result.current.openCreate());

    await act(async () => {
      await result.current.onCreateSubmit({
        name: 'Acme',
      } as CompanyForm);
    });

    expect(mockCreate).toHaveBeenCalledWith({ name: 'Acme' });
    await waitFor(() => expect(result.current.createOpen).toBe(false));
  });

  it('shows the translated warning on the name field when the company name is already registered, instead of failing silently', async () => {
    // Regression: createMutation had no onError at all — creating a company
    // with a name the backend already rejects (409 COMPANY_ALREADY_EXISTS)
    // used to give the admin no feedback whatsoever; the dialog just sat
    // there as if nothing happened.
    mockCreate.mockRejectedValue({
      response: {
        data: {
          errorCode: 'COMPANY_ALREADY_EXISTS',
          message: 'fallback',
          params: { name: 'Acme' },
        },
      },
    });
    const { result } = renderHook(() => useAdminCompanies(), { wrapper: makeWrapper() });
    act(() => result.current.openCreate());

    await act(async () => {
      await result.current.onCreateSubmit({ name: 'Acme' } as CompanyForm);
    });

    // Dialog must stay open — the admin needs to see and fix the error.
    expect(result.current.createOpen).toBe(true);
    await waitFor(() =>
      expect(result.current.createForm.formState.errors.name?.message).toBe(
        'A company named "Acme" is already registered.',
      ),
    );
  });
});

describe('useAdminCompanies — edit', () => {
  it('populates the edit form from the company', () => {
    const { result } = renderHook(() => useAdminCompanies(), { wrapper: makeWrapper() });
    const company = makeCompany();

    act(() => result.current.openEdit(company));

    expect(result.current.editCompany).toBe(company);
    expect(result.current.editForm.getValues()).toEqual({
      name: 'Acme',
      nit: '900123456',
      address: 'Main St',
      phone: '5551234',
    });
  });

  it('falls back to empty strings for null nit/address/phone', () => {
    const { result } = renderHook(() => useAdminCompanies(), { wrapper: makeWrapper() });
    const company = makeCompany({ nit: null, address: null, phone: null });

    act(() => result.current.openEdit(company));

    expect(result.current.editForm.getValues('nit')).toBe('');
    expect(result.current.editForm.getValues('address')).toBe('');
    expect(result.current.editForm.getValues('phone')).toBe('');
  });

  it('updates a company, refreshes the list and syncs the selected company on success', async () => {
    const company = makeCompany();
    const updated = makeCompany({ name: 'New Name' });
    mockUpdate.mockResolvedValue(updated);
    const { result } = renderHook(() => useAdminCompanies(), { wrapper: makeWrapper() });
    act(() => result.current.openEdit(company));
    act(() => result.current.toggleExpand(company)); // sets selectedCompany

    await act(async () => {
      await result.current.onEditSubmit({
        name: 'New Name',
      } as CompanyForm);
    });

    expect(mockUpdate).toHaveBeenCalledWith(company.id, { name: 'New Name' });
    await waitFor(() => expect(result.current.editCompany).toBeNull());
    expect(result.current.selectedCompany).toEqual(updated);
  });

  it('shows the translated warning on the name field when renaming to an already-registered name', async () => {
    const company = makeCompany();
    mockUpdate.mockRejectedValue({
      response: {
        data: {
          errorCode: 'COMPANY_ALREADY_EXISTS',
          message: 'fallback',
          params: { name: 'Taken' },
        },
      },
    });
    const { result } = renderHook(() => useAdminCompanies(), { wrapper: makeWrapper() });
    act(() => result.current.openEdit(company));

    await act(async () => {
      await result.current.onEditSubmit({ name: 'Taken' } as CompanyForm);
    });

    // Dialog must stay open — the admin needs to see and fix the error.
    expect(result.current.editCompany).toBe(company);
    await waitFor(() =>
      expect(result.current.editForm.formState.errors.name?.message).toBe(
        'A company named "Taken" is already registered.',
      ),
    );
  });

  it('onEditSubmit is a no-op when no company is being edited', async () => {
    const { result } = renderHook(() => useAdminCompanies(), { wrapper: makeWrapper() });

    await act(async () => {
      await result.current.onEditSubmit({
        name: 'New Name',
      } as CompanyForm);
    });

    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

describe('useAdminCompanies — delete', () => {
  it('deletes a company, closes the dialog, clears selection and collapses the row', async () => {
    mockRemove.mockResolvedValue(undefined);
    const { result } = renderHook(() => useAdminCompanies(), { wrapper: makeWrapper() });
    const company = makeCompany();
    act(() => result.current.toggleExpand(company)); // expand + select
    act(() => result.current.setDeleteCompany(company));

    act(() => result.current.deleteMutation.mutate(company.id));

    await waitFor(() => expect(result.current.deleteCompany).toBeNull());
    expect(result.current.selectedCompany).toBeNull();
    expect(result.current.expandedCompanies.has(company.id)).toBe(false);
  });
});

describe('useAdminCompanies — status toggle and restore', () => {
  it('toggles a company status and refreshes the list', async () => {
    mockUpdate.mockResolvedValue(makeCompany({ status: 'inactive' }));
    const { result } = renderHook(() => useAdminCompanies(), { wrapper: makeWrapper() });
    mockList.mockClear();

    act(() => result.current.toggleStatusMutation.mutate({ id: 'org-1', status: 'inactive' }));

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith('org-1', { status: 'inactive' }));
    await waitFor(() => expect(mockList).toHaveBeenCalled());
  });

  it('restores a deleted company and refreshes the list', async () => {
    mockRestore.mockResolvedValue(makeCompany());
    const { result } = renderHook(() => useAdminCompanies(), { wrapper: makeWrapper() });
    mockList.mockClear();

    act(() => result.current.restoreMutation.mutate('org-1'));

    await waitFor(() => expect(mockRestore).toHaveBeenCalledWith('org-1'));
    await waitFor(() => expect(mockList).toHaveBeenCalled());
  });
});

describe('useAdminCompanies — row expand/collapse', () => {
  it('expands a row and marks it selected', () => {
    const { result } = renderHook(() => useAdminCompanies(), { wrapper: makeWrapper() });
    const company = makeCompany();

    act(() => result.current.toggleExpand(company));

    expect(result.current.expandedCompanies.has(company.id)).toBe(true);
    expect(result.current.selectedCompany).toEqual(company);
  });

  it('collapses an expanded row and clears the selection', () => {
    const { result } = renderHook(() => useAdminCompanies(), { wrapper: makeWrapper() });
    const company = makeCompany();
    act(() => result.current.toggleExpand(company));

    act(() => result.current.toggleExpand(company));

    expect(result.current.expandedCompanies.has(company.id)).toBe(false);
    expect(result.current.selectedCompany).toBeNull();
  });
});
