import { FileText, XCircle, Paperclip } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { SearchableSelect } from '@/components/ui/searchable-select';
import type { WorkflowsHook } from './workflow-dialog.types';

export function ForwardStepDialog({ hook }: { hook: WorkflowsHook }) {
  const {
    forwardStepWorkflow,
    setForwardStepWorkflow,
    forwardStepOptionalId,
    setForwardStepOptionalId,
    forwardStepNotes,
    setForwardStepNotes,
    forwardStepFiles,
    setForwardStepFiles,
  } = hook.dialogs;
  const { forwardStepMutation } = hook.mutations;
  const { orgUsersMap } = hook.queries;
  const { t } = useTranslation();

  if (!forwardStepWorkflow) return null;

  const cycle = forwardStepWorkflow.activeAdminCycle;
  const allowedIds = cycle?.allowedOptionalReviewerIds ?? [];

  const optionalReviewerOptions = allowedIds.map((id) => ({
    value: id,
    label: orgUsersMap.get(id) ?? id,
  }));

  const handleFileAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(e.target.files ?? []);
    if (newFiles.length === 0) return;
    setForwardStepFiles((prev) => [...prev, ...newFiles]);
    e.target.value = '';
  };

  const removeFile = (index: number) =>
    setForwardStepFiles((prev) => prev.filter((_, i) => i !== index));

  const canSubmit = !!forwardStepOptionalId && !forwardStepMutation.isPending;

  return (
    <Dialog
      open={!!forwardStepWorkflow}
      onOpenChange={(o) => {
        if (!o) setForwardStepWorkflow(null);
      }}
    >
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('workflows.dialogs.forwardStepTitle')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <p className="text-sm text-muted-foreground">
            {t('workflows.dialogs.forwardStepDesc')}{' '}
            <span className="font-medium text-foreground">"{forwardStepWorkflow.title}"</span>.
          </p>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              {t('workflows.dialogs.selectOptionalReviewer')}
            </label>
            <SearchableSelect
              options={optionalReviewerOptions}
              value={forwardStepOptionalId}
              onChange={setForwardStepOptionalId}
              placeholder={t('workflows.dialogs.selectOptionalReviewerPlaceholder')}
              searchPlaceholder={t('workflows.dialogs.approverSearch')}
              emptyText={t('workflows.dialogs.noUsersAvailable')}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              {t('workflows.dialogs.notesLabel')}{' '}
              <span className="font-normal text-muted-foreground">
                ({t('workflows.dialogs.optional')})
              </span>
            </label>
            <textarea
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              placeholder={t('workflows.dialogs.notesPlaceholder')}
              maxLength={3000}
              value={forwardStepNotes}
              onChange={(e) => setForwardStepNotes(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <p className="text-sm font-medium">
              {t('workflows.dialogs.attachmentsShort')}{' '}
              <span className="font-normal text-muted-foreground">
                ({t('workflows.dialogs.optional')})
              </span>
            </p>

            {forwardStepFiles.length > 0 && (
              <div className="rounded-md border divide-y divide-border">
                {forwardStepFiles.map((file, i) => (
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
                {forwardStepFiles.length === 0
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
          <Button type="button" variant="outline" onClick={() => setForwardStepWorkflow(null)}>
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            disabled={!canSubmit}
            onClick={() =>
              forwardStepMutation.mutate({
                workflow: forwardStepWorkflow,
                optionalReviewerId: forwardStepOptionalId,
                notes: forwardStepNotes,
                files: forwardStepFiles,
              })
            }
          >
            {forwardStepMutation.isPending
              ? t('common.processing')
              : t('workflows.actions.forwardStep')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
