import type { useWorkflows } from '@/features/workflows/hooks/use-workflows';
import { CreateWorkflowDialog } from './dialogs/CreateWorkflowDialog';
import { EditWorkflowDialog } from './dialogs/EditWorkflowDialog';
import { DetailWorkflowDialog } from './dialogs/DetailWorkflowDialog';
import { ApproveDialog } from './dialogs/ApproveDialog';
import { RejectDialog } from './dialogs/RejectDialog';
import { TimelineDialog } from './dialogs/TimelineDialog';
import { DeleteWorkflowDialog } from './dialogs/DeleteWorkflowDialog';
import { StartReviewCycleDialog } from './dialogs/StartReviewCycleDialog';
import { CompleteReviewStepDialog } from './dialogs/CompleteReviewStepDialog';
import { ForwardStepDialog } from './dialogs/ForwardStepDialog';

type WorkflowsHook = ReturnType<typeof useWorkflows>;

interface WorkflowDialogsProps {
  hook: WorkflowsHook;
  canApprove?: boolean;
}

export function WorkflowDialogs({ hook, canApprove = false }: WorkflowDialogsProps) {
  return (
    <>
      <CreateWorkflowDialog hook={hook} />
      <EditWorkflowDialog hook={hook} />
      <DetailWorkflowDialog hook={hook} canApprove={canApprove} />
      <ApproveDialog hook={hook} />
      <RejectDialog hook={hook} />
      <TimelineDialog hook={hook} />
      <DeleteWorkflowDialog hook={hook} />
      <StartReviewCycleDialog hook={hook} />
      <CompleteReviewStepDialog hook={hook} />
      <ForwardStepDialog hook={hook} />
    </>
  );
}
