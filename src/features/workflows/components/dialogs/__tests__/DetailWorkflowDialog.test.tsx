import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import ExcelJS from 'exceljs';
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

const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }));
vi.mock('sonner', () => ({
  toast: { error: toastError, success: vi.fn() },
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

async function makeXlsxArrayBuffer(): Promise<ExcelJS.Buffer> {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet('Sheet1');
  sheet.addRow(['Name', 'Amount']);
  sheet.addRow(['Widget', 42]);
  return wb.xlsx.writeBuffer();
}

function clickPreviewEye() {
  fireEvent.click(screen.getByRole('button', { name: 'Preview document' }));
}

async function makeXlsxWithMergedHeaderAndDate(): Promise<ExcelJS.Buffer> {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet('Sheet1');
  sheet.addRow(['Report', '']);
  sheet.addRow(['Item', 'Date']);
  const dataRow = sheet.addRow(['Widget', new Date(2024, 0, 15)]);
  dataRow.getCell(2).numFmt = 'm/d/yy';
  sheet.mergeCells('A1:B1');
  return wb.xlsx.writeBuffer();
}

// Cells are set individually (not via a full row range) so the sheet's used
// range — worksheet.dimensions, derived from the cells actually touched —
// starts at B2, not A1.
async function makeXlsxWithMergeOffFromA1(): Promise<ExcelJS.Buffer> {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet('Sheet1');
  sheet.getCell('B2').value = 'Report';
  sheet.getCell('C2').value = '';
  sheet.getCell('B3').value = 'Item';
  sheet.getCell('C3').value = 'Date';
  sheet.getCell('B4').value = 'Widget';
  const dateCell = sheet.getCell('C4');
  dateCell.value = new Date(2024, 0, 15);
  dateCell.numFmt = 'm/d/yy';
  sheet.mergeCells('B2:C2');
  return wb.xlsx.writeBuffer();
}

// 1x1 red PNG, base64-encoded — just needs to be a valid PNG for ExcelJS/the
// browser <img> to accept it, pixel content is irrelevant to the test.
const RED_DOT_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

async function makeXlsxWithImageAndStyledCell(): Promise<ExcelJS.Buffer> {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet('Sheet1');
  const cell = sheet.getCell('A1');
  cell.value = 'Styled';
  cell.font = { bold: true, color: { argb: 'FFFF0000' } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
  cell.border = { top: { style: 'thick', color: { argb: 'FF000000' } } };

  const imageId = wb.addImage({ base64: RED_DOT_PNG_BASE64, extension: 'png' });
  sheet.addImage(imageId, 'B1:B1');

  return wb.xlsx.writeBuffer();
}

describe('DetailWorkflowDialog — main document preview', () => {
  beforeEach(() => {
    mockGetSignedUrl.mockReset();
    mockGetContent.mockReset();
    mockRenderDocxAsync.mockClear();
    toastError.mockClear();
    docxDeferreds = [];
  });

  it('opens a PDF main document in a new tab instead of embedding it, since inline iframes are unreliable across browsers', async () => {
    mockGetSignedUrl.mockResolvedValue({
      signedUrl: 'https://r2.example.com/signed',
      expiresAt: '2099-01-01',
    });
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const wf = makeWorkflow({
      mainDocumentMetadata: {
        storageKey: 'key-1',
        originalName: 'contract.pdf',
        mimeType: 'application/pdf',
      },
    });
    render(<DetailWorkflowDialog hook={makeHook(wf)} canApprove={false} />);

    expect(mockGetSignedUrl).not.toHaveBeenCalled(); // not fetched eagerly on dialog open
    clickPreviewEye();

    await vi.waitFor(() =>
      // forceAttachment: false — a preview should open inline, not force an
      // immediate download prompt like the Download button does.
      expect(mockGetSignedUrl).toHaveBeenCalledWith(
        'org-1',
        'key-1',
        'contract.pdf',
        'application/pdf',
        false,
      ),
    );
    await vi.waitFor(() =>
      expect(openSpy).toHaveBeenCalledWith(
        'https://r2.example.com/signed',
        '_blank',
        'noopener,noreferrer',
      ),
    );
    // No popup dialog, no iframe — the eye button is a plain "open in new tab" shortcut for PDFs.
    expect(screen.queryByRole('dialog', { name: 'contract.pdf' })).not.toBeInTheDocument();

    openSpy.mockRestore();
  });

  it('forces attachment disposition when downloading the main document, even for a PDF', async () => {
    // Regression guard: only the preview ("eye") path should request an
    // inline PDF — the Download button must keep forcing a save prompt.
    mockGetSignedUrl.mockResolvedValue({
      signedUrl: 'https://r2.example.com/signed',
      expiresAt: '2099-01-01',
    });
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const wf = makeWorkflow({
      mainDocumentMetadata: {
        storageKey: 'key-1',
        originalName: 'contract.pdf',
        mimeType: 'application/pdf',
      },
    });
    render(<DetailWorkflowDialog hook={makeHook(wf)} canApprove={false} />);

    fireEvent.click(screen.getByRole('button', { name: 'Download document' }));

    await vi.waitFor(() =>
      expect(mockGetSignedUrl).toHaveBeenCalledWith(
        'org-1',
        'key-1',
        'contract.pdf',
        'application/pdf',
        true,
      ),
    );

    openSpy.mockRestore();
  });

  it('shows a toast error if the PDF signed URL fetch fails', async () => {
    mockGetSignedUrl.mockRejectedValue(new Error('network error'));
    const wf = makeWorkflow({
      mainDocumentMetadata: {
        storageKey: 'key-1',
        originalName: 'contract.pdf',
        mimeType: 'application/pdf',
      },
    });
    render(<DetailWorkflowDialog hook={makeHook(wf)} canApprove={false} />);

    clickPreviewEye();

    await vi.waitFor(() => expect(toastError).toHaveBeenCalled());
  });

  it('does not fetch DOCX/XLSX bytes until the eye button is clicked', () => {
    const wf = makeWorkflow({
      mainDocumentMetadata: {
        storageKey: 'key-3',
        originalName: 'contract.docx',
        mimeType: DOCX_MIME,
      },
    });
    render(<DetailWorkflowDialog hook={makeHook(wf)} canApprove={false} />);

    expect(mockGetContent).not.toHaveBeenCalled();
  });

  it('renders a DOCX main document client-side via docx-preview, fetching bytes through our own API, in a large popup', async () => {
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

    clickPreviewEye();

    expect(mockGetSignedUrl).not.toHaveBeenCalled();
    await screen.findByLabelText('Preview of contract.docx');
    expect(mockGetContent).toHaveBeenCalledWith('org-1', 'key-3', DOCX_MIME);
    expect(mockRenderDocxAsync).toHaveBeenCalled();
  });

  it('does not refetch DOCX bytes when the popup is closed and reopened for the same document', async () => {
    mockGetContent.mockResolvedValue(new ArrayBuffer(8));
    const wf = makeWorkflow({
      mainDocumentMetadata: {
        storageKey: 'key-3',
        originalName: 'contract.docx',
        mimeType: DOCX_MIME,
      },
    });
    render(<DetailWorkflowDialog hook={makeHook(wf)} canApprove={false} />);

    clickPreviewEye();
    await screen.findByLabelText('Preview of contract.docx');
    expect(mockGetContent).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    clickPreviewEye();

    await screen.findByLabelText('Preview of contract.docx');
    expect(mockGetContent).toHaveBeenCalledTimes(1);
  });

  it('never lets a slow, superseded DOCX render clobber a newer one that finished first', async () => {
    // Regression: renderDocxAsync mutates whatever container it's given and
    // is async. If the buffer changes again before a prior call finishes,
    // both calls used to write into the SAME live container — whichever
    // resolved last would win, even if it was the stale one. Simulate that
    // exact ordering: doc A's render resolves AFTER doc B's, with the popup
    // staying open across a main-document replacement on the same workflow.
    mockGetContent.mockImplementation((_orgId: string, storageKey: string) =>
      Promise.resolve(storageKey === 'key-a' ? new ArrayBuffer(8) : new ArrayBuffer(16)),
    );
    const wfA = makeWorkflow({
      mainDocumentMetadata: { storageKey: 'key-a', originalName: 'a.docx', mimeType: DOCX_MIME },
    });
    const wfB = makeWorkflow({
      mainDocumentMetadata: { storageKey: 'key-b', originalName: 'b.docx', mimeType: DOCX_MIME },
    });

    const { rerender } = render(<DetailWorkflowDialog hook={makeHook(wfA)} canApprove={false} />);
    clickPreviewEye();
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

  it('renders an XLSX main document client-side as a table, with real sheet data parsed via ExcelJS', async () => {
    mockGetContent.mockResolvedValue(await makeXlsxArrayBuffer());
    const wf = makeWorkflow({
      mainDocumentMetadata: {
        storageKey: 'key-4',
        originalName: 'budget.xlsx',
        mimeType: XLSX_MIME,
      },
    });
    render(<DetailWorkflowDialog hook={makeHook(wf)} canApprove={false} />);

    clickPreviewEye();

    expect(mockGetSignedUrl).not.toHaveBeenCalled();
    await vi.waitFor(() =>
      expect(mockGetContent).toHaveBeenCalledWith('org-1', 'key-4', XLSX_MIME),
    );
    expect(await screen.findByText('Widget')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('renders merged header cells without duplicating values, and formats dates instead of raw serials', async () => {
    // Regression: sheet_to_json used to be called with no `raw`/`defval`
    // options, so a date cell rendered its raw Excel serial (or an
    // unlocalized Date.toString()) instead of "1/15/24", and merged cells
    // (a very common header pattern in real spreadsheets) rendered as
    // duplicated/misaligned values across every cell they used to span.
    mockGetContent.mockResolvedValue(await makeXlsxWithMergedHeaderAndDate());
    const wf = makeWorkflow({
      mainDocumentMetadata: {
        storageKey: 'key-5',
        originalName: 'report.xlsx',
        mimeType: XLSX_MIME,
      },
    });
    render(<DetailWorkflowDialog hook={makeHook(wf)} canApprove={false} />);

    clickPreviewEye();

    await screen.findByText('Report');
    expect(screen.getAllByText('Report')).toHaveLength(1);
    expect(screen.getByText('Report').closest('td')).toHaveAttribute('colspan', '2');
    expect(screen.getByText('1/15/24')).toBeInTheDocument();
  });

  it('resolves merges correctly on a sheet whose used range does not start at A1', async () => {
    // Regression: sheet_to_json indexes its returned rows from 0 at the
    // start of the sheet's used range, but !merges always uses absolute
    // sheet coordinates. On a sheet ranged "B2:C4" (not "A1:..."), failing to
    // offset the merge coordinates by the range's own start would misalign
    // them against the rendered rows — re-rendering a cell that should have
    // been covered by the merge, or attaching the wrong colSpan.
    mockGetContent.mockResolvedValue(await makeXlsxWithMergeOffFromA1());
    const wf = makeWorkflow({
      mainDocumentMetadata: {
        storageKey: 'key-6',
        originalName: 'offset-report.xlsx',
        mimeType: XLSX_MIME,
      },
    });
    render(<DetailWorkflowDialog hook={makeHook(wf)} canApprove={false} />);

    clickPreviewEye();

    await screen.findByText('Report');
    expect(screen.getAllByText('Report')).toHaveLength(1);
    expect(screen.getByText('Report').closest('td')).toHaveAttribute('colspan', '2');
    expect(screen.getByText('1/15/24')).toBeInTheDocument();
  });

  it('applies font/fill/border styling and renders an embedded image, read via ExcelJS', async () => {
    // Regression: the free `xlsx` package couldn't read cell styles or
    // images at all — this exercises the ExcelJS-based replacement's style
    // mapping (font/fill/border) and image extraction.
    mockGetContent.mockResolvedValue(await makeXlsxWithImageAndStyledCell());
    const wf = makeWorkflow({
      mainDocumentMetadata: {
        storageKey: 'key-7',
        originalName: 'styled.xlsx',
        mimeType: XLSX_MIME,
      },
    });
    render(<DetailWorkflowDialog hook={makeHook(wf)} canApprove={false} />);

    clickPreviewEye();

    const styledCell = await screen.findByText('Styled');
    expect(styledCell.closest('td')).toHaveStyle({
      fontWeight: 'bold',
      color: '#ff0000',
      backgroundColor: '#ffff00',
      borderTop: '3px solid #000000',
    });

    // The <img> is decorative (alt="") since ExcelJS doesn't preserve a
    // usable name for embedded media, which drops it from the accessibility
    // tree — queried by tag rather than role for that reason. The dialog
    // renders into a portal outside render()'s container, so the query goes
    // through `document` rather than a destructured `container`.
    const image = await vi.waitFor(() => {
      const el = document.querySelector('img');
      if (!el) throw new Error('image not rendered yet');
      return el;
    });
    expect(image).toHaveAttribute('src', expect.stringContaining('data:image/png;base64,'));
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

    clickPreviewEye();

    expect(await screen.findByText(/couldn't load the preview/i)).toBeInTheDocument();
  });
});
