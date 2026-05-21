import { Trash2, Upload, Loader2, FileText, Paperclip, GripVertical, User } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { FormField } from '@/components/ui/form-field'
import { SearchableSelect } from '@/components/ui/searchable-select'
import type { SelectOption } from '@/components/ui/searchable-select'
import type { WorkflowsHook } from './workflow-dialog.types'
import { ExtractionComparisonRow } from './workflow-dialog-shared'

export function CreateWorkflowDialog({ hook }: { hook: WorkflowsHook }) {
  const { t } = useTranslation()
  const {
    createOpen, setCreateOpen,
    createForm, submitCreate, createMutation, createError,
    selectedTypologyId, setSelectedTypologyId,
    approverIds, addApprover, removeApprover,
    finalUserIds, addFinalUser, removeFinalUser,
    activeTypologies, activeOrgUsers, approverEligibleUsers, finalUserEligibleUsers,
    notifyNoFinalUsersMutation,
    documentFile, documentExtraction, documentExtractionLoading,
    documentExtractionError, documentComparison, handleDocumentFile,
    createBlocked,
    supportingFiles, addSupportingFile, removeSupportingFile,
  } = hook

  const typologyOptions: SelectOption[] = activeTypologies.map((ty) => ({
    value: ty.id,
    label: ty.datosDeclarados.nombre ?? ty.datosDeclarados.codigo ?? ty.id,
    sublabel: [ty.datosDeclarados.codigo, ty.datosDeclarados.version].filter(Boolean).join(' · '),
  }))

  const availableApproverOptions: SelectOption[] = approverEligibleUsers
    .filter((u) => !approverIds.includes(u.id))
    .map((u) => ({
      value: u.id,
      label: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email,
      sublabel: u.position,
    }))

  const selectedApproversData = approverIds.map((id) => {
    const user = approverEligibleUsers.find((u) => u.id === id)
    return { id, user }
  })

  const availableFinalUserOptions: SelectOption[] = finalUserEligibleUsers
    .filter((u) => !finalUserIds.includes(u.id))
    .map((u) => ({
      value: u.id,
      label: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email,
      sublabel: u.position,
    }))

  const selectedFinalUsersData = finalUserIds.map((id) => {
    const user = finalUserEligibleUsers.find((u) => u.id === id)
      ?? activeOrgUsers.find((u) => u.id === id)
    return { id, user }
  })

  const selectedTypology = activeTypologies.find((t) => t.id === selectedTypologyId) ?? null
  const adminUserIds = activeOrgUsers.filter((u) => u.isSuperAdmin).map((u) => u.id)

  const isSubmitDisabled = createMutation.isPending || createBlocked

  return (
    <Dialog open={createOpen} onOpenChange={setCreateOpen}>
      <DialogContent className="sm:max-w-4xl max-h-[92vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle>{t('workflows.dialogs.createTitle')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submitCreate} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 pt-2">

              {/* ── Columna izquierda: datos + documento ── */}
              <div className="space-y-4">

                {/* Título */}
                <FormField
                  id="wf-title"
                  label={t('workflows.dialogs.titleLabel')}
                  error={createForm.formState.errors.title?.message}
                >
                  <Input
                    id="wf-title"
                    placeholder={t('workflows.dialogs.titlePlaceholder')}
                    {...createForm.register('title')}
                  />
                </FormField>

                {/* Descripción */}
                <FormField
                  id="wf-desc"
                  label={`${t('common.description')} (${t('workflows.dialogs.optional')})`}
                  error={createForm.formState.errors.description?.message}
                >
                  <Input
                    id="wf-desc"
                    placeholder={t('workflows.dialogs.descriptionPlaceholder')}
                    {...createForm.register('description')}
                  />
                </FormField>

                {/* Tipología */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">{t('workflows.dialogs.typologyLabel')}</label>
                  <SearchableSelect
                    options={typologyOptions}
                    value={selectedTypologyId}
                    onChange={(id) => {
                      setSelectedTypologyId(id)
                      notifyNoFinalUsersMutation.reset()
                      removeFinalUser(finalUserIds[0])
                    }}
                    placeholder={t('workflows.dialogs.typologyPlaceholder')}
                    searchPlaceholder={t('workflows.dialogs.typologySearch')}
                    emptyText={t('workflows.dialogs.typologyEmpty')}
                  />
                  {createError === 'ERR_NO_TYPOLOGY' && (
                    <p className="text-xs text-destructive">{t('workflows.dialogs.errorNoTypology')}</p>
                  )}
                </div>

                {/* Documento principal */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">
                    {t('workflows.dialogs.documentLabel')}{' '}
                    <span className="font-normal text-muted-foreground">({t('workflows.dialogs.optional')})</span>
                  </label>
                  <p className="text-xs text-muted-foreground">{t('workflows.dialogs.documentHint')}</p>
                  <label
                    htmlFor="wf-document-file"
                    className="flex flex-col items-center justify-center gap-1.5 w-full h-20 rounded-md border-2 border-dashed border-border hover:border-primary/50 cursor-pointer transition-colors bg-muted/30 hover:bg-muted/50"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault()
                      const file = e.dataTransfer.files[0]
                      if (file) handleDocumentFile(file)
                    }}
                  >
                    {documentFile ? (
                      <>
                        <FileText className="size-4 text-primary" />
                        <span className="text-xs text-foreground font-medium px-2 text-center truncate max-w-full">
                          {documentFile.name}
                        </span>
                      </>
                    ) : (
                      <>
                        <Upload className="size-4 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">{t('workflows.dialogs.documentDrop')}</span>
                      </>
                    )}
                    <input
                      id="wf-document-file"
                      type="file"
                      className="sr-only"
                      accept=".pdf,.docx,.xlsx"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) handleDocumentFile(file)
                        e.target.value = ''
                      }}
                    />
                  </label>
                  {documentExtractionLoading && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="size-3 animate-spin" />
                      {t('workflows.dialogs.documentExtracting')}
                    </div>
                  )}
                  {documentExtractionError && (
                    <p className="text-xs text-destructive">{documentExtractionError}</p>
                  )}
                  {documentExtraction && (
                    <div className="rounded-md border border-border p-3 space-y-2 bg-muted/20">
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                        {t('workflows.dialogs.documentExtracted')}
                      </p>
                      <ExtractionComparisonRow
                        label={t('workflows.dialogs.documentNombre')}
                        extracted={documentExtraction.nombre}
                        match={documentComparison?.nombre ?? undefined}
                      />
                      <ExtractionComparisonRow
                        label={t('workflows.dialogs.documentCodigo')}
                        extracted={documentExtraction.codigo}
                        match={documentComparison?.codigo ?? undefined}
                      />
                      <ExtractionComparisonRow
                        label={t('workflows.dialogs.documentVersion')}
                        extracted={documentExtraction.version}
                        match={documentComparison?.version ?? undefined}
                      />
                      {!selectedTypologyId && (
                        <p className="text-[11px] text-muted-foreground italic">
                          {t('workflows.dialogs.documentSelectTypologyToCompare')}
                        </p>
                      )}
                      {createBlocked && documentComparison && (
                        <p className="text-[11px] text-destructive font-medium">
                          {t('workflows.dialogs.documentMismatchBlocked')}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Adjuntos de soporte */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">
                    {t('workflows.dialogs.attachmentsLabel')}{' '}
                    <span className="font-normal text-muted-foreground">({t('workflows.dialogs.optional')})</span>
                  </label>
                  <p className="text-xs text-muted-foreground">{t('workflows.dialogs.attachmentsHint')}</p>
                  {supportingFiles.length > 0 && (
                    <div className="rounded-md border border-border divide-y divide-border">
                      {supportingFiles.map((file, idx) => (
                        <div key={idx} className="flex items-center gap-2.5 px-3 py-2">
                          <Paperclip className="size-3.5 text-muted-foreground shrink-0" />
                          <span className="flex-1 text-xs truncate">{file.name}</span>
                          <Button
                            type="button" variant="ghost" size="icon"
                            aria-label="Eliminar adjunto"
                            className="size-6 text-muted-foreground hover:text-destructive shrink-0"
                            onClick={() => removeSupportingFile(idx)}
                          >
                            <Trash2 className="size-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  <label
                    htmlFor="wf-attachment-file"
                    className="flex items-center justify-center gap-1.5 w-full h-9 rounded-md border border-dashed border-border hover:border-primary/50 cursor-pointer transition-colors text-xs text-muted-foreground hover:text-foreground bg-muted/20 hover:bg-muted/30"
                  >
                    <Upload className="size-3.5" />
                    {t('workflows.dialogs.attachmentsAdd')}
                    <input
                      id="wf-attachment-file"
                      type="file"
                      className="sr-only"
                      accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg,.webp,.gif,.bmp,.tiff"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) addSupportingFile(file)
                        e.target.value = ''
                      }}
                    />
                  </label>
                </div>
              </div>

              {/* ── Columna derecha: personas ── */}
              <div className="space-y-4">

                {/* Aprobadores */}
                <div className="space-y-2">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">{t('workflows.dialogs.approversLabel')}</label>
                    <p className="text-xs text-muted-foreground">{t('workflows.dialogs.approversHint')}</p>
                  </div>
                  {selectedApproversData.length > 0 && (
                    <div className="rounded-md border border-border divide-y divide-border">
                      {selectedApproversData.map(({ id, user }, index) => (
                        <div key={id} className="flex items-center gap-2.5 px-3 py-2.5">
                          <GripVertical className="size-3.5 text-muted-foreground/40 shrink-0" />
                          <div className="flex items-center justify-center size-5 rounded-full bg-primary/10 text-[10px] font-bold text-primary shrink-0">
                            {index + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {user ? [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email : id}
                            </p>
                            {user?.position && (
                              <p className="text-xs text-muted-foreground truncate">{user.position}</p>
                            )}
                          </div>
                          <Button
                            type="button" variant="ghost" size="icon"
                            aria-label={t('workflows.dialogs.removeApprover')}
                            className="size-7 text-muted-foreground hover:text-destructive shrink-0"
                            onClick={() => removeApprover(id)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  <SearchableSelect
                    options={availableApproverOptions}
                    value=""
                    onChange={addApprover}
                    placeholder={t('workflows.dialogs.addApproverPlaceholder')}
                    searchPlaceholder={t('workflows.dialogs.approverSearch')}
                    emptyText={
                      approverEligibleUsers.length === 0
                        ? t('workflows.dialogs.approverNoPermission')
                        : t('workflows.dialogs.approverAllAdded')
                    }
                  />
                  {createError === 'ERR_NO_APPROVER' && (
                    <p className="text-xs text-destructive">{t('workflows.dialogs.errorMinApprover')}</p>
                  )}
                </div>

                {/* Usuarios finales */}
                <div className="space-y-2">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">{t('workflows.dialogs.finalUsersLabel')}</label>
                    <p className="text-xs text-muted-foreground">
                      {t('workflows.dialogs.finalUsersHint')}
                    </p>
                  </div>
                  {selectedFinalUsersData.length > 0 && (
                    <div className="rounded-md border border-border divide-y divide-border">
                      {selectedFinalUsersData.map(({ id, user }) => (
                        <div key={id} className="flex items-center gap-2.5 px-3 py-2.5">
                          <User className="size-3.5 text-muted-foreground shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {user ? [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email : id}
                            </p>
                            {user?.position && (
                              <p className="text-xs text-muted-foreground truncate">{user.position}</p>
                            )}
                          </div>
                          <Button
                            type="button" variant="ghost" size="icon"
                            aria-label={t('workflows.dialogs.removeFinalUser')}
                            className="size-7 text-muted-foreground hover:text-destructive shrink-0"
                            onClick={() => removeFinalUser(id)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  {!selectedTypologyId ? (
                    <p className="text-xs text-muted-foreground italic px-1">
                      {t('workflows.dialogs.finalUsersSelectTypology')}
                    </p>
                  ) : finalUserEligibleUsers.length === 0 ? (
                    <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-3 space-y-2">
                      <p className="text-xs text-amber-800">
                        {t('workflows.dialogs.finalUsersNoEligible')}
                      </p>
                      {notifyNoFinalUsersMutation.isSuccess ? (
                        <p className="text-xs text-green-700 font-medium">{t('workflows.dialogs.finalUsersNotified')}</p>
                      ) : (
                        <Button
                          type="button" size="sm" variant="outline"
                          className="border-amber-400 text-amber-800 hover:bg-amber-100"
                          disabled={notifyNoFinalUsersMutation.isPending || adminUserIds.length === 0}
                          onClick={() =>
                            notifyNoFinalUsersMutation.mutate({
                              typologyId:   selectedTypologyId,
                              typologyName: selectedTypology?.datosDeclarados.nombre ?? selectedTypologyId,
                              recipientIds: adminUserIds,
                            })
                          }
                        >
                          {notifyNoFinalUsersMutation.isPending
                            ? t('workflows.dialogs.finalUsersSending')
                            : adminUserIds.length === 0
                              ? t('workflows.dialogs.finalUsersNoAdmins')
                              : t('workflows.dialogs.finalUsersNotify')}
                        </Button>
                      )}
                    </div>
                  ) : finalUserIds.length === 0 ? (
                    <SearchableSelect
                      options={availableFinalUserOptions}
                      value=""
                      onChange={addFinalUser}
                      placeholder={t('workflows.dialogs.finalUsersPlaceholder')}
                      searchPlaceholder={t('workflows.dialogs.finalUsersSearch')}
                      emptyText={t('workflows.dialogs.finalUsersEmpty')}
                    />
                  ) : null}
                  {createError === 'ERR_NO_FINAL_USER' && (
                    <p className="text-xs text-destructive">{t('workflows.dialogs.errorMinFinalUser')}</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="pt-4 shrink-0 border-t border-border mt-4">
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={isSubmitDisabled}>
              {createMutation.isPending ? t('common.creating') : t('workflows.dialogs.createButton')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
