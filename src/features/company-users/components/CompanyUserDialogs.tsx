import { useTranslation } from 'react-i18next'
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
    roles,
  } = hook
  const { t } = useTranslation()

  return (
    <>
      {/* ── Crear usuario ─────────────────────────────────────────── */}
      <Dialog open={createUserOpen} onOpenChange={setCreateUserOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('users.dialogs.newUserTitle', { companyName })}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={createForm.handleSubmit((values) =>
              createMutation.mutate({ ...values, isSuperAdmin: false, orgId: companyId }),
            )}
            className="space-y-4 pt-2"
          >
            <FormField id="cu-email" label={t('common.email')} error={createForm.formState.errors.email?.message}>
              <Input id="cu-email" type="email" placeholder={t('users.dialogs.emailPlaceholder')} {...createForm.register('email')} />
            </FormField>
            <FormField id="cu-position" label={t('common.position')} error={createForm.formState.errors.position?.message}>
              <Input id="cu-position" placeholder={t('users.dialogs.positionPlaceholder')} {...createForm.register('position')} />
            </FormField>
            <FormField id="cu-role" label={t('common.role')} error={createForm.formState.errors.roleId?.message}>
              <select
                id="cu-role"
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
                {...createForm.register('roleId')}
              >
                <option value="">{t('users.dialogs.roleSelectPlaceholder')}</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </FormField>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setCreateUserOpen(false)}>{t('common.cancel')}</Button>
              <Button type="submit" disabled={createMutation.isPending || !createForm.formState.isValid}>
                {createMutation.isPending ? t('common.creating') : t('users.dialogs.createButton')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Editar usuario ────────────────────────────────────────── */}
      <Dialog open={!!editUser} onOpenChange={(o) => { if (!o) setEditUser(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('users.dialogs.editTitle')}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={editForm.handleSubmit((values) => {
              if (!editUser) return
              editMutation.mutate({ id: editUser.id, dto: values })
            })}
            className="space-y-4 pt-2"
          >
            <FormField id="eu-firstName" label={t('users.dialogs.firstNameLabel')} error={editForm.formState.errors.firstName?.message}>
              <Input id="eu-firstName" placeholder={t('users.dialogs.firstNamePlaceholder')} {...editForm.register('firstName')} />
            </FormField>
            <FormField id="eu-lastName" label={t('users.dialogs.lastNameLabel')} error={editForm.formState.errors.lastName?.message}>
              <Input id="eu-lastName" placeholder={t('users.dialogs.lastNamePlaceholder')} {...editForm.register('lastName')} />
            </FormField>
            <FormField id="eu-idNumber" label={t('users.dialogs.idNumberLabel')} error={editForm.formState.errors.idNumber?.message}>
              <Input id="eu-idNumber" placeholder={t('users.dialogs.idNumberPlaceholder')} {...editForm.register('idNumber')} />
            </FormField>
            <FormField id="eu-position" label={t('users.dialogs.positionLabel')} error={editForm.formState.errors.position?.message}>
              <Input id="eu-position" placeholder={t('users.dialogs.positionPlaceholder')} {...editForm.register('position')} />
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
      <Dialog open={!!deleteUser} onOpenChange={(o) => { if (!o) setDeleteUser(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('users.dialogs.deleteTitle')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t('users.dialogs.deleteConfirmCompanyPre')}{' '}
            <span className="font-medium text-foreground">{deleteUser?.firstName}</span>
            {t('users.dialogs.deleteConfirmCompanyPost')}
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
