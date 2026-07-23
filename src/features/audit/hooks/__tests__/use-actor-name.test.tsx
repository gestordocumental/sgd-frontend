import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { useActorName } from '../use-actor-name';
import type { SimpleUser } from '../../components/audit-table.utils';

const mockGetById = vi.fn();
vi.mock('@/lib/api/users', () => ({
  usersApi: { getById: (...args: unknown[]) => mockGetById(...args) },
}));

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
}

describe('useActorName', () => {
  beforeEach(() => {
    mockGetById.mockReset();
  });

  it('returns the server-resolved name immediately, without calling usersApi.getById', async () => {
    // Regression: actor names must not depend on the viewer holding
    // USERS:READ. usersApi.getById is a permission-gated endpoint — calling
    // it as a "fallback" even when a server-resolved name already exists
    // would 403 for a viewer without USERS:READ, for no benefit.
    const { result } = renderHook(() => useActorName('user-1', [], 'Ada Lovelace'), {
      wrapper: makeWrapper(),
    });

    expect(result.current).toBe('Ada Lovelace');
    await waitFor(() => expect(mockGetById).not.toHaveBeenCalled());
  });

  it('falls back to the local users list when no server-resolved name is given', () => {
    const users: SimpleUser[] = [
      { id: 'user-1', firstName: 'Ana', lastName: 'Lopez', email: 'ana@test.com' },
    ];
    const { result } = renderHook(() => useActorName('user-1', users), {
      wrapper: makeWrapper(),
    });

    expect(result.current).toBe('Ana Lopez');
    expect(mockGetById).not.toHaveBeenCalled();
  });

  it('falls back to fetching by ID only when neither a server-resolved name nor a local match exists', async () => {
    mockGetById.mockResolvedValue({
      id: 'user-1',
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@test.com',
    });

    const { result } = renderHook(() => useActorName('user-1', [], null), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current).toBe('Ada Lovelace'));
    expect(mockGetById).toHaveBeenCalledWith('user-1', expect.anything());
  });

  it('returns the raw actorId when nothing resolves it', () => {
    const { result } = renderHook(() => useActorName('user-1', []), {
      wrapper: makeWrapper(),
    });

    expect(result.current).toBe('user-1');
  });
});
