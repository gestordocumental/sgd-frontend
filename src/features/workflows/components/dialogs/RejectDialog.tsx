import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import type { WorkflowsHook } from './workflow-dialog.types';

export function RejectDialog({ hook }: { hook: WorkflowsHook }) {
  const { t } = useTranslation();
  const { rejectWorkflow, setRejectWorkflow } = hook.dialogs;
  const { rejectMutation } = hook.mutations;
  const { rejectForm } = hook.forms;

  return (
    <Dialog
      open={!!rejectWorkflow}
      onOpenChange={(o) => {
        if (!o) setRejectWorkflow(null);
      }}
    >
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
            if (!rejectWorkflow) return;
            rejectMutation.mutate({ id: rejectWorkflow.id, dto: values });
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
              style={{ backgroundColor: '#dc2626' }}
              disabled={rejectMutation.isPending || !rejectForm.formState.isValid}
            >
              {rejectMutation.isPending
                ? t('common.processing')
                : t('workflows.dialogs.rejectButton')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
