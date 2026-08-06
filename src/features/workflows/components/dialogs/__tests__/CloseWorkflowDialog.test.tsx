import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@/i18n';
import { CloseWorkflowDialog } from '../CloseWorkflowDialog';
import type { WorkflowsHook } from '../workflow-dialog.types';
import type { ApiWorkflow } from '@/lib/api/workflows';

function makeWorkflow(overrides: Partial<ApiWorkflow> = {}): ApiWorkflow {
  return { id: 'wf-1', title: 'Contract Review', ...overrides } as ApiWorkflow;
}

function makeHook(closeWorkflow: ApiWorkflow | null, closingNotes = ''): WorkflowsHook {
  return {
    dialogs: {
      closeWorkflow,
      setCloseWorkflow: vi.fn(),
      closingNotes,
      setClosingNotes: vi.fn(),
    },
    mutations: {
      closeMutation: { mutate: vi.fn(), isPending: false },
    },
  } as unknown as WorkflowsHook;
}

describe('CloseWorkflowDialog', () => {
  it('is closed when there is no workflow to close', () => {
    render(<CloseWorkflowDialog hook={makeHook(null)} />);

    expect(screen.queryByText('Close workflow')).not.toBeInTheDocument();
  });

  it('shows the workflow title in the confirmation message', () => {
    render(<CloseWorkflowDialog hook={makeHook(makeWorkflow({ title: 'Contract Review' }))} />);

    expect(screen.getByText(/Contract Review/)).toBeInTheDocument();
  });

  it('submits the workflow id and closing notes on confirm', () => {
    const hook = makeHook(makeWorkflow(), 'All good');
    render(<CloseWorkflowDialog hook={hook} />);

    fireEvent.click(screen.getByRole('button', { name: 'Close workflow' }));

    expect(hook.mutations.closeMutation.mutate).toHaveBeenCalledWith({
      id: 'wf-1',
      closingNotes: 'All good',
    });
  });

  it('updates closingNotes as the user types', () => {
    const hook = makeHook(makeWorkflow());
    render(<CloseWorkflowDialog hook={hook} />);

    fireEvent.change(screen.getByPlaceholderText('Optional final comment...'), {
      target: { value: 'Done here' },
    });

    expect(hook.dialogs.setClosingNotes).toHaveBeenCalledWith('Done here');
  });

  it('cancel closes the dialog without submitting', () => {
    const hook = makeHook(makeWorkflow());
    render(<CloseWorkflowDialog hook={hook} />);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(hook.dialogs.setCloseWorkflow).toHaveBeenCalledWith(null);
    expect(hook.mutations.closeMutation.mutate).not.toHaveBeenCalled();
  });

  it('pressing Escape dismisses the dialog via onOpenChange', () => {
    const hook = makeHook(makeWorkflow());
    render(<CloseWorkflowDialog hook={hook} />);

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape', code: 'Escape' });

    expect(hook.dialogs.setCloseWorkflow).toHaveBeenCalledWith(null);
  });

  it('disables the confirm button while the mutation is pending', () => {
    const hook = makeHook(makeWorkflow());
    hook.mutations.closeMutation.isPending = true;
    render(<CloseWorkflowDialog hook={hook} />);

    expect(screen.getByRole('button', { name: 'Processing...' })).toBeDisabled();
  });
});
