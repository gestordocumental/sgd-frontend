import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { FormField } from '@/components/ui/form-field'
import type { useCompanyUsers } from '@/features/company-users/hooks/use-company-users'

type CompanyUsersHook = ReturnType<typeof useCompanyUsers>

interface CompanyUserDialogsProps {
  hook: CompanyUsersHook
  companyName: string | undefined
  companyId: string
}

export function CompanyUserDialogs({ hook, companyName, companyId }: CompanyUserDialogsProps) {
  const {
    createUserOpen, setCreateUserOpen,
    editUser, setEditUser,
    deleteUser, setDeleteUser,
    createForm, editForm,
    createMutation, editMutation, deleteMutation,
  } = hook

  return (
    <>
      {/* ── Crear usuario ─────────────────────────────────────────── */}
      <Dialog open={createUserOpen} onOpenChange={setCreateUserOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nuevo usuario · {companyName}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={createForm.handleSubmit((values) =>
              createMutation.mutate({ ...values, isSuperAdmin: false, companyId }),
            )}
            className="space-y-4 pt-2"
          >
            <FormField id="cu-email" label="Correo electrónico" error={createForm.formState.errors.email?.message}>
              <Input id="cu-email" type="email" placeholder="usuario@empresa.com" {...createForm.register('email')} />
            </FormField>
            <FormField id="cu-position" label="Cargo o posición" error={createForm.formState.errors.position?.message}>
              <Input id="cu-position" placeholder="Gerente de Ventas" {...createForm.register('position')} />
            </FormField>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setCreateUserOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={createMutation.isPending || !createForm.formState.isValid}>
                {createMutation.isPending ? 'Creando...' : 'Crear usuario'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Editar usuario ────────────────────────────────────────── */}
      <Dialog open={!!editUser} onOpenChange={(o) => { if (!o) setEditUser(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar usuario</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={editForm.handleSubmit((values) => {
              if (!editUser) return
              editMutation.mutate({ id: editUser.id, dto: values })
            })}
            className="space-y-4 pt-2"
          >
            <FormField id="eu-email" label="Correo electrónico" error={editForm.formState.errors.email?.message}>
              <Input id="eu-email" type="email" {...editForm.register('email')} />
            </FormField>
            <FormField id="eu-name" label="Nombre" error={editForm.formState.errors.name?.message}>
              <Input id="eu-name" placeholder="Juan García" {...editForm.register('name')} />
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
      <Dialog open={!!deleteUser} onOpenChange={(o) => { if (!o) setDeleteUser(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Eliminar usuario</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            ¿Eliminar a{' '}
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
