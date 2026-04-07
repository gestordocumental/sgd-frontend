import { useQuery } from '@tanstack/react-query'
import { usersApi } from '@/lib/api/users'
import { rolesApi, type PermissionModule, type PermissionAction } from '@/lib/api/roles'

/**
 * Derives the current user's effective permissions within a company.
 *
 * Flow:
 * 1. Fetch the user's role assignments in the org (requires USERS:READ).
 *    If this fails (403), no role IDs are available → no permissions inferred.
 * 2. Fetch all org roles with their permission lists (no guard on this endpoint).
 * 3. Cross-reference to build the user's permission set.
 *
 * Super admins bypass all checks and always return true.
 */
export function useMyPermissions(
  companyId: string | null,
  userId: string | null,
  isSuperAdmin: boolean,
) {
  const { data: myOrgRoles = [], isLoading: orgRolesLoading } = useQuery({
    queryKey: ['my-org-roles', userId, companyId],
    queryFn: () => usersApi.getMyOrgRoles(userId!),
    enabled: !!userId && !!companyId && !isSuperAdmin,
    retry: false,
    staleTime: 60_000,
  })

  const myRoleIds = new Set(myOrgRoles.map((r) => r.roleId).filter(Boolean))

  const { data: allRoles = [], isLoading: allRolesLoading } = useQuery({
    queryKey: ['roles', companyId],
    queryFn: () => rolesApi.listRoles(),
    enabled: !!companyId && myRoleIds.size > 0 && !isSuperAdmin,
    staleTime: 60_000,
  })

  const myPermissions = new Set<string>()
  for (const role of allRoles) {
    if (myRoleIds.has(role.id)) {
      for (const perm of role.permissions) {
        myPermissions.add(`${perm.module}:${perm.action}`)
      }
    }
  }

  function hasPermission(module: PermissionModule, action: PermissionAction): boolean {
    if (isSuperAdmin) return true
    return myPermissions.has(`${module}:${action}`)
  }

  return {
    hasPermission,
    isLoading: !isSuperAdmin && (orgRolesLoading || allRolesLoading),
  }
}
