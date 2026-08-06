import {
  CheckCircle,
  User,
  FileText,
  Paperclip,
  Download,
  FolderArchive,
  Loader2,
  Eye,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useState, useMemo, useEffect, useRef, type CSSProperties } from 'react';
import { renderAsync as renderDocxAsync } from 'docx-preview';
import ExcelJS from 'exceljs';
import SSF from 'ssf';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { WorkflowStatusBadge } from '../WorkflowsTable';
import { useAuthStore } from '@/store/authStore';
import { decodeJwt } from '@/lib/jwt';
import { workflowFilesApi } from '@/lib/api/workflow-files';
import { workflowsApi } from '@/lib/api/workflows';
import { buildAuditExportRows } from '@/features/audit/components/audit-table.utils';
import type { WorkflowsHook } from './workflow-dialog.types';
import { InfoRow, ApprovalStepBadge } from './workflow-dialog-shared';
import { getWorkflowActions } from '@/features/workflows/workflow-state-machine';

const PDF_MIME = 'application/pdf';
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

// ExcelJS reads what the free `xlsx` package couldn't: font/fill/border
// styles and embedded images. What it does NOT do is format a cell's value
// through its numFmt — cell.text is just String(value) — so date/currency/
// percentage cells still need ssf (the same formatting engine `xlsx` used
// internally under raw: false) applied by hand below.
const BORDER_CSS: Partial<Record<ExcelJS.BorderStyle, string>> = {
  thin: '1px solid',
  hair: '1px solid',
  dotted: '1px dotted',
  dashed: '1px dashed',
  dashDot: '1px dashed',
  dashDotDot: '1px dashed',
  slantDashDot: '1px dashed',
  medium: '2px solid',
  mediumDashed: '2px dashed',
  mediumDashDot: '2px dashed',
  mediumDashDotDot: '2px dashed',
  thick: '3px solid',
  double: '3px double',
};

function argbToCss(color?: Partial<ExcelJS.Color>): string | undefined {
  return color?.argb ? `#${color.argb.slice(2)}` : undefined;
}

function borderSideCss(side?: Partial<ExcelJS.Border>): string | undefined {
  if (!side?.style) return undefined;
  return `${BORDER_CSS[side.style] ?? '1px solid'} ${argbToCss(side.color) ?? '#000'}`;
}

function cellStyleCss(cell: ExcelJS.Cell): CSSProperties {
  const style: CSSProperties = {};
  const font = cell.font;
  if (font?.bold) style.fontWeight = 'bold';
  if (font?.italic) style.fontStyle = 'italic';
  if (font?.underline) style.textDecoration = 'underline';
  if (font?.size) style.fontSize = `${font.size}px`;
  const fontColor = argbToCss(font?.color);
  if (fontColor) style.color = fontColor;

  const fill = cell.fill;
  if (fill?.type === 'pattern' && fill.pattern === 'solid') {
    const bg = argbToCss(fill.fgColor);
    if (bg) style.backgroundColor = bg;
  }

  const top = borderSideCss(cell.border?.top);
  const left = borderSideCss(cell.border?.left);
  const bottom = borderSideCss(cell.border?.bottom);
  const right = borderSideCss(cell.border?.right);
  if (top) style.borderTop = top;
  if (left) style.borderLeft = left;
  if (bottom) style.borderBottom = bottom;
  if (right) style.borderRight = right;

  if (cell.alignment?.horizontal) {
    style.textAlign =
      cell.alignment.horizontal === 'center' || cell.alignment.horizontal === 'right'
        ? cell.alignment.horizontal
        : 'left';
  }
  if (cell.alignment?.wrapText) style.whiteSpace = 'normal';

  return style;
}

// ssf.format(fmt, aDateObject) converts via Date#getTimezoneOffset(), diffed
// against the offset of its Dec-31-1899 epoch anchor — but IANA zones that
// used a non-round historical LMT offset before standardization (e.g.
// America/Bogota was -4:56 until 1914, vs -5:00 today) return a *different*
// offset for that 1899 anchor than for the cell's actual date, so the diff
// is off by a few minutes and the resulting serial rounds down to the wrong
// day. Converting to the Excel serial ourselves via Date.UTC — reading the
// Date's local Y/M/D/H/M/S fields as if they were UTC, against a UTC epoch
// anchor — never calls getTimezoneOffset() and so never hits that skew.
function dateToExcelSerial(date: Date): number {
  const asUtcMs = Date.UTC(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
    date.getMilliseconds(),
  );
  const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30);
  return (asUtcMs - EXCEL_EPOCH_UTC) / 86400000;
}

// cell.value can be a plain scalar, or one of ExcelJS's structured value
// shapes (rich text runs, a formula + its computed result, a hyperlink
// wrapper, or an error code) — this unwraps to the underlying scalar before
// formatting.
function cellDisplayValue(cell: ExcelJS.Cell): string {
  let value: ExcelJS.CellValue = cell.value;
  if (value != null && typeof value === 'object') {
    if ('richText' in value) value = value.richText.map((r) => r.text).join('');
    else if ('result' in value) value = value.result ?? '';
    else if ('text' in value) value = value.text;
  }
  if (value != null && typeof value === 'object' && 'error' in value) value = value.error;
  if (value == null) return '';
  if (value instanceof Date) return SSF.format(cell.numFmt || 'General', dateToExcelSerial(value));
  if (typeof value === 'number') return SSF.format(cell.numFmt || 'General', value);
  return String(value);
}

// exceljs's own typings declare a global `Buffer extends ArrayBuffer {}`
// (see node_modules/exceljs/index.d.ts:1) that shadows @types/node's real
// Buffer and drops its `toString(encoding)` overload — so media.buffer's
// declared type only has the 0-arg Object.toString. The object itself is a
// real Buffer at runtime (Node in tests, the `buffer` polyfill exceljs's
// browser bundle ships in the app), so this narrows through `unknown`
// instead of fighting the ambient type.
function bufferToBase64(buffer: unknown): string | undefined {
  const withToString = buffer as { toString?: (encoding: string) => string } | undefined;
  return typeof withToString?.toString === 'function' ? withToString.toString('base64') : undefined;
}

function decodeAddress(addr: string): { row: number; col: number } {
  const match = /^([A-Za-z]+)(\d+)$/.exec(addr);
  if (!match) return { row: 1, col: 1 };
  let col = 0;
  for (const ch of match[1].toUpperCase()) col = col * 26 + (ch.charCodeAt(0) - 64);
  return { row: Number(match[2]), col };
}

// A sheet's used range can be sparse — a single stray value (or a formula
// that once referenced a far-off cell) at, say, XFD1048576 would otherwise
// make the loops below try to materialise over a billion Cell objects and
// hang or OOM the tab. Real workflow attachments are nowhere near this size,
// so the preview is simply capped and a truncation notice shown instead.
const MAX_PREVIEW_ROWS = 2000;
const MAX_PREVIEW_COLS = 200;

// Renders a parsed XLSX workbook as a plain HTML table, with sheet tabs when
// there's more than one sheet. Keyed by the caller on the file's storageKey
// so switching to a different spreadsheet resets `activeSheet` instead of
// keeping a sheet name that may not exist in the new workbook.
function XlsxPreviewTable({ workbook }: { workbook: ExcelJS.Workbook }) {
  const [activeSheet, setActiveSheet] = useState(workbook.worksheets[0]?.name ?? '');
  const sheet = workbook.getWorksheet(activeSheet) ?? workbook.worksheets[0];

  // worksheet.dimensions indexes rows/cols from 1 at the start of the used
  // range (not necessarily A1) — !merges and image anchors use absolute
  // sheet coordinates, so both need the same offset subtracted to line up
  // with the 0-based `rows` grid built below.
  //
  // dimensions only covers cells that hold a value — a floating image
  // anchored over an otherwise-empty cell (a logo in a blank header column,
  // say) sits outside it, so the grid's bounds are widened to the union of
  // dimensions and every image anchor before building `rows`, or that column/
  // row would never be rendered and the image would silently disappear.
  const { rows, mergeSpanAt, mergeCovered, imageAt, truncated } = useMemo(() => {
    const empty = {
      rows: [] as ExcelJS.Cell[][],
      mergeSpanAt: new Map<string, { rowSpan: number; colSpan: number }>(),
      mergeCovered: new Set<string>(),
      imageAt: new Map<string, string>(),
      truncated: false,
    };
    if (!sheet) return empty;

    const images = sheet.getImages();
    const dim = sheet.dimensions;
    if (!dim && images.length === 0) return empty;

    let top = dim?.top ?? Infinity;
    let left = dim?.left ?? Infinity;
    let bottom = dim?.bottom ?? -Infinity;
    let right = dim?.right ?? -Infinity;
    for (const img of images) {
      const r = Math.floor(img.range.tl.row) + 1;
      const c = Math.floor(img.range.tl.col) + 1;
      top = Math.min(top, r);
      left = Math.min(left, c);
      bottom = Math.max(bottom, r);
      right = Math.max(right, c);
    }
    const rowOffset = top - 1;
    const colOffset = left - 1;

    const truncated = bottom - top + 1 > MAX_PREVIEW_ROWS || right - left + 1 > MAX_PREVIEW_COLS;
    bottom = Math.min(bottom, top + MAX_PREVIEW_ROWS - 1);
    right = Math.min(right, left + MAX_PREVIEW_COLS - 1);

    const rows: ExcelJS.Cell[][] = [];
    for (let r = top; r <= bottom; r++) {
      const row = sheet.getRow(r);
      const cells: ExcelJS.Cell[] = [];
      for (let c = left; c <= right; c++) cells.push(row.getCell(c));
      rows.push(cells);
    }

    const mergeSpanAt = new Map<string, { rowSpan: number; colSpan: number }>();
    const mergeCovered = new Set<string>();
    // Maps a covered cell's key to the key of the merge's anchor (top-left)
    // cell — an image anchored on a covered cell (e.g. B1 inside a merged
    // A1:B1) needs to be redirected there, since the covered <td> itself is
    // never rendered (see the `mergeCovered.has` check below).
    const mergeAnchorAt = new Map<string, string>();
    for (const range of sheet.model.merges ?? []) {
      const [tl, br] = range.split(':');
      const s = decodeAddress(tl);
      const e = decodeAddress(br);
      const sr = s.row - 1 - rowOffset;
      const sc = s.col - 1 - colOffset;
      const er = e.row - 1 - rowOffset;
      const ec = e.col - 1 - colOffset;
      const anchorKey = `${sr}:${sc}`;
      mergeSpanAt.set(anchorKey, { rowSpan: er - sr + 1, colSpan: ec - sc + 1 });
      for (let r = sr; r <= er; r++) {
        for (let c = sc; c <= ec; c++) {
          if (r !== sr || c !== sc) {
            const coveredKey = `${r}:${c}`;
            mergeCovered.add(coveredKey);
            mergeAnchorAt.set(coveredKey, anchorKey);
          }
        }
      }
    }

    const imageAt = new Map<string, string>();
    for (const img of images) {
      const media = workbook.getImage(Number(img.imageId));
      const base64 = media.base64 ?? bufferToBase64(media.buffer);
      if (!base64) continue;
      const arrRow = Math.floor(img.range.tl.row) - rowOffset;
      const arrCol = Math.floor(img.range.tl.col) - colOffset;
      const imageKey = `${arrRow}:${arrCol}`;
      imageAt.set(
        mergeAnchorAt.get(imageKey) ?? imageKey,
        `data:image/${media.extension};base64,${base64}`,
      );
    }

    return { rows, mergeSpanAt, mergeCovered, imageAt, truncated };
  }, [sheet, workbook]);

  const { t } = useTranslation();

  return (
    <div className="h-full flex flex-col rounded-md border border-border overflow-hidden">
      {truncated && (
        <div className="shrink-0 border-b border-border bg-amber-50 px-2 py-1 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-200">
          {t('workflows.detail.previewTruncated', {
            rows: MAX_PREVIEW_ROWS,
            cols: MAX_PREVIEW_COLS,
          })}
        </div>
      )}
      {workbook.worksheets.length > 1 && (
        <div className="flex items-center gap-1 border-b border-border bg-muted/40 px-2 py-1 overflow-x-auto shrink-0">
          {workbook.worksheets.map(({ name }) => (
            <button
              key={name}
              type="button"
              onClick={() => setActiveSheet(name)}
              className={`text-xs px-2 py-1 rounded shrink-0 ${
                name === activeSheet
                  ? 'bg-background font-medium text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {name}
            </button>
          ))}
        </div>
      )}
      <div className="flex-1 min-h-0 overflow-auto bg-white">
        <table className="text-xs border-collapse">
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => {
                  if (mergeCovered.has(`${i}:${j}`)) return null;
                  const span = mergeSpanAt.get(`${i}:${j}`);
                  const image = imageAt.get(`${i}:${j}`);
                  return (
                    <td
                      key={j}
                      rowSpan={span?.rowSpan}
                      colSpan={span?.colSpan}
                      style={cellStyleCss(cell)}
                      className="border border-border px-2 py-1 whitespace-nowrap text-black"
                    >
                      {image && (
                        <img
                          src={image}
                          alt=""
                          className="block max-h-24 max-w-[12rem] object-contain mb-1"
                        />
                      )}
                      {cellDisplayValue(cell)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function DetailWorkflowDialog({
  hook,
  canApprove,
  reviewCycleEnabled = true,
}: {
  hook: WorkflowsHook;
  canApprove: boolean;
  reviewCycleEnabled?: boolean;
}) {
  const { t } = useTranslation();
  const { user, accessToken } = useAuthStore();
  const { detailWorkflow, setDetailWorkflow } = hook.dialogs;
  const { startApprovalMutation } = hook.mutations;
  const { orgUsersMap } = hook.queries;
  const {
    openApprove,
    openReject,
    openTimeline,
    openEdit,
    openReviewCycle,
    openCompleteStep,
    openForwardStep,
    openClose,
    openManage,
    navigateFromDetail,
  } = hook.actions;
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [docxPreviewBuffer, setDocxPreviewBuffer] = useState<ArrayBuffer | null>(null);
  const [xlsxPreviewWorkbook, setXlsxPreviewWorkbook] = useState<ExcelJS.Workbook | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(false);
  const docxContainerRef = useRef<HTMLDivElement>(null);
  // Bumped on every docx render attempt so a slow, superseded renderDocxAsync
  // call can tell it's stale once it resolves (see the effect below).
  const docxRenderGenerationRef = useRef(0);
  // storageKey of the last successfully-fetched DOCX/XLSX content — lets the
  // fetch effect skip refetching when the popup is closed and reopened for
  // the same document, while still refetching if the main document changes.
  const previewLoadedKeyRef = useRef<string | null>(null);

  // Memoized so atob + JSON.parse only re-run when the token or user changes,
  // not on every re-render caused by isDownloadingZip or other local state.
  const currentUserId = useMemo(
    () => (accessToken ? decodeJwt(accessToken)?.sub : null) ?? user?.id,
    [accessToken, user?.id],
  );

  // Prefer names resolved server-side (see WorkflowsService.findOneOrFail) —
  // works regardless of the viewer's Users-module permission. orgUsersMap is
  // only a fallback for the rare case the backend couldn't resolve it either.
  const userName = (userId: string) =>
    detailWorkflow?.participantNames?.[userId] ??
    orgUsersMap.get(userId) ??
    t('common.unknownUser');

  const mainDocMeta = (detailWorkflow?.mainDocumentMetadata ?? null) as {
    storageKey?: string;
    originalName?: string;
    mimeType?: string;
  } | null;
  // PDFs can't be embedded reliably (browsers/extensions frequently block or
  // error on <iframe>-rendered PDFs), so the "eye" button just opens the
  // signed URL in a new tab instead — the backend already serves PDFs with
  // Content-Disposition: inline (see StorageService.getSignedDownloadUrl), so
  // the browser's native PDF viewer handles it there.
  // DOCX/XLSX have no browser-native viewer, so their bytes are fetched
  // through our own API (see workflowFilesApi.getContent — a direct R2
  // signed URL would hit CORS, since the bucket has no CORS policy for
  // browser fetches) and rendered fully client-side with docx-preview / xlsx,
  // inside a large popup opened by the same "eye" button.
  const isPdfMainDoc = mainDocMeta?.mimeType === PDF_MIME;
  const isDocxMainDoc = mainDocMeta?.mimeType === DOCX_MIME;
  const isXlsxMainDoc = mainDocMeta?.mimeType === XLSX_MIME;
  const isPreviewableMainDoc = isPdfMainDoc || isDocxMainDoc || isXlsxMainDoc;

  // Reset preview state whenever the open workflow changes, so stale content
  // from a previously-viewed document can never flash before the next fetch.
  useEffect(() => {
    setPreviewOpen(false); // eslint-disable-line react-hooks/set-state-in-effect
    setDocxPreviewBuffer(null);
    setXlsxPreviewWorkbook(null);
    setPreviewError(false);
    previewLoadedKeyRef.current = null;
  }, [detailWorkflow?.id]);

  useEffect(() => {
    // Fetched on demand — only once the popup is actually opened — instead of
    // eagerly on every workflow-detail open, since most opens never look at
    // the preview.
    if (!previewOpen || !detailWorkflow || !mainDocMeta?.storageKey) return;
    if (!isDocxMainDoc && !isXlsxMainDoc) return;
    // Already fetched and rendered this exact document — reopening the popup
    // for the same storageKey just reuses it instead of refetching. A
    // changed storageKey (main document replaced) still refetches below.
    if (previewLoadedKeyRef.current === mainDocMeta.storageKey) return;
    const { orgId } = detailWorkflow;
    const { storageKey, mimeType } = mainDocMeta;
    let cancelled = false;
    setPreviewLoading(true);
    setPreviewError(false);

    (async () => {
      try {
        const buffer = await workflowFilesApi.getContent(orgId, storageKey, mimeType);
        if (cancelled) return;
        if (isDocxMainDoc) setDocxPreviewBuffer(buffer);
        else {
          const wb = new ExcelJS.Workbook();
          await wb.xlsx.load(buffer);
          if (cancelled) return;
          setXlsxPreviewWorkbook(wb);
        }
        previewLoadedKeyRef.current = storageKey;
      } catch {
        if (!cancelled) setPreviewError(true);
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewOpen, detailWorkflow?.id, mainDocMeta?.storageKey, isDocxMainDoc, isXlsxMainDoc]);

  // Runs after the docx container div has committed to the DOM (it's only
  // rendered once previewLoading flips to false in the same batch as this
  // buffer being set), so the ref is guaranteed to be attached by now.
  //
  // renderDocxAsync mutates whatever container it's given, and it's async —
  // if docxPreviewBuffer changes again before a prior call finishes, both
  // calls would otherwise write into the SAME live container concurrently,
  // corrupting the DOM (not just "stale content", actual interleaved writes).
  // Rendering into a detached, per-call node and only publishing into the
  // real container when this call's generation is still current avoids that
  // entirely: a superseded call simply never touches the visible DOM.
  useEffect(() => {
    if (!docxPreviewBuffer || !docxContainerRef.current) return;
    const container = docxContainerRef.current;
    const generation = ++docxRenderGenerationRef.current;
    const offscreen = document.createElement('div');

    void renderDocxAsync(docxPreviewBuffer, offscreen)
      .then(() => {
        if (docxRenderGenerationRef.current !== generation) return;
        container.replaceChildren(...offscreen.childNodes);
      })
      .catch(() => {
        if (docxRenderGenerationRef.current === generation) setPreviewError(true);
      });
  }, [docxPreviewBuffer]);

  if (!detailWorkflow) return null;

  const isCreator = detailWorkflow.createdBy === currentUserId;

  const {
    canStartApproval,
    canApproveStep,
    canStartReviewCycle,
    canCompleteAdminStep,
    canForwardAdminStep,
    canManageWorkflow,
    canCloseWorkflow,
  } = getWorkflowActions(detailWorkflow, { userId: currentUserId, canApprove, reviewCycleEnabled });

  const allAttachments = detailWorkflow.attachments ?? [];
  // "Adjuntos de soporte" shows only SUPPORTING/MAIN_DOCUMENT files — MANAGEMENT
  // ones (from "Gestionar") get their own section below with the uploader shown,
  // same as approval attachments. allAttachments itself stays unfiltered since
  // it also feeds the ZIP download and the file count in the footer.
  const supportingAttachments = allAttachments.filter((att) => att.attachmentType !== 'MANAGEMENT');
  const managementAttachments = allAttachments.filter((att) => att.attachmentType === 'MANAGEMENT');
  const approvalAttachments = (detailWorkflow.approvalActions ?? []).flatMap((a) =>
    (a.attachments ?? []).map((att) => ({ ...att, userId: a.userId })),
  );

  const handleOpenFile = async (
    storageKey: string,
    originalName?: string,
    mimeType?: string,
    forceAttachment = true,
  ) => {
    try {
      const { signedUrl } = await workflowFilesApi.getSignedUrl(
        detailWorkflow.orgId,
        storageKey,
        originalName,
        mimeType,
        forceAttachment,
      );
      window.open(signedUrl, '_blank', 'noopener,noreferrer');
    } catch {
      toast.error(t('workflows.detail.downloadError'));
    }
  };

  // Build the flat list of all downloadable files with their target ZIP path
  const buildZipEntries = () => {
    const entries: { zipPath: string; storageKey: string }[] = [];
    const nameCount = new Map<string, number>();

    const uniqueName = (folder: string, name: string) => {
      const key = `${folder}/${name}`;
      const count = nameCount.get(key) ?? 0;
      nameCount.set(key, count + 1);
      if (count === 0) return `${folder}/${name}`;
      const dot = name.lastIndexOf('.');
      return dot !== -1
        ? `${folder}/${name.slice(0, dot)} (${count})${name.slice(dot)}`
        : `${folder}/${name} (${count})`;
    };

    if (mainDocMeta?.storageKey && mainDocMeta.originalName) {
      entries.push({
        zipPath: uniqueName(t('workflows.detail.zipFolderMain'), mainDocMeta.originalName),
        storageKey: mainDocMeta.storageKey,
      });
    }

    for (const att of allAttachments) {
      entries.push({
        zipPath: uniqueName(t('workflows.detail.zipFolderAttachments'), att.originalName),
        storageKey: att.storageKey,
      });
    }

    for (const att of approvalAttachments) {
      entries.push({
        zipPath: uniqueName(t('workflows.detail.zipFolderApproval'), att.originalName),
        storageKey: att.storageKey,
      });
    }

    for (const cycle of detailWorkflow.adminCycles ?? []) {
      for (const step of cycle.steps ?? []) {
        for (const att of step.attachments ?? []) {
          const cycleFolder = `${t('workflows.detail.zipFolderCycles')}/ciclo-${cycle.cycleNumber}/paso-${step.stepOrder}`;
          entries.push({
            zipPath: uniqueName(cycleFolder, att.originalName),
            storageKey: att.storageKey,
          });
        }
      }
    }

    return entries;
  };

  // Downloads this workflow's own audit trail (grouped by Correlation ID =
  // workflow.id — see workflow-timeline.service.ts) as a second file,
  // alongside the attachments ZIP. This call is independent of the ZIP
  // download and deliberately soft-fails: audit-service being briefly down
  // must not undo an attachments download that already succeeded, so a
  // failure here only shows a warning toast.
  const downloadAuditLog = async (safeTitle: string) => {
    try {
      const logs = await workflowsApi.getAuditLog(detailWorkflow.id);
      if (logs.length === 0) return;

      const rows = buildAuditExportRows(logs, [], t);
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet(t('audit.title'));
      const headers = Object.keys(rows[0]);
      ws.addRow(headers);
      for (const row of rows) ws.addRow(headers.map((h) => row[h]));
      headers.forEach((key, i) => {
        const maxLen = rows.reduce(
          (acc, r) => Math.max(acc, String(r[key] ?? '').length),
          key.length,
        );
        ws.getColumn(i + 1).width = Math.max(maxLen, 10);
      });

      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${safeTitle}_audit-log.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error(t('workflows.detail.auditLogDownloadError'));
    }
  };

  const handleDownloadAll = async () => {
    const entries = buildZipEntries();
    if (entries.length === 0) return;

    setIsDownloadingZip(true);
    try {
      const blob = await workflowFilesApi.downloadZip(
        detailWorkflow.orgId,
        entries,
        detailWorkflow.title,
      );
      const safeTitle = detailWorkflow.title.replace(/[<>:"/\\|?*]/g, '_');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${safeTitle}.zip`;
      a.click();
      URL.revokeObjectURL(url);

      await downloadAuditLog(safeTitle);
    } catch {
      toast.error(t('workflows.detail.downloadError'));
    } finally {
      setIsDownloadingZip(false);
    }
  };

  const totalFiles = buildZipEntries().length;

  return (
    <Dialog
      open={!!detailWorkflow}
      onOpenChange={(o) => {
        if (!o) setDetailWorkflow(null);
      }}
    >
      <DialogContent className="sm:max-w-4xl max-h-[92vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="pr-6 leading-snug">{detailWorkflow.title}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0">
          {/* Layout de flujo continuo (CSS multi-column): cada sección se marca
              break-inside-avoid para no cortarse a la mitad, y el navegador
              reparte el contenido entre ambas columnas según su altura real —
              evita el hueco en blanco que dejaba un grid de 2 columnas fijas
              cuando una columna (p. ej. comentarios) crecía mucho más que la otra. */}
          <div className="columns-1 sm:columns-2 gap-6 pt-1">
            {/* Encabezado: estado + descripción + info básica — siempre una sola unidad */}
            <div className="break-inside-avoid mb-6 space-y-4">
              <div className="flex items-center gap-3">
                <WorkflowStatusBadge status={detailWorkflow.status} />
              </div>

              {detailWorkflow.description && (
                <p className="text-sm text-muted-foreground">{detailWorkflow.description}</p>
              )}

              <Separator />

              <div className="space-y-2 text-sm">
                <InfoRow label={t('workflows.detail.typology')}>
                  <span className="font-mono text-xs">{detailWorkflow.typologyCode}</span>
                  <span className="text-muted-foreground ml-1">
                    — {detailWorkflow.typologyName}
                  </span>
                  <Badge variant="outline" className="text-xs ml-1">
                    {detailWorkflow.typologyVersion}
                  </Badge>
                </InfoRow>
                <InfoRow label={t('workflows.detail.createdBy')}>
                  {userName(detailWorkflow.createdBy)}
                </InfoRow>
                <InfoRow label={t('workflows.detail.createdAt')}>
                  {new Date(detailWorkflow.createdAt).toLocaleString()}
                </InfoRow>
              </div>
            </div>

            {/* Documento principal */}
            {mainDocMeta?.storageKey && (
              <div className="break-inside-avoid mb-6">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  {t('workflows.detail.mainDocument')}
                </p>
                <div className="flex items-center gap-2.5 rounded-md border border-border px-3 py-2.5">
                  <FileText className="size-4 text-primary shrink-0" />
                  <span className="flex-1 text-sm truncate">
                    {mainDocMeta.originalName ?? mainDocMeta.storageKey}
                  </span>
                  {isPreviewableMainDoc && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={t('workflows.detail.previewDoc')}
                      className="size-7 shrink-0"
                      onClick={() => {
                        if (isPdfMainDoc) {
                          // forceAttachment: false — this is a preview, not a
                          // download, so the PDF should open inline in the new
                          // tab instead of triggering an immediate save prompt.
                          void handleOpenFile(
                            mainDocMeta.storageKey!,
                            mainDocMeta.originalName,
                            mainDocMeta.mimeType,
                            false,
                          );
                        } else {
                          setPreviewOpen(true);
                        }
                      }}
                    >
                      <Eye className="size-3.5" />
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t('workflows.detail.downloadDoc')}
                    className="size-7 shrink-0"
                    onClick={() =>
                      handleOpenFile(
                        mainDocMeta.storageKey!,
                        mainDocMeta.originalName,
                        mainDocMeta.mimeType,
                      )
                    }
                  >
                    <Download className="size-3.5" />
                  </Button>
                </div>
              </div>
            )}

            {/* Adjuntos de soporte */}
            {supportingAttachments.length > 0 && (
              <div className="break-inside-avoid mb-6">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  {t('workflows.detail.attachments')}
                </p>
                <div className="rounded-md border border-border divide-y divide-border">
                  {supportingAttachments.map((att) => (
                    <div key={att.id} className="flex items-center gap-2.5 px-3 py-2.5">
                      <Paperclip className="size-3.5 text-muted-foreground shrink-0" />
                      <span className="flex-1 text-xs truncate">{att.originalName}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={t('workflows.detail.downloadAttachment')}
                        className="size-7 shrink-0"
                        onClick={() =>
                          handleOpenFile(att.storageKey, att.originalName, att.mimeType)
                        }
                      >
                        <Download className="size-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Adjuntos de aprobación */}
            {approvalAttachments.length > 0 && (
              <div className="break-inside-avoid mb-6">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  {t('workflows.detail.approvalAttachments')}
                </p>
                <div className="rounded-md border border-border divide-y divide-border">
                  {approvalAttachments.map((att, i) => (
                    <div key={i} className="flex items-center gap-2.5 px-3 py-2.5">
                      <CheckCircle className="size-3.5 text-green-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs truncate">{att.originalName}</p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {userName(att.userId)}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={t('workflows.detail.downloadAttachment')}
                        className="size-7 shrink-0"
                        onClick={() =>
                          handleOpenFile(att.storageKey, att.originalName, att.mimeType)
                        }
                      >
                        <Download className="size-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Pasos de aprobación */}
            {detailWorkflow.approvalSteps.length > 0 && (
              <div className="break-inside-avoid mb-6">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  {t('workflows.detail.approvalSteps')}
                </p>
                <div className="space-y-2">
                  {[...detailWorkflow.approvalSteps]
                    .sort((a, b) => a.stepOrder - b.stepOrder)
                    .map((step) => {
                      const actions = (detailWorkflow.approvalActions ?? [])
                        .filter((a) => a.stepId === step.id)
                        .sort((a, b) => b.attemptNumber - a.attemptNumber);
                      const lastAction = actions[0] ?? null;
                      return (
                        <div key={step.id} className="space-y-1">
                          <div className="flex items-center gap-2.5">
                            <div className="flex items-center justify-center size-5 rounded-full border text-[10px] font-bold shrink-0 text-muted-foreground">
                              {step.stepOrder}
                            </div>
                            <User className="size-3.5 text-muted-foreground shrink-0" />
                            <span className="text-xs flex-1 truncate">{userName(step.userId)}</span>
                            <ApprovalStepBadge status={step.status} />
                          </div>
                          {lastAction?.observations && (
                            <div className="ml-8 rounded-md bg-muted/50 border border-border px-2.5 py-1.5">
                              <p className="text-[11px] text-muted-foreground italic break-words">
                                "{lastAction.observations}"
                              </p>
                              <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                                {lastAction.action === 'APPROVED'
                                  ? t('workflows.approvalStepStatus.APPROVED')
                                  : t('workflows.approvalStepStatus.REJECTED')}{' '}
                                · {new Date(lastAction.createdAt).toLocaleString()}
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Ciclos de revisión */}
            {(detailWorkflow.adminCycles ?? []).length > 0 && (
              <div className="break-inside-avoid mb-6 space-y-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {t('workflows.detail.reviewCycles')}
                </p>
                {(detailWorkflow.adminCycles ?? []).map((cycle) => (
                  <div key={cycle.id} className="space-y-3">
                    {(detailWorkflow.adminCycles ?? []).length > 1 && (
                      <p className="text-xs font-medium text-muted-foreground">
                        {t('workflows.detail.cycleLabel', { number: cycle.cycleNumber })}{' '}
                        <span
                          className={
                            cycle.status === 'COMPLETED' ? 'text-green-600' : 'text-blue-600'
                          }
                        >
                          (
                          {cycle.status === 'COMPLETED'
                            ? t('workflows.detail.cycleCompleted')
                            : t('workflows.detail.cycleInProgress')}
                          )
                        </span>
                      </p>
                    )}
                    <div className="space-y-2">
                      {[...cycle.steps]
                        .sort((a, b) => a.stepOrder - b.stepOrder)
                        .map((step) => {
                          const hasContent =
                            (step.notes?.length ?? 0) > 0 || (step.attachments?.length ?? 0) > 0;
                          return (
                            <div
                              key={step.id}
                              className="rounded-md border border-border p-3 space-y-2"
                            >
                              <div className="flex items-center gap-2">
                                <div className="flex items-center justify-center size-5 rounded-full border text-[10px] font-bold shrink-0 text-muted-foreground">
                                  {step.stepOrder}
                                </div>
                                <User className="size-3.5 text-muted-foreground shrink-0" />
                                <span className="text-xs font-medium flex-1 truncate">
                                  {userName(step.userId)}
                                </span>
                                {step.isOptional && (
                                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full border bg-purple-50 text-purple-700 border-purple-200">
                                    {t('workflows.dialogs.optionalReviewer')}
                                  </span>
                                )}
                                <span
                                  className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${
                                    step.status === 'COMPLETED'
                                      ? 'bg-green-50 text-green-700 border-green-200'
                                      : step.status === 'PENDING'
                                        ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                                        : 'bg-muted text-muted-foreground border-muted-foreground/20'
                                  }`}
                                >
                                  {step.status === 'COMPLETED'
                                    ? t('workflows.detail.stepCompleted')
                                    : step.status === 'PENDING'
                                      ? t('workflows.approvalStepStatus.PENDING')
                                      : t('workflows.approvalStepStatus.WAITING')}
                                </span>
                              </div>
                              {step.status === 'COMPLETED' && !hasContent && (
                                <p className="text-[11px] text-muted-foreground italic pl-7">
                                  {t('workflows.detail.noCommentsOrAttachments')}
                                </p>
                              )}
                              {(step.notes ?? []).map((note) => (
                                <div
                                  key={note.id}
                                  className="ml-7 rounded-md bg-muted/40 border border-border px-2.5 py-2"
                                >
                                  <p className="text-xs text-foreground break-words">
                                    {note.content}
                                  </p>
                                  <p className="text-[10px] text-muted-foreground mt-0.5">
                                    {new Date(note.createdAt).toLocaleString()}
                                  </p>
                                </div>
                              ))}
                              {(step.attachments ?? []).length > 0 && (
                                <div className="ml-7 rounded-md border border-border divide-y divide-border">
                                  {(step.attachments ?? []).map((att) => (
                                    <div
                                      key={att.id}
                                      className="flex items-center gap-2 px-2.5 py-1.5"
                                    >
                                      <Paperclip className="size-3 text-muted-foreground shrink-0" />
                                      <span className="flex-1 text-xs truncate">
                                        {att.originalName}
                                      </span>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="size-6 shrink-0"
                                        onClick={() =>
                                          handleOpenFile(
                                            att.storageKey,
                                            att.originalName,
                                            att.mimeType,
                                          )
                                        }
                                      >
                                        <Download className="size-3" />
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Gestión del usuario final — comentarios y adjuntos vía "Gestionar" */}
            {((detailWorkflow.notes?.length ?? 0) > 0 || managementAttachments.length > 0) && (
              <div className="break-inside-avoid mb-6">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  {t('workflows.detail.management')}
                </p>
                <div className="space-y-2">
                  {(detailWorkflow.notes ?? []).map((note) => (
                    <div
                      key={note.id}
                      className="rounded-md bg-muted/40 border border-border px-2.5 py-2"
                    >
                      <p className="text-xs font-medium text-foreground">
                        {userName(note.createdBy)}
                      </p>
                      <p className="text-xs text-foreground break-words mt-0.5">{note.content}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {new Date(note.createdAt).toLocaleString()}
                      </p>
                    </div>
                  ))}
                  {managementAttachments.length > 0 && (
                    <div className="rounded-md border border-border divide-y divide-border">
                      {managementAttachments.map((att) => (
                        <div key={att.id} className="flex items-center gap-2.5 px-3 py-2.5">
                          <Paperclip className="size-3.5 text-muted-foreground shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs truncate">{att.originalName}</p>
                            <p className="text-[10px] text-muted-foreground truncate">
                              {userName(att.uploadedBy)}
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={t('workflows.detail.downloadAttachment')}
                            className="size-7 shrink-0"
                            onClick={() =>
                              handleOpenFile(att.storageKey, att.originalName, att.mimeType)
                            }
                          >
                            <Download className="size-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Usuario final */}
            {(detailWorkflow.finalUserIds?.length ?? 0) > 0 && (
              <div className="break-inside-avoid mb-6">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  {t('workflows.detail.finalUser')}
                </p>
                <div className="rounded-md border border-border divide-y divide-border">
                  {detailWorkflow.finalUserIds!.map((finalUserId) => (
                    <div key={finalUserId} className="flex items-center gap-2.5 px-3 py-2.5">
                      <User className="size-3.5 text-muted-foreground shrink-0" />
                      <span className="text-sm">{userName(finalUserId)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex-wrap gap-2 pt-4 shrink-0 border-t border-border mt-2">
          {totalFiles > 0 && (
            <Button
              variant="outline"
              size="sm"
              disabled={isDownloadingZip}
              onClick={handleDownloadAll}
            >
              {isDownloadingZip ? (
                <>
                  <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                  {t('workflows.detail.downloadingAll')}
                </>
              ) : (
                <>
                  <FolderArchive className="size-3.5 mr-1.5" />
                  {t('workflows.detail.downloadAll')}
                </>
              )}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigateFromDetail(() => openTimeline(detailWorkflow.id))}
          >
            {t('workflows.actions.viewTimeline')}
          </Button>
          {isCreator && detailWorkflow.status === 'DRAFT' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateFromDetail(() => openEdit(detailWorkflow))}
            >
              {t('common.edit')}
            </Button>
          )}
          {canStartApproval && (
            <Button
              size="sm"
              disabled={startApprovalMutation.isPending}
              onClick={() => startApprovalMutation.mutate(detailWorkflow.id)}
            >
              {startApprovalMutation.isPending
                ? t('common.processing')
                : t('workflows.actions.startApproval')}
            </Button>
          )}
          {canApproveStep && (
            <>
              <Button
                size="sm"
                variant="outline"
                style={{ color: '#dc2626', borderColor: '#dc2626' }}
                onClick={() => navigateFromDetail(() => openReject(detailWorkflow))}
              >
                {t('workflows.actions.reject')}
              </Button>
              <Button
                size="sm"
                onClick={() => navigateFromDetail(() => openApprove(detailWorkflow))}
              >
                {t('workflows.actions.approve')}
              </Button>
            </>
          )}
          {canStartReviewCycle && (
            <Button
              size="sm"
              onClick={() => navigateFromDetail(() => openReviewCycle(detailWorkflow))}
            >
              {t('workflows.actions.startReviewCycle')}
            </Button>
          )}
          {canCompleteAdminStep && (
            <Button
              size="sm"
              onClick={() => navigateFromDetail(() => openCompleteStep(detailWorkflow))}
            >
              {t('workflows.actions.completeStep')}
            </Button>
          )}
          {canForwardAdminStep && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigateFromDetail(() => openForwardStep(detailWorkflow))}
            >
              {t('workflows.actions.forwardStep')}
            </Button>
          )}
          {canManageWorkflow && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigateFromDetail(() => openManage(detailWorkflow))}
            >
              {t('workflows.actions.manage')}
            </Button>
          )}
          {canCloseWorkflow && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigateFromDetail(() => openClose(detailWorkflow))}
            >
              {t('workflows.actions.close')}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setDetailWorkflow(null)}>
            {t('common.close')}
          </Button>
        </DialogFooter>

        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="sm:max-w-6xl w-[95vw] h-[88vh] flex flex-col">
            <DialogHeader className="shrink-0">
              <DialogTitle className="pr-6 truncate">
                {mainDocMeta?.originalName ?? mainDocMeta?.storageKey}
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 min-h-0">
              {previewLoading ? (
                <div className="flex items-center justify-center h-full rounded-md border border-border bg-muted/20 text-xs text-muted-foreground gap-1.5">
                  <Loader2 className="size-3.5 animate-spin" />
                  {t('workflows.detail.previewLoading')}
                </div>
              ) : previewError ? (
                <p className="text-xs text-muted-foreground italic px-1">
                  {t('workflows.detail.previewError')}
                </p>
              ) : isDocxMainDoc ? (
                <div
                  ref={docxContainerRef}
                  aria-label={t('workflows.detail.previewTitle', {
                    name: mainDocMeta?.originalName ?? mainDocMeta?.storageKey ?? '',
                  })}
                  // docx-preview renders each page at its real fixed width (e.g. Letter/A4) —
                  // overflow-x-auto lets a page wider than the popup scroll horizontally
                  // instead of being clipped/squished at the container's edge.
                  className="w-full h-full overflow-auto rounded-md border border-border bg-white p-4"
                />
              ) : (
                isXlsxMainDoc &&
                xlsxPreviewWorkbook && (
                  <XlsxPreviewTable key={mainDocMeta?.storageKey} workbook={xlsxPreviewWorkbook} />
                )
              )}
            </div>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
