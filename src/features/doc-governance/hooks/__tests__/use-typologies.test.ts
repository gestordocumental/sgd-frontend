import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';

// ── Module mocks — declared before any import that triggers them ───────────────

const mockList = vi.fn().mockResolvedValue([]);

vi.mock('@/lib/api/typologies', () => ({
  typologiesApi: {
    list: (...args: unknown[]) => mockList(...args),
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

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
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
