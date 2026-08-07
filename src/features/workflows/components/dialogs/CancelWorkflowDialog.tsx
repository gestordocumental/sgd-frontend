import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import type { WorkflowsHook } from './workflow-dialog.types';

export function CancelWorkflowDialog({ hook }: { hook: WorkflowsHook }) {
  const { t } = useTranslation();
  const { cancelWorkflow, setCancelWorkflow, cancelReason, setCancelReason } = hook.dialogs;
  const { cancelMutation } = hook.mutations;
  const trimmedReason = cancelReason.trim();

  return (
    <Dialog
      open={!!cancelWorkflow}
      onOpenChange={(o) => {
        if (!o) setCancelWorkflow(null);
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('workflows.dialogs.cancelWorkflowTitle')}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {t('workflows.dialogs.cancelWorkflowConfirmPre')}{' '}
          <span className="font-medium text-foreground">"{cancelWorkflow?.title}"</span>
          {t('workflows.dialogs.cancelWorkflowConfirmPost')}
        </p>
        <div className="space-y-1.5">
          <label htmlFor="cancel-reason" className="text-sm font-medium">
            {t('workflows.dialogs.cancelReasonLabel')}
          </label>
          <textarea
            id="cancel-reason"
            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
            placeholder={t('workflows.dialogs.cancelReasonPlaceholder')}
            maxLength={2000}
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
          />
        </div>
        <DialogFooter className="pt-2">
          <Button type="button" variant="outline" onClick={() => setCancelWorkflow(null)}>
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            style={{ backgroundColor: '#dc2626' }}
            disabled={cancelMutation.isPending || !trimmedReason}
            onClick={() =>
              cancelWorkflow &&
              cancelMutation.mutate({ id: cancelWorkflow.id, reason: cancelReason })
            }
          >
            {cancelMutation.isPending
              ? t('common.processing')
              : t('workflows.dialogs.cancelWorkflowButton')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
