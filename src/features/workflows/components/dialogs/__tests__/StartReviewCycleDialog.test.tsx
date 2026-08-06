import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@/i18n';
import { StartReviewCycleDialog } from '../StartReviewCycleDialog';
import type { WorkflowsHook } from '../workflow-dialog.types';
import type { ApiWorkflow } from '@/lib/api/workflows';

function makeWorkflow(overrides: Partial<ApiWorkflow> = {}): ApiWorkflow {
  return {
    id: 'wf-1',
    title: 'Contract Review',
    status: 'PENDING_REVIEW_CYCLE',
    ...overrides,
  } as ApiWorkflow;
}

interface TestOrgUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  position?: string;
  isOptionalReviewer: boolean;
}

function makeHook(
  reviewCycleWorkflow: ApiWorkflow | null,
  activeOrgUsers: TestOrgUser[] = [],
): WorkflowsHook {
  return {
    dialogs: {
      reviewCycleWorkflow,
      setReviewCycleWorkflow: vi.fn(),
      reviewCycleReviewerIds: [] as string[],
      setReviewCycleReviewerIds: vi.fn(),
    },
    mutations: {
      createAdminCycleMutation: { mutate: vi.fn(), isPending: false },
      skipReviewCycleMutation: { mutate: vi.fn(), isPending: false },
    },
    queries: {
      activeOrgUsers,
      orgUsersMap: new Map(activeOrgUsers.map((u) => [u.id, u.firstName])),
    },
  } as unknown as WorkflowsHook;
}

describe('StartReviewCycleDialog', () => {
  it('is closed when there is no workflow to start a cycle for', () => {
    render(<StartReviewCycleDialog hook={makeHook(null)} />);

    expect(screen.queryByText('Start review cycle')).not.toBeInTheDocument();
  });

  it('shows "Go to Available without review" when opened from PENDING_REVIEW_CYCLE', () => {
    const hook = makeHook(makeWorkflow({ status: 'PENDING_REVIEW_CYCLE' }));
    render(<StartReviewCycleDialog hook={hook} />);

    expect(
      screen.getByRole('button', { name: 'Go to Available without review' }),
    ).toBeInTheDocument();
  });

  it('hides the skip button when reopened from AVAILABLE_FOR_FINAL_USERS to start another cycle', () => {
    const hook = makeHook(makeWorkflow({ status: 'AVAILABLE_FOR_FINAL_USERS' }));
    render(<StartReviewCycleDialog hook={hook} />);

    expect(
      screen.queryByRole('button', { name: 'Go to Available without review' }),
    ).not.toBeInTheDocument();
    // The primary action to start a (new) cycle remains available.
    expect(screen.getByRole('button', { name: 'Start review cycle' })).toBeInTheDocument();
  });

  it('calls skipReviewCycleMutation when "Go to Available without review" is clicked', () => {
    const hook = makeHook(makeWorkflow({ status: 'PENDING_REVIEW_CYCLE' }));
    render(<StartReviewCycleDialog hook={hook} />);

    fireEvent.click(screen.getByRole('button', { name: 'Go to Available without review' }));

    expect(hook.mutations.skipReviewCycleMutation.mutate).toHaveBeenCalledWith('wf-1');
  });

  it('disables "Start review cycle" until at least one reviewer is selected', () => {
    const hook = makeHook(makeWorkflow());
    render(<StartReviewCycleDialog hook={hook} />);

    expect(screen.getByRole('button', { name: 'Start review cycle' })).toBeDisabled();
  });

  it('calls createAdminCycleMutation with the selected reviewers on confirm', () => {
    const hook = makeHook(makeWorkflow());
    hook.dialogs.reviewCycleReviewerIds = ['reviewer-1'];
    render(<StartReviewCycleDialog hook={hook} />);

    fireEvent.click(screen.getByRole('button', { name: 'Start review cycle' }));

    expect(hook.mutations.createAdminCycleMutation.mutate).toHaveBeenCalledWith({
      id: 'wf-1',
      reviewerIds: ['reviewer-1'],
      optionalReviewerIds: undefined,
    });
  });

  it('cancel closes the dialog without submitting', () => {
    const hook = makeHook(makeWorkflow());
    render(<StartReviewCycleDialog hook={hook} />);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(hook.dialogs.setReviewCycleWorkflow).toHaveBeenCalledWith(null);
    expect(hook.mutations.createAdminCycleMutation.mutate).not.toHaveBeenCalled();
  });

  it('lists selected reviewers by name and removes one on click', () => {
    const hook = makeHook(makeWorkflow(), [
      {
        id: 'reviewer-1',
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'ada@x.com',
        isOptionalReviewer: false,
      },
    ]);
    hook.dialogs.reviewCycleReviewerIds = ['reviewer-1'];
    render(<StartReviewCycleDialog hook={hook} />);

    expect(screen.getByText('Ada')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Remove reviewer' }));
    expect(hook.dialogs.setReviewCycleReviewerIds).toHaveBeenCalledWith(expect.any(Function));
  });

  it('shows the pool of optional reviewers as informational badges', () => {
    const hook = makeHook(makeWorkflow(), [
      {
        id: 'opt-1',
        firstName: 'Grace',
        lastName: 'Hopper',
        email: 'grace@x.com',
        isOptionalReviewer: true,
      },
    ]);
    render(<StartReviewCycleDialog hook={hook} />);

    expect(screen.getByText('Grace Hopper')).toBeInTheDocument();
  });

  it('adds a reviewer selected from the searchable dropdown', () => {
    const hook = makeHook(makeWorkflow(), [
      {
        id: 'reviewer-1',
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'ada@x.com',
        isOptionalReviewer: false,
      },
    ]);
    render(<StartReviewCycleDialog hook={hook} />);

    fireEvent.click(screen.getByText('Add reviewer...'));
    fireEvent.click(screen.getByRole('option', { name: /Ada Lovelace/ }));

    expect(hook.dialogs.setReviewCycleReviewerIds).toHaveBeenCalledWith(expect.any(Function));
  });

  it("includes the org's optional reviewer pool on submit", () => {
    const hook = makeHook(makeWorkflow(), [
      {
        id: 'reviewer-1',
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'ada@x.com',
        isOptionalReviewer: false,
      },
      {
        id: 'opt-1',
        firstName: 'Grace',
        lastName: 'Hopper',
        email: 'grace@x.com',
        isOptionalReviewer: true,
      },
    ]);
    hook.dialogs.reviewCycleReviewerIds = ['reviewer-1'];
    render(<StartReviewCycleDialog hook={hook} />);

    fireEvent.click(screen.getByRole('button', { name: 'Start review cycle' }));

    expect(hook.mutations.createAdminCycleMutation.mutate).toHaveBeenCalledWith({
      id: 'wf-1',
      reviewerIds: ['reviewer-1'],
      optionalReviewerIds: ['opt-1'],
    });
  });
});
