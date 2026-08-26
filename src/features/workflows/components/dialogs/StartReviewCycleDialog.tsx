import { Trash2 } from 'lucide-react';
import { useState } from 'react';
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

export function StartReviewCycleDialog({ hook }: { hook: WorkflowsHook }) {
  const {
    reviewCycleWorkflow,
    setReviewCycleWorkflow,
    reviewCycleReviewerIds,
    setReviewCycleReviewerIds,
  } = hook.dialogs;
  const { createAdminCycleMutation, skipReviewCycleMutation } = hook.mutations;
  const { activeOrgUsers, orgUsersMap } = hook.queries;
  const { t } = useTranslation();

  const [selectOpen, setSelectOpen] = useState(false);

  if (!reviewCycleWorkflow) return null;

  // Usuarios con flag isOptionalReviewer = true (configurado desde la tabla de usuarios)
  const optionalReviewers = activeOrgUsers.filter((u) => u.isOptionalReviewer);
  const optionalReviewerIds = optionalReviewers.map((u) => u.id);

  // Cualquier usuario activo puede agregarse como revisor obligatorio del
  // ciclo, incluidos los marcados como revisor opcional — ese flag solo
  // controla su inclusión automática en el pool informativo de abajo (para
  // ser llamado ad hoc durante el ciclo), no les impide ser además un paso
  // numerado normal.
  const availableReviewerOptions = activeOrgUsers
    .filter((u) => !reviewCycleReviewerIds.includes(u.id))
    .map((u) => ({
      value: u.id,
      label: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email,
      sublabel: u.position,
    }));

  const addReviewer = (userId: string) => {
    if (!reviewCycleReviewerIds.includes(userId)) {
      setReviewCycleReviewerIds((prev) => [...prev, userId]);
    }
  };

  const removeReviewer = (userId: string) => {
    setReviewCycleReviewerIds((prev) => prev.filter((id) => id !== userId));
  };

  const isPending = createAdminCycleMutation.isPending || skipReviewCycleMutation.isPending;
  // skipReviewCycle solo es válido en PENDING_REVIEW_CYCLE (antes del primer
  // ciclo) — reabierto desde AVAILABLE_FOR_FINAL_USERS tras completar uno, el
  // workflow ya está disponible, así que "Omitir" no aplica (basta con cerrar).
  const canSkip = reviewCycleWorkflow.status === 'PENDING_REVIEW_CYCLE';

  return (
    <Dialog
      open={!!reviewCycleWorkflow}
      onOpenChange={(o) => {
        if (!o) setReviewCycleWorkflow(null);
      }}
    >
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle>{t('workflows.dialogs.reviewCycleTitle')}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 pt-2 min-h-0 flex-1 overflow-y-auto pr-1">
          <p className="text-sm text-muted-foreground shrink-0">
            {t('workflows.dialogs.reviewCycleDescPre')}{' '}
            <span className="font-medium text-foreground">"{reviewCycleWorkflow.title}"</span>
            {t('workflows.dialogs.reviewCycleDescPost')}
          </p>

          {/* Lista de revisores obligatorios */}
          {reviewCycleReviewerIds.length > 0 && (
            <div className="rounded-md border border-border divide-y divide-border overflow-y-auto max-h-80 shrink-0">
              {reviewCycleReviewerIds.map((id, index) => (
                <div key={id} className="flex items-center gap-2.5 px-3 py-2.5">
                  <div className="flex items-center justify-center size-5 rounded-full bg-primary/10 text-[10px] font-bold text-primary shrink-0">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{orgUsersMap.get(id) ?? id}</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t('workflows.dialogs.removeReviewer')}
                    className="size-7 text-muted-foreground hover:text-destructive shrink-0"
                    onClick={() => removeReviewer(id)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className={selectOpen ? 'pb-56' : ''}>
            <SearchableSelect
              options={availableReviewerOptions}
              value=""
              onChange={addReviewer}
              placeholder={t('workflows.dialogs.addReviewer')}
              searchPlaceholder={t('workflows.dialogs.approverSearch')}
              emptyText={t('workflows.dialogs.noUsersAvailable')}
              onOpenChange={setSelectOpen}
            />
          </div>

          {/* Revisores opcionales disponibles (informativos) */}
          {optionalReviewers.length > 0 && (
            <div className="rounded-md bg-purple-50 border border-purple-200 px-3 py-2.5 space-y-1.5 shrink-0">
              <p className="text-xs font-medium text-purple-700">
                {t('workflows.dialogs.availableOptionalReviewers')}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {optionalReviewers.map((u) => (
                  <span
                    key={u.id}
                    className="text-[11px] px-2 py-0.5 rounded-full bg-white border border-purple-200 text-purple-800"
                  >
                    {[u.firstName, u.lastName].filter(Boolean).join(' ') || u.email}
                  </span>
                ))}
              </div>
              <p className="text-[11px] text-purple-600">
                {t('workflows.dialogs.optionalReviewerHint')}
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="flex-wrap gap-2 pt-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() => setReviewCycleWorkflow(null)}
          >
            {t('common.cancel')}
          </Button>
          {canSkip && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={() => skipReviewCycleMutation.mutate(reviewCycleWorkflow.id)}
            >
              {skipReviewCycleMutation.isPending
                ? t('common.processing')
                : t('workflows.dialogs.skipReviewCycle')}
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            disabled={isPending || reviewCycleReviewerIds.length === 0}
            onClick={() =>
              createAdminCycleMutation.mutate({
                id: reviewCycleWorkflow.id,
                reviewerIds: reviewCycleReviewerIds,
                optionalReviewerIds:
                  optionalReviewerIds.length > 0 ? optionalReviewerIds : undefined,
              })
            }
          >
            {createAdminCycleMutation.isPending
              ? t('workflows.dialogs.startingReview')
              : t('workflows.actions.startReviewCycle')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
