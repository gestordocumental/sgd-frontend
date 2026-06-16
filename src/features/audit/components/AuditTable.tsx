import { useState, useRef, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  Eye,
  Download,
  Copy,
  Filter,
  RefreshCw,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { TableCell, TableHead, TableRow } from '@/components/ui/table';
import { RefreshCountdown } from '@/components/ui/refresh-countdown';
import { AuditExportModal } from './AuditExportModal';
import { AuditDetailModal } from './AuditDetailModal';
import {
  type AuditHook,
  type AuditLog,
  type SimpleUser,
  RESOURCE_TYPES,
  CORRELATION_RESOURCE_TYPES,
  ALL_ACTIONS,
  formatDate,
  formatAction,
  resourceTypeColor,
  formatResourceType,
  resolveResourceName,
} from './audit-table.utils';
import { useActorName } from '../hooks/use-actor-name';

function ActorCell({ actorId, users }: { actorId: string; users: SimpleUser[] }) {
  const name = useActorName(actorId, users);
  return <>{name}</>;
}

interface AuditTableProps {
  hook: AuditHook;
  users?: SimpleUser[];
  companyId?: string;
}

export function AuditTable({ hook, users = [], companyId }: AuditTableProps) {
  const { t } = useTranslation();
  const {
    logs,
    total,
    page,
    limit,
    isLoading,
    isFetching,
    dataUpdatedAt,
    filters,
    applyFilters,
    clearFilters,
    setPage,
    refresh,
  } = hook;

  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [exportOpen, setExportOpen] = useState(false);

  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: logs.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 48,
    overscan: 8,
  });

  useEffect(() => {
    parentRef.current?.scrollTo({ top: 0 });
  }, [page, filters]);

  function isoToLocal(iso: string | undefined): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  const [draft, setDraft] = useState({
    action: filters.action ?? '',
    resourceType: filters.resourceType ?? '',
    actorId: filters.actorId ?? '',
    correlationId: filters.correlationId ?? '',
    from: isoToLocal(filters.from),
    to: isoToLocal(filters.to),
  });

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const hasFilters = Object.values(filters).some(Boolean);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    applyFilters({
      action: draft.action || undefined,
      resourceType: draft.resourceType || undefined,
      actorId: draft.actorId || undefined,
      correlationId: draft.correlationId || undefined,
      from: draft.from ? new Date(draft.from).toISOString() : undefined,
      to: draft.to ? new Date(draft.to).toISOString() : undefined,
    });
  }

  function handleClear() {
    setDraft({ action: '', resourceType: '', actorId: '', correlationId: '', from: '', to: '' });
    clearFilters();
  }

  return (
    <main className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">{t('audit.title')}</h2>
          <div className="flex flex-col items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={refresh}
              disabled={isFetching}
              title={t('common.refresh')}
              aria-label={t('common.refresh')}
            >
              <RefreshCw
                className={`size-3.5 text-muted-foreground ${isFetching ? 'animate-spin' : ''}`}
              />
            </Button>
            <RefreshCountdown duration={60_000} isFetching={isFetching} updatedAt={dataUpdatedAt} />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            {total} {t('audit.events')}
          </span>
          <Button variant="outline" size="sm" className="h-8" onClick={() => setExportOpen(true)}>
            <Download className="size-3.5" />
            {t('audit.export.button')}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <form onSubmit={handleSearch} className="flex flex-wrap gap-2 items-end">
        <div className="flex flex-col gap-1">
          <label htmlFor="audit-filter-action" className="text-xs text-muted-foreground">
            {t('audit.filters.action')}
          </label>
          <select
            id="audit-filter-action"
            className="h-8 w-52 text-xs rounded-md border border-input bg-background px-2 focus:outline-none focus:ring-1 focus:ring-ring"
            value={draft.action}
            onChange={(e) => setDraft((d) => ({ ...d, action: e.target.value }))}
          >
            <option value="">{t('audit.filters.all')}</option>
            {ALL_ACTIONS.map((a) => (
              <option key={a} value={a}>
                {formatAction(a, t)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="audit-filter-resource-type" className="text-xs text-muted-foreground">
            {t('audit.filters.resourceType')}
          </label>
          <select
            id="audit-filter-resource-type"
            className="h-8 w-36 text-xs rounded-md border border-input bg-background px-2 focus:outline-none focus:ring-1 focus:ring-ring"
            value={draft.resourceType}
            onChange={(e) => setDraft((d) => ({ ...d, resourceType: e.target.value }))}
          >
            <option value="">{t('audit.filters.all')}</option>
            {RESOURCE_TYPES.map((r) => (
              <option key={r} value={r}>
                {formatResourceType(r, t)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="audit-filter-actor" className="text-xs text-muted-foreground">
            {t('audit.filters.actor')}
          </label>
          <select
            id="audit-filter-actor"
            className="h-8 w-44 text-xs rounded-md border border-input bg-background px-2 focus:outline-none focus:ring-1 focus:ring-ring"
            value={draft.actorId}
            onChange={(e) => setDraft((d) => ({ ...d, actorId: e.target.value }))}
          >
            <option value="">{t('audit.filters.all')}</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {[u.firstName, u.lastName].filter(Boolean).join(' ') || u.email || u.id}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="audit-filter-correlation-id" className="text-xs text-muted-foreground">
            {t('audit.filters.correlationId')}
          </label>
          <Input
            id="audit-filter-correlation-id"
            className="h-8 w-72 text-xs font-mono"
            placeholder={t('audit.filters.correlationIdPlaceholder')}
            value={draft.correlationId}
            onChange={(e) => setDraft((d) => ({ ...d, correlationId: e.target.value }))}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="audit-filter-from" className="text-xs text-muted-foreground">
            {t('audit.filters.from')}
          </label>
          <Input
            id="audit-filter-from"
            className="h-8 w-40 text-xs"
            type="datetime-local"
            value={draft.from}
            onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="audit-filter-to" className="text-xs text-muted-foreground">
            {t('audit.filters.to')}
          </label>
          <Input
            id="audit-filter-to"
            className="h-8 w-40 text-xs"
            type="datetime-local"
            value={draft.to}
            onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))}
          />
        </div>
        <Button type="submit" size="sm" className="h-8">
          <Search className="size-3.5" />
          {t('common.search')}
        </Button>
        {hasFilters && (
          <Button type="button" size="sm" variant="ghost" className="h-8" onClick={handleClear}>
            <X className="size-3.5" />
            {t('common.clear')}
          </Button>
        )}
      </form>

      {/* Table */}
      <div
        ref={parentRef}
        className="rounded-md border overflow-y-auto overflow-x-auto"
        style={{ maxHeight: 'calc(100vh - 360px)' }}
      >
        <table className="w-full caption-bottom text-sm">
          <thead className="sticky top-0 z-10 bg-background [&_tr]:border-b">
            <TableRow>
              <TableHead>{t('audit.columns.timestamp')}</TableHead>
              <TableHead>{t('audit.columns.action')}</TableHead>
              <TableHead>{t('audit.columns.resourceType')}</TableHead>
              <TableHead>{t('audit.columns.resource')}</TableHead>
              <TableHead>{t('audit.columns.actor')}</TableHead>
              <TableHead>{t('audit.columns.correlationId')}</TableHead>
              <TableHead />
            </TableRow>
          </thead>
          <tbody className="[&_tr:last-child]:border-0">
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-10 text-sm">
                  {t('audit.empty')}
                </TableCell>
              </TableRow>
            ) : (
              (() => {
                const virtualItems = rowVirtualizer.getVirtualItems();
                const totalSize = rowVirtualizer.getTotalSize();
                const paddingTop = virtualItems.length > 0 ? virtualItems[0].start : 0;
                const paddingBottom =
                  virtualItems.length > 0
                    ? totalSize - virtualItems[virtualItems.length - 1].end
                    : 0;
                return (
                  <>
                    {paddingTop > 0 && (
                      <tr style={{ height: paddingTop }}>
                        <td colSpan={7} style={{ padding: 0, border: 'none' }} />
                      </tr>
                    )}
                    {virtualItems.map((vr) => {
                      const log = logs[vr.index];
                      return (
                        <TableRow key={log.id}>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {formatDate(log.timestamp)}
                          </TableCell>
                          <TableCell className="text-xs">{formatAction(log.action, t)}</TableCell>
                          <TableCell>
                            <span
                              className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${resourceTypeColor(log.resourceType)}`}
                            >
                              {formatResourceType(log.resourceType, t)}
                            </span>
                          </TableCell>
                          <TableCell
                            className="text-xs text-muted-foreground max-w-[160px] truncate"
                            title={log.resourceId}
                          >
                            {resolveResourceName(log)}
                          </TableCell>
                          <TableCell
                            className="text-xs text-muted-foreground max-w-[160px] truncate"
                            title={log.actorId}
                          >
                            <ActorCell actorId={log.actorId} users={users} />
                          </TableCell>
                          <TableCell className="text-xs">
                            {CORRELATION_RESOURCE_TYPES.has(log.resourceType) &&
                            log.correlationId ? (
                              <span className="flex items-center gap-1 min-w-0">
                                <span
                                  className="font-mono text-[11px] text-muted-foreground truncate max-w-[100px]"
                                  title={log.correlationId}
                                >
                                  {log.correlationId.slice(0, 8)}…
                                </span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-5 w-5 p-0 shrink-0"
                                  title={t('audit.detail.copy')}
                                  aria-label={t('audit.detail.copy')}
                                  onClick={() => {
                                    if (!navigator.clipboard?.writeText) return;
                                    void navigator.clipboard
                                      .writeText(log.correlationId!)
                                      .catch(() => undefined);
                                  }}
                                >
                                  <Copy className="size-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-5 w-5 p-0 shrink-0"
                                  title={t('audit.detail.filterByCorrelation')}
                                  aria-label={t('audit.detail.filterByCorrelation')}
                                  onClick={() => {
                                    const correlationOnly = {
                                      action: '',
                                      resourceType: '',
                                      actorId: '',
                                      correlationId: log.correlationId!,
                                      from: '',
                                      to: '',
                                    };
                                    setDraft(correlationOnly);
                                    applyFilters({ correlationId: log.correlationId! });
                                  }}
                                >
                                  <Filter className="size-3" />
                                </Button>
                              </span>
                            ) : (
                              <span className="text-muted-foreground/40">—</span>
                            )}
                          </TableCell>
                          <TableCell className="w-8">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => setSelectedLog(log)}
                              title={t('audit.detail.view')}
                              aria-label={t('audit.detail.view')}
                            >
                              <Eye className="size-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {paddingBottom > 0 && (
                      <tr style={{ height: paddingBottom }}>
                        <td colSpan={7} style={{ padding: 0, border: 'none' }} />
                      </tr>
                    )}
                  </>
                );
              })()
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
        <span>
          {total} {t('audit.events')}
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            disabled={page <= 1}
            aria-label={t('common.previous')}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft className="size-3.5" />
          </Button>
          <span className="px-2">
            {page} / {totalPages}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            disabled={page >= totalPages}
            aria-label={t('common.next')}
            onClick={() => setPage((p) => p + 1)}
          >
            <ChevronRight className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Detail modal */}
      {selectedLog && (
        <AuditDetailModal
          log={selectedLog}
          users={users}
          companyId={companyId}
          open={!!selectedLog}
          onClose={() => setSelectedLog(null)}
          onFilterByCorrelation={(correlationId) => {
            setDraft({
              action: '',
              resourceType: '',
              actorId: '',
              correlationId,
              from: '',
              to: '',
            });
            applyFilters({ correlationId });
          }}
        />
      )}

      {/* Export modal */}
      <AuditExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        companyId={companyId}
        defaultFrom={filters.from}
        defaultTo={filters.to}
        defaultCorrelationId={filters.correlationId}
        users={users}
      />
    </main>
  );
}
