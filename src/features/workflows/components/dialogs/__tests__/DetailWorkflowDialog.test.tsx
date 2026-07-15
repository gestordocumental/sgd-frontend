import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
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

interface Deferred {
  promise: Promise<void>;
  resolve: () => void;
}
function makeDeferred(): Deferred {
  let resolve!: () => void;
  const promise = new Promise<void>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

// Resolves a docx render's deferred promise and flushes the microtasks so its
// .then()/.catch() handlers (and any resulting state update) settle before
// the next assertion or resolution — wrapped in act() since that state update
// happens outside a user-driven event.
async function flushDocxRender(deferred: Deferred) {
  await act(async () => {
    deferred.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

// Each call gets its own controllable promise (instead of an immediate
// resolution) so tests can force overlapping/out-of-order completions —
// needed to prove a stale render never clobbers a newer one. The DOM write
// happens when `resolve()` is invoked (mirroring how the real async library
// only mutates the DOM as part of settling), not at call time — otherwise
// the race this guards against couldn't be reproduced in a test at all.
let docxDeferreds: Deferred[] = [];
const mockRenderDocxAsync = vi.fn((buffer: ArrayBuffer, container: HTMLElement) => {
  const { promise, resolve } = makeDeferred();
  docxDeferreds.push({
    promise,
    resolve: () => {
      const marker = document.createElement('span');
      marker.textContent = `rendered:${buffer.byteLength}`;
      container.appendChild(marker);
      resolve();
    },
  });
  return promise;
});
vi.mock('docx-preview', () => ({
  renderAsync: (...args: [ArrayBuffer, HTMLElement]) => mockRenderDocxAsync(...args),
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
    docxDeferreds = [];
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
    // Defense in depth: if the stored object were ever the wrong type or
    // compromised, the sandbox stops it from executing scripts, navigating
    // the top window, or doing anything beyond letting the user download it.
    expect(iframe).toHaveAttribute('sandbox', 'allow-downloads');
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

  it('never lets a slow, superseded DOCX render clobber a newer one that finished first', async () => {
    // Regression: renderDocxAsync mutates whatever container it's given and
    // is async. If the buffer changes again before a prior call finishes,
    // both calls used to write into the SAME live container — whichever
    // resolved last would win, even if it was the stale one. Simulate that
    // exact ordering: doc A's render resolves AFTER doc B's.
    mockGetContent.mockImplementation((_orgId: string, storageKey: string) =>
      Promise.resolve(storageKey === 'key-a' ? new ArrayBuffer(8) : new ArrayBuffer(16)),
    );
    const wfA = makeWorkflow({
      mainDocumentMetadata: { storageKey: 'key-a', originalName: 'a.docx', mimeType: DOCX_MIME },
    });
    const wfB = makeWorkflow({
      id: 'wf-2',
      mainDocumentMetadata: { storageKey: 'key-b', originalName: 'b.docx', mimeType: DOCX_MIME },
    });

    const { rerender } = render(<DetailWorkflowDialog hook={makeHook(wfA)} canApprove={false} />);
    await screen.findByLabelText('Preview of a.docx');
    // The docx render effect is a separate, passive effect from the one that
    // sets previewLoading — it can fire slightly after the aria-label commits,
    // so wait for the actual call rather than assuming findByLabelText implies it.
    await vi.waitFor(() => expect(docxDeferreds).toHaveLength(1)); // doc A's render kicked off, still pending

    rerender(<DetailWorkflowDialog hook={makeHook(wfB)} canApprove={false} />);
    await screen.findByLabelText('Preview of b.docx');
    await vi.waitFor(() => expect(docxDeferreds).toHaveLength(2)); // doc B's render kicked off, still pending

    // Doc B (newer) finishes first...
    await flushDocxRender(docxDeferreds[1]);
    // ...then doc A (older, now stale) finishes late.
    await flushDocxRender(docxDeferreds[0]);

    const container = screen.getByLabelText('Preview of b.docx');
    expect(container).toHaveTextContent('rendered:16');
    expect(container).not.toHaveTextContent('rendered:8');
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
