import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { FormField } from '@/components/ui/form-field'
import type { useAdminCompanies } from '@/features/companies/hooks/use-admin-companies'

type CompaniesHook = ReturnType<typeof useAdminCompanies>

interface CompanyDialogsProps {
  hook: CompaniesHook
}

export function CompanyDialogs({ hook }: CompanyDialogsProps) {
  const {
    createOpen, setCreateOpen,
    editCompany, setEditCompany,
    deleteCompany, setDeleteCompany,
    createForm, editForm,
    onCreateSubmit, onEditSubmit,
    createMutation, editMutation, deleteMutation,
  } = hook

  return (
    <>
      {/* ── Crear empresa ─────────────────────────────────────────── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nueva empresa</DialogTitle>
          </DialogHeader>
          <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4 pt-2">
            <FormField id="company-name" label="Nombre de la empresa" error={createForm.formState.errors.name?.message}>
              <Input id="company-name" placeholder="Helisa Software S.A.S" {...createForm.register('name')} />
            </FormField>
            <FormField id="company-nit" label="NIT" error={createForm.formState.errors.nit?.message}>
              <Input id="company-nit" placeholder="900.123.456-7" {...createForm.register('nit')} />
            </FormField>
            <FormField id="company-address" label="Dirección" error={createForm.formState.errors.address?.message}>
              <Input id="company-address" placeholder="Calle 123 # 45-67, Bogotá" {...createForm.register('address')} />
            </FormField>
            <FormField id="company-phone" label="Teléfono" error={createForm.formState.errors.phone?.message}>
              <Input id="company-phone" placeholder="+57 601 234 5678" {...createForm.register('phone')} />
            </FormField>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={createMutation.isPending || !createForm.formState.isValid}>
                {createMutation.isPending ? 'Creando...' : 'Crear empresa'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Editar empresa ────────────────────────────────────────── */}
      <Dialog open={!!editCompany} onOpenChange={(open) => { if (!open) setEditCompany(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar empresa</DialogTitle>
          </DialogHeader>
          <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4 pt-2">
            <FormField id="edit-company-name" label="Nombre de la empresa" error={editForm.formState.errors.name?.message}>
              <Input id="edit-company-name" placeholder="Helisa Software S.A.S" {...editForm.register('name')} />
            </FormField>
            <FormField id="edit-company-nit" label="NIT" error={editForm.formState.errors.nit?.message}>
              <Input id="edit-company-nit" placeholder="900.123.456-7" {...editForm.register('nit')} />
            </FormField>
            <FormField id="edit-company-address" label="Dirección" error={editForm.formState.errors.address?.message}>
              <Input id="edit-company-address" placeholder="Calle 123 # 45-67, Bogotá" {...editForm.register('address')} />
            </FormField>
            <FormField id="edit-company-phone" label="Teléfono" error={editForm.formState.errors.phone?.message}>
              <Input id="edit-company-phone" placeholder="+57 601 234 5678" {...editForm.register('phone')} />
            </FormField>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setEditCompany(null)}>Cancelar</Button>
              <Button type="submit" disabled={editMutation.isPending || !editForm.formState.isValid}>
                {editMutation.isPending ? 'Guardando...' : 'Guardar cambios'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Eliminar empresa ──────────────────────────────────────── */}
      <Dialog open={!!deleteCompany} onOpenChange={(open) => { if (!open) setDeleteCompany(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Eliminar empresa</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            ¿Estás seguro de que deseas eliminar{' '}
            <span className="font-medium text-foreground">{deleteCompany?.name}</span>? Esta acción no se puede deshacer.
          </p>
          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setDeleteCompany(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteCompany && deleteMutation.mutate(deleteCompany.id)}
            >
              {deleteMutation.isPending ? 'Eliminando...' : 'Eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
