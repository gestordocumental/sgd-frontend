import { FileText, XCircle, Paperclip } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import React from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import type { WorkflowsHook } from './workflow-dialog.types'

export function CompleteReviewStepDialog({ hook }: { hook: WorkflowsHook }) {
  const {
    completeStepWorkflow, setCompleteStepWorkflow,
    completeStepFiles, setCompleteStepFiles,
    completeStepNotes, setCompleteStepNotes,
    completeStepMutation,
  } = hook
  const { t } = useTranslation()

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
          <DialogTitle>{t('workflows.dialogs.completeStepTitle')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <p className="text-sm text-muted-foreground">
            {t('workflows.dialogs.completeStepDescPre')}{' '}
            {currentStep ? <span className="font-medium text-foreground">#{currentStep.stepOrder}</span> : null}{' '}
            {t('workflows.dialogs.completeStepDescMid')}{' '}
            <span className="font-medium text-foreground">"{completeStepWorkflow.title}"</span>
            {t('workflows.dialogs.completeStepDescPost')}
          </p>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              {t('workflows.dialogs.notesLabel')} <span className="font-normal text-muted-foreground">({t('workflows.dialogs.optional')})</span>
            </label>
            <textarea
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              placeholder={t('workflows.dialogs.notesPlaceholder')}
              maxLength={3000}
              value={completeStepNotes}
              onChange={(e) => setCompleteStepNotes(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <p className="text-sm font-medium">
              {t('workflows.dialogs.attachmentsShort')} <span className="font-normal text-muted-foreground">({t('workflows.dialogs.optional')})</span>
            </p>

            {completeStepFiles.length > 0 && (
              <div className="rounded-md border divide-y divide-border">
                {completeStepFiles.map((file, i) => (
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

            <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground hover:bg-muted/40 transition-colors">
              <Paperclip className="h-4 w-4 shrink-0" />
              <span>
                {completeStepFiles.length === 0
                  ? t('workflows.dialogs.attachDocuments')
                  : t('workflows.dialogs.attachMore')}
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
            {t('common.cancel')}
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
            {completeStepMutation.isPending ? t('common.processing') : t('workflows.actions.completeStep')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
