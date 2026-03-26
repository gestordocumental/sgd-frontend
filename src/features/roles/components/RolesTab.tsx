import { useMemo } from 'react'
import { Shield, Key, ChevronRight, ChevronDown, MoreHorizontal, Pencil, Trash2, UserPlus, X, ShieldOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { initials } from '@/lib/formatters'
import { ALL_PERMISSIONS, type ApiRole, type ApiPermission, type ApiUserPermission } from '@/lib/api/roles'
import type { ApiUser } from '@/lib/api/users'
import type { useRoles } from '@/features/roles/hooks/use-roles'

type RolesHook = ReturnType<typeof useRoles>

interface RolesTabProps {
  hook: RolesHook
  users: ApiUser[]
}

export function RolesTab({ hook, users }: RolesTabProps) {
  const {
    roles,
    rolesLoading,
    userPermissions,
    expandedRoles, setExpandedRoles,
    expandedPermissions, setExpandedPermissions,
    openEdit,
    setDeleteRole,
    removeUserFromRoleMutation,
    setAssignRoleUser,
    setAssignPermUser,
    setRevokePermTarget,
  } = hook

  const [view, setView] = useMemo(() => {
    let v: 'by-role' | 'by-permission' = 'by-role'
    const setter = (val: 'by-role' | 'by-permission') => { v = val }
    return [v, setter] as const
  }, [])

  const toggleRole = (id: string) => {
    const next = new Set(expandedRoles)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setExpandedRoles(next)
  }

  const togglePermission = (id: string) => {
    const next = new Set(expandedPermissions)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setExpandedPermissions(next)
  }

  return (
    <main className="p-6 space-y-4">
      <RolesViewTabs
        roles={roles}
        rolesLoading={rolesLoading}
        users={users}
        userPermissions={userPermissions}
        expandedRoles={expandedRoles}
        expandedPermissions={expandedPermissions}
        onToggleRole={toggleRole}
        onTogglePermission={togglePermission}
        onEditRole={openEdit}
        onDeleteRole={setDeleteRole}
        onRemoveUserFromRole={(roleId, userId) => removeUserFromRoleMutation.mutate({ roleId, userId })}
        onAssignRoleUser={(role) => setAssignRoleUser({ role })}
        onAssignPermUser={(permissionId) => setAssignPermUser({ permissionId })}
        onRevokePermUser={(userId, permissionId) => setRevokePermTarget({ userId, permissionId })}
      />
    </main>
  )
}

// ── RolesViewTabs ─────────────────────────────────────────────────────────────

interface RolesViewTabsProps {
  roles: ApiRole[]
  rolesLoading: boolean
  users: ApiUser[]
  userPermissions: ApiUserPermission[]
  expandedRoles: Set<string>
  expandedPermissions: Set<string>
  onToggleRole: (id: string) => void
  onTogglePermission: (id: string) => void
  onEditRole: (r: ApiRole) => void
  onDeleteRole: (r: ApiRole) => void
  onRemoveUserFromRole: (roleId: string, userId: string) => void
  onAssignRoleUser: (role: ApiRole) => void
  onAssignPermUser: (permissionId: string) => void
  onRevokePermUser: (userId: string, permissionId: string) => void
}

function RolesViewTabs({
  roles, rolesLoading, users, userPermissions,
  expandedRoles, expandedPermissions,
  onToggleRole, onTogglePermission,
  onEditRole, onDeleteRole, onRemoveUserFromRole,
  onAssignRoleUser, onAssignPermUser, onRevokePermUser,
}: RolesViewTabsProps) {
  const { t } = useTranslation()
  return (
    <Tabs defaultValue="by-role" className="gap-0">
      <TabsList className="w-fit">
        <TabsTrigger value="by-role"><Shield className="size-4" />{t('roles.byRole')}</TabsTrigger>
        <TabsTrigger value="by-permission"><Key className="size-4" />{t('roles.byPermission')}</TabsTrigger>
      </TabsList>

      <TabsContent value="by-role" className="mt-4">
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          {rolesLoading ? (
            <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">{t('roles.loading')}</div>
          ) : roles.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">{t('roles.empty')}</div>
          ) : (
            <div className="divide-y divide-border">
              {roles.map((role) => (
                <RoleRow
                  key={role.id}
                  role={role}
                  users={users}
                  isExpanded={expandedRoles.has(role.id)}
                  onToggle={() => onToggleRole(role.id)}
                  onEdit={() => onEditRole(role)}
                  onDelete={() => onDeleteRole(role)}
                  onRemoveUser={(userId) => onRemoveUserFromRole(role.id, userId)}
                  onAssignUser={() => onAssignRoleUser(role)}
                />
              ))}
            </div>
          )}
        </div>
      </TabsContent>

      <TabsContent value="by-permission" className="mt-4">
        <ByPermissionView
          permissions={ALL_PERMISSIONS}
          roles={roles}
          users={users}
          userPermissions={userPermissions}
          expandedPermissions={expandedPermissions}
          onToggle={onTogglePermission}
          onAssignPermUser={onAssignPermUser}
          onRevokePermUser={onRevokePermUser}
        />
      </TabsContent>
    </Tabs>
  )
}

// ── RoleRow ───────────────────────────────────────────────────────────────────

interface RoleRowProps {
  role: ApiRole
  users: ApiUser[]
  isExpanded: boolean
  onToggle: () => void
  onEdit: () => void
  onDelete: () => void
  onRemoveUser: (userId: string) => void
  onAssignUser: () => void
}

function RoleRow({ role, users, isExpanded, onToggle, onEdit, onDelete, onRemoveUser, onAssignUser }: RoleRowProps) {
  const { t } = useTranslation()
  const roleUsers = users.filter((u) => role.userIds.includes(u.id))

  const getPermLabel = (permId: string) => {
    const perm = ALL_PERMISSIONS.find((p) => p.id === permId)
    if (!perm) return permId
    return t(`permissions.${perm.name}.label`, { defaultValue: perm.label })
  }

  return (
    <div>
      <div className="flex items-center gap-3 px-5 py-3.5 hover:bg-muted/30 transition-colors cursor-pointer" onClick={onToggle}>
        <button type="button" className="flex items-center justify-center size-6 rounded text-muted-foreground shrink-0" onClick={(e) => { e.stopPropagation(); onToggle() }}>
          {isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        </button>
        <div className="flex items-center justify-center size-8 rounded-md bg-primary/10 shrink-0">
          <Shield className="size-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{role.name}</p>
          <p className="text-xs text-muted-foreground">{role.description}</p>
        </div>
        <div className="flex items-center gap-3 shrink-0" onClick={(e) => e.stopPropagation()}>
          <span className="text-xs text-muted-foreground">{t('roles.permissionsCount', { count: role.permissionIds.length })}</span>
          <span className="text-xs text-muted-foreground">
            {roleUsers.length === 1
              ? t('roles.usersCount_one', { count: roleUsers.length })
              : t('roles.usersCount_other', { count: roleUsers.length })}
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex items-center justify-center size-8 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}><Pencil className="size-4" />{t('roles.actions.editRole')}</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={onDelete}>
                <Trash2 className="size-4" />{t('roles.actions.deleteRole')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {isExpanded && (
        <div className="bg-muted/30 border-t border-border px-14 py-4 space-y-4">
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">{t('roles.rolePermissions')}</p>
            <div className="flex flex-wrap gap-1.5">
              {role.permissionIds.length === 0 ? (
                <span className="text-xs text-muted-foreground">{t('roles.noPermissions')}</span>
              ) : (
                role.permissionIds.map((pid) => {
                  const perm = ALL_PERMISSIONS.find((p) => p.id === pid)
                  return perm ? <Badge key={pid} variant="outline" className="text-xs">{getPermLabel(pid)}</Badge> : null
                })
              )}
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{t('roles.assignedUsers')}</p>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onAssignUser}>
                <UserPlus className="size-3" />{t('roles.assignUser')}
              </Button>
            </div>
            {roleUsers.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t('roles.noUsers')}</p>
            ) : (
              <div className="space-y-1">
                {roleUsers.map((u) => (
                  <div key={u.id} className="flex items-center gap-2.5 py-1.5">
                    <Avatar className="size-6">
                      <AvatarFallback className="text-[9px] bg-primary/10 text-primary">{initials(u.firstName)}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm flex-1">{u.firstName} {u.lastName}</span>
                    <span className="text-xs text-muted-foreground">{u.position}</span>
                    <Button variant="ghost" size="icon" className="size-6 text-muted-foreground hover:text-destructive" onClick={() => onRemoveUser(u.id)}>
                      <X className="size-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── ByPermissionView ──────────────────────────────────────────────────────────

interface PermissionUserEntry {
  user: ApiUser
  viaRoles: ApiRole[]
  isDirect: boolean
}

function getUsersForPermission(permissionId: string, roles: ApiRole[], users: ApiUser[], userPermissions: ApiUserPermission[]): PermissionUserEntry[] {
  const map = new Map<string, PermissionUserEntry>()
  for (const role of roles) {
    if (!role.permissionIds.includes(permissionId)) continue
    for (const uid of role.userIds) {
      const user = users.find((u) => u.id === uid)
      if (!user) continue
      const existing = map.get(uid)
      if (existing) existing.viaRoles.push(role)
      else map.set(uid, { user, viaRoles: [role], isDirect: false })
    }
  }
  for (const up of userPermissions) {
    if (up.permissionId !== permissionId) continue
    const user = users.find((u) => u.id === up.userId)
    if (!user) continue
    const existing = map.get(up.userId)
    if (existing) existing.isDirect = true
    else map.set(up.userId, { user, viaRoles: [], isDirect: true })
  }
  return Array.from(map.values())
}

interface ByPermissionViewProps {
  permissions: ApiPermission[]
  roles: ApiRole[]
  users: ApiUser[]
  userPermissions: ApiUserPermission[]
  expandedPermissions: Set<string>
  onToggle: (id: string) => void
  onAssignPermUser: (permissionId: string) => void
  onRevokePermUser: (userId: string, permissionId: string) => void
}

function ByPermissionView({ permissions, roles, users, userPermissions, expandedPermissions, onToggle, onAssignPermUser, onRevokePermUser }: ByPermissionViewProps) {
  const { t } = useTranslation()
  const categories = useMemo(() => [...new Set(permissions.map((p) => p.category))], [permissions])

  const getPermLabel = (perm: ApiPermission) =>
    t(`permissions.${perm.name}.label`, { defaultValue: perm.label })

  const getPermDescription = (perm: ApiPermission) =>
    t(`permissions.${perm.name}.description`, { defaultValue: perm.description })

  const getCategoryLabel = (category: string) =>
    t(`permissions.categories.${category}`, { defaultValue: category })

  return (
    <div className="space-y-6">
      {categories.map((category) => (
        <div key={category}>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">{getCategoryLabel(category)}</p>
          <div className="rounded-lg border border-border bg-card overflow-hidden divide-y divide-border">
            {permissions.filter((p) => p.category === category).map((perm) => {
              const isExpanded = expandedPermissions.has(perm.id)
              const rolesWithPerm = roles.filter((r) => r.permissionIds.includes(perm.id))
              const usersWithPerm = getUsersForPermission(perm.id, roles, users, userPermissions)

              return (
                <div key={perm.id}>
                  <div className="flex items-center gap-3 px-5 py-3.5 hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => onToggle(perm.id)}>
                    <button type="button" className="flex items-center justify-center size-6 rounded text-muted-foreground shrink-0" onClick={(e) => { e.stopPropagation(); onToggle(perm.id) }}>
                      {isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                    </button>
                    <div className="flex items-center justify-center size-8 rounded-md bg-muted shrink-0">
                      <Key className="size-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{getPermLabel(perm)}</p>
                      <p className="text-xs text-muted-foreground">{getPermDescription(perm)}</p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap justify-end max-w-xs" onClick={(e) => e.stopPropagation()}>
                      {rolesWithPerm.slice(0, 3).map((r) => (
                        <Badge key={r.id} variant="secondary" className="text-xs shrink-0">{r.name}</Badge>
                      ))}
                      {rolesWithPerm.length > 3 && <Badge variant="outline" className="text-xs shrink-0">+{rolesWithPerm.length - 3}</Badge>}
                      {rolesWithPerm.length === 0 && <span className="text-xs text-muted-foreground">{t('common.noRole')}</span>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2" onClick={(e) => e.stopPropagation()}>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {usersWithPerm.length === 1
                          ? t('roles.usersCount_one', { count: usersWithPerm.length })
                          : t('roles.usersCount_other', { count: usersWithPerm.length })}
                      </span>
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); onAssignPermUser(perm.id) }}>
                        <UserPlus className="size-3" />{t('common.assign')}
                      </Button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="bg-muted/30 border-t border-border px-14 py-4 space-y-3">
                      {rolesWithPerm.length > 0 && (
                        <div>
                          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">{t('roles.rolesWithPermission')}</p>
                          <div className="flex flex-wrap gap-1.5">
                            {rolesWithPerm.map((r) => (
                              <Badge key={r.id} variant="outline" className="text-xs gap-1">
                                <Shield className="size-3" />{r.name}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      <div>
                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">{t('roles.usersWithAccess')}</p>
                        {usersWithPerm.length === 0 ? (
                          <p className="text-xs text-muted-foreground">{t('roles.noUsersWithPermission')}</p>
                        ) : (
                          <div className="space-y-1.5">
                            {usersWithPerm.map(({ user, viaRoles, isDirect }) => (
                              <div key={user.id} className="flex items-center gap-2.5 py-1">
                                <Avatar className="size-6">
                                  <AvatarFallback className="text-[9px] bg-primary/10 text-primary">{initials(user.firstName)}</AvatarFallback>
                                </Avatar>
                                <span className="text-sm font-medium min-w-[140px]">{user.firstName} {user.lastName}</span>
                                <div className="flex flex-wrap gap-1">
                                  {viaRoles.map((r) => (
                                    <Badge key={r.id} variant="secondary" className="text-[10px] px-1.5 py-0">
                                      <Shield className="size-2.5 mr-0.5" />{r.name}
                                    </Badge>
                                  ))}
                                  {isDirect && (
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-primary border-primary/30">
                                      <Key className="size-2.5 mr-0.5" />{t('roles.direct')}
                                    </Badge>
                                  )}
                                </div>
                                {isDirect && (
                                  <Button variant="ghost" size="icon" className="size-6 ml-auto text-muted-foreground hover:text-destructive" title={t('roles.revokeDirectPermissionTitle')} onClick={() => onRevokePermUser(user.id, perm.id)}>
                                    <ShieldOff className="size-3" />
                                  </Button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
