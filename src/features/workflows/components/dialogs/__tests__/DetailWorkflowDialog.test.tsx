import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import ExcelJS from 'exceljs';
import i18n from '@/i18n';
import { DetailWorkflowDialog } from '../DetailWorkflowDialog';
import type { WorkflowsHook } from '../workflow-dialog.types';
import type { ApiWorkflow } from '@/lib/api/workflows';

vi.mock('@/router', () => ({
  router: { navigate: vi.fn(), update: vi.fn() },
}));

vi.mock('@/store/authStore', () => ({
  useAuthStore: vi.fn(() => ({ user: { id: 'user-1' }, accessToken: null })),
}));

// A vi.fn() (not a plain arrow function) so individual tests can override the
// returned actions via mockReturnValueOnce to exercise the footer buttons
// that depend on them — most tests rely on the default all-false return.
const { mockGetWorkflowActions } = vi.hoisted(() => ({
  mockGetWorkflowActions: vi.fn(() => ({
    canStartApproval: false,
    canApproveStep: false,
    canStartReviewCycle: false,
    canCompleteAdminStep: false,
    canForwardAdminStep: false,
    canDelete: false,
  })),
}));
vi.mock('@/features/workflows/workflow-state-machine', () => ({
  getWorkflowActions: mockGetWorkflowActions,
}));

const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }));
vi.mock('sonner', () => ({
  toast: { error: toastError, success: vi.fn() },
}));

const mockGetSignedUrl = vi.fn();
const mockGetContent = vi.fn();
const mockDownloadZip = vi.fn();
vi.mock('@/lib/api/workflow-files', () => ({
  workflowFilesApi: {
    getSignedUrl: (...args: unknown[]) => mockGetSignedUrl(...args),
    getContent: (...args: unknown[]) => mockGetContent(...args),
    downloadZip: (...args: unknown[]) => mockDownloadZip(...args),
  },
}));

const mockGetAuditLog = vi.fn();
vi.mock('@/lib/api/workflows', () => ({
  workflowsApi: {
    getAuditLog: (...args: unknown[]) => mockGetAuditLog(...args),
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
      // Mirrors the real navigateFromDetail: closes detail and immediately
      // runs the action that opens the next dialog (see use-workflows.ts).
      navigateFromDetail: vi.fn((action: () => void) => action()),
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

// A single stray value far from the rest of the sheet — e.g. left behind by
// a formula that once referenced a distant cell — used to blow the used
// range out to over a billion cells (row 1..1048576 x col A) and hang the
// preview trying to materialise them all.
async function makeXlsxWithRemoteCell(): Promise<ExcelJS.Buffer> {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet('Sheet1');
  sheet.getCell('A1').value = 'Near';
  sheet.getCell('A1048576').value = 'Far';
  return wb.xlsx.writeBuffer();
}

// Anchors the image on B1 — the *covered* half of an A1:B1 merge, not its
// anchor (top-left) cell — since that's the cell a real header logo would
// commonly float over.
async function makeXlsxWithImageInsideMerge(): Promise<ExcelJS.Buffer> {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet('Sheet1');
  sheet.getCell('A1').value = 'Report';
  sheet.mergeCells('A1:B1');
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

  it('caps the rendered grid and shows a truncation notice for a sheet with a far-off cell', async () => {
    // Regression: the used range spans row 1..1048576 x col A here — without
    // a cap, the preview would try to materialise ~1M ExcelJS Cell objects
    // (or over a billion for a range that was also wide) and hang the tab.
    mockGetContent.mockResolvedValue(await makeXlsxWithRemoteCell());
    const wf = makeWorkflow({
      mainDocumentMetadata: {
        storageKey: 'key-8',
        originalName: 'huge.xlsx',
        mimeType: XLSX_MIME,
      },
    });
    render(<DetailWorkflowDialog hook={makeHook(wf)} canApprove={false} />);

    clickPreviewEye();

    expect(await screen.findByText('Near')).toBeInTheDocument();
    expect(screen.getByText(/2000/)).toBeInTheDocument();
    expect(screen.queryByText('Far')).not.toBeInTheDocument();
  });

  it('renders an image anchored on the covered half of a merge, redirected to the merge anchor cell', async () => {
    // Regression: imageAt used to key an image by its raw anchor cell — if
    // that cell falls inside a merge but isn't the merge's own anchor (e.g.
    // a logo floated over B1 inside a merged A1:B1), the covered <td> is
    // never rendered at all (see the `mergeCovered.has` check), so the image
    // silently disappeared instead of showing up in the merged cell.
    mockGetContent.mockResolvedValue(await makeXlsxWithImageInsideMerge());
    const wf = makeWorkflow({
      mainDocumentMetadata: {
        storageKey: 'key-9',
        originalName: 'logo-header.xlsx',
        mimeType: XLSX_MIME,
      },
    });
    render(<DetailWorkflowDialog hook={makeHook(wf)} canApprove={false} />);

    clickPreviewEye();

    const mergedCell = (await screen.findByText('Report')).closest('td');
    expect(mergedCell).toHaveAttribute('colspan', '2');

    const image = await vi.waitFor(() => {
      const el = document.querySelector('img');
      if (!el) throw new Error('image not rendered yet');
      return el;
    });
    expect(image.closest('td')).toBe(mergedCell);
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

describe('DetailWorkflowDialog — "Download all" also exports the workflow\'s audit log', () => {
  let createdBlobs: Blob[] = [];
  let createdAnchors: HTMLAnchorElement[] = [];
  let createElementSpy: ReturnType<typeof vi.spyOn>;
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;
  const originalCreateElement = document.createElement.bind(document);

  beforeEach(() => {
    mockDownloadZip.mockReset();
    mockGetAuditLog.mockReset();
    toastError.mockClear();
    createdBlobs = [];
    createdAnchors = [];
    URL.createObjectURL = vi.fn((blob: Blob) => {
      createdBlobs.push(blob);
      return `blob:mock-url-${createdBlobs.length}`;
    });
    URL.revokeObjectURL = vi.fn();
    // Captures the <a download=...> elements the component creates, so tests
    // can assert on filenames/order — not just "some blob was made".
    createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const el = originalCreateElement(tagName);
      if (tagName === 'a') createdAnchors.push(el as HTMLAnchorElement);
      return el;
    });
  });

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    createElementSpy.mockRestore();
  });

  function renderWithMainDoc() {
    const wf = makeWorkflow({
      id: 'wf-download-all',
      mainDocumentMetadata: {
        storageKey: 'key-1',
        originalName: 'contract.pdf',
        mimeType: 'application/pdf',
      },
    });
    render(<DetailWorkflowDialog hook={makeHook(wf)} canApprove={false} />);
  }

  it('downloads both the attachments ZIP and a second .xlsx with the audit trail, keyed by workflow.id as the Correlation ID', async () => {
    mockDownloadZip.mockResolvedValue(new Blob(['zip-bytes']));
    mockGetAuditLog.mockResolvedValue([
      {
        id: 'log-1',
        service: 'workflow-service',
        actorId: 'user-1',
        actorName: 'Ana Gomez',
        orgId: 'org-1',
        action: 'WORKFLOW_CREATED',
        resourceType: 'workflow',
        resourceId: 'wf-download-all',
        correlationId: 'wf-download-all',
        ip: null,
        metadata: null,
        timestamp: '2024-01-01T00:00:00Z',
      },
    ]);

    renderWithMainDoc();
    fireEvent.click(screen.getByRole('button', { name: 'Download all' }));

    await vi.waitFor(() => expect(mockGetAuditLog).toHaveBeenCalledWith('wf-download-all'));
    await vi.waitFor(() => expect(createdBlobs).toHaveLength(2));
    expect(toastError).not.toHaveBeenCalled();

    // Order and filenames: the ZIP downloads first, the audit-log workbook
    // second — a swap or a wrong extension would slip past a test that only
    // counts blobs.
    expect(createdAnchors).toHaveLength(2);
    expect(createdAnchors[0].download).toMatch(/\.zip$/);
    expect(createdAnchors[1].download).toMatch(/_audit-log\.xlsx$/);

    // The second blob must actually be a readable XLSX whose Correlation ID
    // column carries the workflow's own id — not just "some blob".
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await createdBlobs[1].arrayBuffer());
    const sheet = wb.worksheets[0];
    const headerRow = sheet.getRow(1);
    const correlationColIndex = Array.from({ length: headerRow.cellCount }, (_, i) => i + 1).find(
      (i) => headerRow.getCell(i).text === i18n.t('audit.columns.correlationId'),
    );
    expect(correlationColIndex).toBeDefined();
    expect(sheet.getRow(2).getCell(correlationColIndex!).text).toBe('wf-download-all');
  });

  it('skips the second download silently when the workflow has no audit events yet', async () => {
    mockDownloadZip.mockResolvedValue(new Blob(['zip-bytes']));
    mockGetAuditLog.mockResolvedValue([]);

    renderWithMainDoc();
    fireEvent.click(screen.getByRole('button', { name: 'Download all' }));

    await vi.waitFor(() => expect(mockGetAuditLog).toHaveBeenCalled());
    await vi.waitFor(() => expect(createdBlobs).toHaveLength(1));
    expect(toastError).not.toHaveBeenCalled();
  });

  it('still completes the ZIP download and only warns via toast when the audit-log fetch fails (soft-fail)', async () => {
    mockDownloadZip.mockResolvedValue(new Blob(['zip-bytes']));
    mockGetAuditLog.mockRejectedValue(new Error('audit-service unavailable'));

    renderWithMainDoc();
    fireEvent.click(screen.getByRole('button', { name: 'Download all' }));

    await vi.waitFor(() => expect(createdBlobs).toHaveLength(1));
    await vi.waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        "The attachments downloaded, but the audit log couldn't be included. Try again from the audit page if you need it.",
      ),
    );
  });

  it('shows the generic download error (and never calls getAuditLog) when the ZIP itself fails', async () => {
    mockDownloadZip.mockRejectedValue(new Error('document-service unavailable'));

    renderWithMainDoc();
    fireEvent.click(screen.getByRole('button', { name: 'Download all' }));

    await vi.waitFor(() =>
      expect(toastError).toHaveBeenCalledWith('Failed to download the file. Please try again.'),
    );
    expect(mockGetAuditLog).not.toHaveBeenCalled();
    expect(createdBlobs).toHaveLength(0);
  });
});

describe('DetailWorkflowDialog — footer actions', () => {
  it('"View timeline" navigates away from detail and opens the timeline for this workflow', () => {
    const wf = makeWorkflow();
    const hook = makeHook(wf);
    render(<DetailWorkflowDialog hook={hook} canApprove={false} />);

    fireEvent.click(screen.getByRole('button', { name: 'View timeline' }));

    // setDetailWorkflow(null) is navigateFromDetail's own responsibility
    // (see use-workflows.ts) — covered there, not re-asserted on this mock.
    expect(hook.actions.navigateFromDetail).toHaveBeenCalledTimes(1);
    expect(hook.actions.openTimeline).toHaveBeenCalledWith(wf.id);
  });

  it('"Edit" shows only for the creator on a DRAFT workflow, and navigates to the edit dialog', () => {
    const wf = makeWorkflow({ status: 'DRAFT', createdBy: 'user-1' });
    const hook = makeHook(wf);
    render(<DetailWorkflowDialog hook={hook} canApprove={false} />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));

    expect(hook.actions.navigateFromDetail).toHaveBeenCalledTimes(1);
    expect(hook.actions.openEdit).toHaveBeenCalledWith(wf);
  });

  it('hides "Edit" for a DRAFT workflow created by someone else', () => {
    const wf = makeWorkflow({ status: 'DRAFT', createdBy: 'someone-else' });
    render(<DetailWorkflowDialog hook={makeHook(wf)} canApprove={false} />);

    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
  });

  it('"Start approval" calls the mutation directly, without navigating away from detail', () => {
    mockGetWorkflowActions.mockReturnValueOnce({
      canStartApproval: true,
      canApproveStep: false,
      canStartReviewCycle: false,
      canCompleteAdminStep: false,
      canForwardAdminStep: false,
      canDelete: false,
    });
    const wf = makeWorkflow();
    const hook = makeHook(wf);
    render(<DetailWorkflowDialog hook={hook} canApprove={false} />);

    fireEvent.click(screen.getByRole('button', { name: 'Start approval' }));

    expect(hook.mutations.startApprovalMutation.mutate).toHaveBeenCalledWith(wf.id);
    expect(hook.actions.navigateFromDetail).not.toHaveBeenCalled();
  });

  it('"Reject" navigates to the reject dialog', () => {
    mockGetWorkflowActions.mockReturnValueOnce({
      canStartApproval: false,
      canApproveStep: true,
      canStartReviewCycle: false,
      canCompleteAdminStep: false,
      canForwardAdminStep: false,
      canDelete: false,
    });
    const wf = makeWorkflow();
    const hook = makeHook(wf);
    render(<DetailWorkflowDialog hook={hook} canApprove />);

    fireEvent.click(screen.getByRole('button', { name: 'Reject' }));

    expect(hook.actions.openReject).toHaveBeenCalledWith(wf);
  });

  it('"Approve" navigates to the approve dialog', () => {
    mockGetWorkflowActions.mockReturnValueOnce({
      canStartApproval: false,
      canApproveStep: true,
      canStartReviewCycle: false,
      canCompleteAdminStep: false,
      canForwardAdminStep: false,
      canDelete: false,
    });
    const wf = makeWorkflow();
    const hook = makeHook(wf);
    render(<DetailWorkflowDialog hook={hook} canApprove />);

    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));

    expect(hook.actions.openApprove).toHaveBeenCalledWith(wf);
  });

  it('"Start review cycle" navigates to the review cycle dialog when shown', () => {
    mockGetWorkflowActions.mockReturnValueOnce({
      canStartApproval: false,
      canApproveStep: false,
      canStartReviewCycle: true,
      canCompleteAdminStep: false,
      canForwardAdminStep: false,
      canDelete: false,
    });
    const wf = makeWorkflow();
    const hook = makeHook(wf);
    render(<DetailWorkflowDialog hook={hook} canApprove={false} />);

    fireEvent.click(screen.getByRole('button', { name: 'Start review cycle' }));

    expect(hook.actions.openReviewCycle).toHaveBeenCalledWith(wf);
  });

  it('"Complete step" and "Send to optional reviewer" navigate to their dialogs', () => {
    mockGetWorkflowActions.mockReturnValueOnce({
      canStartApproval: false,
      canApproveStep: false,
      canStartReviewCycle: false,
      canCompleteAdminStep: true,
      canForwardAdminStep: true,
      canDelete: false,
    });
    const wf = makeWorkflow();
    const hook = makeHook(wf);
    render(<DetailWorkflowDialog hook={hook} canApprove={false} />);

    fireEvent.click(screen.getByRole('button', { name: 'Complete step' }));
    expect(hook.actions.openCompleteStep).toHaveBeenCalledWith(wf);

    fireEvent.click(screen.getByRole('button', { name: 'Send to optional reviewer' }));
    expect(hook.actions.openForwardStep).toHaveBeenCalledWith(wf);
  });

  it('plain "Close" clears the detail workflow directly, without navigateFromDetail', () => {
    // Two elements share the "Close" accessible name: the dialog's own
    // built-in X button (data-slot="dialog-close") and our footer button —
    // only the latter is under test here.
    const wf = makeWorkflow();
    const hook = makeHook(wf);
    render(<DetailWorkflowDialog hook={hook} canApprove={false} />);
    const closeButtons = screen.getAllByRole('button', { name: 'Close' });
    const footerClose = closeButtons.find((el) => el.getAttribute('data-slot') !== 'dialog-close');

    fireEvent.click(footerClose!);

    expect(hook.dialogs.setDetailWorkflow).toHaveBeenCalledWith(null);
    expect(hook.actions.navigateFromDetail).not.toHaveBeenCalled();
  });

  it('forwards reviewCycleEnabled to getWorkflowActions, defaulting to true when omitted', () => {
    const wf = makeWorkflow();
    render(<DetailWorkflowDialog hook={makeHook(wf)} canApprove={false} />);

    expect(mockGetWorkflowActions).toHaveBeenLastCalledWith(
      wf,
      expect.objectContaining({ reviewCycleEnabled: true }),
    );
  });

  it('forwards an explicit reviewCycleEnabled: false to getWorkflowActions', () => {
    const wf = makeWorkflow();
    render(
      <DetailWorkflowDialog hook={makeHook(wf)} canApprove={false} reviewCycleEnabled={false} />,
    );

    expect(mockGetWorkflowActions).toHaveBeenLastCalledWith(
      wf,
      expect.objectContaining({ reviewCycleEnabled: false }),
    );
  });
});

describe('DetailWorkflowDialog — rich detail rendering', () => {
  it('renders support/approval attachments, approval steps with observations, multi-cycle admin history and final users', () => {
    const wf = makeWorkflow({
      description: 'A contract pending review',
      finalUserIds: ['final-user-1'],
      approvalSteps: [
        {
          id: 'step-1',
          workflowId: 'wf-1',
          userId: 'approver-1',
          stepOrder: 1,
          status: 'APPROVED',
          completedAt: '2024-01-01T00:00:00Z',
        },
      ],
      approvalActions: [
        {
          id: 'act-1',
          workflowId: 'wf-1',
          stepId: 'step-1',
          userId: 'approver-1',
          action: 'APPROVED',
          observations: 'Looks good to me',
          attemptNumber: 1,
          attachments: [
            {
              storageKey: 'k2',
              originalName: 'proof.pdf',
              mimeType: 'application/pdf',
              fileSizeBytes: 50,
            },
          ],
          createdAt: '2024-01-01T00:00:00Z',
        },
      ],
      attachments: [
        {
          id: 'att-1',
          workflowId: 'wf-1',
          uploadedBy: 'user-1',
          storageKey: 'k1',
          originalName: 'support.pdf',
          mimeType: 'application/pdf',
          fileSizeBytes: 100,
          attachmentType: 'SUPPORTING',
          createdAt: '2024-01-01T00:00:00Z',
        },
      ],
      adminCycles: [
        {
          id: 'cycle-1',
          workflowId: 'wf-1',
          cycleNumber: 1,
          initiatedBy: 'final-user-1',
          status: 'COMPLETED',
          currentStepOrder: null,
          completedAt: '2024-01-02T00:00:00Z',
          allowedOptionalReviewerIds: [],
          steps: [
            {
              id: 'astep-1',
              cycleId: 'cycle-1',
              userId: 'admin-1',
              stepOrder: 1,
              status: 'COMPLETED',
              isOptional: false,
              insertedByStepId: null,
              completedAt: '2024-01-02T00:00:00Z',
              notes: [
                {
                  id: 'note-1',
                  content: 'Reviewed and fine',
                  createdBy: 'admin-1',
                  createdAt: '2024-01-02T00:00:00Z',
                },
              ],
              attachments: [
                {
                  id: 'aatt-1',
                  storageKey: 'k3',
                  originalName: 'cycle-note.pdf',
                  mimeType: 'application/pdf',
                  fileSizeBytes: 10,
                  uploadedBy: 'admin-1',
                  createdAt: '2024-01-02T00:00:00Z',
                },
              ],
            },
          ],
          createdAt: '2024-01-01T00:00:00Z',
        },
        {
          id: 'cycle-2',
          workflowId: 'wf-1',
          cycleNumber: 2,
          initiatedBy: 'final-user-1',
          status: 'IN_PROGRESS',
          currentStepOrder: 1,
          completedAt: null,
          allowedOptionalReviewerIds: [],
          steps: [
            {
              id: 'astep-2',
              cycleId: 'cycle-2',
              userId: 'admin-2',
              stepOrder: 1,
              status: 'PENDING',
              isOptional: true,
              insertedByStepId: null,
              completedAt: null,
            },
          ],
          createdAt: '2024-01-03T00:00:00Z',
        },
      ],
    });

    render(<DetailWorkflowDialog hook={makeHook(wf)} canApprove={false} />);

    expect(screen.getByText('A contract pending review')).toBeInTheDocument();
    expect(screen.getByText('support.pdf')).toBeInTheDocument();
    expect(screen.getByText('proof.pdf')).toBeInTheDocument();
    expect(screen.getByText('"Looks good to me"')).toBeInTheDocument();
    expect(screen.getByText('Reviewed and fine')).toBeInTheDocument();
    expect(screen.getByText('cycle-note.pdf')).toBeInTheDocument();
    expect(screen.getByText(/Cycle #2/)).toBeInTheDocument();
  });
});
