import { FileText, XCircle, Paperclip } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import React from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { FormField } from '@/components/ui/form-field'
import type { WorkflowsHook } from './workflow-dialog.types'

export function ApproveDialog({ hook }: { hook: WorkflowsHook }) {
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
              {t('workflows.dialogs.attachedDocsLabel')}{' '}
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
                      aria-label={t('workflows.dialogs.removeFile')}
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
                  ? t('workflows.dialogs.attachFirst')
                  : t('workflows.dialogs.attachMore')}
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
