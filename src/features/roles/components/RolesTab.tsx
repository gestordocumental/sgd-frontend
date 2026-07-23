import { useMemo } from 'react';
import {
  Shield,
  Key,
  ChevronRight,
  ChevronDown,
  MoreHorizontal,
  Pencil,
  Trash2,
  UserPlus,
  X,
  Plus,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { initials } from '@/lib/formatters';
import { type ApiRole, type ApiPermission } from '@/lib/api/roles';
import type { ApiUserWithRoles } from '@/lib/api/users';
import type { useRoles } from '@/features/roles/hooks/use-roles';

type RolesHook = ReturnType<typeof useRoles>;

interface RolesTabProps {
  hook: RolesHook;
  users: ApiUserWithRoles[];
  canWrite?: boolean;
}

export function RolesTab({ hook, users, canWrite = false }: RolesTabProps) {
  const { t } = useTranslation();
  const {
    roles,
    rolesLoading,
    permissions,
    expandedRoles,
    setExpandedRoles,
    expandedPermissions,
    setExpandedPermissions,
    openEdit,
    openCreate,
    setDeleteRole,
    removeUserFromRoleMutation,
    setAssignRoleUser,
  } = hook;

  const toggleRole = (id: string) => {
    const next = new Set(expandedRoles);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedRoles(next);
  };

  const togglePermission = (id: string) => {
    const next = new Set(expandedPermissions);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedPermissions(next);
  };

  return (
    <main className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">{t('dashboard.rolesAndPermissions')}</h2>
        {canWrite && (
          <Button size="sm" onClick={openCreate}>
            <Plus className="size-4" />
            {t('dashboard.newRole')}
          </Button>
        )}
      </div>
      <RolesViewTabs
        roles={roles}
        rolesLoading={rolesLoading}
        permissions={permissions}
        users={users}
        canWrite={canWrite}
        expandedRoles={expandedRoles}
        expandedPermissions={expandedPermissions}
        onToggleRole={toggleRole}
        onTogglePermission={togglePermission}
        onEditRole={openEdit}
        onDeleteRole={setDeleteRole}
        onRemoveUserFromRole={(roleId, userId) =>
          removeUserFromRoleMutation.mutate({ userId, roleId })
        }
        onAssignRoleUser={(role) => setAssignRoleUser({ role })}
      />
    </main>
  );
}

// ── RolesViewTabs ─────────────────────────────────────────────────────────────

interface RolesViewTabsProps {
  roles: ApiRole[];
  rolesLoading: boolean;
  permissions: ApiPermission[];
  users: ApiUserWithRoles[];
  canWrite: boolean;
  expandedRoles: Set<string>;
  expandedPermissions: Set<string>;
  onToggleRole: (id: string) => void;
  onTogglePermission: (id: string) => void;
  onEditRole: (r: ApiRole) => void;
  onDeleteRole: (r: ApiRole) => void;
  onRemoveUserFromRole: (roleId: string, userId: string) => void;
  onAssignRoleUser: (role: ApiRole) => void;
}

function RolesViewTabs({
  roles,
  rolesLoading,
  permissions,
  users,
  canWrite,
  expandedRoles,
  expandedPermissions,
  onToggleRole,
  onTogglePermission,
  onEditRole,
  onDeleteRole,
  onRemoveUserFromRole,
  onAssignRoleUser,
}: RolesViewTabsProps) {
  const { t } = useTranslation();
  return (
    <Tabs defaultValue="by-role" className="gap-0">
      <TabsList className="w-fit">
        <TabsTrigger value="by-role">
          <Shield className="size-4" />
          {t('roles.byRole')}
        </TabsTrigger>
        <TabsTrigger value="by-permission">
          <Key className="size-4" />
          {t('roles.byPermission')}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="by-role" className="mt-4">
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          {rolesLoading ? (
            <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
              {t('roles.loading')}
            </div>
          ) : roles.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
              {t('roles.empty')}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {roles.map((role) => (
                <RoleRow
                  key={role.id}
                  role={role}
                  users={users}
                  canWrite={canWrite}
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
          permissions={permissions}
          roles={roles}
          users={users}
          expandedPermissions={expandedPermissions}
          onToggle={onTogglePermission}
        />
      </TabsContent>
    </Tabs>
  );
}

// ── RoleRow ───────────────────────────────────────────────────────────────────

interface RoleRowProps {
  role: ApiRole;
  users: ApiUserWithRoles[];
  canWrite: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onRemoveUser: (userId: string) => void;
  onAssignUser: () => void;
}

function RoleRow({
  role,
  users,
  canWrite,
  isExpanded,
  onToggle,
  onEdit,
  onDelete,
  onRemoveUser,
  onAssignUser,
}: RoleRowProps) {
  const { t } = useTranslation();
  const roleUsers = users.filter((u) => u.roles.some((r) => r.roleId === role.id));

  const getPermLabel = (p: ApiPermission) =>
    `${t(`permissions.actions.${p.action}`)} — ${t(`permissions.modules.${p.module}`)}`;

  return (
    <div>
      <div
        className="flex items-center gap-3 px-5 py-3.5 hover:bg-muted/30 transition-colors cursor-pointer"
        onClick={onToggle}
      >
        <button
          type="button"
          className="flex items-center justify-center size-6 rounded text-muted-foreground shrink-0"
          aria-label={
            isExpanded
              ? `${t('common.collapse')}: ${role.name}`
              : `${t('common.expand')}: ${role.name}`
          }
          aria-expanded={isExpanded}
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
        >
          {isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        </button>
        <div className="flex items-center justify-center size-8 rounded-md bg-primary/10 shrink-0">
          <Shield className="size-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium">{role.name}</p>
            {role.isSystem && (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {t('roles.systemBadge')}
                    </Badge>
                  }
                />
                <TooltipContent>{t('roles.systemRoleTooltip')}</TooltipContent>
              </Tooltip>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {t(`roles.systemDescriptions.${role.name}`, { defaultValue: role.description })}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0" onClick={(e) => e.stopPropagation()}>
          <span className="text-xs text-muted-foreground">
            {t('roles.permissionsCount', { count: role.permissions.length })}
          </span>
          <span className="text-xs text-muted-foreground">
            {roleUsers.length === 1
              ? t('roles.usersCount_one', { count: roleUsers.length })
              : t('roles.usersCount_other', { count: roleUsers.length })}
          </span>
          {canWrite && !role.isSystem && (
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label={t('roles.actions.menuLabel', { name: role.name })}
                className="inline-flex items-center justify-center size-8 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              >
                <MoreHorizontal className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onEdit}>
                  <Pencil className="size-4" />
                  {t('roles.actions.editRole')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={onDelete}
                >
                  <Trash2 className="size-4" />
                  {t('roles.actions.deleteRole')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="bg-muted/30 border-t border-border px-14 py-4 space-y-4">
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              {t('roles.rolePermissions')}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {role.permissions.length === 0 ? (
                <span className="text-xs text-muted-foreground">{t('roles.noPermissions')}</span>
              ) : (
                role.permissions.map((p) => (
                  <Badge key={p.id} variant="outline" className="text-xs">
                    {getPermLabel(p)}
                  </Badge>
                ))
              )}
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                {t('roles.assignedUsers')}
              </p>
              {canWrite && (
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onAssignUser}>
                  <UserPlus className="size-3" />
                  {t('roles.assignUser')}
                </Button>
              )}
            </div>
            {roleUsers.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t('roles.noUsers')}</p>
            ) : (
              <div className="space-y-1">
                {roleUsers.map((u) => (
                  <div key={u.id} className="flex items-center gap-2.5 py-1.5">
                    <Avatar className="size-6">
                      <AvatarFallback className="text-[9px] bg-primary/10 text-primary">
                        {initials(u.firstName)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm flex-1">
                      {u.firstName} {u.lastName}
                    </span>
                    <span className="text-xs text-muted-foreground">{u.position}</span>
                    {canWrite && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-6 text-muted-foreground hover:text-destructive"
                        aria-label={`${t('common.remove')}: ${u.firstName} ${u.lastName}`}
                        onClick={() => onRemoveUser(u.id)}
                      >
                        <X className="size-3" />
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
  );
}

// ── ByPermissionView ──────────────────────────────────────────────────────────

interface ByPermissionViewProps {
  permissions: ApiPermission[];
  roles: ApiRole[];
  users: ApiUserWithRoles[];
  expandedPermissions: Set<string>;
  onToggle: (id: string) => void;
}

function ByPermissionView({
  permissions,
  roles,
  users,
  expandedPermissions,
  onToggle,
}: ByPermissionViewProps) {
  const { t } = useTranslation();
  const modules = useMemo(() => [...new Set(permissions.map((p) => p.module))], [permissions]);

  const getPermLabel = (p: ApiPermission) =>
    `${t(`permissions.actions.${p.action}`)} — ${t(`permissions.modules.${p.module}`)}`;

  const getModuleLabel = (module: string) =>
    t(`permissions.modules.${module}`, { defaultValue: module });

  const usersByPermission = useMemo(() => {
    const result = new Map<string, Array<{ user: ApiUserWithRoles; viaRoles: ApiRole[] }>>();
    for (const role of roles) {
      const roleUsers = users.filter((u) => u.roles.some((r) => r.roleId === role.id));
      for (const perm of role.permissions) {
        const current = result.get(perm.id) ?? [];
        const byUser = new Map(current.map((x) => [x.user.id, x]));
        for (const user of roleUsers) {
          const existing = byUser.get(user.id);
          if (existing) existing.viaRoles.push(role);
          else byUser.set(user.id, { user, viaRoles: [role] });
        }
        result.set(perm.id, Array.from(byUser.values()));
      }
    }
    return result;
  }, [roles, users]);

  return (
    <div className="space-y-6">
      {modules.map((module) => (
        <div key={module}>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
            {getModuleLabel(module)}
          </p>
          <div className="rounded-lg border border-border bg-card overflow-hidden divide-y divide-border">
            {permissions
              .filter((p) => p.module === module)
              .map((perm) => {
                const isExpanded = expandedPermissions.has(perm.id);
                const rolesWithPerm = roles.filter((r) =>
                  r.permissions.some((p) => p.id === perm.id),
                );
                const usersWithPerm = usersByPermission.get(perm.id) ?? [];

                return (
                  <div key={perm.id}>
                    <div
                      className="flex items-center gap-3 px-5 py-3.5 hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => onToggle(perm.id)}
                    >
                      <button
                        type="button"
                        className="flex items-center justify-center size-6 rounded text-muted-foreground shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggle(perm.id);
                        }}
                      >
                        {isExpanded ? (
                          <ChevronDown className="size-4" />
                        ) : (
                          <ChevronRight className="size-4" />
                        )}
                      </button>
                      <div className="flex items-center justify-center size-8 rounded-md bg-muted shrink-0">
                        <Key className="size-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{getPermLabel(perm)}</p>
                        {perm.description && (
                          <p className="text-xs text-muted-foreground">
                            {t(`permissions.descriptions.${perm.module}.${perm.action}`, {
                              defaultValue: perm.description,
                            })}
                          </p>
                        )}
                      </div>
                      <div
                        className="flex items-center gap-1.5 flex-wrap justify-end max-w-xs"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {rolesWithPerm.slice(0, 3).map((r) => (
                          <Badge key={r.id} variant="secondary" className="text-xs shrink-0">
                            {r.name}
                          </Badge>
                        ))}
                        {rolesWithPerm.length > 3 && (
                          <Badge variant="outline" className="text-xs shrink-0">
                            +{rolesWithPerm.length - 3}
                          </Badge>
                        )}
                        {rolesWithPerm.length === 0 && (
                          <span className="text-xs text-muted-foreground">
                            {t('common.noRole')}
                          </span>
                        )}
                      </div>
                      <span
                        className="text-xs text-muted-foreground shrink-0 ml-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {usersWithPerm.length === 1
                          ? t('roles.usersCount_one', { count: usersWithPerm.length })
                          : t('roles.usersCount_other', { count: usersWithPerm.length })}
                      </span>
                    </div>

                    {isExpanded && (
                      <div className="bg-muted/30 border-t border-border px-14 py-4 space-y-3">
                        {rolesWithPerm.length > 0 && (
                          <div>
                            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                              {t('roles.rolesWithPermission')}
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {rolesWithPerm.map((r) => (
                                <Badge key={r.id} variant="outline" className="text-xs gap-1">
                                  <Shield className="size-3" />
                                  {r.name}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        <div>
                          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                            {t('roles.usersWithAccess')}
                          </p>
                          {usersWithPerm.length === 0 ? (
                            <p className="text-xs text-muted-foreground">
                              {t('roles.noUsersWithPermission')}
                            </p>
                          ) : (
                            <div className="space-y-1.5">
                              {usersWithPerm.map(({ user, viaRoles }) => (
                                <div key={user.id} className="flex items-center gap-2.5 py-1">
                                  <Avatar className="size-6">
                                    <AvatarFallback className="text-[9px] bg-primary/10 text-primary">
                                      {initials(user.firstName)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="text-sm font-medium min-w-[140px]">
                                    {user.firstName} {user.lastName}
                                  </span>
                                  <div className="flex flex-wrap gap-1">
                                    {viaRoles.map((r) => (
                                      <Badge
                                        key={r.id}
                                        variant="secondary"
                                        className="text-[10px] px-1.5 py-0"
                                      >
                                        <Shield className="size-2.5 mr-0.5" />
                                        {r.name}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      ))}
    </div>
  );
}
