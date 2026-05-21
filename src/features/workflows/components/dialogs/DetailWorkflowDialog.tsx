import { CheckCircle, User, FileText, Paperclip, Download } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { WorkflowStatusBadge } from '../WorkflowsTable'
import { useAuthStore } from '@/store/authStore'
import { decodeJwt } from '@/lib/jwt'
import { workflowFilesApi } from '@/lib/api/workflow-files'
import type { WorkflowsHook } from './workflow-dialog.types'
import { InfoRow, ApprovalStepBadge } from './workflow-dialog-shared'

export function DetailWorkflowDialog({ hook, canApprove }: { hook: WorkflowsHook; canApprove: boolean }) {
  const { t } = useTranslation()
  const { user, accessToken } = useAuthStore()
  const { detailWorkflow, setDetailWorkflow, startApprovalMutation, openApprove, openReject, openTimeline, openEdit, orgUsersMap, openReviewCycle, openCompleteStep } = hook

  const userName = (userId: string) => orgUsersMap.get(userId) ?? userId

  if (!detailWorkflow) return null

  // createdBy viene del sub del JWT — usamos sub decodificado para comparar con certeza
  const currentUserId = (accessToken ? decodeJwt(accessToken)?.sub : null) ?? user?.id
  const isCreator = detailWorkflow.createdBy === currentUserId
  const isCurrentApprover = detailWorkflow.currentAssignedUserId === user?.id

  const isFinalUser = detailWorkflow.finalUserIds?.includes(currentUserId ?? '') ?? false
  const canStartApproval = isCreator && detailWorkflow.status === 'DRAFT'
  const canApproveStep = canApprove && isCurrentApprover && detailWorkflow.status === 'PENDING_APPROVAL'
  const canStartReviewCycle = isFinalUser && detailWorkflow.status === 'PENDING_REVIEW_CYCLE'
  const canCompleteAdminStep = detailWorkflow.status === 'ADMIN_CYCLE_IN_PROGRESS' && detailWorkflow.currentAssignedUserId === (currentUserId ?? user?.id)

  const mainDocMeta = detailWorkflow.mainDocumentMetadata as {
    storageKey?: string; originalName?: string; mimeType?: string
  } | null

  const allAttachments = detailWorkflow.attachments ?? []
  const approvalAttachments = (detailWorkflow.approvalActions ?? []).flatMap((a) =>
    (a.attachments ?? []).map((att) => ({ ...att, userId: a.userId })),
  )

  const handleOpenFile = async (storageKey: string) => {
    try {
      const { signedUrl } = await workflowFilesApi.getSignedUrl(detailWorkflow.orgId, storageKey)
      window.open(signedUrl, '_blank', 'noopener,noreferrer')
    } catch {
      // silently fail — user can retry
    }
  }

  return (
    <Dialog open={!!detailWorkflow} onOpenChange={(o) => { if (!o) setDetailWorkflow(null) }}>
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
                  <span className="text-muted-foreground ml-1">— {detailWorkflow.typologyName}</span>
                  <Badge variant="outline" className="text-xs ml-1">{detailWorkflow.typologyVersion}</Badge>
                </InfoRow>
                <InfoRow label={t('workflows.detail.createdBy')}>{userName(detailWorkflow.createdBy)}</InfoRow>
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
                      <span className="flex-1 text-sm truncate">{mainDocMeta.originalName ?? mainDocMeta.storageKey}</span>
                      <Button type="button" variant="ghost" size="icon" aria-label={t('workflows.detail.downloadDoc')} className="size-7 shrink-0" onClick={() => handleOpenFile(mainDocMeta.storageKey!)}>
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
                          <Button type="button" variant="ghost" size="icon" aria-label={t('workflows.detail.downloadAttachment')} className="size-7 shrink-0" onClick={() => handleOpenFile(att.storageKey)}>
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
                            <p className="text-[10px] text-muted-foreground truncate">{userName(att.userId)}</p>
                          </div>
                          <Button type="button" variant="ghost" size="icon" aria-label={t('workflows.detail.downloadAttachment')} className="size-7 shrink-0" onClick={() => handleOpenFile(att.storageKey)}>
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
                    {detailWorkflow.approvalSteps
                      .sort((a, b) => a.stepOrder - b.stepOrder)
                      .map((step) => {
                        const actions = (detailWorkflow.approvalActions ?? [])
                          .filter((a) => a.stepId === step.id)
                          .sort((a, b) => b.attemptNumber - a.attemptNumber)
                        const lastAction = actions[0] ?? null
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
                                  {lastAction.action === 'APPROVED' ? t('workflows.approvalStepStatus.APPROVED') : t('workflows.approvalStepStatus.REJECTED')} · {new Date(lastAction.createdAt).toLocaleString()}
                                </p>
                              </div>
                            )}
                          </div>
                        )
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
                            <span className={cycle.status === 'COMPLETED' ? 'text-green-600' : 'text-blue-600'}>
                              ({cycle.status === 'COMPLETED' ? t('workflows.detail.cycleCompleted') : t('workflows.detail.cycleInProgress')})
                            </span>
                          </p>
                        )}
                        <div className="space-y-2">
                          {[...cycle.steps]
                            .sort((a, b) => a.stepOrder - b.stepOrder)
                            .map((step) => {
                              const hasContent = (step.notes?.length ?? 0) > 0 || (step.attachments?.length ?? 0) > 0
                              return (
                                <div key={step.id} className="rounded-md border border-border p-3 space-y-2">
                                  <div className="flex items-center gap-2">
                                    <div className="flex items-center justify-center size-5 rounded-full border text-[10px] font-bold shrink-0 text-muted-foreground">
                                      {step.stepOrder}
                                    </div>
                                    <User className="size-3.5 text-muted-foreground shrink-0" />
                                    <span className="text-xs font-medium flex-1 truncate">{userName(step.userId)}</span>
                                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${
                                      step.status === 'COMPLETED' ? 'bg-green-50 text-green-700 border-green-200'
                                      : step.status === 'PENDING'  ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                                      : 'bg-muted text-muted-foreground border-muted-foreground/20'
                                    }`}>
                                      {step.status === 'COMPLETED' ? t('workflows.detail.stepCompleted') : step.status === 'PENDING' ? t('workflows.approvalStepStatus.PENDING') : t('workflows.approvalStepStatus.WAITING')}
                                    </span>
                                  </div>
                                  {step.status === 'COMPLETED' && !hasContent && (
                                    <p className="text-[11px] text-muted-foreground italic pl-7">{t('workflows.detail.noCommentsOrAttachments')}</p>
                                  )}
                                  {(step.notes ?? []).map((note) => (
                                    <div key={note.id} className="ml-7 rounded-md bg-muted/40 border border-border px-2.5 py-2">
                                      <p className="text-xs text-foreground break-words">{note.content}</p>
                                      <p className="text-[10px] text-muted-foreground mt-0.5">{new Date(note.createdAt).toLocaleString()}</p>
                                    </div>
                                  ))}
                                  {(step.attachments ?? []).length > 0 && (
                                    <div className="ml-7 rounded-md border border-border divide-y divide-border">
                                      {(step.attachments ?? []).map((att) => (
                                        <div key={att.id} className="flex items-center gap-2 px-2.5 py-1.5">
                                          <Paperclip className="size-3 text-muted-foreground shrink-0" />
                                          <span className="flex-1 text-xs truncate">{att.originalName}</span>
                                          <Button type="button" variant="ghost" size="icon" className="size-6 shrink-0" onClick={() => handleOpenFile(att.storageKey)}>
                                            <Download className="size-3" />
                                          </Button>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )
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
                    <div className="flex items-center gap-2.5 rounded-md border border-border px-3 py-2.5">
                      <User className="size-3.5 text-muted-foreground shrink-0" />
                      <span className="text-sm">{userName(detailWorkflow.finalUserIds![0])}</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="flex-wrap gap-2 pt-4 shrink-0 border-t border-border mt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setDetailWorkflow(null); openTimeline(detailWorkflow.id) }}
          >
            {t('workflows.actions.viewTimeline')}
          </Button>
          {isCreator && detailWorkflow.status === 'DRAFT' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setDetailWorkflow(null); openEdit(detailWorkflow) }}
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
              {startApprovalMutation.isPending ? t('common.processing') : t('workflows.actions.startApproval')}
            </Button>
          )}
          {canApproveStep && (
            <>
              <Button
                size="sm"
                variant="outline"
                style={{ color: '#dc2626', borderColor: '#dc2626' }}
                onClick={() => { setDetailWorkflow(null); openReject(detailWorkflow) }}
              >
                {t('workflows.actions.reject')}
              </Button>
              <Button
                size="sm"
                onClick={() => { setDetailWorkflow(null); openApprove(detailWorkflow) }}
              >
                {t('workflows.actions.approve')}
              </Button>
            </>
          )}
          {canStartReviewCycle && (
            <Button
              size="sm"
              onClick={() => { setDetailWorkflow(null); openReviewCycle(detailWorkflow) }}
            >
              {t('workflows.actions.startReviewCycle')}
            </Button>
          )}
          {canCompleteAdminStep && (
            <Button
              size="sm"
              onClick={() => { setDetailWorkflow(null); openCompleteStep(detailWorkflow) }}
            >
              {t('workflows.actions.completeStep')}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setDetailWorkflow(null)}>
            {t('common.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
