import { useQuery } from '@tanstack/react-query';
import { usersApi } from '@/lib/api/users';
import type { SimpleUser } from '../components/audit-table.utils';

/**
 * Resolves an actorId to a display name.
 *
 * Prefers `serverResolvedName` (from AuditLogEntry.actorName, resolved
 * server-side — see AuditService.resolveActorNames — so it works regardless
 * of whether the viewer's role has USERS:READ). Only falls back to the local
 * `users` list, then a permission-gated GET /users/:id call, when the server
 * didn't provide one (e.g. an older cached response) — that fallback fetch
 * would 403 for a viewer without USERS:READ, so it's skipped entirely once a
 * server-resolved name is already available.
 */
export function useActorName(
  actorId: string,
  users: SimpleUser[],
  serverResolvedName?: string | null,
): string {
  const local = users.find((u) => u.id === actorId);
  const needsFetch = !serverResolvedName && !local;

  const { data: fetched } = useQuery({
    queryKey: ['user-actor', actorId],
    queryFn: ({ signal }) => usersApi.getById(actorId, signal),
    staleTime: 10 * 60 * 1000,
    retry: false,
    enabled: needsFetch && !!actorId,
  });

  if (serverResolvedName) return serverResolvedName;
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
