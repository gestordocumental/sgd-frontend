import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { FormField } from '@/components/ui/form-field'
import { PermissionSelector } from '@/features/roles/components/PermissionSelector'
import { ALL_PERMISSIONS } from '@/lib/api/roles'
import { initials } from '@/lib/formatters'
import type { ApiUser } from '@/lib/api/users'
import type { useRoles } from '@/features/roles/hooks/use-roles'

type RolesHook = ReturnType<typeof useRoles>

interface RoleDialogsProps {
  hook: RolesHook
  activeUsers: ApiUser[]
  allUsers: ApiUser[]
}

export function RoleDialogs({ hook, activeUsers, allUsers }: RoleDialogsProps) {
  const {
    createRoleOpen, setCreateRoleOpen,
    editRole, setEditRole,
    deleteRole, setDeleteRole,
    selectedPermIds,
    assignRoleUser, setAssignRoleUser,
    assignPermUser, setAssignPermUser,
    revokePermTarget, setRevokePermTarget,
    createForm, editForm,
    togglePerm,
    createRoleMutation, editRoleMutation, deleteRoleMutation,
    assignUserToRoleMutation, assignPermMutation, revokePermMutation,
    userPermissions,
  } = hook

  return (
    <>
      {/* ── Crear rol ─────────────────────────────────────────────── */}
      <Dialog open={createRoleOpen} onOpenChange={setCreateRoleOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Nuevo rol</DialogTitle></DialogHeader>
          <form
            onSubmit={createForm.handleSubmit((values) =>
              createRoleMutation.mutate({ ...values, permissionIds: selectedPermIds }),
            )}
            className="space-y-4 pt-2"
          >
            <FormField id="cr-name" label="Nombre del rol" error={createForm.formState.errors.name?.message}>
              <Input id="cr-name" placeholder="Gestor Documentos" {...createForm.register('name')} />
            </FormField>
            <FormField id="cr-desc" label="Descripción" error={createForm.formState.errors.description?.message}>
              <Input id="cr-desc" placeholder="Descripción breve del rol" {...createForm.register('description')} />
            </FormField>
            <div className="space-y-2">
              <Label className="text-sm">Permisos del rol</Label>
              <PermissionSelector permissions={ALL_PERMISSIONS} selected={selectedPermIds} onToggle={togglePerm} />
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setCreateRoleOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={createRoleMutation.isPending || !createForm.formState.isValid}>
                {createRoleMutation.isPending ? 'Creando...' : 'Crear rol'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Editar rol ────────────────────────────────────────────── */}
      <Dialog open={!!editRole} onOpenChange={(o) => { if (!o) setEditRole(null) }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Editar rol</DialogTitle></DialogHeader>
          <form
            onSubmit={editForm.handleSubmit((values) => {
              if (!editRole) return
              editRoleMutation.mutate({ id: editRole.id, dto: { ...values, permissionIds: selectedPermIds } })
            })}
            className="space-y-4 pt-2"
          >
            <FormField id="er-name" label="Nombre del rol" error={editForm.formState.errors.name?.message}>
              <Input id="er-name" {...editForm.register('name')} />
            </FormField>
            <FormField id="er-desc" label="Descripción" error={editForm.formState.errors.description?.message}>
              <Input id="er-desc" {...editForm.register('description')} />
            </FormField>
            <div className="space-y-2">
              <Label className="text-sm">Permisos del rol</Label>
              <PermissionSelector permissions={ALL_PERMISSIONS} selected={selectedPermIds} onToggle={togglePerm} />
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setEditRole(null)}>Cancelar</Button>
              <Button type="submit" disabled={editRoleMutation.isPending || !editForm.formState.isValid}>
                {editRoleMutation.isPending ? 'Guardando...' : 'Guardar cambios'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Eliminar rol ──────────────────────────────────────────── */}
      <Dialog open={!!deleteRole} onOpenChange={(o) => { if (!o) setDeleteRole(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Eliminar rol</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            ¿Eliminar el rol{' '}
            <span className="font-medium text-foreground">"{deleteRole?.name}"</span>? Los usuarios con este rol perderán los permisos asociados.
          </p>
          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setDeleteRole(null)}>Cancelar</Button>
            <Button variant="destructive" disabled={deleteRoleMutation.isPending} onClick={() => deleteRole && deleteRoleMutation.mutate(deleteRole.id)}>
              {deleteRoleMutation.isPending ? 'Eliminando...' : 'Eliminar rol'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Asignar usuario a rol ─────────────────────────────────── */}
      <Dialog open={!!assignRoleUser} onOpenChange={(o) => { if (!o) setAssignRoleUser(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Asignar rol · {assignRoleUser?.role.name}</DialogTitle></DialogHeader>
          <div className="space-y-1 py-2">
            {activeUsers
              .filter((u) => !assignRoleUser?.role.userIds.includes(u.id))
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
            {activeUsers.filter((u) => !assignRoleUser?.role.userIds.includes(u.id)).length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Todos los usuarios activos ya tienen este rol</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignRoleUser(null)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Asignar permiso directo ───────────────────────────────── */}
      <Dialog open={!!assignPermUser} onOpenChange={(o) => { if (!o) setAssignPermUser(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Asignar permiso directamente</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground -mt-2">
            Permiso: <span className="font-medium text-foreground">{ALL_PERMISSIONS.find((p) => p.id === assignPermUser?.permissionId)?.label}</span>
          </p>
          <div className="space-y-1 py-2">
            {activeUsers
              .filter((u) => {
                if (!assignPermUser) return false
                return !userPermissions.some((up) => up.userId === u.id && up.permissionId === assignPermUser.permissionId)
              })
              .map((u) => (
                <button
                  key={u.id}
                  type="button"
                  className="flex items-center gap-3 w-full px-3 py-2 rounded-md hover:bg-accent text-left transition-colors"
                  onClick={() => assignPermUser && assignPermMutation.mutate({ userId: u.id, permissionId: assignPermUser.permissionId })}
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
            {activeUsers.filter((u) => {
              if (!assignPermUser) return false
              return !userPermissions.some((up) => up.userId === u.id && up.permissionId === assignPermUser.permissionId)
            }).length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Todos los usuarios ya tienen este permiso asignado directamente</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignPermUser(null)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Revocar permiso directo ───────────────────────────────── */}
      <Dialog open={!!revokePermTarget} onOpenChange={(o) => { if (!o) setRevokePermTarget(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Revocar permiso directo</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            ¿Revocar el permiso{' '}
            <span className="font-medium text-foreground">"{ALL_PERMISSIONS.find((p) => p.id === revokePermTarget?.permissionId)?.label}"</span>{' '}
            asignado directamente a{' '}
            <span className="font-medium text-foreground">{allUsers.find((u) => u.id === revokePermTarget?.userId)?.firstName}</span>?
            El usuario puede conservar el permiso si lo tiene mediante un rol.
          </p>
          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setRevokePermTarget(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              disabled={revokePermMutation.isPending}
              onClick={() => revokePermTarget && revokePermMutation.mutate({ userId: revokePermTarget.userId, permissionId: revokePermTarget.permissionId })}
            >
              {revokePermMutation.isPending ? 'Revocando...' : 'Revocar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
