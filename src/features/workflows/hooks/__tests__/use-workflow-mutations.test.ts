import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockStartApproval = vi.fn();
const mockApprove = vi.fn();
const mockReject = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockRemove = vi.fn();
const mockCreateAdminCycle = vi.fn();
const mockSkipReviewCycle = vi.fn();
const mockCompleteAdminStep = vi.fn();
const mockForwardAdminStep = vi.fn();
const mockNotifyNoFinalUsers = vi.fn();
const mockClose = vi.fn();
const mockAddNote = vi.fn();

vi.mock('@/lib/api/workflows', () => ({
  workflowsApi: {
    startApproval: (...args: unknown[]) => mockStartApproval(...args),
    approve: (...args: unknown[]) => mockApprove(...args),
    reject: (...args: unknown[]) => mockReject(...args),
    create: (...args: unknown[]) => mockCreate(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
    remove: (...args: unknown[]) => mockRemove(...args),
    createAdminCycle: (...args: unknown[]) => mockCreateAdminCycle(...args),
    skipReviewCycle: (...args: unknown[]) => mockSkipReviewCycle(...args),
    completeAdminStep: (...args: unknown[]) => mockCompleteAdminStep(...args),
    forwardAdminStep: (...args: unknown[]) => mockForwardAdminStep(...args),
    notifyNoFinalUsers: (...args: unknown[]) => mockNotifyNoFinalUsers(...args),
    close: (...args: unknown[]) => mockClose(...args),
    addNote: (...args: unknown[]) => mockAddNote(...args),
  },
}));

const mockUpload = vi.fn();
vi.mock('@/lib/api/workflow-files', () => ({
  workflowFilesApi: { upload: (...args: unknown[]) => mockUpload(...args) },
}));

// ── Import hook AFTER mocks ───────────────────────────────────────────────────

import { useWorkflowMutations } from '../use-workflow-mutations';
import type { ApiWorkflow } from '@/lib/api/workflows';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
}

const NO_OP_DEPS = {
  invalidateAll: vi.fn(),
  approveAttachmentFiles: [] as File[],
  onCreateSuccess: vi.fn(),
  onUpdateSuccess: vi.fn(),
  onDeleteSuccess: vi.fn(),
  onApproveSuccess: vi.fn(),
  onRejectSuccess: vi.fn(),
  onAdminCycleSuccess: vi.fn(),
  onSkipCycleSuccess: vi.fn(),
  onSkipCycleError: vi.fn(),
  onCompleteStepSuccess: vi.fn(),
  onForwardStepSuccess: vi.fn(),
  onCloseSuccess: vi.fn(),
  onAddNoteSuccess: vi.fn(),
};

function makeWorkflow(overrides: Partial<ApiWorkflow> = {}): ApiWorkflow {
  return {
    id: 'wf-1',
    orgId: 'org-1',
    title: 'Test',
    description: null,
    typologyId: 'typ-1',
    typologyCode: 'CM-001',
    typologyVersion: 'v1',
    typologyName: 'Contrato',
    mainDocumentId: null,
    mainDocumentValidated: false,
    mainDocumentMetadata: null,
    status: 'ADMIN_CYCLE_IN_PROGRESS',
    currentApprovalStepOrder: null,
    currentAssignedUserId: null,
    finalUserIds: null,
    createdBy: 'user-1',
    closedBy: null,
    closedAt: null,
    cancelledBy: null,
    cancelledAt: null,
    approvalSteps: [],
    approvalActions: [],
    attachments: [],
    activeAdminCycle: {
      id: 'cycle-1',
      workflowId: 'wf-1',
      cycleNumber: 1,
      initiatedBy: 'admin-1',
      status: 'IN_PROGRESS',
      currentStepOrder: 1,
      completedAt: null,
      allowedOptionalReviewerIds: [],
      steps: [
        {
          id: 'step-1',
          cycleId: 'cycle-1',
          userId: 'user-1',
          stepOrder: 1,
          status: 'PENDING',
          isOptional: false,
          insertedByStepId: null,
          completedAt: null,
        },
      ],
      createdAt: '2024-01-01T00:00:00Z',
    },
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    participantNames: {},
    ...overrides,
  };
}

// ── Setup ─────────────────────────────────────────────────────────────────────

let uuidCounter = 0;

beforeEach(() => {
  vi.clearAllMocks();
  uuidCounter = 0;
  vi.stubGlobal('crypto', {
    randomUUID: vi.fn(() => `mock-uuid-${++uuidCounter}`),
  });

  const fakeWorkflow = makeWorkflow();
  mockStartApproval.mockResolvedValue(fakeWorkflow);
  mockApprove.mockResolvedValue(fakeWorkflow);
  mockReject.mockResolvedValue(fakeWorkflow);
  mockCreate.mockResolvedValue(fakeWorkflow);
  mockUpdate.mockResolvedValue(fakeWorkflow);
  mockRemove.mockResolvedValue(undefined);
  mockCreateAdminCycle.mockResolvedValue({ id: 'cycle-1' });
  mockSkipReviewCycle.mockResolvedValue(fakeWorkflow);
  mockCompleteAdminStep.mockResolvedValue({});
  mockForwardAdminStep.mockResolvedValue({});
  mockClose.mockResolvedValue(fakeWorkflow);
  mockAddNote.mockResolvedValue(fakeWorkflow);
  mockUpload.mockResolvedValue({
    storageKey: 'key-1',
    originalName: 'file.pdf',
    mimeType: 'application/pdf',
    fileSizeBytes: 1024,
  });
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useWorkflowMutations — idempotency keys', () => {
  it('startApprovalMutation passes a generated idempotency key to the API', async () => {
    const { result } = renderHook(() => useWorkflowMutations('org-1', NO_OP_DEPS), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      await result.current.startApprovalMutation.mutateAsync('wf-1');
    });

    expect(mockStartApproval).toHaveBeenCalledWith('wf-1', 'mock-uuid-1');
  });

  it('approveMutation passes a generated idempotency key to the API', async () => {
    const { result } = renderHook(() => useWorkflowMutations('org-1', NO_OP_DEPS), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      await result.current.approveMutation.mutateAsync({ id: 'wf-1', dto: {} });
    });

    expect(mockApprove).toHaveBeenCalledWith(
      'wf-1',
      expect.objectContaining({ attachments: undefined }),
      'mock-uuid-1',
    );
  });

  it('rejectMutation passes a generated idempotency key to the API', async () => {
    const { result } = renderHook(() => useWorkflowMutations('org-1', NO_OP_DEPS), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      await result.current.rejectMutation.mutateAsync({
        id: 'wf-1',
        dto: { observations: 'Not good' },
      });
    });

    expect(mockReject).toHaveBeenCalledWith('wf-1', { observations: 'Not good' }, 'mock-uuid-1');
  });

  it('createAdminCycleMutation passes a generated idempotency key to the API', async () => {
    const { result } = renderHook(() => useWorkflowMutations('org-1', NO_OP_DEPS), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      await result.current.createAdminCycleMutation.mutateAsync({
        id: 'wf-1',
        reviewerIds: ['user-a', 'user-b'],
      });
    });

    expect(mockCreateAdminCycle).toHaveBeenCalledWith(
      'wf-1',
      expect.objectContaining({
        steps: [
          { userId: 'user-a', stepOrder: 1 },
          { userId: 'user-b', stepOrder: 2 },
        ],
      }),
      'mock-uuid-1',
    );
  });

  it('skipReviewCycleMutation passes a generated idempotency key to the API', async () => {
    const { result } = renderHook(() => useWorkflowMutations('org-1', NO_OP_DEPS), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      await result.current.skipReviewCycleMutation.mutateAsync('wf-1');
    });

    expect(mockSkipReviewCycle).toHaveBeenCalledWith('wf-1', 'mock-uuid-1');
  });

  it('completeStepMutation passes a generated idempotency key to the API', async () => {
    const { result } = renderHook(() => useWorkflowMutations('org-1', NO_OP_DEPS), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      await result.current.completeStepMutation.mutateAsync({
        workflow: makeWorkflow(),
        notes: 'Looks good',
        files: [],
      });
    });

    expect(mockCompleteAdminStep).toHaveBeenCalledWith(
      'wf-1',
      'cycle-1',
      'step-1',
      expect.objectContaining({ notes: 'Looks good', attachments: undefined }),
      'mock-uuid-1',
    );
  });

  it('forwardStepMutation passes a generated idempotency key to the API', async () => {
    const { result } = renderHook(() => useWorkflowMutations('org-1', NO_OP_DEPS), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      await result.current.forwardStepMutation.mutateAsync({
        workflow: makeWorkflow(),
        optionalReviewerId: 'opt-user-1',
        notes: 'Please review',
        files: [],
      });
    });

    expect(mockForwardAdminStep).toHaveBeenCalledWith(
      'wf-1',
      'cycle-1',
      'step-1',
      expect.objectContaining({ optionalReviewerId: 'opt-user-1', notes: 'Please review' }),
      'mock-uuid-1',
    );
  });

  it('closeMutation passes a generated idempotency key to the API and trims closingNotes', async () => {
    const { result } = renderHook(() => useWorkflowMutations('org-1', NO_OP_DEPS), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      await result.current.closeMutation.mutateAsync({ id: 'wf-1', closingNotes: '  All set  ' });
    });

    expect(mockClose).toHaveBeenCalledWith('wf-1', { closingNotes: 'All set' }, 'mock-uuid-1');
  });

  it('closeMutation sends closingNotes: undefined when blank/whitespace', async () => {
    const { result } = renderHook(() => useWorkflowMutations('org-1', NO_OP_DEPS), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      await result.current.closeMutation.mutateAsync({ id: 'wf-1', closingNotes: '   ' });
    });

    expect(mockClose).toHaveBeenCalledWith('wf-1', { closingNotes: undefined }, 'mock-uuid-1');
  });

  it('addNoteMutation uploads files then passes a generated idempotency key to the API', async () => {
    const { result } = renderHook(() => useWorkflowMutations('org-1', NO_OP_DEPS), {
      wrapper: makeWrapper(),
    });
    const file = new File(['x'], 'proof.pdf', { type: 'application/pdf' });

    await act(async () => {
      await result.current.addNoteMutation.mutateAsync({
        workflow: makeWorkflow(),
        content: 'See attached',
        files: [file],
      });
    });

    expect(mockUpload).toHaveBeenCalledWith('org-1', file);
    expect(mockAddNote).toHaveBeenCalledWith(
      'wf-1',
      expect.objectContaining({
        content: 'See attached',
        attachments: [expect.objectContaining({ storageKey: 'key-1', originalName: 'file.pdf' })],
      }),
      'mock-uuid-1',
    );
  });

  it('addNoteMutation sends attachments: undefined when no files are provided', async () => {
    const { result } = renderHook(() => useWorkflowMutations('org-1', NO_OP_DEPS), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      await result.current.addNoteMutation.mutateAsync({
        workflow: makeWorkflow(),
        content: 'Just a comment',
        files: [],
      });
    });

    expect(mockAddNote).toHaveBeenCalledWith(
      'wf-1',
      expect.objectContaining({ content: 'Just a comment', attachments: undefined }),
      'mock-uuid-1',
    );
  });

  it('generates distinct keys for two separate mutation calls', async () => {
    const { result } = renderHook(() => useWorkflowMutations('org-1', NO_OP_DEPS), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      await result.current.startApprovalMutation.mutateAsync('wf-1');
      await result.current.startApprovalMutation.mutateAsync('wf-1');
    });

    const [firstCall, secondCall] = mockStartApproval.mock.calls;
    expect(firstCall[1]).not.toBe(secondCall[1]);
  });

  it('completeStepMutation uploads files and includes them as attachments', async () => {
    const file = new File(['content'], 'doc.pdf', { type: 'application/pdf' });
    const { result } = renderHook(() => useWorkflowMutations('org-1', NO_OP_DEPS), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      await result.current.completeStepMutation.mutateAsync({
        workflow: makeWorkflow(),
        notes: '',
        files: [file],
      });
    });

    expect(mockUpload).toHaveBeenCalledWith('org-1', file);
    expect(mockCompleteAdminStep).toHaveBeenCalledWith(
      'wf-1',
      'cycle-1',
      'step-1',
      expect.objectContaining({
        attachments: [
          expect.objectContaining({ storageKey: 'key-1', mimeType: 'application/pdf' }),
        ],
      }),
      expect.any(String),
    );
  });

  it('createAdminCycleMutation passes allowedOptionalReviewerIds when provided', async () => {
    const { result } = renderHook(() => useWorkflowMutations('org-1', NO_OP_DEPS), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      await result.current.createAdminCycleMutation.mutateAsync({
        id: 'wf-1',
        reviewerIds: ['user-a'],
        optionalReviewerIds: ['opt-1', 'opt-2'],
      });
    });

    expect(mockCreateAdminCycle).toHaveBeenCalledWith(
      'wf-1',
      expect.objectContaining({ allowedOptionalReviewerIds: ['opt-1', 'opt-2'] }),
      expect.any(String),
    );
  });
});
