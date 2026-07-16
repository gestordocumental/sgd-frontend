import type { ElementType } from 'react';
import { Clock, CheckCircle, XCircle, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import type { ApiTimelineEvent, TimelineEventType } from '@/lib/api/workflows';
import type { WorkflowsHook } from './workflow-dialog.types';

const TIMELINE_ICON: Record<TimelineEventType, ElementType> = {
  WORKFLOW_CREATED: CheckCircle,
  APPROVAL_STARTED: Clock,
  STEP_APPROVED: CheckCircle,
  STEP_REJECTED: XCircle,
  WORKFLOW_RETURNED_TO_CREATOR: XCircle,
  WORKFLOW_RESUBMITTED: Clock,
  WORKFLOW_APPROVED: CheckCircle,
  ATTACHMENT_ADDED: CheckCircle,
  NOTE_ADDED: CheckCircle,
  ADMIN_CYCLE_STARTED: Clock,
  ADMIN_STEP_COMPLETED: CheckCircle,
  ADMIN_CYCLE_COMPLETED: CheckCircle,
  WORKFLOW_CLOSED: CheckCircle,
  WORKFLOW_CANCELLED: XCircle,
};

export function TimelineDialog({ hook }: { hook: WorkflowsHook }) {
  const { t } = useTranslation();
  const { timelineWorkflowId, setTimelineWorkflowId } = hook.dialogs;
  const { timeline, timelineLoading, orgUsersMap } = hook.queries;

  // Prefer the name resolved server-side (works regardless of the viewer's
  // Users-module permission). orgUsersMap is only a fallback for the rare case
  // where the backend couldn't resolve it either (e.g. user-service was down).
  const userName = (event: ApiTimelineEvent) =>
    event.actorName ?? orgUsersMap.get(event.actorId) ?? event.actorId;

  return (
    <Dialog
      open={!!timelineWorkflowId}
      onOpenChange={(o) => {
        if (!o) setTimelineWorkflowId(null);
      }}
    >
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('workflows.dialogs.timelineTitle')}</DialogTitle>
        </DialogHeader>
        <div className="py-2">
          {timelineLoading ? (
            <p className="text-sm text-muted-foreground text-center py-8">{t('common.loading')}</p>
          ) : timeline.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {t('workflows.dialogs.timelineEmpty')}
            </p>
          ) : (
            <div className="relative">
              <div className="absolute left-3.5 top-0 bottom-0 w-px bg-border" />
              <div className="space-y-4">
                {timeline.map((event) => (
                  <TimelineEventRow key={event.id} event={event} userName={userName} />
                ))}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setTimelineWorkflowId(null)}>
            {t('common.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TimelineEventRow({
  event,
  userName,
}: {
  event: ApiTimelineEvent;
  userName: (event: ApiTimelineEvent) => string;
}) {
  const Icon = TIMELINE_ICON[event.eventType] ?? ChevronRight;
  const isNegative = [
    'STEP_REJECTED',
    'WORKFLOW_RETURNED_TO_CREATOR',
    'WORKFLOW_CANCELLED',
  ].includes(event.eventType);

  return (
    <div className="flex gap-3 pl-1">
      <div
        className={`relative z-10 flex items-center justify-center size-6 rounded-full border-2 bg-background shrink-0 ${
          isNegative ? 'border-destructive/40 text-destructive' : 'border-green-500 text-green-700'
        }`}
      >
        <Icon className="size-3" />
      </div>
      <div className="flex-1 min-w-0 pb-1">
        <p className="text-sm font-medium">{event.description}</p>
        <p className="text-xs text-muted-foreground">
          <span className="font-medium">{userName(event)}</span>
          {' · '}
          {new Date(event.createdAt).toLocaleString()}
        </p>
        {!!event.metadata?.observations && (
          <p className="text-xs text-muted-foreground mt-1 italic">
            "{String(event.metadata.observations)}"
          </p>
        )}
      </div>
    </div>
  );
}
