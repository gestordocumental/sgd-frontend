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

export function CloseWorkflowDialog({ hook }: { hook: WorkflowsHook }) {
  const { t } = useTranslation();
  const { closeWorkflow, setCloseWorkflow, closingNotes, setClosingNotes } = hook.dialogs;
  const { closeMutation } = hook.mutations;

  return (
    <Dialog
      open={!!closeWorkflow}
      onOpenChange={(o) => {
        if (!o) setCloseWorkflow(null);
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('workflows.dialogs.closeTitle')}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {t('workflows.dialogs.closeConfirmPre')}{' '}
          <span className="font-medium text-foreground">"{closeWorkflow?.title}"</span>
          {t('workflows.dialogs.closeConfirmPost')}
        </p>
        <div className="space-y-1.5">
          <label htmlFor="closing-notes" className="text-sm font-medium">
            {t('workflows.dialogs.closingNotesLabel')}{' '}
            <span className="font-normal text-muted-foreground">
              ({t('workflows.dialogs.optional')})
            </span>
          </label>
          <textarea
            id="closing-notes"
            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
            placeholder={t('workflows.dialogs.closingNotesPlaceholder')}
            maxLength={2000}
            value={closingNotes}
            onChange={(e) => setClosingNotes(e.target.value)}
          />
        </div>
        <DialogFooter className="pt-2">
          <Button type="button" variant="outline" onClick={() => setCloseWorkflow(null)}>
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            disabled={closeMutation.isPending}
            onClick={() =>
              closeWorkflow && closeMutation.mutate({ id: closeWorkflow.id, closingNotes })
            }
          >
            {closeMutation.isPending ? t('common.processing') : t('workflows.dialogs.closeButton')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
