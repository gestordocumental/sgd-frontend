import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import '@/i18n';

import { ApproveDialog } from '../ApproveDialog';
import { approveSchema, type ApproveForm } from '@/features/workflows/hooks/workflow-schemas';
import type { WorkflowsHook } from '../workflow-dialog.types';
import type { ApiWorkflow } from '@/lib/api/workflows';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeWorkflow(): ApiWorkflow {
  return {
    id: 'wf-1',
    title: 'Security Policy Update',
  } as ApiWorkflow;
}

// Real dialogs/form state (not stubbed) — same shape use-workflow-dialogs.ts and
// use-workflow-forms.ts actually produce — so the rendered DOM matches what users
// see, while everything ApproveDialog doesn't touch is left undefined.
function ApproveDialogHarness({ initialFiles = [] as File[] }: { initialFiles?: File[] }) {
  const [approveWorkflow, setApproveWorkflow] = useState<ApiWorkflow | null>(makeWorkflow());
  const [approveAttachmentFiles, setApproveAttachmentFiles] = useState<File[]>(initialFiles);
  const approveForm = useForm<ApproveForm>({
    resolver: zodResolver(approveSchema),
    defaultValues: { observations: '' },
  });

  const hook = {
    dialogs: {
      approveWorkflow,
      setApproveWorkflow,
      approveAttachmentFiles,
      setApproveAttachmentFiles,
    },
    mutations: {
      approveMutation: { isPending: false, mutate: vi.fn() },
    },
    forms: { approveForm },
  } as unknown as WorkflowsHook;

  return <ApproveDialog hook={hook} />;
}

describe('ApproveDialog — modal layout', () => {
  it('separates the scrollable content from the footer, so Approve/Cancel stay outside any horizontal or vertical scroll region', async () => {
    // Regression: the whole dialog (intro text, form fields, attachment list,
    // AND the footer buttons) used to share a single overflow-y-auto region
    // with no width containment. A long attachment filename could force
    // horizontal overflow that dragged the Approve button along with it,
    // off-screen ("el botón Aprobar queda parcialmente oculto").
    const longName = 'a'.repeat(120) + '.pdf';
    const file = new File(['content'], longName, { type: 'application/pdf' });

    render(<ApproveDialogHarness initialFiles={[file]} />);

    const approveButton = await screen.findByRole('button', { name: 'Approve' });
    const footer = approveButton.closest('[data-slot="dialog-footer"]');
    expect(footer).not.toBeNull();

    // The footer must not live inside the scrollable region — otherwise it
    // scrolls (and can be pushed off-screen) along with the content above it.
    expect(footer!.closest('.overflow-y-auto')).toBeNull();

    // DialogContent itself must cap its height and lay out header/content/
    // footer as separate flex sections (not the ungoverned CSS grid default),
    // or nothing below stops the dialog from growing past the viewport.
    const dialogContent = footer!.closest('[data-slot="dialog-content"]');
    expect(dialogContent).toHaveClass('flex', 'flex-col', 'max-h-[90vh]');

    // The scroll region itself must not grow wider than the dialog — this is
    // what actually stops a long filename from causing horizontal overflow
    // (on top of the filename's own truncate/min-w-0).
    const scrollArea = dialogContent!.querySelector('.overflow-y-auto');
    expect(scrollArea).not.toBeNull();
    expect(scrollArea).toHaveClass('overflow-x-hidden', 'min-w-0');

    // The long filename is still present (truncated visually via CSS, not
    // hidden from the DOM/AT) — confirms the fix didn't drop it or the
    // remove control.
    expect(screen.getByText(longName)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove file' })).toBeInTheDocument();
  });

  it('renders normally with no attachments (the previously-working case must stay working)', async () => {
    render(<ApproveDialogHarness />);

    expect(await screen.findByRole('button', { name: 'Approve' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove file' })).not.toBeInTheDocument();
  });

  it('lets the user add and remove an attachment without losing the layout structure', async () => {
    const user = userEvent.setup();
    render(<ApproveDialogHarness />);

    const file = new File(['content'], 'report.pdf', { type: 'application/pdf' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, file);

    expect(await screen.findByText('report.pdf')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Remove file' }));
    expect(screen.queryByText('report.pdf')).not.toBeInTheDocument();
  });
});
