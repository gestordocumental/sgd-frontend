import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { FormField } from '@/components/ui/form-field'
import type { useAdminUsers } from '@/features/users/hooks/use-admin-users'

type UsersHook = ReturnType<typeof useAdminUsers>

const selectCls = 'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed'

interface UserDialogsProps {
  hook: UsersHook
}

export function UserDialogs({ hook }: UserDialogsProps) {
  const {
    createOpen, setCreateOpen,
    createUserContext, companyRoles,
    departamentos, areas, cargos,
    selectedDeptId, setSelectedDeptId,
    selectedAreaId, setSelectedAreaId,
    editUser, setEditUser,
    deleteUser, setDeleteUser,
    createForm, editForm,
    onCreateSubmit, onEditSubmit,
    createMutation, editMutation, deleteMutation,
  } = hook
  const { t } = useTranslation()

  return (
    <>
      {/* ── Crear usuario ─────────────────────────────────────────── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('users.dialogs.createTitle')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4 pt-2">
            <FormField id="create-email" label={t('common.email')} error={createForm.formState.errors.email?.message}>
              <Input id="create-email" type="email" placeholder={t('users.dialogs.emailPlaceholder')} {...createForm.register('email')} />
            </FormField>

            {createUserContext === 'company' && (
              <>
                {/* ── Org-structure ──────────────────────────────── */}
                <FormField id="create-dept" label={t('orgStructure.departamento')}>
                  <select
                    id="create-dept"
                    className={selectCls}
                    value={selectedDeptId}
                    {...createForm.register('departamentoId')}
                    onChange={(e) => {
                      createForm.setValue('departamentoId', e.target.value || undefined)
                      createForm.setValue('areaId', undefined)
                      createForm.setValue('cargoId', undefined)
                      setSelectedDeptId(e.target.value)
                      setSelectedAreaId('')
                    }}
                  >
                    <option value="">{t('orgStructure.selectDepartamento')}</option>
                    {departamentos.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </FormField>

                <FormField id="create-area" label={t('orgStructure.area')}>
                  <select
                    id="create-area"
                    className={selectCls}
                    disabled={!selectedDeptId}
                    value={selectedAreaId}
                    {...createForm.register('areaId')}
                    onChange={(e) => {
                      createForm.setValue('areaId', e.target.value || undefined)
                      createForm.setValue('cargoId', undefined)
                      setSelectedAreaId(e.target.value)
                    }}
                  >
                    <option value="">{t('orgStructure.selectArea')}</option>
                    {areas.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </FormField>

                <FormField id="create-cargo" label={t('orgStructure.cargos')}>
                  <select
                    id="create-cargo"
                    className={selectCls}
                    disabled={!selectedAreaId}
                    {...createForm.register('cargoId')}
                    onChange={(e) => createForm.setValue('cargoId', e.target.value || undefined)}
                  >
                    <option value="">{t('orgStructure.selectCargo')}</option>
                    {cargos.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </FormField>

                {/* ── Rol ────────────────────────────────────────── */}
                <FormField id="create-role" label={t('common.role')}>
                  <select
                    id="create-role"
                    className={selectCls}
                    {...createForm.register('roleId')}
                  >
                    <option value="">{t('users.dialogs.rolePlaceholder')}</option>
                    {companyRoles.map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </FormField>
              </>
            )}

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>{t('common.cancel')}</Button>
              <Button type="submit" disabled={createMutation.isPending || !createForm.formState.isValid}>
                {createMutation.isPending ? t('common.creating') : t('users.dialogs.createButton')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Editar usuario ────────────────────────────────────────── */}
      <Dialog open={!!editUser} onOpenChange={(open) => { if (!open) setEditUser(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('users.dialogs.editTitle')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4 pt-2">
            <FormField id="edit-firstName" label={t('users.dialogs.firstNameLabel')} error={editForm.formState.errors.firstName?.message}>
              <Input id="edit-firstName" placeholder={t('users.dialogs.firstNamePlaceholder')} {...editForm.register('firstName')} />
            </FormField>
            <FormField id="edit-lastName" label={t('users.dialogs.lastNameLabel')} error={editForm.formState.errors.lastName?.message}>
              <Input id="edit-lastName" placeholder={t('users.dialogs.lastNamePlaceholder')} {...editForm.register('lastName')} />
            </FormField>
            <FormField id="edit-idNumber" label={t('users.dialogs.idNumberLabel')} error={editForm.formState.errors.idNumber?.message}>
              <Input id="edit-idNumber" placeholder={t('users.dialogs.idNumberPlaceholder')} {...editForm.register('idNumber')} />
            </FormField>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setEditUser(null)}>{t('common.cancel')}</Button>
              <Button type="submit" disabled={editMutation.isPending || !editForm.formState.isValid}>
                {editMutation.isPending ? t('common.saving') : t('common.saveChanges')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Eliminar usuario ──────────────────────────────────────── */}
      <Dialog open={!!deleteUser} onOpenChange={(open) => { if (!open) setDeleteUser(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('users.dialogs.deleteTitle')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t('users.dialogs.deleteConfirmPre')}{' '}
            <span className="font-medium text-foreground">{deleteUser?.firstName}</span>
            {t('users.dialogs.deleteConfirmPost')}
          </p>
          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setDeleteUser(null)}>{t('common.cancel')}</Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteUser && deleteMutation.mutate(deleteUser.id)}
            >
              {deleteMutation.isPending ? t('common.deleting') : t('users.dialogs.deleteButton')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
