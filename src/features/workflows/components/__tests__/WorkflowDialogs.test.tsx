import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WorkflowDialogs } from '../WorkflowDialogs';
import type { WorkflowsHook } from '../dialogs/workflow-dialog.types';

// Each dialog is stubbed to a marker element so this test only verifies
// WorkflowDialogs' own job — rendering every dialog and forwarding the right
// props to DetailWorkflowDialog — without depending on their real internals.
vi.mock('../dialogs/CreateWorkflowDialog', () => ({
  CreateWorkflowDialog: () => <div data-testid="create-dialog" />,
}));
vi.mock('../dialogs/EditWorkflowDialog', () => ({
  EditWorkflowDialog: () => <div data-testid="edit-dialog" />,
}));
vi.mock('../dialogs/DetailWorkflowDialog', () => ({
  DetailWorkflowDialog: ({ canApprove }: { canApprove: boolean }) => (
    <div data-testid="detail-dialog" data-can-approve={String(canApprove)} />
  ),
}));
vi.mock('../dialogs/ApproveDialog', () => ({
  ApproveDialog: () => <div data-testid="approve-dialog" />,
}));
vi.mock('../dialogs/RejectDialog', () => ({
  RejectDialog: () => <div data-testid="reject-dialog" />,
}));
vi.mock('../dialogs/TimelineDialog', () => ({
  TimelineDialog: () => <div data-testid="timeline-dialog" />,
}));
vi.mock('../dialogs/DeleteWorkflowDialog', () => ({
  DeleteWorkflowDialog: () => <div data-testid="delete-dialog" />,
}));
vi.mock('../dialogs/StartReviewCycleDialog', () => ({
  StartReviewCycleDialog: () => <div data-testid="review-cycle-dialog" />,
}));
vi.mock('../dialogs/CompleteReviewStepDialog', () => ({
  CompleteReviewStepDialog: () => <div data-testid="complete-step-dialog" />,
}));
vi.mock('../dialogs/ForwardStepDialog', () => ({
  ForwardStepDialog: () => <div data-testid="forward-step-dialog" />,
}));
vi.mock('../dialogs/CloseWorkflowDialog', () => ({
  CloseWorkflowDialog: () => <div data-testid="close-dialog" />,
}));
vi.mock('../dialogs/CancelWorkflowDialog', () => ({
  CancelWorkflowDialog: () => <div data-testid="cancel-dialog" />,
}));
vi.mock('../dialogs/ManageWorkflowDialog', () => ({
  ManageWorkflowDialog: () => <div data-testid="manage-dialog" />,
}));

const hook = {} as WorkflowsHook;

describe('WorkflowDialogs', () => {
  it('renders every workflow dialog', () => {
    render(<WorkflowDialogs hook={hook} />);

    expect(screen.getByTestId('create-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('edit-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('detail-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('approve-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('reject-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('timeline-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('delete-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('review-cycle-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('complete-step-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('forward-step-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('close-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('cancel-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('manage-dialog')).toBeInTheDocument();
  });

  it('defaults canApprove to false when omitted', () => {
    render(<WorkflowDialogs hook={hook} />);

    const detail = screen.getByTestId('detail-dialog');
    expect(detail).toHaveAttribute('data-can-approve', 'false');
  });

  it('forwards explicit canApprove to DetailWorkflowDialog', () => {
    render(<WorkflowDialogs hook={hook} canApprove />);

    const detail = screen.getByTestId('detail-dialog');
    expect(detail).toHaveAttribute('data-can-approve', 'true');
  });
});
