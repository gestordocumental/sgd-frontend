import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@/i18n';
import { ForwardStepDialog } from '../ForwardStepDialog';
import type { WorkflowsHook } from '../workflow-dialog.types';
import type { ApiWorkflow, ApiAdminCycle } from '@/lib/api/workflows';

function makeWorkflow(overrides: Partial<ApiWorkflow> = {}): ApiWorkflow {
  return {
    id: 'wf-1',
    orgId: 'org-1',
    title: 'Contract Review',
    description: null,
    typologyId: 'typ-1',
    typologyCode: 'CON-01',
    typologyVersion: '1',
    typologyName: 'Contract',
    mainDocumentId: null,
    mainDocumentValidated: true,
    mainDocumentMetadata: null,
    status: 'ADMIN_CYCLE_IN_PROGRESS',
    currentApprovalStepOrder: null,
    currentAssignedUserId: null,
    finalUserIds: [],
    createdBy: 'user-1',
    closedBy: null,
    closedAt: null,
    cancelledBy: null,
    cancelledAt: null,
    approvalSteps: [],
    approvalActions: [],
    attachments: [],
    activeAdminCycle: null,
    adminCycles: [],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    participantNames: {},
    ...overrides,
  } as ApiWorkflow;
}

function makeHook(overrides: {
  dialogs?: Partial<WorkflowsHook['dialogs']>;
  queries?: Partial<WorkflowsHook['queries']>;
}): WorkflowsHook {
  return {
    dialogs: {
      forwardStepWorkflow: null,
      setForwardStepWorkflow: vi.fn(),
      forwardStepOptionalId: '',
      setForwardStepOptionalId: vi.fn(),
      forwardStepNotes: '',
      setForwardStepNotes: vi.fn(),
      forwardStepFiles: [],
      setForwardStepFiles: vi.fn(),
      ...overrides.dialogs,
    },
    mutations: {
      forwardStepMutation: { mutate: vi.fn(), isPending: false },
    },
    queries: {
      orgUsersMap: new Map(),
      ...overrides.queries,
    },
  } as unknown as WorkflowsHook;
}

describe('ForwardStepDialog — optional reviewer selector', () => {
  it('shows the participant name resolved server-side, not the raw user ID, for a viewer without USERS:READ', () => {
    // Regression: the selector always fell back to the raw user ID because
    // it only looked up names in orgUsersMap, which requires USERS:READ to
    // populate. allowedOptionalReviewerIds now also gets resolved into
    // participantNames server-side (see WorkflowsService.resolveParticipantNames).
    const workflow = makeWorkflow({
      activeAdminCycle: {
        id: 'cycle-1',
        workflowId: 'wf-1',
        cycleNumber: 1,
        initiatedBy: 'user-1',
        status: 'IN_PROGRESS',
        currentStepOrder: 1,
        completedAt: null,
        allowedOptionalReviewerIds: ['optional-1'],
        steps: [],
        createdAt: '2024-01-01T00:00:00Z',
      } satisfies ApiAdminCycle,
      participantNames: { 'optional-1': 'Oscar One' },
    });

    render(
      <ForwardStepDialog
        hook={makeHook({
          dialogs: { forwardStepWorkflow: workflow },
          // orgUsersMap intentionally empty — simulates a viewer without USERS:READ.
          queries: { orgUsersMap: new Map() },
        })}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /select optional reviewer/i }));

    expect(screen.getByText('Oscar One')).toBeInTheDocument();
    expect(screen.queryByText('optional-1')).not.toBeInTheDocument();
  });

  it('falls back to orgUsersMap, then the raw ID, when the backend could not resolve a name', () => {
    const workflow = makeWorkflow({
      activeAdminCycle: {
        id: 'cycle-1',
        workflowId: 'wf-1',
        cycleNumber: 1,
        initiatedBy: 'user-1',
        status: 'IN_PROGRESS',
        currentStepOrder: 1,
        completedAt: null,
        allowedOptionalReviewerIds: ['optional-1', 'optional-2'],
        steps: [],
        createdAt: '2024-01-01T00:00:00Z',
      } satisfies ApiAdminCycle,
      participantNames: {},
    });

    render(
      <ForwardStepDialog
        hook={makeHook({
          dialogs: { forwardStepWorkflow: workflow },
          queries: { orgUsersMap: new Map([['optional-1', 'From Map']]) },
        })}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /select optional reviewer/i }));

    expect(screen.getByText('From Map')).toBeInTheDocument();
    expect(screen.getByText('optional-2')).toBeInTheDocument();
  });
});
