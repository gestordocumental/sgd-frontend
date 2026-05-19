import { useTranslation } from 'react-i18next'
import { FileText, GitBranch, HardDrive, CheckCircle, ClipboardList, Users } from 'lucide-react'
import type { TypologyStats } from '@/lib/api/typologies'
import type { WorkflowStats } from '@/lib/api/workflows'
import type { ApiUser } from '@/lib/api/users'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

const WORKFLOW_STATUS_COLORS: Record<string, string> = {
  DRAFT:                     '#94a3b8',
  PENDING_APPROVAL:          '#f59e0b',
  RETURNED_TO_CREATOR:       '#ef4444', // legacy
  REJECTED:                  '#dc2626',
  PENDING_REVIEW_CYCLE:      '#8b5cf6',
  AVAILABLE_FOR_FINAL_USERS: '#10b981',
  ADMIN_CYCLE_IN_PROGRESS:   '#3b82f6',
  CLOSED:                    '#6b7280',
  CANCELLED:                 '#6b7280',
}

const WORKFLOW_STATUS_LABELS: Record<string, string> = {
  DRAFT:                     'Borrador',
  PENDING_APPROVAL:          'Pend. aprobación',
  RETURNED_TO_CREATOR:       'Rechazado (legacy)',
  REJECTED:                  'Rechazado',
  PENDING_REVIEW_CYCLE:      'Pend. revisión',
  AVAILABLE_FOR_FINAL_USERS: 'Disponible',
  ADMIN_CYCLE_IN_PROGRESS:   'En ciclo admin',
  CLOSED:                    'Cerrado',
  CANCELLED:                 'Cancelado',
}

const EXTRACTION_STATUS_COLORS: Record<string, string> = {
  NOT_UPLOADED:         '#e2e8f0',
  PROCESSING:           '#fbbf24',
  COMPLETED:            '#34d399',
  DISCREPANCY:          '#f87171',
  PENDING_CONFIRMATION: '#a78bfa',
  CONFIRMED:            '#10b981',
  FAILED:               '#dc2626',
}

const EXTRACTION_STATUS_LABELS: Record<string, string> = {
  NOT_UPLOADED:         'Sin cargar',
  PROCESSING:           'Procesando',
  COMPLETED:            'Completado',
  DISCREPANCY:          'Discrepancia',
  PENDING_CONFIRMATION: 'Pend. confirmación',
  CONFIRMED:            'Confirmado',
  FAILED:               'Fallido',
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

interface KpiColor {
  bg: string
  iconBg: string
  icon: string
  accent: string
}

const KPI_COLORS: KpiColor[] = [
  { bg: 'bg-emerald-50 dark:bg-emerald-950/40',  iconBg: 'bg-emerald-100 dark:bg-emerald-900/60', icon: 'text-emerald-600 dark:text-emerald-400', accent: 'text-emerald-700 dark:text-emerald-300' },
  { bg: 'bg-blue-50 dark:bg-blue-950/40',        iconBg: 'bg-blue-100 dark:bg-blue-900/60',       icon: 'text-blue-600 dark:text-blue-400',       accent: 'text-blue-700 dark:text-blue-300'       },
  { bg: 'bg-violet-50 dark:bg-violet-950/40',    iconBg: 'bg-violet-100 dark:bg-violet-900/60',   icon: 'text-violet-600 dark:text-violet-400',   accent: 'text-violet-700 dark:text-violet-300'   },
  { bg: 'bg-amber-50 dark:bg-amber-950/40',      iconBg: 'bg-amber-100 dark:bg-amber-900/60',     icon: 'text-amber-600 dark:text-amber-400',     accent: 'text-amber-700 dark:text-amber-300'     },
  { bg: 'bg-rose-50 dark:bg-rose-950/40',        iconBg: 'bg-rose-100 dark:bg-rose-900/60',       icon: 'text-rose-600 dark:text-rose-400',       accent: 'text-rose-700 dark:text-rose-300'       },
  { bg: 'bg-indigo-50 dark:bg-indigo-950/40',    iconBg: 'bg-indigo-100 dark:bg-indigo-900/60',   icon: 'text-indigo-600 dark:text-indigo-400',   accent: 'text-indigo-700 dark:text-indigo-300'   },
]

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  loading,
  colorIdx = 0,
}: {
  icon: React.ElementType
  label: string
  value: string | number
  sub?: string
  loading?: boolean
  colorIdx?: number
}) {
  const c = KPI_COLORS[colorIdx % KPI_COLORS.length]
  return (
    <div className={`rounded-xl border border-border ${c.bg} p-4 flex items-start gap-3`}>
      <div className={`flex items-center justify-center size-11 rounded-xl ${c.iconBg} shrink-0`}>
        <Icon className={`size-5 ${c.icon}`} />
      </div>
      <div className="min-w-0">
        <p className="text-sm text-muted-foreground font-medium">{label}</p>
        {loading ? (
          <div className="h-8 w-20 rounded bg-muted/60 animate-pulse mt-1" />
        ) : (
          <p className={`text-3xl font-bold leading-tight ${c.accent}`}>{value}</p>
        )}
        {sub && <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{sub}</p>}
      </div>
    </div>
  )
}

// ── Donut Chart (SVG) ─────────────────────────────────────────────────────────

function DonutChart({
  slices,
  title,
  centerLabel,
  noDataLabel,
}: {
  slices: { label: string; value: number; color: string }[]
  title: string
  centerLabel?: string
  noDataLabel: string
}) {
  const visible = slices.filter((s) => s.value > 0)
  const total = visible.reduce((s, sl) => s + sl.value, 0)
  const cx = 64; const cy = 64; const r = 52; const innerR = 33
  const gap = 0.03

  let cumAngle = -Math.PI / 2
  const paths = visible.map((sl) => {
    const angle = (sl.value / total) * 2 * Math.PI - gap
    const startA = cumAngle + gap / 2
    const endA = startA + angle
    const large = angle > Math.PI ? 1 : 0
    const p = `M ${cx + r * Math.cos(startA)} ${cy + r * Math.sin(startA)}
      A ${r} ${r} 0 ${large} 1 ${cx + r * Math.cos(endA)} ${cy + r * Math.sin(endA)}
      L ${cx + innerR * Math.cos(endA)} ${cy + innerR * Math.sin(endA)}
      A ${innerR} ${innerR} 0 ${large} 0 ${cx + innerR * Math.cos(startA)} ${cy + innerR * Math.sin(startA)} Z`
    cumAngle += (sl.value / total) * 2 * Math.PI
    return { ...sl, path: p }
  })

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="text-base font-semibold mb-4">{title}</p>
      {total === 0 ? (
        <p className="text-sm text-muted-foreground">{noDataLabel}</p>
      ) : (
        <div className="flex items-center gap-5">
          <svg viewBox="0 0 128 128" className="size-32 shrink-0 drop-shadow-sm">
            {paths.map((p) => (
              <path key={p.label} d={p.path} fill={p.color} />
            ))}
            <text x={cx} y={cy - 4} textAnchor="middle" fontSize={18} fontWeight="bold" fill="currentColor">{total}</text>
            <text x={cx} y={cy + 13} textAnchor="middle" fontSize={9} fill="currentColor" opacity={0.5}>{centerLabel ?? 'total'}</text>
          </svg>
          <ul className="space-y-2.5 min-w-0 flex-1">
            {paths.map((p) => (
              <li key={p.label} className="flex items-center gap-2">
                <span className="size-3 rounded-sm shrink-0" style={{ backgroundColor: p.color }} />
                <span className="text-sm text-muted-foreground truncate">{p.label}</span>
                <span className="ml-auto text-sm font-bold shrink-0">{p.value}</span>
                <span className="text-xs text-muted-foreground w-8 text-right shrink-0">
                  {Math.round((p.value / total) * 100)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// ── Status donut (from Record<string,number>) ─────────────────────────────────

function StatusDonutChart({
  data,
  colorMap,
  labelMap,
  title,
  noDataLabel,
}: {
  data: Record<string, number>
  colorMap: Record<string, string>
  labelMap: Record<string, string>
  title: string
  noDataLabel: string
}) {
  const entries = Object.entries(data).filter(([, v]) => v > 0)
  const slices = entries.map(([key, value]) => ({
    label: labelMap[key] ?? key,
    value,
    color: colorMap[key] ?? '#cbd5e1',
  }))
  return <DonutChart slices={slices} title={title} noDataLabel={noDataLabel} />
}

// ── Weekly bar chart ──────────────────────────────────────────────────────────

function WeeklyBarChart({
  data,
  title,
  noDataLabel,
}: {
  data: { week: string; count: number }[]
  title: string
  noDataLabel: string
}) {
  const maxCount = Math.max(...data.map((d) => d.count), 1)
  const chartH = 100
  const chartW = 320
  const cols = data.length || 1
  const barW = Math.floor(chartW / cols) - 5

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="text-base font-semibold mb-4">{title}</p>
      {maxCount === 0 ? (
        <p className="text-sm text-muted-foreground">{noDataLabel}</p>
      ) : (
        <svg viewBox={`0 0 ${chartW} ${chartH + 24}`} className="w-full">
          <defs>
            <linearGradient id="orgBarGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" />
              <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.7" />
            </linearGradient>
          </defs>
          {data.map((d, i) => {
            const barH = Math.max((d.count / maxCount) * chartH, d.count > 0 ? 6 : 0)
            const x = i * (chartW / cols) + 2
            const y = chartH - barH
            return (
              <g key={d.week}>
                <rect x={x} y={y} width={barW} height={barH} rx={4} fill="url(#orgBarGrad)" />
                <text x={x + barW / 2} y={chartH + 17} textAnchor="middle" fontSize={9} fill="currentColor" opacity={0.6}>
                  {d.week}
                </text>
                {d.count > 0 && (
                  <text x={x + barW / 2} y={y - 5} textAnchor="middle" fontSize={10} fill="#6366f1" fontWeight="bold">
                    {d.count}
                  </text>
                )}
              </g>
            )
          })}
        </svg>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface OrgDashboardProps {
  typologyStats: TypologyStats | undefined
  workflowStats:  WorkflowStats | undefined
  isLoading: boolean
  users: ApiUser[]
  usersLoading: boolean
}

export function OrgDashboard({ typologyStats, workflowStats, isLoading, users, usersLoading }: OrgDashboardProps) {
  const { t } = useTranslation()
  const noData = t('dashboard.noData')

  const totalStorageBytes =
    (typologyStats?.storageTotalBytes ?? 0) + (workflowStats?.storageTotalBytes ?? 0)
  const totalAttachments =
    (typologyStats?.uploadedDocuments ?? 0) + (workflowStats?.totalAttachments ?? 0)

  const activeUsers   = users.filter((u) => u.isActive && !u.deletedAt).length
  const inactiveUsers = users.filter((u) => !u.isActive || !!u.deletedAt).length

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard
          icon={FileText}
          label={t('dashboard.kpi.activeTypologies')}
          value={typologyStats?.activeTypologies ?? '—'}
          sub={`${typologyStats?.totalTypologies ?? 0} total`}
          loading={isLoading}
          colorIdx={0}
        />
        <KpiCard
          icon={CheckCircle}
          label={t('dashboard.kpi.uploadedDocuments')}
          value={isLoading ? '—' : totalAttachments}
          sub={`${typologyStats?.uploadedDocuments ?? 0} tipol. · ${workflowStats?.totalAttachments ?? 0} flujos`}
          loading={isLoading}
          colorIdx={1}
        />
        <KpiCard
          icon={HardDrive}
          label={t('dashboard.kpi.storageUsed')}
          value={isLoading ? '—' : formatBytes(totalStorageBytes)}
          sub={`${formatBytes(typologyStats?.storageTotalBytes ?? 0)} tipol. · ${formatBytes(workflowStats?.storageTotalBytes ?? 0)} flujos`}
          loading={isLoading}
          colorIdx={2}
        />
        <KpiCard
          icon={GitBranch}
          label={t('dashboard.kpi.totalWorkflows')}
          value={workflowStats?.totalWorkflows ?? '—'}
          loading={isLoading}
          colorIdx={3}
        />
        <KpiCard
          icon={ClipboardList}
          label={t('dashboard.kpi.myPendingTasks')}
          value={workflowStats?.myPendingTasks ?? '—'}
          loading={isLoading}
          colorIdx={4}
        />
        <KpiCard
          icon={Users}
          label="Usuarios"
          value={usersLoading ? '—' : users.length}
          sub={usersLoading ? undefined : `${activeUsers} activos · ${inactiveUsers} inactivos`}
          loading={usersLoading}
          colorIdx={5}
        />
      </div>

      {/* Charts row 1: status donuts + weekly trend */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatusDonutChart
          data={workflowStats?.statusCounts ?? {}}
          colorMap={WORKFLOW_STATUS_COLORS}
          labelMap={WORKFLOW_STATUS_LABELS}
          title={t('dashboard.charts.workflowStatus')}
          noDataLabel={noData}
        />
        <StatusDonutChart
          data={typologyStats?.extractionStatusCounts ?? {}}
          colorMap={EXTRACTION_STATUS_COLORS}
          labelMap={EXTRACTION_STATUS_LABELS}
          title={t('dashboard.charts.extractionStatus')}
          noDataLabel={noData}
        />
        <WeeklyBarChart
          data={workflowStats?.weeklyTrend ?? []}
          title={t('dashboard.charts.weeklyTrend')}
          noDataLabel={noData}
        />
      </div>

      {/* Charts row 2: users active/inactive */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <DonutChart
          slices={[
            { label: 'Activos',   value: activeUsers,   color: '#6366f1' },
            { label: 'Inactivos', value: inactiveUsers, color: '#f87171' },
          ]}
          title="Usuarios activos / inactivos"
          centerLabel="usuarios"
          noDataLabel={usersLoading ? 'Cargando…' : noData}
        />
        {/* placeholder card so the row doesn't feel empty when only one chart */}
        <div className="rounded-xl border border-border bg-card p-5 flex flex-col justify-center items-center text-muted-foreground gap-2">
          <Users className="size-10 opacity-20" />
          <p className="text-sm font-medium">
            {usersLoading ? 'Cargando usuarios…' : `${users.length} usuarios en esta organización`}
          </p>
          {!usersLoading && (
            <p className="text-xs opacity-60">
              {activeUsers} activos · {inactiveUsers} inactivos
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
