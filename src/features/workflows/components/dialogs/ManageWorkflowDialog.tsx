import { FileText, XCircle, Paperclip } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import React from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import type { WorkflowsHook } from './workflow-dialog.types';

export function ManageWorkflowDialog({ hook }: { hook: WorkflowsHook }) {
  const {
    manageWorkflow,
    setManageWorkflow,
    manageContent,
    setManageContent,
    manageFiles,
    setManageFiles,
  } = hook.dialogs;
  const { addNoteMutation } = hook.mutations;
  const { t } = useTranslation();

  const handleFileAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(e.target.files ?? []);
    if (newFiles.length === 0) return;
    setManageFiles((prev) => [...prev, ...newFiles]);
    e.target.value = '';
  };

  const removeFile = (index: number) =>
    setManageFiles((prev) => prev.filter((_, i) => i !== index));

  const canSubmit = manageContent.trim().length > 0 || manageFiles.length > 0;

  return (
    <Dialog
      open={!!manageWorkflow}
      onOpenChange={(o) => {
        if (!o) setManageWorkflow(null);
      }}
    >
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle>{t('workflows.dialogs.manageTitle')}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 pt-1 min-h-0 flex-1 overflow-y-auto pr-1">
          <p className="text-sm text-muted-foreground shrink-0">
            {t('workflows.dialogs.manageDescPre')}{' '}
            <span className="font-medium text-foreground">"{manageWorkflow?.title}"</span>
            {t('workflows.dialogs.manageDescPost')}
          </p>

          <div className="space-y-1.5 shrink-0">
            <label className="text-sm font-medium">
              {t('workflows.dialogs.manageContentLabel')}
            </label>
            <textarea
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
              placeholder={t('workflows.dialogs.manageContentPlaceholder')}
              maxLength={3000}
              value={manageContent}
              onChange={(e) => setManageContent(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <p className="text-sm font-medium shrink-0">
              {t('workflows.dialogs.attachmentsShort')}{' '}
              <span className="font-normal text-muted-foreground">
                ({t('workflows.dialogs.optional')})
              </span>
            </p>

            {manageFiles.length > 0 && (
              <div className="rounded-md border divide-y divide-border overflow-hidden">
                {manageFiles.map((file, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-2">
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate" title={file.name}>
                        {file.name}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {file.size < 1024 * 1024
                          ? `${(file.size / 1024).toFixed(1)} KB`
                          : `${(file.size / (1024 * 1024)).toFixed(1)} MB`}
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label={t('workflows.dialogs.removeFile')}
                      className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                      onClick={() => removeFile(i)}
                    >
                      <XCircle className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed px-3 py-2.5 text-sm text-muted-foreground hover:bg-muted/40 transition-colors">
              <Paperclip className="h-4 w-4 shrink-0" />
              <span>
                {manageFiles.length === 0
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

        <DialogFooter className="pt-2 shrink-0">
          <Button type="button" variant="outline" onClick={() => setManageWorkflow(null)}>
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            disabled={addNoteMutation.isPending || !canSubmit}
            onClick={() =>
              manageWorkflow &&
              addNoteMutation.mutate({
                workflow: manageWorkflow,
                content: manageContent,
                files: manageFiles,
              })
            }
          >
            {addNoteMutation.isPending
              ? t('common.processing')
              : t('workflows.dialogs.manageButton')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
