import { useQuery } from '@tanstack/react-query';
import { usersApi } from '@/lib/api/users';
import type { SimpleUser } from '../components/audit-table.utils';

/**
 * Resolves an actorId to a display name.
 * Checks the provided users list first; if not found (e.g. super-admin acting in an org context),
 * fetches the user by ID from the API and caches the result.
 */
export function useActorName(actorId: string, users: SimpleUser[]): string {
  const local = users.find((u) => u.id === actorId);

  const { data: fetched } = useQuery({
    queryKey: ['user-actor', actorId],
    queryFn: ({ signal }) => usersApi.getById(actorId, signal),
    staleTime: 10 * 60 * 1000,
    retry: false,
    enabled: !local && !!actorId,
  });

  if (local) {
    const name = [local.firstName, local.lastName].filter(Boolean).join(' ').trim();
    return name || local.email || actorId;
  }
  if (fetched) {
    const name = [fetched.firstName, fetched.lastName].filter(Boolean).join(' ').trim();
    return name || fetched.email || actorId;
  }
  return actorId;
}
