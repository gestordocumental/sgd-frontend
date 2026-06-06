import { useMemo, useEffect, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { ElementType, CSSProperties } from 'react';
import {
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  FileText,
  History,
  MoreHorizontal,
  Trash2,
  Play,
  Plus,
  Copy,
  Search,
  RefreshCw,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Pager } from '@/components/ui/pager';
import { RefreshCountdown } from '@/components/ui/refresh-countdown';
import { type ApiWorkflow, type WorkflowStatus } from '@/lib/api/workflows';
import type { useWorkflows } from '@/features/workflows/hooks/use-workflows';
import { useAuthStore } from '@/store/authStore';
import { getWorkflowActions } from '@/features/workflows/workflow-state-machine';

type WorkflowsHook = ReturnType<typeof useWorkflows>;

interface WorkflowsTableProps {
  hook: WorkflowsHook;
  canWrite?: boolean;
  canApprove?: boolean;
  canManage?: boolean;
}

export function WorkflowsTable({
  hook,
  canWrite = false,
  canApprove = false,
  canManage = false,
}: WorkflowsTableProps) {
  const { t } = useTranslation();
  const { innerTab, setInnerTab, statusFilter, setStatusFilter, search, setSearch, page, setPage } =
    hook.dialogs;
  const {
    workflows,
    workflowsLoading,
    workflowsTotal,
    workflowsTotalPages,
    myTasks,
    myTasksLoading,
    myAvailable,
    myAvailableLoading,
    isRefreshing,
    workflowsDataUpdatedAt,
    invalidateAll,
  } = hook.queries;
  const { openCreate } = hook.actions;

  // If the user has no MANAGE permission, redirect away from the 'all' tab
  useEffect(() => {
    if (!canManage && innerTab === 'all') setInnerTab('my-tasks');
  }, [canManage, innerTab, setInnerTab]);

  const STATUS_OPTIONS = useMemo(
    () => [
      { value: 'all', label: t('common.all') },
      { value: 'DRAFT', label: t('workflows.status.DRAFT') },
      { value: 'PENDING_APPROVAL', label: t('workflows.status.PENDING_APPROVAL') },
      { value: 'REJECTED', label: t('workflows.status.REJECTED') },
      { value: 'PENDING_REVIEW_CYCLE', label: t('workflows.status.PENDING_REVIEW_CYCLE') },
      {
        value: 'AVAILABLE_FOR_FINAL_USERS',
        label: t('workflows.status.AVAILABLE_FOR_FINAL_USERS'),
      },
      { value: 'ADMIN_CYCLE_IN_PROGRESS', label: t('workflows.status.ADMIN_CYCLE_IN_PROGRESS') },
      { value: 'CLOSED', label: t('workflows.status.CLOSED') },
      { value: 'CANCELLED', label: t('workflows.status.CANCELLED') },
    ],
    [t],
  );

  // Search and pagination are server-side; workflows already contains the current page slice.
  const totalPages = workflowsTotalPages;

  return (
    <main className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">{t('dashboard.workflows')}</h2>
          <div className="flex flex-col items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={invalidateAll}
              disabled={isRefreshing}
              title={t('common.refresh')}
            >
              <RefreshCw
                className={`size-3.5 text-muted-foreground ${isRefreshing ? 'animate-spin' : ''}`}
              />
            </Button>
            <RefreshCountdown
              duration={30_000}
              isFetching={isRefreshing}
              updatedAt={workflowsDataUpdatedAt}
            />
          </div>
        </div>
        {canWrite && (
          <Button size="sm" onClick={openCreate}>
            <Plus className="size-4" />
            {t('dashboard.newWorkflow')}
          </Button>
        )}
      </div>
      <Tabs
        value={innerTab}
        onValueChange={(v) => {
          setInnerTab(v as typeof innerTab);
          setPage(1);
        }}
        className="gap-0"
      >
        <TabsList className="w-fit">
          {canManage && (
            <TabsTrigger value="all">
              <FileText className="size-4" />
              {t('workflows.tabs.all')}
            </TabsTrigger>
          )}
          <TabsTrigger value="my-tasks">
            <AlertCircle className="size-4" />
            {t('workflows.tabs.myTasks')}
            {myTasks.length > 0 && (
              <span
                data-testid="my-tasks-badge"
                className="ml-1.5 flex items-center justify-center size-4 rounded-full text-[9px] text-white font-bold bg-brand"
              >
                {myTasks.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="my-available">
            <CheckCircle className="size-4" />
            {t('workflows.tabs.myAvailable')}
          </TabsTrigger>
        </TabsList>

        {canManage && (
          <TabsContent value="all" className="mt-4 space-y-3">
            {/* Filters bar */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('common.search')}
                  className="h-8 pl-8 w-52 text-sm"
                />
              </div>
              <select
                value={statusFilter ?? 'all'}
                onChange={(e) =>
                  setStatusFilter(
                    e.target.value === 'all' ? undefined : (e.target.value as WorkflowStatus),
                  )
                }
                className="h-8 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring"
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <WorkflowList
              workflows={workflows ?? []}
              isLoading={workflowsLoading}
              hook={hook}
              canWrite={canWrite}
              canApprove={canApprove}
              emptyKey={search || statusFilter ? 'common.noResults' : 'workflows.empty'}
            />
            {totalPages > 1 && (
              <Pager
                page={page}
                totalPages={totalPages}
                total={workflowsTotal}
                onChange={setPage}
                className="px-1 py-2"
              />
            )}
          </TabsContent>
        )}

        <TabsContent value="my-tasks" className="mt-4">
          <WorkflowList
            workflows={myTasks}
            isLoading={myTasksLoading}
            hook={hook}
            canWrite={false}
            canApprove={canApprove}
            emptyKey="workflows.emptyMyTasks"
          />
        </TabsContent>

        <TabsContent value="my-available" className="mt-4">
          <WorkflowList
            workflows={myAvailable}
            isLoading={myAvailableLoading}
            hook={hook}
            canWrite={false}
            canApprove={false}
            emptyKey="workflows.emptyMyAvailable"
          />
        </TabsContent>
      </Tabs>
    </main>
  );
}

// ── WorkflowList ──────────────────────────────────────────────────────────────

interface WorkflowListProps {
  workflows: ApiWorkflow[];
  isLoading: boolean;
  hook: WorkflowsHook;
  canWrite: boolean;
  canApprove: boolean;
  emptyKey: string;
}

function WorkflowList({
  workflows,
  isLoading,
  hook,
  canWrite,
  canApprove,
  emptyKey,
}: WorkflowListProps) {
  const { t } = useTranslation();
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: workflows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 65,
    overscan: 5,
  });

  // Reset scroll position when the dataset changes (page navigation, filter change)
  useEffect(() => {
    parentRef.current?.scrollTo({ top: 0 });
  }, [workflows]);

  if (isLoading) {
    return (
      <div
        data-testid="workflow-skeleton"
        className="rounded-lg border border-border bg-card overflow-hidden divide-y divide-border"
      >
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-4">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-28 ml-auto" />
          </div>
        ))}
      </div>
    );
  }

  if (workflows.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card flex items-center justify-center py-16 text-sm text-muted-foreground">
        {t(emptyKey)}
      </div>
    );
  }

  const virtualItems = rowVirtualizer.getVirtualItems();

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {/* Sticky column header */}
      <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-5 py-2.5 bg-muted/40 border-b border-border">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {t('workflows.table.title')}
        </span>
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider w-32">
          {t('workflows.table.typology')}
        </span>
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider w-36">
          {t('workflows.table.status')}
        </span>
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider w-28">
          {t('audit.columns.correlationId')}
        </span>
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider w-8" />
      </div>
      {/* Virtualized rows */}
      <div ref={parentRef} className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 260px)' }}>
        <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }}>
          {virtualItems.map((vr) => (
            <div
              key={workflows[vr.index].id}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${vr.start}px)`,
              }}
            >
              <WorkflowRow
                workflow={workflows[vr.index]}
                hook={hook}
                canWrite={canWrite}
                canApprove={canApprove}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── WorkflowRow ───────────────────────────────────────────────────────────────

interface WorkflowRowProps {
  workflow: ApiWorkflow;
  hook: WorkflowsHook;
  canWrite: boolean;
  canApprove: boolean;
}

function WorkflowRow({ workflow, hook, canWrite, canApprove }: WorkflowRowProps) {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const { setDetailWorkflow, setDeleteWorkflow } = hook.dialogs;
  const { startApprovalMutation } = hook.mutations;
  const { openTimeline, openReviewCycle, openCompleteStep, openForwardStep } = hook.actions;
  const {
    canStartApproval,
    canDelete,
    canStartReviewCycle,
    canCompleteAdminStep: canCompleteStep,
    canForwardAdminStep: canForwardStep,
  } = getWorkflowActions(workflow, { userId: user?.id, canWrite, canApprove });

  return (
    <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 items-center px-5 py-3.5 hover:bg-muted/30 transition-colors border-b border-border">
      {/* Title + description */}
      <div className="min-w-0">
        <button
          type="button"
          className="text-sm font-medium text-left hover:underline truncate block max-w-full"
          onClick={() => setDetailWorkflow(workflow)}
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

      {/* Correlation ID */}
      <div className="w-28 flex items-center gap-1 min-w-0">
        <span className="font-mono text-[11px] text-muted-foreground truncate" title={workflow.id}>
          {workflow.id.slice(0, 8)}…
        </span>
        <button
          type="button"
          className="inline-flex items-center justify-center size-5 rounded text-muted-foreground hover:bg-accent hover:text-accent-foreground shrink-0"
          aria-label={t('audit.detail.copy')}
          title={t('audit.detail.copy')}
          onClick={() => {
            navigator.clipboard.writeText(workflow.id).catch(() => undefined);
          }}
        >
          <Copy className="size-3" />
        </button>
      </div>

      {/* Actions */}
      <div className="w-8">
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={t('workflows.actions.openMenu')}
            className="inline-flex items-center justify-center size-8 rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            <MoreHorizontal className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setDetailWorkflow(workflow)}>
              <FileText className="size-4" />
              {t('workflows.actions.viewDetail')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => openTimeline(workflow.id)}>
              <History className="size-4" />
              {t('workflows.actions.viewTimeline')}
            </DropdownMenuItem>
            {canStartApproval && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => startApprovalMutation.mutate(workflow.id)}
                  disabled={startApprovalMutation.isPending}
                >
                  <Play className="size-4" />
                  {t('workflows.actions.startApproval')}
                </DropdownMenuItem>
              </>
            )}
            {canStartReviewCycle && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => openReviewCycle(workflow)}>
                  <Play className="size-4" />
                  {t('workflows.actions.startReviewCycle')}
                </DropdownMenuItem>
              </>
            )}
            {canCompleteStep && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => openCompleteStep(workflow)}>
                  <CheckCircle className="size-4" />
                  {t('workflows.actions.completeReviewStep')}
                </DropdownMenuItem>
                {canForwardStep && (
                  <DropdownMenuItem onClick={() => openForwardStep(workflow)}>
                    <Play className="size-4" />
                    {t('workflows.actions.forwardStep')}
                  </DropdownMenuItem>
                )}
              </>
            )}
            {canDelete && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => setDeleteWorkflow(workflow)}
                >
                  <Trash2 className="size-4" />
                  {t('workflows.actions.delete')}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

// ── WorkflowStatusBadge ───────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  WorkflowStatus,
  { icon: ElementType; className: string; key: string; style?: CSSProperties }
> = {
  DRAFT: {
    icon: FileText,
    className: 'bg-muted text-muted-foreground border-muted-foreground/30',
    key: 'workflows.status.DRAFT',
  },
  PENDING_APPROVAL: {
    icon: Clock,
    className: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    key: 'workflows.status.PENDING_APPROVAL',
  },
  RETURNED_TO_CREATOR: {
    icon: XCircle,
    className: 'bg-red-50 text-red-700 border-red-200',
    key: 'workflows.status.RETURNED_TO_CREATOR',
  },
  REJECTED: {
    icon: XCircle,
    className: 'bg-red-50 text-red-700 border-red-200',
    key: 'workflows.status.REJECTED',
  },
  PENDING_REVIEW_CYCLE: {
    icon: Clock,
    className: 'bg-purple-50 text-purple-700 border-purple-200',
    key: 'workflows.status.PENDING_REVIEW_CYCLE',
  },
  AVAILABLE_FOR_FINAL_USERS: {
    icon: CheckCircle,
    className: 'bg-green-50 text-green-700 border-green-200',
    key: 'workflows.status.AVAILABLE_FOR_FINAL_USERS',
  },
  ADMIN_CYCLE_IN_PROGRESS: {
    icon: AlertCircle,
    className: 'bg-blue-50 text-blue-700 border-blue-200',
    key: 'workflows.status.ADMIN_CYCLE_IN_PROGRESS',
  },
  CLOSED: {
    icon: CheckCircle,
    className: 'bg-slate-100 text-slate-600 border-slate-300',
    key: 'workflows.status.CLOSED',
  },
  CANCELLED: {
    icon: XCircle,
    className: 'bg-gray-50 text-gray-500 border-gray-200',
    key: 'workflows.status.CANCELLED',
  },
};

export function WorkflowStatusBadge({ status }: { status: WorkflowStatus }) {
  const { t } = useTranslation();
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.DRAFT;
  const Icon = config.icon;
  return (
    <Badge variant="outline" className={`gap-1 text-xs ${config.className}`} style={config.style}>
      <Icon className="size-3" />
      {t(config.key)}
    </Badge>
  );
}
