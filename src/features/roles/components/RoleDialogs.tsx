import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { FormField } from '@/components/ui/form-field'
import { PermissionSelector } from '@/features/roles/components/PermissionSelector'
import { initials } from '@/lib/formatters'
import type { ApiUser } from '@/lib/api/users'
import type { useRoles } from '@/features/roles/hooks/use-roles'

type RolesHook = ReturnType<typeof useRoles>

interface RoleDialogsProps {
  hook: RolesHook
  activeUsers: ApiUser[]
  allUsers: ApiUser[]
}

export function RoleDialogs({ hook, activeUsers }: RoleDialogsProps) {
  const {
    permissions,
    createRoleOpen, setCreateRoleOpen,
    editRole, setEditRole,
    deleteRole, setDeleteRole,
    selectedPermIds,
    assignRoleUser, setAssignRoleUser,
    createForm, editForm,
    togglePerm,
    createRoleMutation, editRoleMutation, deleteRoleMutation,
    assignUserToRoleMutation,
  } = hook
  const { t } = useTranslation()

  return (
    <>
      {/* ── Crear rol ─────────────────────────────────────────────── */}
      <Dialog open={createRoleOpen} onOpenChange={setCreateRoleOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{t('roles.dialogs.createTitle')}</DialogTitle></DialogHeader>
          <form
            onSubmit={createForm.handleSubmit((values) =>
              createRoleMutation.mutate({ ...values, permissionIds: selectedPermIds }),
            )}
            className="space-y-4 pt-2"
          >
            <FormField id="cr-name" label={t('roles.dialogs.roleNameLabel')} error={createForm.formState.errors.name?.message}>
              <Input id="cr-name" placeholder={t('roles.dialogs.roleNamePlaceholder')} {...createForm.register('name')} />
            </FormField>
            <FormField id="cr-desc" label={t('common.description')} error={createForm.formState.errors.description?.message}>
              <Input id="cr-desc" placeholder={t('roles.dialogs.descriptionPlaceholder')} {...createForm.register('description')} />
            </FormField>
            <div className="space-y-2">
              <Label className="text-sm">{t('roles.dialogs.rolePermissionsLabel')}</Label>
              <PermissionSelector permissions={permissions} selected={selectedPermIds} onToggle={togglePerm} />
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setCreateRoleOpen(false)}>{t('common.cancel')}</Button>
              <Button type="submit" disabled={createRoleMutation.isPending || !createForm.formState.isValid}>
                {createRoleMutation.isPending ? t('common.creating') : t('roles.dialogs.createButton')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Editar rol ────────────────────────────────────────────── */}
      <Dialog open={!!editRole} onOpenChange={(o) => { if (!o) setEditRole(null) }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{t('roles.dialogs.editTitle')}</DialogTitle></DialogHeader>
          <form
            onSubmit={editForm.handleSubmit((values) => {
              if (!editRole) return
              editRoleMutation.mutate({ id: editRole.id, dto: { ...values, permissionIds: selectedPermIds } })
            })}
            className="space-y-4 pt-2"
          >
            <FormField id="er-name" label={t('roles.dialogs.roleNameLabel')} error={editForm.formState.errors.name?.message}>
              <Input id="er-name" {...editForm.register('name')} />
            </FormField>
            <FormField id="er-desc" label={t('common.description')} error={editForm.formState.errors.description?.message}>
              <Input id="er-desc" {...editForm.register('description')} />
            </FormField>
            <div className="space-y-2">
              <Label className="text-sm">{t('roles.dialogs.rolePermissionsLabel')}</Label>
              <PermissionSelector permissions={permissions} selected={selectedPermIds} onToggle={togglePerm} />
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setEditRole(null)}>{t('common.cancel')}</Button>
              <Button type="submit" disabled={editRoleMutation.isPending || !editForm.formState.isValid}>
                {editRoleMutation.isPending ? t('common.saving') : t('common.saveChanges')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Eliminar rol ──────────────────────────────────────────── */}
      <Dialog open={!!deleteRole} onOpenChange={(o) => { if (!o) setDeleteRole(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>{t('roles.dialogs.deleteTitle')}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t('roles.dialogs.deleteConfirmPre')}{' '}
            <span className="font-medium text-foreground">"{deleteRole?.name}"</span>
            {t('roles.dialogs.deleteConfirmPost')}
          </p>
          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setDeleteRole(null)}>{t('common.cancel')}</Button>
            <Button variant="destructive" disabled={deleteRoleMutation.isPending} onClick={() => deleteRole && deleteRoleMutation.mutate(deleteRole.id)}>
              {deleteRoleMutation.isPending ? t('common.deleting') : t('roles.dialogs.deleteButton')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Asignar usuario a rol ─────────────────────────────────── */}
      <Dialog open={!!assignRoleUser} onOpenChange={(o) => { if (!o) setAssignRoleUser(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>{t('roles.dialogs.assignRoleTitle', { roleName: assignRoleUser?.role.name })}</DialogTitle></DialogHeader>
          <div className="space-y-1 py-2">
            {activeUsers
              .filter((u) => !u.roles.some((r) => r.roleId === assignRoleUser?.role.id))
              .map((u) => (
                <button
                  key={u.id}
                  type="button"
                  className="flex items-center gap-3 w-full px-3 py-2 rounded-md hover:bg-accent text-left transition-colors"
                  onClick={() => assignRoleUser && assignUserToRoleMutation.mutate({ roleId: assignRoleUser.role.id, userId: u.id })}
                >
                  <Avatar className="size-7">
                    <AvatarFallback className="text-[10px] bg-primary/10 text-primary">{initials(u.firstName)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{u.firstName} {u.lastName}</p>
                    <p className="text-xs text-muted-foreground">{u.position}</p>
                  </div>
                </button>
              ))}
            {activeUsers.filter((u) => !u.roles.some((r) => r.roleId === assignRoleUser?.role.id)).length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">{t('roles.dialogs.allUsersHaveRole')}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignRoleUser(null)}>{t('common.close')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
