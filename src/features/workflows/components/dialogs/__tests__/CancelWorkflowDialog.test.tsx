import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@/i18n';
import { CancelWorkflowDialog } from '../CancelWorkflowDialog';
import type { WorkflowsHook } from '../workflow-dialog.types';
import type { ApiWorkflow } from '@/lib/api/workflows';

function makeWorkflow(overrides: Partial<ApiWorkflow> = {}): ApiWorkflow {
  return { id: 'wf-1', title: 'Contract Review', ...overrides } as ApiWorkflow;
}

function makeHook(cancelWorkflow: ApiWorkflow | null, cancelReason = ''): WorkflowsHook {
  return {
    dialogs: {
      cancelWorkflow,
      setCancelWorkflow: vi.fn(),
      cancelReason,
      setCancelReason: vi.fn(),
    },
    mutations: {
      cancelMutation: { mutate: vi.fn(), isPending: false },
    },
  } as unknown as WorkflowsHook;
}

describe('CancelWorkflowDialog', () => {
  it('is closed when there is no workflow to cancel', () => {
    render(<CancelWorkflowDialog hook={makeHook(null)} />);

    expect(screen.queryByText('Cancel workflow')).not.toBeInTheDocument();
  });

  it('shows the workflow title in the confirmation message', () => {
    render(<CancelWorkflowDialog hook={makeHook(makeWorkflow({ title: 'Contract Review' }))} />);

    expect(screen.getByText(/Contract Review/)).toBeInTheDocument();
  });

  it('disables the confirm button while the reason is empty', () => {
    const hook = makeHook(makeWorkflow(), '   ');
    render(<CancelWorkflowDialog hook={hook} />);

    expect(screen.getByRole('button', { name: 'Cancel workflow' })).toBeDisabled();
  });

  it('submits the workflow id and reason on confirm', () => {
    const hook = makeHook(makeWorkflow(), 'No longer needed');
    render(<CancelWorkflowDialog hook={hook} />);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel workflow' }));

    expect(hook.mutations.cancelMutation.mutate).toHaveBeenCalledWith({
      id: 'wf-1',
      reason: 'No longer needed',
    });
  });

  it('updates cancelReason as the user types', () => {
    const hook = makeHook(makeWorkflow());
    render(<CancelWorkflowDialog hook={hook} />);

    fireEvent.change(
      screen.getByPlaceholderText('Explain why this workflow is being cancelled...'),
      {
        target: { value: 'Duplicate request' },
      },
    );

    expect(hook.dialogs.setCancelReason).toHaveBeenCalledWith('Duplicate request');
  });

  it('dismiss closes the dialog without submitting', () => {
    const hook = makeHook(makeWorkflow(), 'No longer needed');
    render(<CancelWorkflowDialog hook={hook} />);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(hook.dialogs.setCancelWorkflow).toHaveBeenCalledWith(null);
    expect(hook.mutations.cancelMutation.mutate).not.toHaveBeenCalled();
  });

  it('pressing Escape dismisses the dialog via onOpenChange', () => {
    const hook = makeHook(makeWorkflow(), 'No longer needed');
    render(<CancelWorkflowDialog hook={hook} />);

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape', code: 'Escape' });

    expect(hook.dialogs.setCancelWorkflow).toHaveBeenCalledWith(null);
  });

  it('disables the confirm button while the mutation is pending', () => {
    const hook = makeHook(makeWorkflow(), 'No longer needed');
    hook.mutations.cancelMutation.isPending = true;
    render(<CancelWorkflowDialog hook={hook} />);

    expect(screen.getByRole('button', { name: 'Processing...' })).toBeDisabled();
  });
});
