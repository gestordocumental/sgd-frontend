import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import * as XLSX from 'xlsx';
import '@/i18n';
import { DetailWorkflowDialog } from '../DetailWorkflowDialog';
import type { WorkflowsHook } from '../workflow-dialog.types';
import type { ApiWorkflow } from '@/lib/api/workflows';

vi.mock('@/router', () => ({
  router: { navigate: vi.fn(), update: vi.fn() },
}));

vi.mock('@/store/authStore', () => ({
  useAuthStore: vi.fn(() => ({ user: { id: 'user-1' }, accessToken: null })),
}));

vi.mock('@/features/workflows/workflow-state-machine', () => ({
  getWorkflowActions: () => ({
    canStartApproval: false,
    canApproveStep: false,
    canStartReviewCycle: false,
    canCompleteAdminStep: false,
    canForwardAdminStep: false,
    canDelete: false,
  }),
}));

const mockGetSignedUrl = vi.fn();
const mockGetContent = vi.fn();
vi.mock('@/lib/api/workflow-files', () => ({
  workflowFilesApi: {
    getSignedUrl: (...args: unknown[]) => mockGetSignedUrl(...args),
    getContent: (...args: unknown[]) => mockGetContent(...args),
    downloadZip: vi.fn(),
  },
}));

const mockRenderDocxAsync = vi.fn().mockResolvedValue(undefined);
vi.mock('docx-preview', () => ({
  renderAsync: (...args: unknown[]) => mockRenderDocxAsync(...args),
}));

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

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
    mainDocumentId: 'doc-1',
    mainDocumentValidated: true,
    mainDocumentMetadata: null,
    status: 'DRAFT',
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
  };
}

function makeHook(detailWorkflow: ApiWorkflow | null): WorkflowsHook {
  return {
    dialogs: {
      detailWorkflow,
      setDetailWorkflow: vi.fn(),
    },
    queries: {
      orgUsersMap: new Map(),
    },
    mutations: {
      startApprovalMutation: { mutate: vi.fn(), isPending: false },
    },
    actions: {
      openApprove: vi.fn(),
      openReject: vi.fn(),
      openTimeline: vi.fn(),
      openEdit: vi.fn(),
      openReviewCycle: vi.fn(),
      openCompleteStep: vi.fn(),
      openForwardStep: vi.fn(),
    },
  } as unknown as WorkflowsHook;
}

function makeXlsxArrayBuffer(): ArrayBuffer {
  const sheet = XLSX.utils.aoa_to_sheet([
    ['Name', 'Amount'],
    ['Widget', 42],
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, 'Sheet1');
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
}

describe('DetailWorkflowDialog — main document preview', () => {
  beforeEach(() => {
    mockGetSignedUrl.mockReset();
    mockGetContent.mockReset();
    mockRenderDocxAsync.mockClear();
  });

  it('embeds an iframe preview for a PDF main document', async () => {
    // Regression: previously the only way to see the main document was to
    // open a signed URL in a new tab (or force a download). PDFs should
    // preview inline in the dialog itself.
    mockGetSignedUrl.mockResolvedValue({
      signedUrl: 'https://r2.example.com/signed',
      expiresAt: '2099-01-01',
    });
    const wf = makeWorkflow({
      mainDocumentMetadata: {
        storageKey: 'key-1',
        originalName: 'contract.pdf',
        mimeType: 'application/pdf',
      },
    });
    render(<DetailWorkflowDialog hook={makeHook(wf)} canApprove={false} />);

    expect(mockGetSignedUrl).toHaveBeenCalledWith(
      'org-1',
      'key-1',
      'contract.pdf',
      'application/pdf',
    );
    const iframe = await screen.findByTitle('Preview of contract.pdf');
    expect(iframe).toHaveAttribute('src', 'https://r2.example.com/signed');
  });

  it('shows a fallback message if the PDF preview fails to load', async () => {
    mockGetSignedUrl.mockRejectedValue(new Error('network error'));
    const wf = makeWorkflow({
      mainDocumentMetadata: {
        storageKey: 'key-1',
        originalName: 'contract.pdf',
        mimeType: 'application/pdf',
      },
    });
    render(<DetailWorkflowDialog hook={makeHook(wf)} canApprove={false} />);

    expect(await screen.findByText(/couldn't load the preview/i)).toBeInTheDocument();
  });

  it('renders a DOCX main document client-side via docx-preview, fetching bytes through our own API', async () => {
    // Regression: DOCX has no browser-native viewer and the backend forces a
    // download disposition for it, so previewing it means fetching the raw
    // bytes ourselves (not a direct R2 signed URL — that would hit CORS,
    // since R2 has no CORS policy for browser fetches) and rendering with
    // docx-preview, entirely client-side (no third party sees the file).
    mockGetContent.mockResolvedValue(new ArrayBuffer(8));
    const wf = makeWorkflow({
      mainDocumentMetadata: {
        storageKey: 'key-3',
        originalName: 'contract.docx',
        mimeType: DOCX_MIME,
      },
    });
    render(<DetailWorkflowDialog hook={makeHook(wf)} canApprove={false} />);

    expect(mockGetSignedUrl).not.toHaveBeenCalled();
    await screen.findByLabelText('Preview of contract.docx');
    expect(mockGetContent).toHaveBeenCalledWith('org-1', 'key-3', DOCX_MIME);
    expect(mockRenderDocxAsync).toHaveBeenCalled();
  });

  it('renders an XLSX main document client-side as a table, with real sheet data parsed via xlsx', async () => {
    mockGetContent.mockResolvedValue(makeXlsxArrayBuffer());
    const wf = makeWorkflow({
      mainDocumentMetadata: {
        storageKey: 'key-4',
        originalName: 'budget.xlsx',
        mimeType: XLSX_MIME,
      },
    });
    render(<DetailWorkflowDialog hook={makeHook(wf)} canApprove={false} />);

    expect(mockGetSignedUrl).not.toHaveBeenCalled();
    expect(mockGetContent).toHaveBeenCalledWith('org-1', 'key-4', XLSX_MIME);
    expect(await screen.findByText('Widget')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('shows a fallback message if fetching the DOCX/XLSX content fails', async () => {
    mockGetContent.mockRejectedValue(new Error('network error'));
    const wf = makeWorkflow({
      mainDocumentMetadata: {
        storageKey: 'key-3',
        originalName: 'contract.docx',
        mimeType: DOCX_MIME,
      },
    });
    render(<DetailWorkflowDialog hook={makeHook(wf)} canApprove={false} />);

    expect(await screen.findByText(/couldn't load the preview/i)).toBeInTheDocument();
  });
});
