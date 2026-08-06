import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@/i18n';
import { ManageWorkflowDialog } from '../ManageWorkflowDialog';
import type { WorkflowsHook } from '../workflow-dialog.types';
import type { ApiWorkflow } from '@/lib/api/workflows';

function makeWorkflow(overrides: Partial<ApiWorkflow> = {}): ApiWorkflow {
  return { id: 'wf-1', title: 'Contract Review', orgId: 'org-1', ...overrides } as ApiWorkflow;
}

function makeHook(
  manageWorkflow: ApiWorkflow | null,
  manageContent = '',
  manageFiles: File[] = [],
): WorkflowsHook {
  return {
    dialogs: {
      manageWorkflow,
      setManageWorkflow: vi.fn(),
      manageContent,
      setManageContent: vi.fn(),
      manageFiles,
      setManageFiles: vi.fn(),
    },
    mutations: {
      addNoteMutation: { mutate: vi.fn(), isPending: false },
    },
  } as unknown as WorkflowsHook;
}

describe('ManageWorkflowDialog', () => {
  it('is closed when there is no workflow to manage', () => {
    render(<ManageWorkflowDialog hook={makeHook(null)} />);

    expect(screen.queryByText('Manage workflow')).not.toBeInTheDocument();
  });

  it('shows the workflow title in the description', () => {
    render(<ManageWorkflowDialog hook={makeHook(makeWorkflow({ title: 'Contract Review' }))} />);

    expect(screen.getByText(/Contract Review/)).toBeInTheDocument();
  });

  it('submits the workflow, content and files on confirm', () => {
    const workflow = makeWorkflow();
    const hook = makeHook(workflow, 'All good');
    render(<ManageWorkflowDialog hook={hook} />);

    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(hook.mutations.addNoteMutation.mutate).toHaveBeenCalledWith({
      workflow,
      content: 'All good',
      files: [],
    });
  });

  it('updates manageContent as the user types', () => {
    const hook = makeHook(makeWorkflow());
    render(<ManageWorkflowDialog hook={hook} />);

    fireEvent.change(screen.getByPlaceholderText('Write a comment...'), {
      target: { value: 'Done here' },
    });

    expect(hook.dialogs.setManageContent).toHaveBeenCalledWith('Done here');
  });

  it('cancel closes the dialog without submitting', () => {
    const hook = makeHook(makeWorkflow());
    render(<ManageWorkflowDialog hook={hook} />);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(hook.dialogs.setManageWorkflow).toHaveBeenCalledWith(null);
    expect(hook.mutations.addNoteMutation.mutate).not.toHaveBeenCalled();
  });

  it('pressing Escape dismisses the dialog via onOpenChange', () => {
    const hook = makeHook(makeWorkflow());
    render(<ManageWorkflowDialog hook={hook} />);

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape', code: 'Escape' });

    expect(hook.dialogs.setManageWorkflow).toHaveBeenCalledWith(null);
  });

  it('adding a file appends it to manageFiles', () => {
    const hook = makeHook(makeWorkflow());
    render(<ManageWorkflowDialog hook={hook} />);

    const file = new File(['content'], 'evidence.pdf', { type: 'application/pdf' });
    const input = screen.getByTestId('manage-file-input');
    fireEvent.change(input, { target: { files: [file] } });

    expect(hook.dialogs.setManageFiles).toHaveBeenCalledWith(expect.any(Function));
  });

  it('shows the selected files with a remove control and "add another document" label', () => {
    const file = new File(['content'], 'evidence.pdf', { type: 'application/pdf' });
    const hook = makeHook(makeWorkflow(), '', [file]);
    render(<ManageWorkflowDialog hook={hook} />);

    expect(screen.getByText('evidence.pdf')).toBeInTheDocument();
    expect(screen.getByText('Add another document')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Remove file'));
    expect(hook.dialogs.setManageFiles).toHaveBeenCalledWith(expect.any(Function));
  });

  it('shows file size in MB for large files', () => {
    const bigFile = new File([new Uint8Array(2 * 1024 * 1024)], 'big.pdf', {
      type: 'application/pdf',
    });
    const hook = makeHook(makeWorkflow(), '', [bigFile]);
    render(<ManageWorkflowDialog hook={hook} />);

    expect(screen.getByText('2.0 MB')).toBeInTheDocument();
  });

  it('ignores the file input change when no files are selected', () => {
    const hook = makeHook(makeWorkflow());
    render(<ManageWorkflowDialog hook={hook} />);

    const input = screen.getByTestId('manage-file-input');
    fireEvent.change(input, { target: { files: [] } });

    expect(hook.dialogs.setManageFiles).not.toHaveBeenCalled();
  });

  it('the "Attach documents" button is a focusable, keyboard-operable trigger for the file input', () => {
    const hook = makeHook(makeWorkflow());
    render(<ManageWorkflowDialog hook={hook} />);

    const button = screen.getByRole('button', { name: 'Attach documents' });
    const input = screen.getByTestId('manage-file-input');
    const clickSpy = vi.spyOn(input, 'click');

    button.focus();
    expect(button).toHaveFocus();

    fireEvent.click(button);
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it('disables the confirm button when there is no content and no files', () => {
    const hook = makeHook(makeWorkflow());
    render(<ManageWorkflowDialog hook={hook} />);

    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
  });

  it('enables the confirm button when there are files but no content', () => {
    const file = new File(['content'], 'evidence.pdf', { type: 'application/pdf' });
    const hook = makeHook(makeWorkflow(), '', [file]);
    render(<ManageWorkflowDialog hook={hook} />);

    expect(screen.getByRole('button', { name: 'Add' })).not.toBeDisabled();
  });

  it('disables the confirm button while the mutation is pending', () => {
    const hook = makeHook(makeWorkflow(), 'All good');
    hook.mutations.addNoteMutation.isPending = true;
    render(<ManageWorkflowDialog hook={hook} />);

    expect(screen.getByRole('button', { name: 'Processing...' })).toBeDisabled();
  });
});
