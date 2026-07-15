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
import { useState, useMemo, useEffect, useRef } from 'react';
import { renderAsync as renderDocxAsync } from 'docx-preview';
import * as XLSX from 'xlsx';
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
import type { WorkflowsHook } from './workflow-dialog.types';
import { InfoRow, ApprovalStepBadge } from './workflow-dialog-shared';
import { getWorkflowActions } from '@/features/workflows/workflow-state-machine';

const PDF_MIME = 'application/pdf';
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

// Renders a parsed XLSX workbook as a plain HTML table, with sheet tabs when
// there's more than one sheet. Keyed by the caller on the file's storageKey
// so switching to a different spreadsheet resets `activeSheet` instead of
// keeping a sheet name that may not exist in the new workbook.
function XlsxPreviewTable({ workbook }: { workbook: XLSX.WorkBook }) {
  const [activeSheet, setActiveSheet] = useState(workbook.SheetNames[0]);
  const sheet = workbook.Sheets[activeSheet];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });

  return (
    <div className="h-full flex flex-col rounded-md border border-border overflow-hidden">
      {workbook.SheetNames.length > 1 && (
        <div className="flex items-center gap-1 border-b border-border bg-muted/40 px-2 py-1 overflow-x-auto shrink-0">
          {workbook.SheetNames.map((name) => (
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
                {row.map((cell, j) => (
                  <td
                    key={j}
                    className="border border-border px-2 py-1 whitespace-nowrap text-black"
                  >
                    {cell != null ? String(cell) : ''}
                  </td>
                ))}
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
}: {
  hook: WorkflowsHook;
  canApprove: boolean;
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
  } = hook.actions;
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [docxPreviewBuffer, setDocxPreviewBuffer] = useState<ArrayBuffer | null>(null);
  const [xlsxPreviewWorkbook, setXlsxPreviewWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(false);
  const docxContainerRef = useRef<HTMLDivElement>(null);
  // Bumped on every docx render attempt so a slow, superseded renderDocxAsync
  // call can tell it's stale once it resolves (see the effect below).
  const docxRenderGenerationRef = useRef(0);

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
  }, [detailWorkflow?.id]);

  useEffect(() => {
    // Fetched on demand — only once the popup is actually opened — instead of
    // eagerly on every workflow-detail open, since most opens never look at
    // the preview.
    if (!previewOpen || !detailWorkflow || !mainDocMeta?.storageKey) return;
    if (!isDocxMainDoc && !isXlsxMainDoc) return;
    const { orgId } = detailWorkflow;
    const { storageKey, mimeType } = mainDocMeta;
    let cancelled = false;
    setPreviewLoading(true); // eslint-disable-line react-hooks/set-state-in-effect
    setPreviewError(false);

    (async () => {
      try {
        const buffer = await workflowFilesApi.getContent(orgId, storageKey, mimeType);
        if (cancelled) return;
        if (isDocxMainDoc) setDocxPreviewBuffer(buffer);
        else setXlsxPreviewWorkbook(XLSX.read(buffer, { type: 'array' }));
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
  } = getWorkflowActions(detailWorkflow, { userId: currentUserId, canApprove });

  const allAttachments = detailWorkflow.attachments ?? [];
  const approvalAttachments = (detailWorkflow.approvalActions ?? []).flatMap((a) =>
    (a.attachments ?? []).map((att) => ({ ...att, userId: a.userId })),
  );

  const handleOpenFile = async (storageKey: string, originalName?: string, mimeType?: string) => {
    try {
      const { signedUrl } = await workflowFilesApi.getSignedUrl(
        detailWorkflow.orgId,
        storageKey,
        originalName,
        mimeType,
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
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${detailWorkflow.title.replace(/[<>:"/\\|?*]/g, '_')}.zip`;
      a.click();
      URL.revokeObjectURL(url);
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
          <div className="grid grid-cols-2 gap-x-6 pt-1">
            {/* ── Columna izquierda: info + documentos ── */}
            <div className="space-y-4">
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

              {/* Documento principal */}
              {mainDocMeta?.storageKey && (
                <>
                  <Separator />
                  <div>
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
                              void handleOpenFile(
                                mainDocMeta.storageKey!,
                                mainDocMeta.originalName,
                                mainDocMeta.mimeType,
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
                </>
              )}

              {/* Adjuntos de soporte */}
              {allAttachments.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      {t('workflows.detail.attachments')}
                    </p>
                    <div className="rounded-md border border-border divide-y divide-border">
                      {allAttachments.map((att) => (
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
                </>
              )}

              {/* Adjuntos de aprobación */}
              {approvalAttachments.length > 0 && (
                <>
                  <Separator />
                  <div>
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
                </>
              )}
            </div>

            {/* ── Columna derecha: aprobación + ciclos + usuario final ── */}
            <div className="space-y-4">
              {/* Pasos de aprobación */}
              {detailWorkflow.approvalSteps.length > 0 && (
                <div>
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
                              <span className="text-xs flex-1 truncate">
                                {userName(step.userId)}
                              </span>
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
                <>
                  {detailWorkflow.approvalSteps.length > 0 && <Separator />}
                  <div className="space-y-4">
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
                                (step.notes?.length ?? 0) > 0 ||
                                (step.attachments?.length ?? 0) > 0;
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
                </>
              )}

              {/* Usuario final */}
              {(detailWorkflow.finalUserIds?.length ?? 0) > 0 && (
                <>
                  <Separator />
                  <div>
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
                </>
              )}
            </div>
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
            onClick={() => {
              setDetailWorkflow(null);
              openTimeline(detailWorkflow.id);
            }}
          >
            {t('workflows.actions.viewTimeline')}
          </Button>
          {isCreator && detailWorkflow.status === 'DRAFT' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setDetailWorkflow(null);
                openEdit(detailWorkflow);
              }}
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
                onClick={() => {
                  setDetailWorkflow(null);
                  openReject(detailWorkflow);
                }}
              >
                {t('workflows.actions.reject')}
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setDetailWorkflow(null);
                  openApprove(detailWorkflow);
                }}
              >
                {t('workflows.actions.approve')}
              </Button>
            </>
          )}
          {canStartReviewCycle && (
            <Button
              size="sm"
              onClick={() => {
                setDetailWorkflow(null);
                openReviewCycle(detailWorkflow);
              }}
            >
              {t('workflows.actions.startReviewCycle')}
            </Button>
          )}
          {canCompleteAdminStep && (
            <Button
              size="sm"
              onClick={() => {
                setDetailWorkflow(null);
                openCompleteStep(detailWorkflow);
              }}
            >
              {t('workflows.actions.completeStep')}
            </Button>
          )}
          {canForwardAdminStep && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setDetailWorkflow(null);
                openForwardStep(detailWorkflow);
              }}
            >
              {t('workflows.actions.forwardStep')}
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
                  className="w-full h-full overflow-y-auto rounded-md border border-border bg-white p-4"
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
