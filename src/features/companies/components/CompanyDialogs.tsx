import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()

  return (
    <>
      {/* ── Crear empresa ─────────────────────────────────────────── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('companies.dialogs.createTitle')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4 pt-2">
            <FormField id="company-name" label={t('companies.dialogs.companyNameLabel')} error={createForm.formState.errors.name?.message}>
              <Input id="company-name" placeholder={t('companies.dialogs.companyNamePlaceholder')} {...createForm.register('name')} />
            </FormField>
            <FormField id="company-nit" label={t('companies.nit')} error={createForm.formState.errors.nit?.message}>
              <Input id="company-nit" placeholder={t('companies.dialogs.nitPlaceholder')} {...createForm.register('nit')} />
            </FormField>
            <FormField id="company-address" label={t('common.address')} error={createForm.formState.errors.address?.message}>
              <Input id="company-address" placeholder={t('companies.dialogs.addressPlaceholder')} {...createForm.register('address')} />
            </FormField>
            <FormField id="company-phone" label={t('common.phone')} error={createForm.formState.errors.phone?.message}>
              <Input id="company-phone" placeholder={t('companies.dialogs.phonePlaceholder')} {...createForm.register('phone')} />
            </FormField>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>{t('common.cancel')}</Button>
              <Button type="submit" disabled={createMutation.isPending || !createForm.formState.isValid}>
                {createMutation.isPending ? t('common.creating') : t('companies.dialogs.createButton')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Editar empresa ────────────────────────────────────────── */}
      <Dialog open={!!editCompany} onOpenChange={(open) => { if (!open) setEditCompany(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('companies.dialogs.editTitle')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4 pt-2">
            <FormField id="edit-company-name" label={t('companies.dialogs.companyNameLabel')} error={editForm.formState.errors.name?.message}>
              <Input id="edit-company-name" placeholder={t('companies.dialogs.companyNamePlaceholder')} {...editForm.register('name')} />
            </FormField>
            <FormField id="edit-company-nit" label={t('companies.nit')} error={editForm.formState.errors.nit?.message}>
              <Input id="edit-company-nit" placeholder={t('companies.dialogs.nitPlaceholder')} {...editForm.register('nit')} />
            </FormField>
            <FormField id="edit-company-address" label={t('common.address')} error={editForm.formState.errors.address?.message}>
              <Input id="edit-company-address" placeholder={t('companies.dialogs.addressPlaceholder')} {...editForm.register('address')} />
            </FormField>
            <FormField id="edit-company-phone" label={t('common.phone')} error={editForm.formState.errors.phone?.message}>
              <Input id="edit-company-phone" placeholder={t('companies.dialogs.phonePlaceholder')} {...editForm.register('phone')} />
            </FormField>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setEditCompany(null)}>{t('common.cancel')}</Button>
              <Button type="submit" disabled={editMutation.isPending || !editForm.formState.isValid}>
                {editMutation.isPending ? t('common.saving') : t('common.saveChanges')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Eliminar empresa ──────────────────────────────────────── */}
      <Dialog open={!!deleteCompany} onOpenChange={(open) => { if (!open) setDeleteCompany(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('companies.dialogs.deleteTitle')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t('companies.dialogs.deleteConfirmPre')}{' '}
            <span className="font-medium text-foreground">{deleteCompany?.name}</span>
            {t('companies.dialogs.deleteConfirmPost')}
          </p>
          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setDeleteCompany(null)}>{t('common.cancel')}</Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteCompany && deleteMutation.mutate(deleteCompany.id)}
            >
              {deleteMutation.isPending ? t('common.deleting') : t('companies.dialogs.deleteButton')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
