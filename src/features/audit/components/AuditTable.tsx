import { useState } from 'react'
import { Search, X, ChevronLeft, ChevronRight, Eye, Download, Copy, Filter } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { AuditExportModal } from './AuditExportModal'
import type { useAudit } from '../hooks/use-audit'

const RESOURCE_TYPES = [
  'user',
  'cargo',
  'area',
  'departamento',
  'typology',
  'workflow',
]

const CORRELATION_RESOURCE_TYPES = new Set(['typology', 'workflow'])

const ACTIONS_BY_SERVICE: Record<string, string[]> = {
  'user-service': [
    'USER_CREATED',
    'USER_UPDATED',
    'USER_DELETED',
    'USER_RESTORED',
    'USER_ORG_ASSIGNED',
    'USER_ORG_ROLE_UPDATED',
    'USER_REMOVED_FROM_ORG',
    'USER_SUPER_ADMIN_CHANGED',
  ],
  'org-service': [
    'DEPARTAMENTO_CREATED',
    'DEPARTAMENTO_UPDATED',
    'DEPARTAMENTO_DELETED',
    'DEPARTAMENTO_RESTORED',
    'AREA_CREATED',
    'AREA_UPDATED',
    'AREA_DELETED',
    'AREA_RESTORED',
    'CARGO_CREATED',
    'CARGO_UPDATED',
    'CARGO_DELETED',
    'CARGO_RESTORED',
  ],
  'document-service': [
    'TYPOLOGY_CREATED',
    'TYPOLOGY_UPDATED',
    'TYPOLOGY_DELETED',
    'TYPOLOGY_VERSION_CREATED',
    'TYPOLOGY_DOCUMENT_UPLOADED',
    'TYPOLOGY_EXTRACTION_RETRIED',
    'TYPOLOGY_DISCREPANCY_RESOLVED',
  ],
  'workflow-service': [
    'WORKFLOW_CREATED',
    'WORKFLOW_UPDATED',
    'APPROVAL_STARTED',
    'STEP_APPROVED',
    'STEP_REJECTED',
    'WORKFLOW_RETURNED_TO_CREATOR',
    'WORKFLOW_RESUBMITTED',
    'WORKFLOW_APPROVED',
    'ATTACHMENT_ADDED',
    'NOTE_ADDED',
    'ADMIN_CYCLE_STARTED',
    'ADMIN_STEP_COMPLETED',
    'ADMIN_CYCLE_COMPLETED',
    'WORKFLOW_CLOSED',
    'WORKFLOW_CANCELLED',
  ],
  'audit-service': [],
}

const ALL_ACTIONS = Array.from(new Set(Object.values(ACTIONS_BY_SERVICE).flat())).sort()

type AuditHook = ReturnType<typeof useAudit>
type AuditLog = AuditHook['logs'][number]

interface SimpleUser {
  id: string
  firstName?: string | null
  lastName?: string | null
  email?: string | null
}

interface AuditTableProps {
  hook: AuditHook
  users?: SimpleUser[]
}

function resolveActorName(actorId: string, users: SimpleUser[]): string {
  const u = users.find((u) => u.id === actorId)
  if (!u) return actorId
  const name = [u.firstName, u.lastName].filter(Boolean).join(' ').trim()
  return name || u.email || actorId
}

type TFn = (key: string, opts?: Record<string, unknown>) => string

function formatAction(action: string, t: TFn): string {
  return String(t(`audit.actions.${action}`, { defaultValue: action.replace(/_/g, ' ') }))
}

function formatFieldName(field: string, t: TFn): string {
  return String(t(`audit.fields.${field}`, { defaultValue: field }))
}

const RESOURCE_TYPE_COLORS: Record<string, string> = {
  user:         'bg-blue-100 text-blue-800',
  cargo:        'bg-purple-100 text-purple-800',
  area:         'bg-violet-100 text-violet-800',
  departamento: 'bg-indigo-100 text-indigo-800',
  typology:     'bg-green-100 text-green-800',
  workflow:     'bg-orange-100 text-orange-800',
}

function resourceTypeColor(type: string) {
  return RESOURCE_TYPE_COLORS[type] ?? 'bg-muted text-muted-foreground'
}

function formatResourceType(type: string, t: TFn): string {
  return String(t(`audit.resourceTypes.${type}`, { defaultValue: type }))
}

function resolveResourceName(log: { resourceId: string; resourceName?: string | null; metadata: Record<string, unknown> | null }): string {
  if (log.resourceName) return log.resourceName
  const m = log.metadata
  if (m) {
    const name = (m['name'] ?? m['email'] ?? m['title']) as string | undefined
    if (name) return name
  }
  return log.resourceId
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

// ── Modal de detalle ──────────────────────────────────────────────────────────

function AuditDetailModal({
  log,
  users,
  open,
  onClose,
  onFilterByCorrelation,
}: {
  log: AuditLog
  users: SimpleUser[]
  open: boolean
  onClose: () => void
  onFilterByCorrelation: (correlationId: string) => void
}) {
  const { t } = useTranslation()
  const changes = (log.metadata?.['changes'] ?? null) as Record<string, { from: unknown; to: unknown }> | null

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-lg w-full overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-sm">{t('audit.detail.title')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm overflow-y-auto max-h-[70vh]">
          {/* Campos principales */}
          <div className="grid grid-cols-[120px_1fr] gap-x-4 gap-y-2 min-w-0">
            <span className="text-muted-foreground whitespace-nowrap">{t('audit.columns.timestamp')}</span>
            <span className="break-words">{formatDate(log.timestamp)}</span>

            <span className="text-muted-foreground whitespace-nowrap">{t('audit.columns.action')}</span>
            <span className="font-medium break-words">{formatAction(log.action, t)}</span>

            <span className="text-muted-foreground whitespace-nowrap">{t('audit.columns.resourceType')}</span>
            <span>
              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${resourceTypeColor(log.resourceType)}`}>
                {formatResourceType(log.resourceType, t)}
              </span>
            </span>

            <span className="text-muted-foreground whitespace-nowrap">{t('audit.columns.resource')}</span>
            <span className="break-words">{resolveResourceName(log)}</span>

            <span className="text-muted-foreground whitespace-nowrap">{t('audit.columns.actor')}</span>
            <span className="break-words">{resolveActorName(log.actorId, users)}</span>

            {log.ip && (
              <>
                <span className="text-muted-foreground whitespace-nowrap">{t('audit.columns.ip')}</span>
                <span className="font-mono text-xs break-all">{log.ip}</span>
              </>
            )}

            {log.correlationId && (
              <>
                <span className="text-muted-foreground whitespace-nowrap">{t('audit.columns.correlationId')}</span>
                <span className="flex items-center gap-1 min-w-0">
                  <span className="font-mono text-xs truncate min-w-0">{log.correlationId}</span>
                  <Button
                    variant="ghost" size="sm" className="h-5 w-5 p-0 shrink-0"
                    title={t('audit.detail.copy')}
                    onClick={() => navigator.clipboard.writeText(log.correlationId!)}
                  >
                    <Copy className="size-3" />
                  </Button>
                  <Button
                    variant="ghost" size="sm" className="h-5 w-5 p-0 shrink-0"
                    title={t('audit.detail.filterByCorrelation')}
                    onClick={() => { onFilterByCorrelation(log.correlationId!); onClose() }}
                  >
                    <Filter className="size-3" />
                  </Button>
                </span>
              </>
            )}
          </div>

          {/* Cambios (solo en UPDATE) */}
          {changes && Object.keys(changes).length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {t('audit.detail.changes')}
              </p>
              <div className="rounded-md border divide-y">
                {Object.entries(changes).map(([field, { from, to }]) => {
                  const isComplex = from === null && to === null
                  return (
                    <div key={field} className="px-3 py-2 space-y-1">
                      <p className="text-xs font-medium">{formatFieldName(field, t)}</p>
                      {isComplex ? (
                        <p className="text-xs text-muted-foreground">{t('audit.detail.modified')}</p>
                      ) : (
                        <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-2 text-xs min-w-0">
                          <span className="line-through text-red-500/80 break-words">{from == null || from === '' ? '—' : String(from)}</span>
                          <span className="text-muted-foreground shrink-0">→</span>
                          <span className="text-green-600 break-words">{to == null || to === '' ? '—' : String(to)}</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Tabla principal ───────────────────────────────────────────────────────────

export function AuditTable({ hook, users = [] }: AuditTableProps) {
  const { t } = useTranslation()
  const { logs, total, page, limit, isLoading, filters, applyFilters, clearFilters, setPage } = hook

  const [selectedLog,   setSelectedLog]   = useState<AuditLog | null>(null)
  const [exportOpen,    setExportOpen]    = useState(false)

  function isoToLocal(iso: string | undefined): string {
    if (!iso) return ''
    const d = new Date(iso)
    if (isNaN(d.getTime())) return ''
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  const [draft, setDraft] = useState({
    action:        filters.action        ?? '',
    resourceType:  filters.resourceType  ?? '',
    actorId:       filters.actorId       ?? '',
    correlationId: filters.correlationId ?? '',
    from:          isoToLocal(filters.from),
    to:            isoToLocal(filters.to),
  })

  const totalPages = Math.max(1, Math.ceil(total / limit))
  const hasFilters = Object.values(filters).some(Boolean)

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    applyFilters({
      action:        draft.action        || undefined,
      resourceType:  draft.resourceType  || undefined,
      actorId:       draft.actorId       || undefined,
      correlationId: draft.correlationId || undefined,
      from:          draft.from          ? new Date(draft.from).toISOString() : undefined,
      to:            draft.to            ? new Date(draft.to).toISOString()   : undefined,
    })
  }

  function handleClear() {
    setDraft({ action: '', resourceType: '', actorId: '', correlationId: '', from: '', to: '' })
    clearFilters()
  }

  return (
    <main className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">{t('audit.title')}</h2>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">{total} {t('audit.events')}</span>
          <Button variant="outline" size="sm" className="h-8" onClick={() => setExportOpen(true)}>
            <Download className="size-3.5" />{t('audit.export.button')}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <form onSubmit={handleSearch} className="flex flex-wrap gap-2 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">{t('audit.filters.action')}</label>
          <select
            className="h-8 w-52 text-xs rounded-md border border-input bg-background px-2 focus:outline-none focus:ring-1 focus:ring-ring"
            value={draft.action}
            onChange={(e) => setDraft((d) => ({ ...d, action: e.target.value }))}
          >
            <option value="">{t('audit.filters.all')}</option>
            {ALL_ACTIONS.map((a) => (
              <option key={a} value={a}>{formatAction(a, t)}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">{t('audit.filters.resourceType')}</label>
          <select
            className="h-8 w-36 text-xs rounded-md border border-input bg-background px-2 focus:outline-none focus:ring-1 focus:ring-ring"
            value={draft.resourceType}
            onChange={(e) => setDraft((d) => ({ ...d, resourceType: e.target.value }))}
          >
            <option value="">{t('audit.filters.all')}</option>
            {RESOURCE_TYPES.map((r) => (
              <option key={r} value={r}>{formatResourceType(r, t)}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">{t('audit.filters.correlationId')}</label>
          <Input
            className="h-8 w-72 text-xs font-mono"
            placeholder={t('audit.filters.correlationIdPlaceholder')}
            value={draft.correlationId}
            onChange={(e) => setDraft((d) => ({ ...d, correlationId: e.target.value }))}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">{t('audit.filters.from')}</label>
          <Input
            className="h-8 w-40 text-xs"
            type="datetime-local"
            value={draft.from}
            onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">{t('audit.filters.to')}</label>
          <Input
            className="h-8 w-40 text-xs"
            type="datetime-local"
            value={draft.to}
            onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))}
          />
        </div>
        <Button type="submit" size="sm" className="h-8">
          <Search className="size-3.5" />{t('common.search')}
        </Button>
        {hasFilters && (
          <Button type="button" size="sm" variant="ghost" className="h-8" onClick={handleClear}>
            <X className="size-3.5" />{t('common.clear')}
          </Button>
        )}
      </form>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('audit.columns.timestamp')}</TableHead>
              <TableHead>{t('audit.columns.action')}</TableHead>
              <TableHead>{t('audit.columns.resourceType')}</TableHead>
              <TableHead>{t('audit.columns.resource')}</TableHead>
              <TableHead>{t('audit.columns.actor')}</TableHead>
              <TableHead>{t('audit.columns.correlationId')}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
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
              logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDate(log.timestamp)}
                  </TableCell>
                  <TableCell className="text-xs">{formatAction(log.action, t)}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${resourceTypeColor(log.resourceType)}`}>
                      {formatResourceType(log.resourceType, t)}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[160px] truncate" title={log.resourceId}>
                    {resolveResourceName(log)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[160px] truncate" title={log.actorId}>
                    {resolveActorName(log.actorId, users)}
                  </TableCell>
                  <TableCell className="text-xs">
                    {CORRELATION_RESOURCE_TYPES.has(log.resourceType) && log.correlationId ? (
                      <span className="flex items-center gap-1 min-w-0">
                        <span
                          className="font-mono text-[11px] text-muted-foreground truncate max-w-[100px]"
                          title={log.correlationId}
                        >
                          {log.correlationId.slice(0, 8)}…
                        </span>
                        <Button
                          variant="ghost" size="sm" className="h-5 w-5 p-0 shrink-0"
                          title={t('audit.detail.copy')}
                          onClick={() => navigator.clipboard.writeText(log.correlationId!)}
                        >
                          <Copy className="size-3" />
                        </Button>
                        <Button
                          variant="ghost" size="sm" className="h-5 w-5 p-0 shrink-0"
                          title={t('audit.detail.filterByCorrelation')}
                          onClick={() => {
                            setDraft((d) => ({ ...d, correlationId: log.correlationId! }))
                            applyFilters({ ...filters, correlationId: log.correlationId! })
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
                    >
                      <Eye className="size-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
        <span>{total} {t('audit.events')}</span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost" size="sm" className="h-7 w-7 p-0"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft className="size-3.5" />
          </Button>
          <span className="px-2">{page} / {totalPages}</span>
          <Button
            variant="ghost" size="sm" className="h-7 w-7 p-0"
            disabled={page >= totalPages}
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
          open={!!selectedLog}
          onClose={() => setSelectedLog(null)}
          onFilterByCorrelation={(correlationId) => {
            setDraft((d) => ({ ...d, correlationId }))
            applyFilters({ ...filters, correlationId })
          }}
        />
      )}

      {/* Export modal */}
      <AuditExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        defaultFrom={filters.from}
        defaultTo={filters.to}
        defaultCorrelationId={filters.correlationId}
      />
    </main>
  )
}
