import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { FormField } from '@/components/ui/form-field'
import type { useOrgStructure } from '@/features/org-structure/hooks/use-org-structure'
import type { StructureForm } from '@/features/org-structure/hooks/use-org-structure'

type OrgStructureHook = ReturnType<typeof useOrgStructure>

interface OrgStructureDialogsProps {
  hook: OrgStructureHook
}

function StructureFormFields({
  form,
  nameId,
  descId,
}: {
  form: OrgStructureHook['deptForm']
  nameId: string
  descId: string
}) {
  const { t } = useTranslation()
  return (
    <>
      <FormField id={nameId} label={t('common.name')} error={form.formState.errors.name?.message}>
        <Input id={nameId} placeholder={t('orgStructure.namePlaceholder')} {...form.register('name')} />
      </FormField>
      <FormField id={descId} label={t('common.description')} error={form.formState.errors.description?.message}>
        <Input id={descId} placeholder={t('orgStructure.descriptionPlaceholder')} {...form.register('description')} />
      </FormField>
    </>
  )
}

export function OrgStructureDialogs({ hook }: OrgStructureDialogsProps) {
  const { t } = useTranslation()
  const {
    createDeptOpen, setCreateDeptOpen, editDept, setEditDept, deleteDept, setDeleteDept,
    deptForm, createDeptMutation, editDeptMutation, deleteDeptMutation,
    createAreaOpen, setCreateAreaOpen, editArea, setEditArea, deleteArea, setDeleteArea,
    areaForm, createAreaMutation, editAreaMutation, deleteAreaMutation,
    createCargoOpen, setCreateCargoOpen, editCargo, setEditCargo, deleteCargo, setDeleteCargo,
    cargoForm, createCargoMutation, editCargoMutation, deleteCargoMutation,
    createDeptCargoOpen, setCreateDeptCargoOpen, editDeptCargo, setEditDeptCargo, deleteDeptCargo, setDeleteDeptCargo,
    deptCargoForm, createDeptCargoMutation, editDeptCargoMutation, deleteDeptCargoMutation,
  } = hook

  const onSubmitDept = (values: StructureForm) => {
    if (editDept) editDeptMutation.mutate(values)
    else createDeptMutation.mutate(values)
  }

  const onSubmitArea = (values: StructureForm) => {
    if (editArea) editAreaMutation.mutate(values)
    else createAreaMutation.mutate(values)
  }

  const onSubmitCargo = (values: StructureForm) => {
    if (editCargo) editCargoMutation.mutate(values)
    else createCargoMutation.mutate(values)
  }

  const onSubmitDeptCargo = (values: StructureForm) => {
    if (editDeptCargo) editDeptCargoMutation.mutate(values)
    else createDeptCargoMutation.mutate(values)
  }

  const deptPending = createDeptMutation.isPending || editDeptMutation.isPending
  const areaPending = createAreaMutation.isPending || editAreaMutation.isPending
  const cargoPending = createCargoMutation.isPending || editCargoMutation.isPending
  const deptCargoPending = createDeptCargoMutation.isPending || editDeptCargoMutation.isPending

  return (
    <>
      {/* ── Departamento form ─────────────────────────────────── */}
      <Dialog
        open={createDeptOpen || !!editDept}
        onOpenChange={(o) => { if (!o) { setCreateDeptOpen(false); setEditDept(null) } }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editDept ? t('orgStructure.editDepartamento') : t('orgStructure.newDepartamento')}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={deptForm.handleSubmit(onSubmitDept)} className="space-y-4 pt-2">
            <StructureFormFields form={deptForm} nameId="dept-name" descId="dept-desc" />
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => { setCreateDeptOpen(false); setEditDept(null) }}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={deptPending || !deptForm.formState.isValid}>
                {deptPending ? t('common.saving') : editDept ? t('common.saveChanges') : t('common.create')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Departamento delete ───────────────────────────────── */}
      <Dialog open={!!deleteDept} onOpenChange={(o) => { if (!o) setDeleteDept(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('orgStructure.deleteDepartamento')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t('orgStructure.deleteConfirmPre')}{' '}
            <span className="font-medium text-foreground">{deleteDept?.name}</span>
            {t('orgStructure.deleteConfirmPost')}
          </p>
          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setDeleteDept(null)}>{t('common.cancel')}</Button>
            <Button
              variant="destructive"
              disabled={deleteDeptMutation.isPending}
              onClick={() => deleteDept && deleteDeptMutation.mutate(deleteDept.id)}
            >
              {deleteDeptMutation.isPending ? t('common.deleting') : t('common.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Area form ─────────────────────────────────────────── */}
      <Dialog
        open={createAreaOpen || !!editArea}
        onOpenChange={(o) => { if (!o) { setCreateAreaOpen(false); setEditArea(null) } }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editArea ? t('orgStructure.editArea') : t('orgStructure.newArea')}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={areaForm.handleSubmit(onSubmitArea)} className="space-y-4 pt-2">
            <StructureFormFields form={areaForm} nameId="area-name" descId="area-desc" />
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => { setCreateAreaOpen(false); setEditArea(null) }}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={areaPending || !areaForm.formState.isValid}>
                {areaPending ? t('common.saving') : editArea ? t('common.saveChanges') : t('common.create')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Area delete ───────────────────────────────────────── */}
      <Dialog open={!!deleteArea} onOpenChange={(o) => { if (!o) setDeleteArea(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('orgStructure.deleteArea')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t('orgStructure.deleteConfirmPre')}{' '}
            <span className="font-medium text-foreground">{deleteArea?.name}</span>
            {t('orgStructure.deleteConfirmPost')}
          </p>
          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setDeleteArea(null)}>{t('common.cancel')}</Button>
            <Button
              variant="destructive"
              disabled={deleteAreaMutation.isPending}
              onClick={() => deleteArea && deleteAreaMutation.mutate(deleteArea)}
            >
              {deleteAreaMutation.isPending ? t('common.deleting') : t('common.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Cargo form ────────────────────────────────────────── */}
      <Dialog
        open={createCargoOpen || !!editCargo}
        onOpenChange={(o) => { if (!o) { setCreateCargoOpen(false); setEditCargo(null) } }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editCargo ? t('orgStructure.editCargo') : t('orgStructure.newCargo')}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={cargoForm.handleSubmit(onSubmitCargo)} className="space-y-4 pt-2">
            <StructureFormFields form={cargoForm} nameId="cargo-name" descId="cargo-desc" />
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => { setCreateCargoOpen(false); setEditCargo(null) }}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={cargoPending || !cargoForm.formState.isValid}>
                {cargoPending ? t('common.saving') : editCargo ? t('common.saveChanges') : t('common.create')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Cargo delete ──────────────────────────────────────── */}
      <Dialog open={!!deleteCargo} onOpenChange={(o) => { if (!o) setDeleteCargo(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('orgStructure.deleteCargo')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t('orgStructure.deleteConfirmPre')}{' '}
            <span className="font-medium text-foreground">{deleteCargo?.name}</span>
            {t('orgStructure.deleteConfirmPost')}
          </p>
          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setDeleteCargo(null)}>{t('common.cancel')}</Button>
            <Button
              variant="destructive"
              disabled={deleteCargoMutation.isPending}
              onClick={() => deleteCargo && deleteCargoMutation.mutate(deleteCargo)}
            >
              {deleteCargoMutation.isPending ? t('common.deleting') : t('common.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dept-level cargo form ──────────────────────────────── */}
      <Dialog
        open={createDeptCargoOpen || !!editDeptCargo}
        onOpenChange={(o) => { if (!o) { setCreateDeptCargoOpen(false); setEditDeptCargo(null) } }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editDeptCargo ? t('orgStructure.editCargo') : t('orgStructure.newCargo')}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={deptCargoForm.handleSubmit(onSubmitDeptCargo)} className="space-y-4 pt-2">
            <StructureFormFields form={deptCargoForm} nameId="dept-cargo-name" descId="dept-cargo-desc" />
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => { setCreateDeptCargoOpen(false); setEditDeptCargo(null) }}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={deptCargoPending || !deptCargoForm.formState.isValid}>
                {deptCargoPending ? t('common.saving') : editDeptCargo ? t('common.saveChanges') : t('common.create')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Dept-level cargo delete ────────────────────────────── */}
      <Dialog open={!!deleteDeptCargo} onOpenChange={(o) => { if (!o) setDeleteDeptCargo(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('orgStructure.deleteCargo')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t('orgStructure.deleteConfirmPre')}{' '}
            <span className="font-medium text-foreground">{deleteDeptCargo?.name}</span>
            {t('orgStructure.deleteConfirmPost')}
          </p>
          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setDeleteDeptCargo(null)}>{t('common.cancel')}</Button>
            <Button
              variant="destructive"
              disabled={deleteDeptCargoMutation.isPending}
              onClick={() => deleteDeptCargo && deleteDeptCargoMutation.mutate(deleteDeptCargo)}
            >
              {deleteDeptCargoMutation.isPending ? t('common.deleting') : t('common.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
