import { useQuery } from '@tanstack/react-query'
import { usersApi } from '@/lib/api/users'
import { rolesApi, type PermissionModule, type PermissionAction } from '@/lib/api/roles'

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
export function useMyPermissions(
  companyId: string | null,
  isSuperAdmin: boolean,
) {
  const { data: myOrgRoles = [], isLoading: orgRolesLoading } = useQuery({
    queryKey: ['my-org-roles', companyId],
    queryFn: () => usersApi.getMyOrgRoles(),
    enabled: !!companyId && !isSuperAdmin,
    retry: false,
    staleTime: 60_000,
  })

  const myRoleIds = new Set(myOrgRoles.map((r) => r.roleId).filter(Boolean))

  const { data: allRoles = [], isPending: allRolesPending } = useQuery({
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
    isLoading: !isSuperAdmin && (orgRolesLoading || (myRoleIds.size > 0 && allRolesPending)),
  }
}
