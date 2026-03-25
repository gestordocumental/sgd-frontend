import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { FormField } from '@/components/ui/form-field'
import type { useAdminUsers } from '@/features/users/hooks/use-admin-users'

type UsersHook = ReturnType<typeof useAdminUsers>

interface UserDialogsProps {
  hook: UsersHook
}

export function UserDialogs({ hook }: UserDialogsProps) {
  const {
    createOpen, setCreateOpen,
    editUser, setEditUser,
    deleteUser, setDeleteUser,
    createForm, editForm,
    onCreateSubmit, onEditSubmit,
    createMutation, editMutation, deleteMutation,
  } = hook

  return (
    <>
      {/* ── Crear usuario ─────────────────────────────────────────── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nuevo usuario</DialogTitle>
          </DialogHeader>
          <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4 pt-2">
            <FormField id="create-email" label="Correo electrónico" error={createForm.formState.errors.email?.message}>
              <Input id="create-email" type="email" placeholder="usuario@empresa.com" {...createForm.register('email')} />
            </FormField>
            <FormField id="create-position" label="Cargo o posición" error={createForm.formState.errors.position?.message}>
              <Input id="create-position" placeholder="Gerente de Ventas" {...createForm.register('position')} />
            </FormField>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={createMutation.isPending || !createForm.formState.isValid}>
                {createMutation.isPending ? 'Creando...' : 'Crear usuario'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Editar usuario ────────────────────────────────────────── */}
      <Dialog open={!!editUser} onOpenChange={(open) => { if (!open) setEditUser(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar usuario</DialogTitle>
          </DialogHeader>
          <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4 pt-2">
            <FormField id="edit-email" label="Correo electrónico" error={editForm.formState.errors.email?.message}>
              <Input id="edit-email" type="email" placeholder="usuario@empresa.com" {...editForm.register('email')} />
            </FormField>
            <FormField id="edit-name" label="Nombre" error={editForm.formState.errors.name?.message}>
              <Input id="edit-name" placeholder="Juan García" {...editForm.register('name')} />
            </FormField>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setEditUser(null)}>Cancelar</Button>
              <Button type="submit" disabled={editMutation.isPending || !editForm.formState.isValid}>
                {editMutation.isPending ? 'Guardando...' : 'Guardar cambios'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Eliminar usuario ──────────────────────────────────────── */}
      <Dialog open={!!deleteUser} onOpenChange={(open) => { if (!open) setDeleteUser(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Eliminar usuario</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            ¿Estás seguro de que deseas eliminar a{' '}
            <span className="font-medium text-foreground">{deleteUser?.firstName}</span>? Podrás restaurarlo después.
          </p>
          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setDeleteUser(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteUser && deleteMutation.mutate(deleteUser.id)}
            >
              {deleteMutation.isPending ? 'Eliminando...' : 'Eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
