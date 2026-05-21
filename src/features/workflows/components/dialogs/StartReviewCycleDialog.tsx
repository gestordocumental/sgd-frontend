import { Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { SearchableSelect } from '@/components/ui/searchable-select'
import type { WorkflowsHook } from './workflow-dialog.types'

export function StartReviewCycleDialog({ hook }: { hook: WorkflowsHook }) {
  const {
    reviewCycleWorkflow, setReviewCycleWorkflow,
    reviewCycleReviewerIds, setReviewCycleReviewerIds,
    createAdminCycleMutation, skipReviewCycleMutation,
    activeOrgUsers, orgUsersMap,
  } = hook
  const { t } = useTranslation()

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
          <DialogTitle>{t('workflows.dialogs.reviewCycleTitle')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <p className="text-sm text-muted-foreground">
            {t('workflows.dialogs.reviewCycleDescPre')}{' '}
            <span className="font-medium text-foreground">"{reviewCycleWorkflow.title}"</span>
            {t('workflows.dialogs.reviewCycleDescPost')}
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

          <SearchableSelect
            options={availableReviewerOptions}
            value=""
            onChange={addReviewer}
            placeholder={t('workflows.dialogs.addReviewer')}
            searchPlaceholder={t('workflows.dialogs.approverSearch')}
            emptyText={t('workflows.dialogs.noUsersAvailable')}
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
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() => skipReviewCycleMutation.mutate(reviewCycleWorkflow.id)}
          >
            {skipReviewCycleMutation.isPending ? t('common.processing') : t('workflows.dialogs.skipReviewCycle')}
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
            {createAdminCycleMutation.isPending ? t('workflows.dialogs.startingReview') : t('workflows.actions.startReviewCycle')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
