import { describe, it, expect } from 'vitest';
import { VALID_TRANSITIONS, canTransitionTo, getWorkflowActions } from '../workflow-state-machine';
import type { ApiWorkflow } from '@/lib/api/workflows';

// ── helpers ───────────────────────────────────────────────────────────────────

function makeWorkflow(overrides: Partial<ApiWorkflow> = {}): ApiWorkflow {
  return {
    id: 'wf-1',
    orgId: 'org-1',
    title: 'Test Workflow',
    description: null,
    typologyId: 'typ-1',
    typologyCode: 'CM-001',
    typologyVersion: 'v1',
    typologyName: 'Contrato Marco',
    mainDocumentId: null,
    mainDocumentValidated: false,
    mainDocumentMetadata: null,
    status: 'DRAFT',
    currentApprovalStepOrder: null,
    currentAssignedUserId: null,
    finalUserIds: null,
    createdBy: 'creator-id',
    closedBy: null,
    closedAt: null,
    cancelledBy: null,
    cancelledAt: null,
    approvalSteps: [],
    approvalActions: [],
    attachments: [],
    activeAdminCycle: null,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    participantNames: {},
    ...overrides,
  };
}

const ALL_STATUSES = [
  'DRAFT',
  'PENDING_APPROVAL',
  'RETURNED_TO_CREATOR',
  'REJECTED',
  'PENDING_REVIEW_CYCLE',
  'AVAILABLE_FOR_FINAL_USERS',
  'ADMIN_CYCLE_IN_PROGRESS',
  'CLOSED',
  'CANCELLED',
] as const;

// ── VALID_TRANSITIONS ─────────────────────────────────────────────────────────

describe('VALID_TRANSITIONS', () => {
  it('defines an entry for every workflow status', () => {
    for (const status of ALL_STATUSES) {
      expect(VALID_TRANSITIONS).toHaveProperty(status);
      expect(Array.isArray(VALID_TRANSITIONS[status])).toBe(true);
    }
  });

  it('terminal states have no outgoing transitions', () => {
    expect(VALID_TRANSITIONS.REJECTED).toHaveLength(0);
    expect(VALID_TRANSITIONS.CLOSED).toHaveLength(0);
    expect(VALID_TRANSITIONS.CANCELLED).toHaveLength(0);
  });

  it('DRAFT can only transition to PENDING_APPROVAL', () => {
    expect(VALID_TRANSITIONS.DRAFT).toEqual(['PENDING_APPROVAL']);
  });

  it('PENDING_APPROVAL can transition to PENDING_REVIEW_CYCLE or REJECTED', () => {
    expect(VALID_TRANSITIONS.PENDING_APPROVAL).toContain('PENDING_REVIEW_CYCLE');
    expect(VALID_TRANSITIONS.PENDING_APPROVAL).toContain('REJECTED');
    expect(VALID_TRANSITIONS.PENDING_APPROVAL).toHaveLength(2);
  });

  it('PENDING_REVIEW_CYCLE can start an admin cycle or skip straight to available', () => {
    expect(VALID_TRANSITIONS.PENDING_REVIEW_CYCLE).toContain('ADMIN_CYCLE_IN_PROGRESS');
    expect(VALID_TRANSITIONS.PENDING_REVIEW_CYCLE).toContain('AVAILABLE_FOR_FINAL_USERS');
  });

  it('ADMIN_CYCLE_IN_PROGRESS can only transition back to AVAILABLE_FOR_FINAL_USERS', () => {
    expect(VALID_TRANSITIONS.ADMIN_CYCLE_IN_PROGRESS).toEqual(['AVAILABLE_FOR_FINAL_USERS']);
  });

  it('AVAILABLE_FOR_FINAL_USERS can start another cycle or close', () => {
    expect(VALID_TRANSITIONS.AVAILABLE_FOR_FINAL_USERS).toContain('ADMIN_CYCLE_IN_PROGRESS');
    expect(VALID_TRANSITIONS.AVAILABLE_FOR_FINAL_USERS).toContain('CLOSED');
  });
});

// ── canTransitionTo ───────────────────────────────────────────────────────────

describe('canTransitionTo', () => {
  it('returns true for valid forward transitions', () => {
    expect(canTransitionTo('DRAFT', 'PENDING_APPROVAL')).toBe(true);
    expect(canTransitionTo('PENDING_APPROVAL', 'PENDING_REVIEW_CYCLE')).toBe(true);
    expect(canTransitionTo('PENDING_APPROVAL', 'REJECTED')).toBe(true);
    expect(canTransitionTo('PENDING_REVIEW_CYCLE', 'ADMIN_CYCLE_IN_PROGRESS')).toBe(true);
    expect(canTransitionTo('PENDING_REVIEW_CYCLE', 'AVAILABLE_FOR_FINAL_USERS')).toBe(true);
    expect(canTransitionTo('AVAILABLE_FOR_FINAL_USERS', 'ADMIN_CYCLE_IN_PROGRESS')).toBe(true);
    expect(canTransitionTo('AVAILABLE_FOR_FINAL_USERS', 'CLOSED')).toBe(true);
    expect(canTransitionTo('ADMIN_CYCLE_IN_PROGRESS', 'AVAILABLE_FOR_FINAL_USERS')).toBe(true);
  });

  it('returns false for invalid transitions', () => {
    expect(canTransitionTo('DRAFT', 'CLOSED')).toBe(false);
    expect(canTransitionTo('DRAFT', 'REJECTED')).toBe(false);
    expect(canTransitionTo('REJECTED', 'PENDING_APPROVAL')).toBe(false);
    expect(canTransitionTo('CLOSED', 'DRAFT')).toBe(false);
    expect(canTransitionTo('CANCELLED', 'DRAFT')).toBe(false);
    expect(canTransitionTo('ADMIN_CYCLE_IN_PROGRESS', 'CLOSED')).toBe(false);
  });

  it('returns false for self-transitions', () => {
    expect(canTransitionTo('DRAFT', 'DRAFT')).toBe(false);
    expect(canTransitionTo('PENDING_APPROVAL', 'PENDING_APPROVAL')).toBe(false);
    expect(canTransitionTo('CLOSED', 'CLOSED')).toBe(false);
  });
});

// ── getWorkflowActions — canStartApproval ─────────────────────────────────────

describe('getWorkflowActions — canStartApproval', () => {
  it('is true when user is creator and workflow is DRAFT', () => {
    const wf = makeWorkflow({ status: 'DRAFT', createdBy: 'user-1' });
    expect(getWorkflowActions(wf, { userId: 'user-1' }).canStartApproval).toBe(true);
  });

  it('is false when user is not the creator', () => {
    const wf = makeWorkflow({ status: 'DRAFT', createdBy: 'other-user' });
    expect(getWorkflowActions(wf, { userId: 'user-1' }).canStartApproval).toBe(false);
  });

  it('is false when workflow has already left DRAFT status', () => {
    const wf = makeWorkflow({ status: 'PENDING_APPROVAL', createdBy: 'user-1' });
    expect(getWorkflowActions(wf, { userId: 'user-1' }).canStartApproval).toBe(false);
  });

  it('is false when workflow is in a terminal state', () => {
    const wf = makeWorkflow({ status: 'REJECTED', createdBy: 'user-1' });
    expect(getWorkflowActions(wf, { userId: 'user-1' }).canStartApproval).toBe(false);
  });
});

// ── getWorkflowActions — canDelete ────────────────────────────────────────────

describe('getWorkflowActions — canDelete', () => {
  it('is true when creator has canWrite and workflow is DRAFT', () => {
    const wf = makeWorkflow({ status: 'DRAFT', createdBy: 'user-1' });
    expect(getWorkflowActions(wf, { userId: 'user-1', canWrite: true }).canDelete).toBe(true);
  });

  it('is true when creator has canWrite and workflow is CANCELLED', () => {
    const wf = makeWorkflow({ status: 'CANCELLED', createdBy: 'user-1' });
    expect(getWorkflowActions(wf, { userId: 'user-1', canWrite: true }).canDelete).toBe(true);
  });

  it('is false when user lacks canWrite permission', () => {
    const wf = makeWorkflow({ status: 'DRAFT', createdBy: 'user-1' });
    expect(getWorkflowActions(wf, { userId: 'user-1', canWrite: false }).canDelete).toBe(false);
  });

  it('is false when user is not the creator', () => {
    const wf = makeWorkflow({ status: 'DRAFT', createdBy: 'other-user' });
    expect(getWorkflowActions(wf, { userId: 'user-1', canWrite: true }).canDelete).toBe(false);
  });

  it('is false when workflow is in a non-deletable status', () => {
    for (const status of [
      'PENDING_APPROVAL',
      'PENDING_REVIEW_CYCLE',
      'CLOSED',
      'REJECTED',
    ] as const) {
      const wf = makeWorkflow({ status, createdBy: 'user-1' });
      expect(getWorkflowActions(wf, { userId: 'user-1', canWrite: true }).canDelete).toBe(false);
    }
  });
});

// ── getWorkflowActions — canApproveStep ───────────────────────────────────────

describe('getWorkflowActions — canApproveStep', () => {
  it('is true when user is current approver with canApprove in PENDING_APPROVAL', () => {
    const wf = makeWorkflow({ status: 'PENDING_APPROVAL', currentAssignedUserId: 'user-1' });
    expect(getWorkflowActions(wf, { userId: 'user-1', canApprove: true }).canApproveStep).toBe(
      true,
    );
  });

  it('is false when user lacks canApprove permission', () => {
    const wf = makeWorkflow({ status: 'PENDING_APPROVAL', currentAssignedUserId: 'user-1' });
    expect(getWorkflowActions(wf, { userId: 'user-1', canApprove: false }).canApproveStep).toBe(
      false,
    );
  });

  it('is false when user is not the current assigned approver', () => {
    const wf = makeWorkflow({ status: 'PENDING_APPROVAL', currentAssignedUserId: 'other-user' });
    expect(getWorkflowActions(wf, { userId: 'user-1', canApprove: true }).canApproveStep).toBe(
      false,
    );
  });

  it('is false when status is not PENDING_APPROVAL', () => {
    const wf = makeWorkflow({ status: 'DRAFT', currentAssignedUserId: 'user-1' });
    expect(getWorkflowActions(wf, { userId: 'user-1', canApprove: true }).canApproveStep).toBe(
      false,
    );
  });
});

// ── getWorkflowActions — canStartReviewCycle ──────────────────────────────────

describe('getWorkflowActions — canStartReviewCycle', () => {
  it('is true for final user in PENDING_REVIEW_CYCLE', () => {
    const wf = makeWorkflow({ status: 'PENDING_REVIEW_CYCLE', finalUserIds: ['user-1'] });
    expect(getWorkflowActions(wf, { userId: 'user-1' }).canStartReviewCycle).toBe(true);
  });

  it('is false in AVAILABLE_FOR_FINAL_USERS — document already published, button must not show', () => {
    const wf = makeWorkflow({ status: 'AVAILABLE_FOR_FINAL_USERS', finalUserIds: ['user-1'] });
    expect(getWorkflowActions(wf, { userId: 'user-1' }).canStartReviewCycle).toBe(false);
  });

  it('does not require canApprove — only finalUserIds membership', () => {
    const wf = makeWorkflow({ status: 'PENDING_REVIEW_CYCLE', finalUserIds: ['user-1'] });
    expect(
      getWorkflowActions(wf, { userId: 'user-1', canApprove: false }).canStartReviewCycle,
    ).toBe(true);
  });

  it('is false for user not in finalUserIds', () => {
    const wf = makeWorkflow({ status: 'PENDING_REVIEW_CYCLE', finalUserIds: ['other-user'] });
    expect(getWorkflowActions(wf, { userId: 'user-1' }).canStartReviewCycle).toBe(false);
  });

  it('is false when finalUserIds is null', () => {
    const wf = makeWorkflow({ status: 'PENDING_REVIEW_CYCLE', finalUserIds: null });
    expect(getWorkflowActions(wf, { userId: 'user-1' }).canStartReviewCycle).toBe(false);
  });

  it('is false when userId is undefined', () => {
    const wf = makeWorkflow({ status: 'PENDING_REVIEW_CYCLE', finalUserIds: ['user-1'] });
    expect(getWorkflowActions(wf, { userId: undefined }).canStartReviewCycle).toBe(false);
  });

  it('is false in ADMIN_CYCLE_IN_PROGRESS (not a valid source for that transition)', () => {
    const wf = makeWorkflow({ status: 'ADMIN_CYCLE_IN_PROGRESS', finalUserIds: ['user-1'] });
    expect(getWorkflowActions(wf, { userId: 'user-1' }).canStartReviewCycle).toBe(false);
  });

  it('defaults to true when reviewCycleEnabled is not passed (preserves existing behavior)', () => {
    const wf = makeWorkflow({ status: 'PENDING_REVIEW_CYCLE', finalUserIds: ['user-1'] });
    expect(getWorkflowActions(wf, { userId: 'user-1' }).canStartReviewCycle).toBe(true);
  });

  it('is false when the org has the review cycle disabled, even if otherwise eligible', () => {
    const wf = makeWorkflow({ status: 'PENDING_REVIEW_CYCLE', finalUserIds: ['user-1'] });
    expect(
      getWorkflowActions(wf, { userId: 'user-1', reviewCycleEnabled: false }).canStartReviewCycle,
    ).toBe(false);
  });

  it('is true when the org explicitly has the review cycle enabled', () => {
    const wf = makeWorkflow({ status: 'PENDING_REVIEW_CYCLE', finalUserIds: ['user-1'] });
    expect(
      getWorkflowActions(wf, { userId: 'user-1', reviewCycleEnabled: true }).canStartReviewCycle,
    ).toBe(true);
  });
});

// ── getWorkflowActions — canCompleteAdminStep ─────────────────────────────────

describe('getWorkflowActions — canCompleteAdminStep', () => {
  it('is true when ADMIN_CYCLE_IN_PROGRESS and user is the assigned reviewer', () => {
    const wf = makeWorkflow({ status: 'ADMIN_CYCLE_IN_PROGRESS', currentAssignedUserId: 'user-1' });
    expect(getWorkflowActions(wf, { userId: 'user-1' }).canCompleteAdminStep).toBe(true);
  });

  it('is false when user is not the current assigned reviewer', () => {
    const wf = makeWorkflow({
      status: 'ADMIN_CYCLE_IN_PROGRESS',
      currentAssignedUserId: 'other-user',
    });
    expect(getWorkflowActions(wf, { userId: 'user-1' }).canCompleteAdminStep).toBe(false);
  });

  it('is false when status is not ADMIN_CYCLE_IN_PROGRESS', () => {
    const wf = makeWorkflow({
      status: 'AVAILABLE_FOR_FINAL_USERS',
      currentAssignedUserId: 'user-1',
    });
    expect(getWorkflowActions(wf, { userId: 'user-1' }).canCompleteAdminStep).toBe(false);
  });
});

// ── getWorkflowActions — canForwardAdminStep ──────────────────────────────────

describe('getWorkflowActions — canForwardAdminStep', () => {
  function makeActiveWorkflow(pendingStepIsOptional: boolean, optionalReviewerIds: string[]) {
    return makeWorkflow({
      status: 'ADMIN_CYCLE_IN_PROGRESS',
      currentAssignedUserId: 'user-1',
      activeAdminCycle: {
        id: 'cycle-1',
        workflowId: 'wf-1',
        cycleNumber: 1,
        initiatedBy: 'admin-1',
        status: 'IN_PROGRESS',
        currentStepOrder: 1,
        completedAt: null,
        allowedOptionalReviewerIds: optionalReviewerIds,
        steps: [
          {
            id: 'step-1',
            cycleId: 'cycle-1',
            userId: 'user-1',
            stepOrder: 1,
            status: 'PENDING',
            isOptional: pendingStepIsOptional,
            insertedByStepId: null,
            completedAt: null,
          },
        ],
        createdAt: '2024-01-01T00:00:00Z',
      },
    });
  }

  it('is true when assigned, step is not optional, and optional reviewers exist', () => {
    const wf = makeActiveWorkflow(false, ['opt-reviewer-1']);
    expect(getWorkflowActions(wf, { userId: 'user-1' }).canForwardAdminStep).toBe(true);
  });

  it('is false when the current pending step is optional', () => {
    const wf = makeActiveWorkflow(true, ['opt-reviewer-1']);
    expect(getWorkflowActions(wf, { userId: 'user-1' }).canForwardAdminStep).toBe(false);
  });

  it('is false when there are no allowed optional reviewers', () => {
    const wf = makeActiveWorkflow(false, []);
    expect(getWorkflowActions(wf, { userId: 'user-1' }).canForwardAdminStep).toBe(false);
  });

  it('is false when there is no active cycle', () => {
    const wf = makeWorkflow({
      status: 'ADMIN_CYCLE_IN_PROGRESS',
      currentAssignedUserId: 'user-1',
      activeAdminCycle: null,
    });
    expect(getWorkflowActions(wf, { userId: 'user-1' }).canForwardAdminStep).toBe(false);
  });

  it('is false when user is not the assigned reviewer', () => {
    const wf = makeActiveWorkflow(false, ['opt-reviewer-1']);
    expect(getWorkflowActions(wf, { userId: 'other-user' }).canForwardAdminStep).toBe(false);
  });
});
