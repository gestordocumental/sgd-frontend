import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import type { WorkflowsHook } from './workflow-dialog.types'

export function DeleteWorkflowDialog({ hook }: { hook: WorkflowsHook }) {
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
