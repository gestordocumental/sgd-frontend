import { Trash2, Upload, FileText, Paperclip, GripVertical, User } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { FormField } from '@/components/ui/form-field'
import { SearchableSelect } from '@/components/ui/searchable-select'
import type { SelectOption } from '@/components/ui/searchable-select'
import type { WorkflowsHook } from './workflow-dialog.types'

export function EditWorkflowDialog({ hook }: { hook: WorkflowsHook }) {
  const {
    editWorkflow, setEditWorkflow,
    editForm, updateMutation,
    editApproverIds, setEditApproverIds,
    editDocumentFile, setEditDocumentFile,
    editSupportingFiles, setEditSupportingFiles,
    editExistingAttachments, setEditExistingAttachments,
    editFinalUserId, setEditFinalUserId,
    approverEligibleUsers, finalUserEligibleUsers, activeOrgUsers, orgUsersMap,
  } = hook
  const { t } = useTranslation()

  if (!editWorkflow) return null

  const addEditApprover = (userId: string) => {
    if (!editApproverIds.includes(userId)) {
      setEditApproverIds((prev) => [...prev, userId])
    }
  }
  const removeEditApprover = (userId: string) =>
    setEditApproverIds((prev) => prev.filter((id) => id !== userId))

  const availableApproverOptions: SelectOption[] = approverEligibleUsers
    .filter((u) => !editApproverIds.includes(u.id))
    .map((u) => ({
      value: u.id,
      label: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email,
      sublabel: u.position,
    }))

  const selectedApproversData = editApproverIds.map((id) => ({
    id,
    user: approverEligibleUsers.find((u) => u.id === id),
  }))

  // Usuario final ya asignado (del workflow) o recién seleccionado
  const currentFinalUser = editFinalUserId
    ? (finalUserEligibleUsers.find((u) => u.id === editFinalUserId)
        ?? activeOrgUsers.find((u) => u.id === editFinalUserId))
    : null

  const availableFinalUserOptions: SelectOption[] = finalUserEligibleUsers
    .filter((u) => u.id !== editFinalUserId)
    .map((u) => ({
      value: u.id,
      label: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email,
      sublabel: u.position,
    }))

  // El usuario final ya estaba guardado desde antes (no es recién seleccionado)
  const finalUserAlreadySaved = !!(editWorkflow.finalUserIds?.[0])

  const existingMainDocMeta = editWorkflow.mainDocumentMetadata as {
    storageKey?: string; originalName?: string
  } | null

  const originalAttachmentCount = (editWorkflow.attachments ?? [])
    .filter((a) => a.attachmentType === 'SUPPORTING').length

  const handleSubmit = editForm.handleSubmit((values) => {
    // Solo enviar finalUserIds si cambió respecto al guardado
    const newFinalUserId = editFinalUserId !== (editWorkflow.finalUserIds?.[0] ?? null)
      ? editFinalUserId
      : null

    updateMutation.mutate({
      id:                      editWorkflow.id,
      dto: {
        title:     values.title,
        description: values.description || undefined,
        approvers: editApproverIds.map((userId, i) => ({ userId, stepOrder: i + 1 })),
      },
      mainFile:                editDocumentFile,
      supportingFilesToUpload: editSupportingFiles,
      newFinalUserId,
      existingAttachments:     editExistingAttachments,
      originalAttachmentCount,
    })
  })

  return (
    <Dialog open={!!editWorkflow} onOpenChange={(o) => { if (!o) setEditWorkflow(null) }}>
      <DialogContent className="sm:max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('workflows.dialogs.editTitle')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">

          {/* Título */}
          <FormField
            id="edit-wf-title"
            label={t('workflows.dialogs.editTitleLabel')}
            error={editForm.formState.errors.title?.message}
          >
            <Input id="edit-wf-title" {...editForm.register('title')} />
          </FormField>

          {/* Descripción */}
          <FormField
            id="edit-wf-desc"
            label={t('workflows.dialogs.editDescLabel')}
            error={editForm.formState.errors.description?.message}
          >
            <Input id="edit-wf-desc" {...editForm.register('description')} />
          </FormField>

          {/* Documento principal */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              {t('workflows.dialogs.editDocLabel')}{' '}
              <span className="font-normal text-muted-foreground">{t('workflows.dialogs.editDocOptional')}</span>
            </label>
            {existingMainDocMeta?.storageKey && !editDocumentFile && (
              <p className="text-xs text-muted-foreground">
                {t('workflows.dialogs.editDocCurrent')} <span className="font-medium text-foreground">{existingMainDocMeta.originalName ?? existingMainDocMeta.storageKey}</span>
              </p>
            )}
            <label
              htmlFor="edit-wf-doc"
              className="flex flex-col items-center justify-center gap-1.5 w-full h-16 rounded-md border-2 border-dashed border-border hover:border-primary/50 cursor-pointer transition-colors bg-muted/30 hover:bg-muted/50"
            >
              {editDocumentFile ? (
                <>
                  <FileText className="size-4 text-primary" />
                  <span className="text-xs font-medium px-2 truncate max-w-full">{editDocumentFile.name}</span>
                </>
              ) : (
                <>
                  <Upload className="size-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{t('workflows.dialogs.editDocDrop')}</span>
                </>
              )}
              <input
                id="edit-wf-doc"
                type="file"
                className="sr-only"
                accept=".pdf,.docx,.xlsx"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) setEditDocumentFile(f)
                  e.target.value = ''
                }}
              />
            </label>
            {editDocumentFile && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground h-6 px-2"
                onClick={() => setEditDocumentFile(null)}
              >
                {t('workflows.dialogs.editDocRemove')}
              </Button>
            )}
          </div>

          {/* Adjuntos de soporte */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t('workflows.dialogs.editAttachmentsLabel')}</label>

            {/* Adjuntos existentes guardados */}
            {editExistingAttachments.length > 0 && (
              <div className="rounded-md border border-border divide-y divide-border">
                {editExistingAttachments.map((att) => (
                  <div key={att.id} className="flex items-center gap-2.5 px-3 py-2">
                    <Paperclip className="size-3.5 text-muted-foreground shrink-0" />
                    <span className="flex-1 text-xs truncate">{att.originalName}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={t('workflows.dialogs.editRemoveAttachment')}
                      className="size-6 text-muted-foreground hover:text-destructive shrink-0"
                      onClick={() =>
                        setEditExistingAttachments((prev) => prev.filter((a) => a.id !== att.id))
                      }
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Nuevos archivos por subir */}
            {editSupportingFiles.length > 0 && (
              <div className="rounded-md border border-dashed border-primary/40 divide-y divide-border bg-muted/10">
                {editSupportingFiles.map((file, idx) => (
                  <div key={idx} className="flex items-center gap-2.5 px-3 py-2">
                    <Upload className="size-3.5 text-primary shrink-0" />
                    <span className="flex-1 text-xs truncate">{file.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={t('workflows.dialogs.editRemoveFile')}
                      className="size-6 text-muted-foreground hover:text-destructive shrink-0"
                      onClick={() => setEditSupportingFiles((prev) => prev.filter((_, i) => i !== idx))}
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {editExistingAttachments.length === 0 && editSupportingFiles.length === 0 && (
              <p className="text-xs text-muted-foreground italic">{t('workflows.dialogs.editAttachmentsEmpty')}</p>
            )}

            <label
              htmlFor="edit-wf-att"
              className="flex items-center justify-center gap-1.5 w-full h-9 rounded-md border border-dashed border-border hover:border-primary/50 cursor-pointer transition-colors text-xs text-muted-foreground hover:text-foreground bg-muted/20"
            >
              <Upload className="size-3.5" />
              {t('workflows.dialogs.editAttachmentsAdd')}
              <input
                id="edit-wf-att"
                type="file"
                className="sr-only"
                accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg,.webp,.gif,.bmp,.tiff"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) setEditSupportingFiles((prev) => [...prev, f])
                  e.target.value = ''
                }}
              />
            </label>
          </div>

          {/* Aprobadores */}
          <div className="space-y-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">{t('workflows.dialogs.editApproversLabel')}</label>
              <p className="text-xs text-muted-foreground">{t('workflows.dialogs.editApproversHint')}</p>
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
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={t('workflows.dialogs.editApproverRemove')}
                      className="size-7 text-muted-foreground hover:text-destructive shrink-0"
                      onClick={() => removeEditApprover(id)}
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
              onChange={addEditApprover}
              placeholder={t('workflows.dialogs.editAddApproverPlaceholder')}
              searchPlaceholder={t('workflows.dialogs.editApproverSearch')}
              emptyText={
                approverEligibleUsers.length === 0
                  ? t('workflows.dialogs.editApproverNoPermission')
                  : t('workflows.dialogs.editApproverAllAdded')
              }
            />
          </div>

          {/* Usuario final */}
          <div className="space-y-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">{t('workflows.dialogs.editFinalUserLabel')}</label>
              {finalUserAlreadySaved && (
                <p className="text-xs text-muted-foreground">
                  {t('workflows.dialogs.editFinalUserAssigned')} <span className="font-medium text-foreground">{orgUsersMap.get(editWorkflow.finalUserIds![0]) ?? editWorkflow.finalUserIds![0]}</span>
                </p>
              )}
            </div>
            {currentFinalUser ? (
              <div className="flex items-center gap-2.5 rounded-md border border-border px-3 py-2.5">
                <User className="size-3.5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {[currentFinalUser.firstName, currentFinalUser.lastName].filter(Boolean).join(' ') || currentFinalUser.email}
                  </p>
                  {currentFinalUser.position && (
                    <p className="text-xs text-muted-foreground truncate">{currentFinalUser.position}</p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={t('workflows.dialogs.editFinalUserRemove')}
                  className="size-7 text-muted-foreground hover:text-destructive shrink-0"
                  onClick={() => setEditFinalUserId(null)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ) : (
              <SearchableSelect
                options={availableFinalUserOptions}
                value=""
                onChange={(id) => setEditFinalUserId(id)}
                placeholder={t('workflows.dialogs.editFinalUserPlaceholder')}
                searchPlaceholder={t('workflows.dialogs.editFinalUserSearch')}
                emptyText={t('workflows.dialogs.editFinalUserEmpty')}
              />
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => setEditWorkflow(null)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? t('workflows.dialogs.editSaving') : t('workflows.dialogs.editSaveChanges')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
