import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@/i18n';
import { WorkflowsTable } from '../WorkflowsTable';
import type { useWorkflows } from '@/features/workflows/hooks/use-workflows';
import type { ApiWorkflow } from '@/lib/api/workflows';

// ── Module mocks ──────────────────────────────────────────────────────────────

// jsdom has zero-height elements — the virtualizer renders 0 items unless we
// make it believe all items are visible regardless of scroll position.
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count, estimateSize }: { count: number; estimateSize: () => number }) => {
    const size = estimateSize();
    return {
      getVirtualItems: () =>
        Array.from({ length: count }, (_, i) => ({
          index: i,
          key: i,
          start: i * size,
          end: (i + 1) * size,
          lane: 0,
          size,
        })),
      getTotalSize: () => count * size,
    };
  },
}));

vi.mock('@/router', () => ({
  router: { navigate: vi.fn(), update: vi.fn() },
}));

vi.mock('@/store/authStore', () => ({
  useAuthStore: vi.fn(() => ({ user: { id: 'user-1' } })),
}));

const mockGetWorkflowActions = vi.fn(() => ({
  canStartApproval: false,
  canDelete: false,
  canStartReviewCycle: false,
  canCompleteAdminStep: false,
  canForwardAdminStep: false,
}));

vi.mock('@/features/workflows/workflow-state-machine', () => ({
  getWorkflowActions: () => mockGetWorkflowActions(),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

type WorkflowsHook = ReturnType<typeof useWorkflows>;

function makeWorkflow(overrides: Partial<ApiWorkflow> = {}): ApiWorkflow {
  return {
    id: 'wf-1',
    title: 'Contract Review',
    description: 'Review the annual contract',
    status: 'DRAFT',
    orgId: 'org-1',
    createdBy: 'user-1',
    typologyId: 'typ-1',
    typologyCode: 'CON-01',
    typologyName: 'Contract',
    approvalSteps: [],
    attachments: [],
    finalUserIds: [],
    activeAdminCycle: null,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  } as ApiWorkflow;
}

function makeHook(
  overrides: {
    dialogs?: Partial<WorkflowsHook['dialogs']>;
    queries?: Partial<WorkflowsHook['queries']>;
    mutations?: Partial<WorkflowsHook['mutations']>;
    actions?: Partial<WorkflowsHook['actions']>;
  } = {},
): WorkflowsHook {
  return {
    dialogs: {
      innerTab: 'all',
      setInnerTab: vi.fn(),
      statusFilter: undefined,
      setStatusFilter: vi.fn(),
      search: '',
      setSearch: vi.fn(),
      page: 1,
      setPage: vi.fn(),
      detailWorkflow: null,
      setDetailWorkflow: vi.fn(),
      timelineWorkflowId: null,
      setTimelineWorkflowId: vi.fn(),
      deleteWorkflow: null,
      setDeleteWorkflow: vi.fn(),
      approveWorkflow: null,
      setApproveWorkflow: vi.fn(),
      approveAttachmentFiles: [],
      setApproveAttachmentFiles: vi.fn(),
      rejectWorkflow: null,
      setRejectWorkflow: vi.fn(),
      createOpen: false,
      setCreateOpen: vi.fn(),
      selectedTypologyId: '',
      setSelectedTypologyId: vi.fn(),
      approverIds: [],
      setApproverIds: vi.fn(),
      createError: null,
      setCreateError: vi.fn(),
      supportingFiles: [],
      setSupportingFiles: vi.fn(),
      finalUserIds: [],
      setFinalUserIds: vi.fn(),
      editWorkflow: null,
      setEditWorkflow: vi.fn(),
      editApproverIds: [],
      setEditApproverIds: vi.fn(),
      editDocumentFile: null,
      setEditDocumentFile: vi.fn(),
      editSupportingFiles: [],
      setEditSupportingFiles: vi.fn(),
      editExistingAttachments: [],
      setEditExistingAttachments: vi.fn(),
      editFinalUserId: null,
      setEditFinalUserId: vi.fn(),
      reviewCycleWorkflow: null,
      setReviewCycleWorkflow: vi.fn(),
      reviewCycleReviewerIds: [],
      setReviewCycleReviewerIds: vi.fn(),
      reviewCycleOptionalIds: new Set<string>(),
      setReviewCycleOptionalIds: vi.fn(),
      completeStepWorkflow: null,
      setCompleteStepWorkflow: vi.fn(),
      completeStepFiles: [],
      setCompleteStepFiles: vi.fn(),
      completeStepNotes: '',
      setCompleteStepNotes: vi.fn(),
      forwardStepWorkflow: null,
      setForwardStepWorkflow: vi.fn(),
      forwardStepOptionalId: '',
      setForwardStepOptionalId: vi.fn(),
      forwardStepNotes: '',
      setForwardStepNotes: vi.fn(),
      forwardStepFiles: [],
      setForwardStepFiles: vi.fn(),
      addApprover: vi.fn(),
      removeApprover: vi.fn(),
      addFinalUser: vi.fn(),
      removeFinalUser: vi.fn(),
      addSupportingFile: vi.fn(),
      removeSupportingFile: vi.fn(),
      ...overrides.dialogs,
    },
    queries: {
      workflows: [],
      workflowsTotal: 0,
      workflowsTotalPages: 1,
      workflowsLoading: false,
      myTasks: [],
      myTasksLoading: false,
      myAvailable: [],
      myAvailableLoading: false,
      isRefreshing: false,
      workflowsDataUpdatedAt: Date.now(),
      invalidateAll: vi.fn(),
      timeline: [],
      timelineLoading: false,
      activeTypologies: [],
      orgUsersMap: new Map(),
      activeOrgUsers: [],
      approverEligibleUsers: [],
      finalUserEligibleUsers: [],
      ...overrides.queries,
    },
    mutations: {
      createMutation: {
        mutate: vi.fn(),
        isPending: false,
      } as unknown as WorkflowsHook['mutations']['createMutation'],
      updateMutation: {
        mutate: vi.fn(),
        isPending: false,
      } as unknown as WorkflowsHook['mutations']['updateMutation'],
      notifyNoFinalUsersMutation: {
        mutate: vi.fn(),
        isPending: false,
      } as unknown as WorkflowsHook['mutations']['notifyNoFinalUsersMutation'],
      deleteMutation: {
        mutate: vi.fn(),
        isPending: false,
      } as unknown as WorkflowsHook['mutations']['deleteMutation'],
      startApprovalMutation: {
        mutate: vi.fn(),
        isPending: false,
      } as unknown as WorkflowsHook['mutations']['startApprovalMutation'],
      approveMutation: {
        mutate: vi.fn(),
        isPending: false,
      } as unknown as WorkflowsHook['mutations']['approveMutation'],
      rejectMutation: {
        mutate: vi.fn(),
        isPending: false,
      } as unknown as WorkflowsHook['mutations']['rejectMutation'],
      createAdminCycleMutation: {
        mutate: vi.fn(),
        isPending: false,
      } as unknown as WorkflowsHook['mutations']['createAdminCycleMutation'],
      skipReviewCycleMutation: {
        mutate: vi.fn(),
        isPending: false,
      } as unknown as WorkflowsHook['mutations']['skipReviewCycleMutation'],
      completeStepMutation: {
        mutate: vi.fn(),
        isPending: false,
      } as unknown as WorkflowsHook['mutations']['completeStepMutation'],
      forwardStepMutation: {
        mutate: vi.fn(),
        isPending: false,
      } as unknown as WorkflowsHook['mutations']['forwardStepMutation'],
      ...overrides.mutations,
    },
    forms: {
      createForm: {} as WorkflowsHook['forms']['createForm'],
      submitCreate: vi.fn(),
      editForm: {} as WorkflowsHook['forms']['editForm'],
      approveForm: {} as WorkflowsHook['forms']['approveForm'],
      rejectForm: {} as WorkflowsHook['forms']['rejectForm'],
    },
    actions: {
      openCreate: vi.fn(),
      openDetailById: vi.fn(),
      openApprove: vi.fn(),
      openReject: vi.fn(),
      openTimeline: vi.fn(),
      openEdit: vi.fn(),
      openReviewCycle: vi.fn(),
      openCompleteStep: vi.fn(),
      openForwardStep: vi.fn(),
      ...overrides.actions,
    },
    extraction: {
      documentFile: null,
      documentExtraction: null,
      documentExtractionLoading: false,
      documentExtractionError: null,
      handleDocumentFile: vi.fn(),
      documentComparison: null,
      createBlocked: false,
    },
  } as WorkflowsHook;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockGetWorkflowActions.mockReturnValue({
    canStartApproval: false,
    canDelete: false,
    canStartReviewCycle: false,
    canCompleteAdminStep: false,
    canForwardAdminStep: false,
  });
});

// ── Permissions / visibility ──────────────────────────────────────────────────

describe('WorkflowsTable — permissions', () => {
  it('hides the "All" tab and redirects to my-tasks when canManage is false', () => {
    const setInnerTab = vi.fn();
    render(
      <WorkflowsTable
        hook={makeHook({ dialogs: { innerTab: 'all', setInnerTab } })}
        canManage={false}
      />,
    );
    expect(screen.queryByRole('tab', { name: /all/i })).not.toBeInTheDocument();
    expect(setInnerTab).toHaveBeenCalledWith('my-tasks');
  });

  it('shows the "All" tab when canManage is true', () => {
    render(<WorkflowsTable hook={makeHook()} canManage />);
    expect(screen.getByRole('tab', { name: /all/i })).toBeInTheDocument();
  });

  it('shows "New workflow" button when canWrite is true', () => {
    render(<WorkflowsTable hook={makeHook()} canWrite />);
    expect(screen.getByRole('button', { name: /new workflow/i })).toBeInTheDocument();
  });

  it('hides "New workflow" button when canWrite is false', () => {
    render(<WorkflowsTable hook={makeHook()} canWrite={false} />);
    expect(screen.queryByRole('button', { name: /new workflow/i })).not.toBeInTheDocument();
  });

  it('calls openCreate when "New workflow" button is clicked', () => {
    const openCreate = vi.fn();
    render(<WorkflowsTable hook={makeHook({ actions: { openCreate } })} canWrite />);
    fireEvent.click(screen.getByRole('button', { name: /new workflow/i }));
    expect(openCreate).toHaveBeenCalledOnce();
  });
});

// ── Loading state ─────────────────────────────────────────────────────────────

describe('WorkflowsTable — loading state', () => {
  it('renders skeleton rows while "all" tab data is loading', () => {
    render(<WorkflowsTable hook={makeHook({ queries: { workflowsLoading: true } })} canManage />);
    expect(screen.getByTestId('workflow-skeleton')).toBeInTheDocument();
  });

  it('renders skeleton rows while my-tasks data is loading', () => {
    render(
      <WorkflowsTable
        hook={makeHook({
          dialogs: { innerTab: 'my-tasks' },
          queries: { myTasksLoading: true },
        })}
        canManage
      />,
    );
    expect(screen.getByTestId('workflow-skeleton')).toBeInTheDocument();
  });
});

// ── Empty state ───────────────────────────────────────────────────────────────

describe('WorkflowsTable — empty state', () => {
  it('shows empty message when there are no workflows and no filters active', () => {
    render(
      <WorkflowsTable
        hook={makeHook({ queries: { workflows: [], workflowsTotal: 0 } })}
        canManage
      />,
    );
    // The emptyKey 'workflows.empty' should produce a visible message
    expect(screen.getByText(/no workflows/i)).toBeInTheDocument();
  });

  it('shows "no results" message when search is active', () => {
    render(
      <WorkflowsTable
        hook={makeHook({
          dialogs: { search: 'xyz' },
          queries: { workflows: [], workflowsTotal: 0 },
        })}
        canManage
      />,
    );
    expect(screen.getByText(/no results/i)).toBeInTheDocument();
  });

  it('shows "no results" message when status filter is active', () => {
    render(
      <WorkflowsTable
        hook={makeHook({
          dialogs: { statusFilter: 'REJECTED' },
          queries: { workflows: [], workflowsTotal: 0 },
        })}
        canManage
      />,
    );
    expect(screen.getByText(/no results/i)).toBeInTheDocument();
  });

  it('shows empty message for my-tasks when there are no tasks', () => {
    render(<WorkflowsTable hook={makeHook({ dialogs: { innerTab: 'my-tasks' } })} canManage />);
    expect(screen.getByText(/no pending approval/i)).toBeInTheDocument();
  });
});

// ── Row rendering ─────────────────────────────────────────────────────────────

describe('WorkflowsTable — row rendering', () => {
  it('renders a row for each workflow', () => {
    const workflows = [
      makeWorkflow({ id: 'wf-1', title: 'Alpha Process' }),
      makeWorkflow({ id: 'wf-2', title: 'Beta Process' }),
    ];
    render(
      <WorkflowsTable hook={makeHook({ queries: { workflows, workflowsTotal: 2 } })} canManage />,
    );
    expect(screen.getByText('Alpha Process')).toBeInTheDocument();
    expect(screen.getByText('Beta Process')).toBeInTheDocument();
  });

  it('renders the workflow typology code', () => {
    const wf = makeWorkflow({ typologyCode: 'INV-07' });
    render(
      <WorkflowsTable
        hook={makeHook({ queries: { workflows: [wf], workflowsTotal: 1 } })}
        canManage
      />,
    );
    expect(screen.getByText('INV-07')).toBeInTheDocument();
  });

  it('renders a short correlation ID with ellipsis', () => {
    const wf = makeWorkflow({ id: '12345678-abcd-ef01-2345-678901234567' });
    render(
      <WorkflowsTable
        hook={makeHook({ queries: { workflows: [wf], workflowsTotal: 1 } })}
        canManage
      />,
    );
    expect(screen.getByText('12345678…')).toBeInTheDocument();
  });
});

// ── Row interactions ──────────────────────────────────────────────────────────

describe('WorkflowsTable — row interactions', () => {
  it('calls setDetailWorkflow when the workflow title is clicked', () => {
    const setDetailWorkflow = vi.fn();
    const wf = makeWorkflow({ title: 'Click Me' });
    render(
      <WorkflowsTable
        hook={makeHook({
          dialogs: { setDetailWorkflow },
          queries: { workflows: [wf], workflowsTotal: 1 },
        })}
        canManage
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Click Me' }));
    expect(setDetailWorkflow).toHaveBeenCalledWith(wf);
  });

  it('calls openTimeline when the "View timeline" menu item is clicked', () => {
    const openTimeline = vi.fn();
    const wf = makeWorkflow();
    render(
      <WorkflowsTable
        hook={makeHook({
          actions: { openTimeline },
          queries: { workflows: [wf], workflowsTotal: 1 },
        })}
        canManage
      />,
    );
    // Open the action dropdown
    fireEvent.click(screen.getByRole('button', { name: /open workflow actions/i }));
    fireEvent.click(screen.getByText(/view timeline/i));
    expect(openTimeline).toHaveBeenCalledWith(wf.id);
  });

  it('shows and calls startApprovalMutation when canStartApproval is true', () => {
    mockGetWorkflowActions.mockReturnValue({
      canStartApproval: true,
      canDelete: false,
      canStartReviewCycle: false,
      canCompleteAdminStep: false,
      canForwardAdminStep: false,
    });
    const startApprovalMutate = vi.fn();
    const wf = makeWorkflow({ status: 'DRAFT' });
    render(
      <WorkflowsTable
        hook={makeHook({
          mutations: {
            startApprovalMutation: {
              mutate: startApprovalMutate,
              isPending: false,
            } as unknown as WorkflowsHook['mutations']['startApprovalMutation'],
          },
          queries: { workflows: [wf], workflowsTotal: 1 },
        })}
        canManage
        canWrite
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /open workflow actions/i }));
    fireEvent.click(screen.getByText(/start approval/i));
    expect(startApprovalMutate).toHaveBeenCalledWith(wf.id);
  });

  it('shows and calls setDeleteWorkflow when canDelete is true', () => {
    mockGetWorkflowActions.mockReturnValue({
      canStartApproval: false,
      canDelete: true,
      canStartReviewCycle: false,
      canCompleteAdminStep: false,
      canForwardAdminStep: false,
    });
    const setDeleteWorkflow = vi.fn();
    const wf = makeWorkflow();
    render(
      <WorkflowsTable
        hook={makeHook({
          dialogs: { setDeleteWorkflow },
          queries: { workflows: [wf], workflowsTotal: 1 },
        })}
        canManage
        canWrite
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /open workflow actions/i }));
    fireEvent.click(screen.getByText(/delete/i));
    expect(setDeleteWorkflow).toHaveBeenCalledWith(wf);
  });
});

// ── My-tasks tab badge ────────────────────────────────────────────────────────

describe('WorkflowsTable — my-tasks badge', () => {
  it('shows a count badge when there are pending tasks', () => {
    render(
      <WorkflowsTable
        hook={makeHook({ queries: { myTasks: [makeWorkflow(), makeWorkflow({ id: 'wf-2' })] } })}
        canManage
      />,
    );
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('hides the count badge when there are no tasks', () => {
    render(<WorkflowsTable hook={makeHook()} canManage />);
    expect(screen.queryByTestId('my-tasks-badge')).not.toBeInTheDocument();
  });
});

// ── Search ────────────────────────────────────────────────────────────────────

describe('WorkflowsTable — search', () => {
  it('calls setSearch when the search input changes', () => {
    const setSearch = vi.fn();
    render(<WorkflowsTable hook={makeHook({ dialogs: { setSearch } })} canManage />);
    const input = screen.getByPlaceholderText(/search/i);
    fireEvent.change(input, { target: { value: 'contract' } });
    expect(setSearch).toHaveBeenCalledWith('contract');
  });

  it('reflects the current search value in the input', () => {
    render(<WorkflowsTable hook={makeHook({ dialogs: { search: 'prefilled' } })} canManage />);
    expect(screen.getByPlaceholderText(/search/i)).toHaveValue('prefilled');
  });
});

// ── Status filter ─────────────────────────────────────────────────────────────

describe('WorkflowsTable — status filter', () => {
  it('calls setStatusFilter with the selected value when changed', () => {
    const setStatusFilter = vi.fn();
    render(<WorkflowsTable hook={makeHook({ dialogs: { setStatusFilter } })} canManage />);
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'DRAFT' } });
    expect(setStatusFilter).toHaveBeenCalledWith('DRAFT');
  });

  it('calls setStatusFilter with undefined when "all" is selected', () => {
    const setStatusFilter = vi.fn();
    render(
      <WorkflowsTable
        hook={makeHook({ dialogs: { statusFilter: 'DRAFT', setStatusFilter } })}
        canManage
      />,
    );
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'all' } });
    expect(setStatusFilter).toHaveBeenCalledWith(undefined);
  });
});

// ── Pagination ────────────────────────────────────────────────────────────────

describe('WorkflowsTable — pagination', () => {
  it('hides the pager when there is only one page', () => {
    render(<WorkflowsTable hook={makeHook({ queries: { workflowsTotalPages: 1 } })} canManage />);
    expect(screen.queryByText(/\d+ \/ \d+/)).not.toBeInTheDocument();
  });

  it('shows the pager when there are multiple pages', () => {
    render(
      <WorkflowsTable
        hook={makeHook({
          dialogs: { page: 2 },
          queries: {
            workflows: [makeWorkflow()],
            workflowsTotal: 50,
            workflowsTotalPages: 3,
          },
        })}
        canManage
      />,
    );
    expect(screen.getByText('2 / 3')).toBeInTheDocument();
  });

  it('calls setPage when the next-page button is clicked', () => {
    const setPage = vi.fn();
    render(
      <WorkflowsTable
        hook={makeHook({
          dialogs: { page: 1, setPage },
          queries: {
            workflows: [makeWorkflow()],
            workflowsTotal: 50,
            workflowsTotalPages: 3,
          },
        })}
        canManage
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /next page/i }));
    expect(setPage).toHaveBeenCalledWith(2);
  });
});

// ── Refresh ───────────────────────────────────────────────────────────────────

describe('WorkflowsTable — refresh', () => {
  it('calls invalidateAll when the refresh button is clicked', () => {
    const invalidateAll = vi.fn();
    render(<WorkflowsTable hook={makeHook({ queries: { invalidateAll } })} canManage />);
    fireEvent.click(screen.getByTitle(/refresh/i));
    expect(invalidateAll).toHaveBeenCalledOnce();
  });

  it('disables the refresh button while refreshing', () => {
    render(<WorkflowsTable hook={makeHook({ queries: { isRefreshing: true } })} canManage />);
    expect(screen.getByTitle(/refresh/i)).toBeDisabled();
  });
});
