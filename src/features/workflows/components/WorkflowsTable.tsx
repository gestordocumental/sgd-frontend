import type { ElementType } from 'react'
import { Clock, CheckCircle, XCircle, AlertCircle, FileText, History, MoreHorizontal, Trash2, Play, RotateCcw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { type ApiWorkflow, type WorkflowStatus } from '@/lib/api/workflows'
import type { useWorkflows } from '@/features/workflows/hooks/use-workflows'
import { useAuthStore } from '@/store/authStore'

type WorkflowsHook = ReturnType<typeof useWorkflows>

interface WorkflowsTableProps {
  hook: WorkflowsHook
  canWrite?: boolean
  canApprove?: boolean
}

export function WorkflowsTable({ hook, canWrite = false, canApprove = false }: WorkflowsTableProps) {
  const { t } = useTranslation()
  const { innerTab, setInnerTab } = hook

  return (
    <main className="p-6 space-y-4">
      <Tabs value={innerTab} onValueChange={(v) => setInnerTab(v as typeof innerTab)} className="gap-0">
        <TabsList className="w-fit">
          <TabsTrigger value="all">
            <FileText className="size-4" />{t('workflows.tabs.all')}
          </TabsTrigger>
          <TabsTrigger value="my-tasks">
            <AlertCircle className="size-4" />{t('workflows.tabs.myTasks')}
            {hook.myTasks.length > 0 && (
              <span className="ml-1.5 flex items-center justify-center size-4 rounded-full bg-destructive text-[9px] text-destructive-foreground font-bold">
                {hook.myTasks.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="my-available">
            <CheckCircle className="size-4" />{t('workflows.tabs.myAvailable')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-4">
          <WorkflowList
            workflows={hook.workflows}
            isLoading={hook.workflowsLoading}
            hook={hook}
            canWrite={canWrite}
            canApprove={canApprove}
            emptyKey="workflows.empty"
          />
        </TabsContent>

        <TabsContent value="my-tasks" className="mt-4">
          <WorkflowList
            workflows={hook.myTasks}
            isLoading={hook.myTasksLoading}
            hook={hook}
            canWrite={false}
            canApprove={canApprove}
            emptyKey="workflows.emptyMyTasks"
          />
        </TabsContent>

        <TabsContent value="my-available" className="mt-4">
          <WorkflowList
            workflows={hook.myAvailable}
            isLoading={hook.myAvailableLoading}
            hook={hook}
            canWrite={false}
            canApprove={false}
            emptyKey="workflows.emptyMyAvailable"
          />
        </TabsContent>
      </Tabs>
    </main>
  )
}

// ── WorkflowList ──────────────────────────────────────────────────────────────

interface WorkflowListProps {
  workflows: ApiWorkflow[]
  isLoading: boolean
  hook: WorkflowsHook
  canWrite: boolean
  canApprove: boolean
  emptyKey: string
}

function WorkflowList({ workflows, isLoading, hook, canWrite, canApprove, emptyKey }: WorkflowListProps) {
  const { t } = useTranslation()

  if (isLoading) {
    return (
      <div className="rounded-lg border border-border bg-card overflow-hidden divide-y divide-border">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-4">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-28 ml-auto" />
          </div>
        ))}
      </div>
    )
  }

  if (workflows.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card flex items-center justify-center py-16 text-sm text-muted-foreground">
        {t(emptyKey)}
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden divide-y divide-border">
      {/* Header */}
      <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-5 py-2.5 bg-muted/40">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('workflows.table.title')}</span>
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider w-32">{t('workflows.table.typology')}</span>
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider w-36">{t('workflows.table.status')}</span>
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider w-8" />
      </div>
      {workflows.map((wf) => (
        <WorkflowRow
          key={wf.id}
          workflow={wf}
          hook={hook}
          canWrite={canWrite}
          canApprove={canApprove}
        />
      ))}
    </div>
  )
}

// ── WorkflowRow ───────────────────────────────────────────────────────────────

interface WorkflowRowProps {
  workflow: ApiWorkflow
  hook: WorkflowsHook
  canWrite: boolean
  canApprove: boolean
}

function WorkflowRow({ workflow, hook, canWrite, canApprove }: WorkflowRowProps) {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const isCreator = workflow.createdBy === user?.id
  const isFinalUser = workflow.finalUserIds?.includes(user?.id ?? '') ?? false

  const canStartApproval = isCreator && workflow.status === 'DRAFT'
  const canResubmit = isCreator && workflow.status === 'RETURNED_TO_CREATOR'
  const canDelete = canWrite && isCreator && (workflow.status === 'DRAFT' || workflow.status === 'CANCELLED')
  const canStartReviewCycle = isFinalUser && workflow.status === 'PENDING_REVIEW_CYCLE'
  const canCompleteStep = isFinalUser && workflow.status === 'ADMIN_CYCLE_IN_PROGRESS' && workflow.currentAssignedUserId === user?.id

  return (
    <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 items-center px-5 py-3.5 hover:bg-muted/30 transition-colors">
      {/* Title + description */}
      <div className="min-w-0">
        <button
          type="button"
          className="text-sm font-medium text-left hover:underline truncate block max-w-full"
          onClick={() => hook.setDetailWorkflow(workflow)}
        >
          {workflow.title}
        </button>
        {workflow.description && (
          <p className="text-xs text-muted-foreground truncate">{workflow.description}</p>
        )}
        <p className="text-xs text-muted-foreground mt-0.5">
          {new Date(workflow.createdAt).toLocaleDateString()}
        </p>
      </div>

      {/* Typology */}
      <div className="w-32 min-w-0">
        <p className="text-xs font-mono text-muted-foreground truncate">{workflow.typologyCode}</p>
        <p className="text-xs text-muted-foreground truncate">{workflow.typologyName}</p>
      </div>

      {/* Status badge */}
      <div className="w-36">
        <WorkflowStatusBadge status={workflow.status} />
      </div>

      {/* Actions */}
      <div className="w-8">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8 text-muted-foreground">
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => hook.setDetailWorkflow(workflow)}>
              <FileText className="size-4" />{t('workflows.actions.viewDetail')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => hook.openTimeline(workflow.id)}>
              <History className="size-4" />{t('workflows.actions.viewTimeline')}
            </DropdownMenuItem>
            {canStartApproval && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => hook.startApprovalMutation.mutate(workflow.id)}
                  disabled={hook.startApprovalMutation.isPending}
                >
                  <Play className="size-4" />{t('workflows.actions.startApproval')}
                </DropdownMenuItem>
              </>
            )}
            {canResubmit && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => hook.openResubmit(workflow)}>
                  <RotateCcw className="size-4" />{t('workflows.actions.resubmit')}
                </DropdownMenuItem>
              </>
            )}
            {canStartReviewCycle && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => hook.openReviewCycle(workflow)}>
                  <Play className="size-4" />Iniciar revisión
                </DropdownMenuItem>
              </>
            )}
            {canCompleteStep && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => hook.openCompleteStep(workflow)}>
                  <CheckCircle className="size-4" />Completar paso de revisión
                </DropdownMenuItem>
              </>
            )}
            {canDelete && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => hook.setDeleteWorkflow(workflow)}
                >
                  <Trash2 className="size-4" />{t('workflows.actions.delete')}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

// ── WorkflowStatusBadge ───────────────────────────────────────────────────────

const STATUS_CONFIG: Record<WorkflowStatus, { icon: ElementType; className: string; key: string }> = {
  DRAFT:                      { icon: FileText,     className: 'bg-muted text-muted-foreground border-muted-foreground/30',             key: 'workflows.status.DRAFT' },
  PENDING_APPROVAL:           { icon: Clock,        className: 'bg-yellow-50 text-yellow-700 border-yellow-200',                        key: 'workflows.status.PENDING_APPROVAL' },
  RETURNED_TO_CREATOR:        { icon: XCircle,      className: 'bg-red-50 text-red-700 border-red-200',                                 key: 'workflows.status.RETURNED_TO_CREATOR' },
  PENDING_REVIEW_CYCLE:       { icon: Clock,        className: 'bg-purple-50 text-purple-700 border-purple-200',                        key: 'workflows.status.PENDING_REVIEW_CYCLE' },
  AVAILABLE_FOR_FINAL_USERS:  { icon: CheckCircle,  className: 'bg-green-50 text-green-700 border-green-200',                           key: 'workflows.status.AVAILABLE_FOR_FINAL_USERS' },
  ADMIN_CYCLE_IN_PROGRESS:    { icon: AlertCircle,  className: 'bg-blue-50 text-blue-700 border-blue-200',                              key: 'workflows.status.ADMIN_CYCLE_IN_PROGRESS' },
  CLOSED:                     { icon: CheckCircle,  className: 'bg-slate-100 text-slate-600 border-slate-300',                          key: 'workflows.status.CLOSED' },
  CANCELLED:                  { icon: XCircle,      className: 'bg-gray-50 text-gray-500 border-gray-200',                              key: 'workflows.status.CANCELLED' },
}

export function WorkflowStatusBadge({ status }: { status: WorkflowStatus }) {
  const { t } = useTranslation()
  const config = STATUS_CONFIG[status]
  const Icon = config.icon
  return (
    <Badge variant="outline" className={`gap-1 text-xs ${config.className}`}>
      <Icon className="size-3" />
      {t(config.key)}
    </Badge>
  )
}
