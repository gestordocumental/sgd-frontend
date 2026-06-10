import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { usersApi } from '@/lib/api/users';
import { rolesApi, type PermissionModule, type PermissionAction } from '@/lib/api/roles';

/**
 * Derives the current user's effective permissions within their current company.
 *
 * Flow:
 * 1. GET /api/users/me/org-roles — no permission required, returns current user's
 *    role assignments for the active company (companyId from JWT).
 * 2. GET /api/roles — no permission guard, returns all org roles with permissions.
 * 3. Cross-reference role IDs to build the user's effective permission set.
 *
 * Super admins bypass all checks and always return true.
 */
export function useMyPermissions(companyId: string | null, isSuperAdmin: boolean) {
  const { data: myOrgRoles = [], isLoading: orgRolesLoading } = useQuery({
    queryKey: ['my-org-roles', companyId],
    queryFn: ({ signal }) => usersApi.getMyOrgRoles(signal),
    enabled: !!companyId && !isSuperAdmin,
    retry: false,
    staleTime: 60_000,
  });

  const myRoleIds = useMemo(
    () => new Set(myOrgRoles.map((r) => r.roleId).filter(Boolean)),
    [myOrgRoles],
  );

  const { data: allRoles = [], isPending: allRolesPending } = useQuery({
    queryKey: ['roles', companyId],
    queryFn: ({ signal }) => rolesApi.listRoles(undefined, signal),
    enabled: !!companyId && myRoleIds.size > 0 && !isSuperAdmin,
    staleTime: 60_000,
  });

  const myPermissions = useMemo(() => {
    const perms = new Set<string>();
    for (const role of allRoles) {
      if (myRoleIds.has(role.id)) {
        for (const perm of role.permissions) {
          perms.add(`${perm.module}:${perm.action}`);
        }
      }
    }
    return perms;
  }, [allRoles, myRoleIds]);

  const hasPermission = useCallback(
    (module: PermissionModule, action: PermissionAction): boolean => {
      if (isSuperAdmin) return true;
      return myPermissions.has(`${module}:${action}`);
    },
    [isSuperAdmin, myPermissions],
  );

  return {
    hasPermission,
    isLoading: !isSuperAdmin && (orgRolesLoading || (myRoleIds.size > 0 && allRolesPending)),
  };
}
