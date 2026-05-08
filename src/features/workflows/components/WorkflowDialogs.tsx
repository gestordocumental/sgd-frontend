import type { ElementType, ReactNode } from 'react'
import {
  Trash2, Clock, CheckCircle, XCircle, User, ChevronRight,
  GripVertical, Upload, Loader2, FileText, Paperclip, Download,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { FormField } from '@/components/ui/form-field'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { SearchableSelect } from '@/components/ui/searchable-select'
import type { SelectOption } from '@/components/ui/searchable-select'
import { WorkflowStatusBadge } from './WorkflowsTable'
import type { ApiTimelineEvent, TimelineEventType } from '@/lib/api/workflows'
import type { useWorkflows } from '@/features/workflows/hooks/use-workflows'
import { useAuthStore } from '@/store/authStore'
import { decodeJwt } from '@/lib/jwt'
import { workflowFilesApi } from '@/lib/api/workflow-files'

type WorkflowsHook = ReturnType<typeof useWorkflows>

interface WorkflowDialogsProps {
  hook: WorkflowsHook
  canApprove?: boolean
}

export function WorkflowDialogs({ hook, canApprove = false }: WorkflowDialogsProps) {
  return (
    <>
      <CreateWorkflowDialog hook={hook} />
      <EditWorkflowDialog hook={hook} />
      <DetailWorkflowDialog hook={hook} canApprove={canApprove} />
      <ApproveDialog hook={hook} />
      <RejectDialog hook={hook} />
      <ResubmitDialog hook={hook} />
      <TimelineDialog hook={hook} />
      <DeleteWorkflowDialog hook={hook} />
      <StartReviewCycleDialog hook={hook} />
      <CompleteReviewStepDialog hook={hook} />
    </>
  )
}

// ── Create ────────────────────────────────────────────────────────────────────

function CreateWorkflowDialog({ hook }: { hook: WorkflowsHook }) {
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
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('workflows.dialogs.createTitle')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submitCreate} className="space-y-4 pt-2">

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
            {createError === 'Selecciona una tipología' && (
              <p className="text-xs text-destructive">{createError}</p>
            )}
          </div>

          {/* Documento principal */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              {t('workflows.dialogs.documentLabel')}{' '}
              <span className="font-normal text-muted-foreground">({t('workflows.dialogs.optional')})</span>
            </label>
            <p className="text-xs text-muted-foreground">{t('workflows.dialogs.documentHint')}</p>

            {/* Drop zone */}
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

            {/* Estado de extracción */}
            {documentExtractionLoading && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-3 animate-spin" />
                {t('workflows.dialogs.documentExtracting')}
              </div>
            )}
            {documentExtractionError && (
              <p className="text-xs text-destructive">{documentExtractionError}</p>
            )}

            {/* Panel de comparación */}
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
                      type="button"
                      variant="ghost"
                      size="icon"
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
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Eliminar aprobador"
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
                  ? 'No hay usuarios con permiso de aprobación'
                  : t('workflows.dialogs.approverAllAdded')
              }
            />
            {createError === 'Agrega al menos un aprobador' && (
              <p className="text-xs text-destructive">{createError}</p>
            )}
          </div>

          {/* Usuarios finales */}
          <div className="space-y-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Usuarios finales</label>
              <p className="text-xs text-muted-foreground">
                Usuarios que podrán acceder al workflow una vez aprobado. Se filtran según la estructura organizacional de la tipología seleccionada.
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
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Eliminar usuario final"
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
                Selecciona una tipología para ver los usuarios elegibles.
              </p>
            ) : finalUserEligibleUsers.length === 0 ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-3 space-y-2">
                <p className="text-xs text-amber-800">
                  No hay usuarios con el cargo, área o departamento requerido por esta tipología. Notifica a los administradores para que configuren los usuarios correctamente.
                </p>
                {notifyNoFinalUsersMutation.isSuccess ? (
                  <p className="text-xs text-green-700 font-medium">
                    Notificación enviada a los administradores.
                  </p>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
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
                      ? 'Enviando...'
                      : adminUserIds.length === 0
                        ? 'No hay administradores registrados'
                        : 'Notificar a los administradores'}
                  </Button>
                )}
              </div>
            ) : finalUserIds.length === 0 ? (
              <SearchableSelect
                options={availableFinalUserOptions}
                value=""
                onChange={addFinalUser}
                placeholder="Seleccionar usuario final..."
                searchPlaceholder="Buscar usuario..."
                emptyText="No hay usuarios que coincidan con la estructura de esta tipología"
              />
            ) : null}
            {createError === 'Agrega al menos un usuario final' && (
              <p className="text-xs text-destructive">{createError}</p>
            )}
          </div>

          <DialogFooter className="pt-2">
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

// ── Edit ──────────────────────────────────────────────────────────────────────

function EditWorkflowDialog({ hook }: { hook: WorkflowsHook }) {
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
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar workflow</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">

          {/* Título */}
          <FormField
            id="edit-wf-title"
            label="Título"
            error={editForm.formState.errors.title?.message}
          >
            <Input id="edit-wf-title" {...editForm.register('title')} />
          </FormField>

          {/* Descripción */}
          <FormField
            id="edit-wf-desc"
            label="Descripción (opcional)"
            error={editForm.formState.errors.description?.message}
          >
            <Input id="edit-wf-desc" {...editForm.register('description')} />
          </FormField>

          {/* Documento principal */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Formato{' '}
              <span className="font-normal text-muted-foreground">(opcional — reemplaza el actual)</span>
            </label>
            {existingMainDocMeta?.storageKey && !editDocumentFile && (
              <p className="text-xs text-muted-foreground">
                Actual: <span className="font-medium text-foreground">{existingMainDocMeta.originalName ?? existingMainDocMeta.storageKey}</span>
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
                  <span className="text-xs text-muted-foreground">Arrastra o selecciona un archivo</span>
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
                Quitar archivo seleccionado
              </Button>
            )}
          </div>

          {/* Adjuntos de soporte */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Adjuntos</label>

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
                      aria-label="Eliminar adjunto"
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
                      aria-label="Quitar archivo"
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
              <p className="text-xs text-muted-foreground italic">Sin adjuntos de soporte.</p>
            )}

            <label
              htmlFor="edit-wf-att"
              className="flex items-center justify-center gap-1.5 w-full h-9 rounded-md border border-dashed border-border hover:border-primary/50 cursor-pointer transition-colors text-xs text-muted-foreground hover:text-foreground bg-muted/20"
            >
              <Upload className="size-3.5" />
              Agregar adjunto
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
              <label className="text-sm font-medium">Aprobadores</label>
              <p className="text-xs text-muted-foreground">El orden determina la secuencia de aprobación.</p>
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
                      aria-label="Eliminar aprobador"
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
              placeholder="Agregar aprobador..."
              searchPlaceholder="Buscar usuario..."
              emptyText={
                approverEligibleUsers.length === 0
                  ? 'No hay usuarios con permiso de aprobación'
                  : 'Todos los aprobadores elegibles ya fueron agregados'
              }
            />
          </div>

          {/* Usuario final */}
          <div className="space-y-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">Usuario final</label>
              {finalUserAlreadySaved && (
                <p className="text-xs text-muted-foreground">
                  Asignado: <span className="font-medium text-foreground">{orgUsersMap.get(editWorkflow.finalUserIds![0]) ?? editWorkflow.finalUserIds![0]}</span>
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
                  aria-label="Eliminar usuario final"
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
                placeholder="Seleccionar usuario final..."
                searchPlaceholder="Buscar usuario..."
                emptyText="No hay usuarios que coincidan con la estructura de esta tipología"
              />
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => setEditWorkflow(null)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Guardando...' : 'Guardar cambios'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Detail ────────────────────────────────────────────────────────────────────

function DetailWorkflowDialog({ hook, canApprove }: { hook: WorkflowsHook; canApprove: boolean }) {
  const { t } = useTranslation()
  const { user, accessToken } = useAuthStore()
  const { detailWorkflow, setDetailWorkflow, startApprovalMutation, openApprove, openReject, openResubmit, openTimeline, openEdit, orgUsersMap, openReviewCycle, openCompleteStep } = hook

  const userName = (userId: string) => orgUsersMap.get(userId) ?? userId

  if (!detailWorkflow) return null

  // createdBy viene del sub del JWT — usamos sub decodificado para comparar con certeza
  const currentUserId = (accessToken ? decodeJwt(accessToken)?.sub : null) ?? user?.id
  const isCreator = detailWorkflow.createdBy === currentUserId
  const isCurrentApprover = detailWorkflow.currentAssignedUserId === user?.id

  const isFinalUser = detailWorkflow.finalUserIds?.includes(currentUserId ?? '') ?? false
  const canStartApproval = isCreator && detailWorkflow.status === 'DRAFT'
  const canApproveStep = canApprove && isCurrentApprover && detailWorkflow.status === 'PENDING_APPROVAL'
  const canResubmit = isCreator && detailWorkflow.status === 'RETURNED_TO_CREATOR'
  const canStartReviewCycle = isFinalUser && detailWorkflow.status === 'PENDING_REVIEW_CYCLE'
  const canCompleteAdminStep = detailWorkflow.status === 'ADMIN_CYCLE_IN_PROGRESS' && detailWorkflow.currentAssignedUserId === (currentUserId ?? user?.id)

  const mainDocMeta = detailWorkflow.mainDocumentMetadata as {
    storageKey?: string; originalName?: string; mimeType?: string
  } | null

  const allAttachments = detailWorkflow.attachments ?? []
  const approvalAttachments = (detailWorkflow.approvalActions ?? []).flatMap((a) =>
    (a.attachments ?? []).map((att) => ({ ...att, userId: a.userId })),
  )

  const handleOpenFile = async (storageKey: string) => {
    try {
      const { signedUrl } = await workflowFilesApi.getSignedUrl(detailWorkflow.orgId, storageKey)
      window.open(signedUrl, '_blank', 'noopener,noreferrer')
    } catch {
      // silently fail — user can retry
    }
  }

  return (
    <Dialog open={!!detailWorkflow} onOpenChange={(o) => { if (!o) setDetailWorkflow(null) }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="pr-6 leading-snug">{detailWorkflow.title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          <div className="flex items-center gap-3">
            <WorkflowStatusBadge status={detailWorkflow.status} />
          </div>

          {detailWorkflow.description && (
            <p className="text-sm text-muted-foreground">{detailWorkflow.description}</p>
          )}

          <Separator />

          <div className="space-y-2 text-sm">
            <InfoRow label={t('workflows.detail.typology')}>
              <span className="font-mono text-xs">{detailWorkflow.typologyCode}</span>
              <span className="text-muted-foreground ml-1">— {detailWorkflow.typologyName}</span>
              <Badge variant="outline" className="text-xs ml-1">{detailWorkflow.typologyVersion}</Badge>
            </InfoRow>
            <InfoRow label="Creado por">
              {userName(detailWorkflow.createdBy)}
            </InfoRow>
            <InfoRow label={t('workflows.detail.createdAt')}>
              {new Date(detailWorkflow.createdAt).toLocaleString()}
            </InfoRow>
          </div>

          {/* Documento principal */}
          {mainDocMeta?.storageKey && (
            <>
              <Separator />
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  {t('workflows.detail.mainDocument')}
                </p>
                <div className="flex items-center gap-2.5 rounded-md border border-border px-3 py-2.5">
                  <FileText className="size-4 text-primary shrink-0" />
                  <span className="flex-1 text-sm truncate">{mainDocMeta.originalName ?? mainDocMeta.storageKey}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Descargar documento"
                    className="size-7 shrink-0"
                    onClick={() => handleOpenFile(mainDocMeta.storageKey!)}
                  >
                    <Download className="size-3.5" />
                  </Button>
                </div>
              </div>
            </>
          )}

          {/* Adjuntos de soporte */}
          {allAttachments.length > 0 && (
            <>
              <Separator />
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  {t('workflows.detail.attachments')}
                </p>
                <div className="rounded-md border border-border divide-y divide-border">
                  {allAttachments.map((att) => (
                    <div key={att.id} className="flex items-center gap-2.5 px-3 py-2.5">
                      <Paperclip className="size-3.5 text-muted-foreground shrink-0" />
                      <span className="flex-1 text-xs truncate">{att.originalName}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Descargar adjunto"
                        className="size-7 shrink-0"
                        onClick={() => handleOpenFile(att.storageKey)}
                      >
                        <Download className="size-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Adjuntos de aprobación */}
          {approvalAttachments.length > 0 && (
            <>
              <Separator />
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Documentos adjuntos de aprobación
                </p>
                <div className="rounded-md border border-border divide-y divide-border">
                  {approvalAttachments.map((att, i) => (
                    <div key={i} className="flex items-center gap-2.5 px-3 py-2.5">
                      <CheckCircle className="size-3.5 text-green-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs truncate">{att.originalName}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{userName(att.userId)}</p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Descargar adjunto"
                        className="size-7 shrink-0"
                        onClick={() => handleOpenFile(att.storageKey)}
                      >
                        <Download className="size-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Ciclos de revisión */}
          {(detailWorkflow.adminCycles ?? []).length > 0 && (
            <>
              <Separator />
              <div className="space-y-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Ciclos de revisión
                </p>
                {(detailWorkflow.adminCycles ?? []).map((cycle) => (
                  <div key={cycle.id} className="space-y-3">
                    {(detailWorkflow.adminCycles ?? []).length > 1 && (
                      <p className="text-xs font-medium text-muted-foreground">
                        Ciclo #{cycle.cycleNumber}{' '}
                        <span className={cycle.status === 'COMPLETED' ? 'text-green-600' : 'text-blue-600'}>
                          ({cycle.status === 'COMPLETED' ? 'Completado' : 'En progreso'})
                        </span>
                      </p>
                    )}
                    <div className="space-y-2">
                      {[...cycle.steps]
                        .sort((a, b) => a.stepOrder - b.stepOrder)
                        .map((step) => {
                          const hasContent = (step.notes?.length ?? 0) > 0 || (step.attachments?.length ?? 0) > 0
                          return (
                            <div key={step.id} className="rounded-md border border-border p-3 space-y-2">
                              <div className="flex items-center gap-2">
                                <div className="flex items-center justify-center size-5 rounded-full border text-[10px] font-bold shrink-0 text-muted-foreground">
                                  {step.stepOrder}
                                </div>
                                <User className="size-3.5 text-muted-foreground shrink-0" />
                                <span className="text-xs font-medium flex-1 truncate">{userName(step.userId)}</span>
                                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${
                                  step.status === 'COMPLETED' ? 'bg-green-50 text-green-700 border-green-200'
                                  : step.status === 'PENDING'  ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                                  : 'bg-muted text-muted-foreground border-muted-foreground/20'
                                }`}>
                                  {step.status === 'COMPLETED' ? 'Completado' : step.status === 'PENDING' ? 'Pendiente' : 'En espera'}
                                </span>
                              </div>

                              {step.status === 'COMPLETED' && !hasContent && (
                                <p className="text-[11px] text-muted-foreground italic pl-7">Sin comentarios ni adjuntos.</p>
                              )}

                              {(step.notes ?? []).map((note) => (
                                <div key={note.id} className="ml-7 rounded-md bg-muted/40 border border-border px-2.5 py-2">
                                  <p className="text-xs text-foreground break-words">{note.content}</p>
                                  <p className="text-[10px] text-muted-foreground mt-0.5">
                                    {new Date(note.createdAt).toLocaleString()}
                                  </p>
                                </div>
                              ))}

                              {(step.attachments ?? []).length > 0 && (
                                <div className="ml-7 rounded-md border border-border divide-y divide-border">
                                  {(step.attachments ?? []).map((att) => (
                                    <div key={att.id} className="flex items-center gap-2 px-2.5 py-1.5">
                                      <Paperclip className="size-3 text-muted-foreground shrink-0" />
                                      <span className="flex-1 text-xs truncate">{att.originalName}</span>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="size-6 shrink-0"
                                        onClick={() => handleOpenFile(att.storageKey)}
                                      >
                                        <Download className="size-3" />
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )
                        })}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {detailWorkflow.approvalSteps.length > 0 && (
            <>
              <Separator />
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  {t('workflows.detail.approvalSteps')}
                </p>
                <div className="space-y-2">
                  {detailWorkflow.approvalSteps
                    .sort((a, b) => a.stepOrder - b.stepOrder)
                    .map((step) => {
                      const actions = (detailWorkflow.approvalActions ?? [])
                        .filter((a) => a.stepId === step.id)
                        .sort((a, b) => b.attemptNumber - a.attemptNumber)
                      const lastAction = actions[0] ?? null
                      return (
                        <div key={step.id} className="space-y-1">
                          <div className="flex items-center gap-2.5">
                            <div className="flex items-center justify-center size-5 rounded-full border text-[10px] font-bold shrink-0 text-muted-foreground">
                              {step.stepOrder}
                            </div>
                            <User className="size-3.5 text-muted-foreground shrink-0" />
                            <span className="text-xs flex-1 truncate">{userName(step.userId)}</span>
                            <ApprovalStepBadge status={step.status} />
                          </div>
                          {lastAction?.observations && (
                            <div className="ml-8 rounded-md bg-muted/50 border border-border px-2.5 py-1.5">
                              <p className="text-[11px] text-muted-foreground italic break-words">
                                "{lastAction.observations}"
                              </p>
                              <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                                {lastAction.action === 'APPROVED' ? 'Aprobado' : 'Rechazado'} · {new Date(lastAction.createdAt).toLocaleString()}
                              </p>
                            </div>
                          )}
                        </div>
                      )
                    })}
                </div>
              </div>
            </>
          )}

          {(detailWorkflow.finalUserIds?.length ?? 0) > 0 && (
            <>
              <Separator />
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Usuario final
                </p>
                <div className="flex items-center gap-2.5 rounded-md border border-border px-3 py-2.5">
                  <User className="size-3.5 text-muted-foreground shrink-0" />
                  <span className="text-sm">{userName(detailWorkflow.finalUserIds![0])}</span>
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="flex-wrap gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setDetailWorkflow(null); openTimeline(detailWorkflow.id) }}
          >
            {t('workflows.actions.viewTimeline')}
          </Button>
          {isCreator && detailWorkflow.status === 'DRAFT' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setDetailWorkflow(null); openEdit(detailWorkflow) }}
            >
              Editar
            </Button>
          )}
          {canStartApproval && (
            <Button
              size="sm"
              disabled={startApprovalMutation.isPending}
              onClick={() => startApprovalMutation.mutate(detailWorkflow.id)}
            >
              {startApprovalMutation.isPending ? t('common.processing') : t('workflows.actions.startApproval')}
            </Button>
          )}
          {canApproveStep && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
                onClick={() => { setDetailWorkflow(null); openReject(detailWorkflow) }}
              >
                {t('workflows.actions.reject')}
              </Button>
              <Button
                size="sm"
                onClick={() => { setDetailWorkflow(null); openApprove(detailWorkflow) }}
              >
                {t('workflows.actions.approve')}
              </Button>
            </>
          )}
          {canResubmit && (
            <Button
              size="sm"
              onClick={() => { setDetailWorkflow(null); openResubmit(detailWorkflow) }}
            >
              {t('workflows.actions.resubmit')}
            </Button>
          )}
          {canStartReviewCycle && (
            <Button
              size="sm"
              onClick={() => { setDetailWorkflow(null); openReviewCycle(detailWorkflow) }}
            >
              Iniciar revisión
            </Button>
          )}
          {canCompleteAdminStep && (
            <Button
              size="sm"
              onClick={() => { setDetailWorkflow(null); openCompleteStep(detailWorkflow) }}
            >
              Completar paso
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setDetailWorkflow(null)}>
            {t('common.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Approve ───────────────────────────────────────────────────────────────────

function ApproveDialog({ hook }: { hook: WorkflowsHook }) {
  const { t } = useTranslation()
  const {
    approveWorkflow, setApproveWorkflow,
    approveForm, approveMutation,
    approveAttachmentFiles, setApproveAttachmentFiles,
  } = hook

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(e.target.files ?? [])
    if (newFiles.length === 0) return
    setApproveAttachmentFiles((prev) => [...prev, ...newFiles])
    e.target.value = ''
  }

  const removeFile = (index: number) =>
    setApproveAttachmentFiles((prev) => prev.filter((_, i) => i !== index))

  return (
    <Dialog open={!!approveWorkflow} onOpenChange={(o) => { if (!o) setApproveWorkflow(null) }}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('workflows.dialogs.approveTitle')}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {t('workflows.dialogs.approveConfirmPre')}{' '}
          <span className="font-medium text-foreground">"{approveWorkflow?.title}"</span>
          {t('workflows.dialogs.approveConfirmPost')}
        </p>
        <form
          onSubmit={approveForm.handleSubmit((values) => {
            if (!approveWorkflow) return
            approveMutation.mutate({ id: approveWorkflow.id, dto: values })
          })}
          className="space-y-4"
        >
          <FormField
            id="approve-obs"
            label={`${t('workflows.dialogs.observationsLabel')} (${t('workflows.dialogs.optional')})`}
            error={approveForm.formState.errors.observations?.message}
          >
            <Input
              id="approve-obs"
              placeholder={t('workflows.dialogs.observationsPlaceholder')}
              {...approveForm.register('observations')}
            />
          </FormField>

          {/* Adjuntos opcionales */}
          <div className="space-y-1.5">
            <p className="text-sm font-medium leading-none">
              Documentos adjuntos{' '}
              <span className="text-muted-foreground font-normal">({t('workflows.dialogs.optional')})</span>
            </p>

            {/* Lista de archivos seleccionados */}
            {approveAttachmentFiles.length > 0 && (
              <div className="rounded-md border divide-y divide-border">
                {approveAttachmentFiles.map((file, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-2 text-sm">
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="flex-1 min-w-0 truncate">{file.name}</span>
                    <button
                      type="button"
                      aria-label="Eliminar archivo"
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => removeFile(i)}
                    >
                      <XCircle className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Botón para agregar más archivos */}
            <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground hover:bg-muted/40 transition-colors">
              <Paperclip className="h-4 w-4 shrink-0" />
              <span>
                {approveAttachmentFiles.length === 0
                  ? 'Adjuntar documentos de soporte'
                  : 'Agregar otro documento'}
              </span>
              <input
                type="file"
                className="hidden"
                accept=".pdf,.docx,.xlsx"
                multiple
                onChange={handleFileChange}
              />
            </label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setApproveWorkflow(null)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={approveMutation.isPending}>
              {approveMutation.isPending ? t('common.processing') : t('workflows.dialogs.approveButton')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Reject ────────────────────────────────────────────────────────────────────

function RejectDialog({ hook }: { hook: WorkflowsHook }) {
  const { t } = useTranslation()
  const { rejectWorkflow, setRejectWorkflow, rejectForm, rejectMutation } = hook

  return (
    <Dialog open={!!rejectWorkflow} onOpenChange={(o) => { if (!o) setRejectWorkflow(null) }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('workflows.dialogs.rejectTitle')}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {t('workflows.dialogs.rejectConfirmPre')}{' '}
          <span className="font-medium text-foreground">"{rejectWorkflow?.title}"</span>
          {t('workflows.dialogs.rejectConfirmPost')}
        </p>
        <form
          onSubmit={rejectForm.handleSubmit((values) => {
            if (!rejectWorkflow) return
            rejectMutation.mutate({ id: rejectWorkflow.id, dto: values })
          })}
          className="space-y-4"
        >
          <FormField
            id="reject-obs"
            label={t('workflows.dialogs.observationsLabel')}
            error={rejectForm.formState.errors.observations?.message}
          >
            <Input
              id="reject-obs"
              placeholder={t('workflows.dialogs.rejectObservationsPlaceholder')}
              {...rejectForm.register('observations')}
            />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRejectWorkflow(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={rejectMutation.isPending || !rejectForm.formState.isValid}
            >
              {rejectMutation.isPending ? t('common.processing') : t('workflows.dialogs.rejectButton')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Resubmit ──────────────────────────────────────────────────────────────────

function ResubmitDialog({ hook }: { hook: WorkflowsHook }) {
  const { t } = useTranslation()
  const { resubmitWorkflow, setResubmitWorkflow, resubmitForm, resubmitMutation } = hook

  return (
    <Dialog open={!!resubmitWorkflow} onOpenChange={(o) => { if (!o) setResubmitWorkflow(null) }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('workflows.dialogs.resubmitTitle')}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {t('workflows.dialogs.resubmitConfirmPre')}{' '}
          <span className="font-medium text-foreground">"{resubmitWorkflow?.title}"</span>
          {t('workflows.dialogs.resubmitConfirmPost')}
        </p>
        <form
          onSubmit={resubmitForm.handleSubmit((values) => {
            if (!resubmitWorkflow) return
            resubmitMutation.mutate({ id: resubmitWorkflow.id, dto: values })
          })}
          className="space-y-4"
        >
          <FormField
            id="resubmit-obs"
            label={`${t('workflows.dialogs.observationsLabel')} (${t('workflows.dialogs.optional')})`}
            error={resubmitForm.formState.errors.observations?.message}
          >
            <Input
              id="resubmit-obs"
              placeholder={t('workflows.dialogs.resubmitObservationsPlaceholder')}
              {...resubmitForm.register('observations')}
            />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setResubmitWorkflow(null)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={resubmitMutation.isPending}>
              {resubmitMutation.isPending ? t('common.processing') : t('workflows.dialogs.resubmitButton')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Timeline ──────────────────────────────────────────────────────────────────

const TIMELINE_ICON: Record<TimelineEventType, ElementType> = {
  WORKFLOW_CREATED:             CheckCircle,
  APPROVAL_STARTED:             Clock,
  STEP_APPROVED:                CheckCircle,
  STEP_REJECTED:                XCircle,
  WORKFLOW_RETURNED_TO_CREATOR: XCircle,
  WORKFLOW_RESUBMITTED:         Clock,
  WORKFLOW_APPROVED:            CheckCircle,
  ATTACHMENT_ADDED:             CheckCircle,
  NOTE_ADDED:                   CheckCircle,
  ADMIN_CYCLE_STARTED:          Clock,
  ADMIN_STEP_COMPLETED:         CheckCircle,
  ADMIN_CYCLE_COMPLETED:        CheckCircle,
  WORKFLOW_CLOSED:              CheckCircle,
  WORKFLOW_CANCELLED:           XCircle,
}

function TimelineDialog({ hook }: { hook: WorkflowsHook }) {
  const { t } = useTranslation()
  const { timelineWorkflowId, setTimelineWorkflowId, timeline, timelineLoading, orgUsersMap } = hook

  const userName = (userId: string) => orgUsersMap.get(userId) ?? userId

  return (
    <Dialog open={!!timelineWorkflowId} onOpenChange={(o) => { if (!o) setTimelineWorkflowId(null) }}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('workflows.dialogs.timelineTitle')}</DialogTitle>
        </DialogHeader>
        <div className="py-2">
          {timelineLoading ? (
            <p className="text-sm text-muted-foreground text-center py-8">{t('common.loading')}</p>
          ) : timeline.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">{t('workflows.dialogs.timelineEmpty')}</p>
          ) : (
            <div className="relative">
              <div className="absolute left-3.5 top-0 bottom-0 w-px bg-border" />
              <div className="space-y-4">
                {timeline.map((event, i) => (
                  <TimelineEventRow key={event.id} event={event} userName={userName} />
                ))}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setTimelineWorkflowId(null)}>{t('common.close')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function TimelineEventRow({
  event,
  userName,
}: {
  event: ApiTimelineEvent
  userName: (id: string) => string
}) {
  const Icon = TIMELINE_ICON[event.eventType] ?? ChevronRight
  const isNegative = ['STEP_REJECTED', 'WORKFLOW_RETURNED_TO_CREATOR', 'WORKFLOW_CANCELLED'].includes(event.eventType)

  return (
    <div className="flex gap-3 pl-1">
      <div className={`relative z-10 flex items-center justify-center size-6 rounded-full border-2 bg-background shrink-0 ${isNegative ? 'border-red-400 text-red-500' : 'border-green-500 text-green-600'}`}>
        <Icon className="size-3" />
      </div>
      <div className="flex-1 min-w-0 pb-1">
        <p className="text-sm font-medium">{event.description}</p>
        <p className="text-xs text-muted-foreground">
          <span className="font-medium">{userName(event.actorId)}</span>
          {' · '}
          {new Date(event.createdAt).toLocaleString()}
        </p>
        {!!event.metadata?.observations && (
          <p className="text-xs text-muted-foreground mt-1 italic">"{String(event.metadata.observations)}"</p>
        )}
      </div>
    </div>
  )
}

// ── Delete ────────────────────────────────────────────────────────────────────

function DeleteWorkflowDialog({ hook }: { hook: WorkflowsHook }) {
  const { t } = useTranslation()
  const { deleteWorkflow, setDeleteWorkflow, deleteMutation } = hook

  return (
    <Dialog open={!!deleteWorkflow} onOpenChange={(o) => { if (!o) setDeleteWorkflow(null) }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('workflows.dialogs.deleteTitle')}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {t('workflows.dialogs.deleteConfirmPre')}{' '}
          <span className="font-medium text-foreground">"{deleteWorkflow?.title}"</span>
          {t('workflows.dialogs.deleteConfirmPost')}
        </p>
        <DialogFooter className="pt-2">
          <Button variant="outline" onClick={() => setDeleteWorkflow(null)}>{t('common.cancel')}</Button>
          <Button
            variant="destructive"
            disabled={deleteMutation.isPending}
            onClick={() => deleteWorkflow && deleteMutation.mutate(deleteWorkflow.id)}
          >
            {deleteMutation.isPending ? t('common.deleting') : t('workflows.dialogs.deleteButton')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── StartReviewCycle ─────────────────────────────────────────────────────────

function StartReviewCycleDialog({ hook }: { hook: WorkflowsHook }) {
  const {
    reviewCycleWorkflow, setReviewCycleWorkflow,
    reviewCycleReviewerIds, setReviewCycleReviewerIds,
    createAdminCycleMutation, skipReviewCycleMutation,
    activeOrgUsers, orgUsersMap,
  } = hook

  if (!reviewCycleWorkflow) return null

  const availableReviewerOptions = activeOrgUsers
    .filter((u) => !reviewCycleReviewerIds.includes(u.id))
    .map((u) => ({
      value: u.id,
      label: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email,
      sublabel: u.position,
    }))

  const addReviewer = (userId: string) => {
    if (!reviewCycleReviewerIds.includes(userId)) {
      setReviewCycleReviewerIds((prev) => [...prev, userId])
    }
  }

  const removeReviewer = (userId: string) => {
    setReviewCycleReviewerIds((prev) => prev.filter((id) => id !== userId))
  }

  const isPending = createAdminCycleMutation.isPending || skipReviewCycleMutation.isPending

  return (
    <Dialog open={!!reviewCycleWorkflow} onOpenChange={(o) => { if (!o) setReviewCycleWorkflow(null) }}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Iniciar ciclo de revisión</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <p className="text-sm text-muted-foreground">
            Configura los revisores para el workflow{' '}
            <span className="font-medium text-foreground">"{reviewCycleWorkflow.title}"</span>.
            El orden de la lista determina la secuencia de revisión.
          </p>

          {reviewCycleReviewerIds.length > 0 && (
            <div className="rounded-md border border-border divide-y divide-border">
              {reviewCycleReviewerIds.map((id, index) => (
                <div key={id} className="flex items-center gap-2.5 px-3 py-2.5">
                  <div className="flex items-center justify-center size-5 rounded-full bg-primary/10 text-[10px] font-bold text-primary shrink-0">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {orgUsersMap.get(id) ?? id}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Eliminar revisor"
                    className="size-7 text-muted-foreground hover:text-destructive shrink-0"
                    onClick={() => removeReviewer(id)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <SearchableSelect
            options={availableReviewerOptions}
            value=""
            onChange={addReviewer}
            placeholder="Agregar revisor..."
            searchPlaceholder="Buscar usuario..."
            emptyText="No hay usuarios disponibles"
          />
        </div>

        <DialogFooter className="flex-wrap gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() => setReviewCycleWorkflow(null)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() => skipReviewCycleMutation.mutate(reviewCycleWorkflow.id)}
          >
            {skipReviewCycleMutation.isPending ? 'Procesando...' : 'Ir a Disponible sin revisión'}
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={isPending || reviewCycleReviewerIds.length === 0}
            onClick={() => createAdminCycleMutation.mutate({
              id: reviewCycleWorkflow.id,
              reviewerIds: reviewCycleReviewerIds,
            })}
          >
            {createAdminCycleMutation.isPending ? 'Iniciando...' : 'Iniciar revisión'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── CompleteReviewStep ────────────────────────────────────────────────────────

function CompleteReviewStepDialog({ hook }: { hook: WorkflowsHook }) {
  const {
    completeStepWorkflow, setCompleteStepWorkflow,
    completeStepFiles, setCompleteStepFiles,
    completeStepNotes, setCompleteStepNotes,
    completeStepMutation,
  } = hook

  if (!completeStepWorkflow) return null

  const cycle = completeStepWorkflow.activeAdminCycle
  const currentStep = cycle?.steps.find((s) => s.status === 'PENDING')

  const handleFileAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(e.target.files ?? [])
    if (newFiles.length === 0) return
    setCompleteStepFiles((prev) => [...prev, ...newFiles])
    e.target.value = ''
  }

  const removeFile = (index: number) =>
    setCompleteStepFiles((prev) => prev.filter((_, i) => i !== index))

  return (
    <Dialog open={!!completeStepWorkflow} onOpenChange={(o) => { if (!o) setCompleteStepWorkflow(null) }}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Completar paso de revisión</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <p className="text-sm text-muted-foreground">
            Añade comentarios y/o adjuntos para el paso{' '}
            {currentStep ? <span className="font-medium text-foreground">#{currentStep.stepOrder}</span> : null}{' '}
            del workflow{' '}
            <span className="font-medium text-foreground">"{completeStepWorkflow.title}"</span>.
            Al completar, el siguiente revisor recibirá la tarea.
          </p>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Notas <span className="font-normal text-muted-foreground">(opcional)</span>
            </label>
            <textarea
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              placeholder="Escribe tus observaciones o comentarios..."
              maxLength={3000}
              value={completeStepNotes}
              onChange={(e) => setCompleteStepNotes(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <p className="text-sm font-medium">
              Adjuntos <span className="font-normal text-muted-foreground">(opcional)</span>
            </p>

            {completeStepFiles.length > 0 && (
              <div className="rounded-md border divide-y divide-border">
                {completeStepFiles.map((file, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-2 text-sm">
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="flex-1 min-w-0 truncate">{file.name}</span>
                    <button
                      type="button"
                      aria-label="Eliminar archivo"
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => removeFile(i)}
                    >
                      <XCircle className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground hover:bg-muted/40 transition-colors">
              <Paperclip className="h-4 w-4 shrink-0" />
              <span>
                {completeStepFiles.length === 0
                  ? 'Adjuntar documentos'
                  : 'Agregar otro documento'}
              </span>
              <input
                type="file"
                className="hidden"
                accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg"
                multiple
                onChange={handleFileAdd}
              />
            </label>
          </div>
        </div>

        <DialogFooter className="pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setCompleteStepWorkflow(null)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={completeStepMutation.isPending || !currentStep}
            onClick={() => completeStepMutation.mutate({
              workflow: completeStepWorkflow,
              notes:    completeStepNotes,
              files:    completeStepFiles,
            })}
          >
            {completeStepMutation.isPending ? 'Procesando...' : 'Completar paso'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-muted-foreground shrink-0 w-24">{label}</span>
      <div className="flex items-center flex-wrap gap-1">{children}</div>
    </div>
  )
}

function ExtractionComparisonRow({
  label,
  extracted,
  match,
}: {
  label: string
  extracted: string | null
  match: boolean | undefined
}) {
  const { t } = useTranslation()
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-muted-foreground w-16 shrink-0">{label}</span>
      <span className="flex-1 font-mono truncate text-foreground">{extracted ?? '—'}</span>
      {match === undefined ? null : match ? (
        <Badge variant="outline" className="text-[10px] px-1.5 shrink-0 bg-green-50 text-green-700 border-green-200">
          {t('workflows.dialogs.documentMatch')}
        </Badge>
      ) : (
        <Badge variant="outline" className="text-[10px] px-1.5 shrink-0 bg-red-50 text-red-700 border-red-200">
          {t('workflows.dialogs.documentMismatch')}
        </Badge>
      )}
    </div>
  )
}

function ApprovalStepBadge({ status }: { status: string }) {
  const { t } = useTranslation()
  const cfg: Record<string, { className: string }> = {
    WAITING:  { className: 'bg-muted text-muted-foreground border-muted-foreground/20' },
    PENDING:  { className: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
    APPROVED: { className: 'bg-green-50 text-green-700 border-green-200' },
    REJECTED: { className: 'bg-red-50 text-red-700 border-red-200' },
  }
  return (
    <Badge variant="outline" className={`text-[10px] px-1.5 ${cfg[status]?.className ?? ''}`}>
      {t(`workflows.approvalStepStatus.${status}`, { defaultValue: status })}
    </Badge>
  )
}
