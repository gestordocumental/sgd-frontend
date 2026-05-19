import { useTranslation } from 'react-i18next'
import { Building2, Users, CheckCircle, Clock, HardDrive, UserCheck } from 'lucide-react'
import type { ApiCompany } from '@/lib/api/companies'
import type { ApiUser } from '@/lib/api/users'
import type { OrgUserCount } from '@/lib/api/users'

export interface MergedOrgStorage {
  orgId: string
  storageTotalBytes: number
  uploadedDocuments: number
  workflowAttachments: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function buildMonthlyOrgData(companies: ApiCompany[]): { label: string; count: number }[] {
  const now = new Date()
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
    return {
      label: d.toLocaleString('default', { month: 'short' }),
      count: companies.filter((c) => {
        const cd = new Date(c.createdAt)
        return cd.getFullYear() === d.getFullYear() && cd.getMonth() === d.getMonth()
      }).length,
    }
  })
}

function totalStorage(stats: MergedOrgStorage[]): number {
  return stats.reduce((s, r) => s + r.storageTotalBytes, 0)
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

interface KpiColor { bg: string; iconBg: string; icon: string; accent: string }
const KPI_COLORS: KpiColor[] = [
  { bg: 'bg-indigo-50 dark:bg-indigo-950/40',   iconBg: 'bg-indigo-100 dark:bg-indigo-900/60',  icon: 'text-indigo-600 dark:text-indigo-400',  accent: 'text-indigo-700 dark:text-indigo-300'  },
  { bg: 'bg-emerald-50 dark:bg-emerald-950/40', iconBg: 'bg-emerald-100 dark:bg-emerald-900/60', icon: 'text-emerald-600 dark:text-emerald-400', accent: 'text-emerald-700 dark:text-emerald-300' },
  { bg: 'bg-blue-50 dark:bg-blue-950/40',       iconBg: 'bg-blue-100 dark:bg-blue-900/60',      icon: 'text-blue-600 dark:text-blue-400',      accent: 'text-blue-700 dark:text-blue-300'      },
  { bg: 'bg-amber-50 dark:bg-amber-950/40',     iconBg: 'bg-amber-100 dark:bg-amber-900/60',    icon: 'text-amber-600 dark:text-amber-400',    accent: 'text-amber-700 dark:text-amber-300'    },
  { bg: 'bg-violet-50 dark:bg-violet-950/40',   iconBg: 'bg-violet-100 dark:bg-violet-900/60',  icon: 'text-violet-600 dark:text-violet-400',  accent: 'text-violet-700 dark:text-violet-300'  },
]

function KpiCard({ icon: Icon, label, value, sub, loading, colorIdx = 0 }: {
  icon: React.ElementType; label: string; value: string | number
  sub?: string; loading?: boolean; colorIdx?: number
}) {
  const c = KPI_COLORS[colorIdx % KPI_COLORS.length]
  return (
    <div className={`rounded-xl border border-border ${c.bg} p-4 flex items-start gap-3`}>
      <div className={`flex items-center justify-center size-11 rounded-xl ${c.iconBg} shrink-0`}>
        <Icon className={`size-5 ${c.icon}`} />
      </div>
      <div className="min-w-0">
        <p className="text-sm text-muted-foreground font-medium">{label}</p>
        {loading
          ? <div className="h-8 w-20 rounded bg-muted/60 animate-pulse mt-1" />
          : <p className={`text-3xl font-bold leading-tight ${c.accent}`}>{value}</p>
        }
        {sub && <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{sub}</p>}
      </div>
    </div>
  )
}

// ── Donut Chart (SVG) ─────────────────────────────────────────────────────────

function DonutChart({ slices, title, centerLabel }: {
  slices: { label: string; value: number; color: string }[]
  title: string
  centerLabel?: string
}) {
  const total = slices.reduce((s, sl) => s + sl.value, 0)
  const visible = slices.filter((sl) => sl.value > 0)
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
        <p className="text-sm text-muted-foreground">Sin datos</p>
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

// ── Monthly bar chart ─────────────────────────────────────────────────────────

function MonthlyBarChart({ title, data, noDataLabel }: {
  title: string; data: { label: string; count: number }[]; noDataLabel: string
}) {
  const maxCount = Math.max(...data.map((d) => d.count), 1)
  const chartH = 100; const chartW = 320; const cols = data.length || 1
  const barW = Math.floor(chartW / cols) - 6

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="text-base font-semibold mb-4">{title}</p>
      {maxCount === 0 ? (
        <p className="text-sm text-muted-foreground">{noDataLabel}</p>
      ) : (
        <svg viewBox={`0 0 ${chartW} ${chartH + 26}`} className="w-full">
          <defs>
            <linearGradient id="adminBarGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#059669" stopOpacity="0.6" />
            </linearGradient>
          </defs>
          {data.map((d, i) => {
            const barH = Math.max((d.count / maxCount) * chartH, d.count > 0 ? 6 : 0)
            const x = i * (chartW / cols) + 3
            const y = chartH - barH
            return (
              <g key={d.label}>
                <rect x={x} y={y} width={barW} height={barH} rx={4} fill="url(#adminBarGrad)" />
                <text x={x + barW / 2} y={chartH + 18} textAnchor="middle" fontSize={10} fill="currentColor" opacity={0.6}>
                  {d.label}
                </text>
                {d.count > 0 && (
                  <text x={x + barW / 2} y={y - 5} textAnchor="middle" fontSize={11} fill="#10b981" fontWeight="bold">
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

// ── Usuarios por organización (barras horizontales apiladas) ──────────────────

function UsersPerOrgChart({ counts, companies, loading }: {
  counts: OrgUserCount[]
  companies: ApiCompany[]
  loading: boolean
}) {
  const companyMap = new Map(companies.map((c) => [c.id, c.name]))
  const sorted = [...counts].sort((a, b) => b.total - a.total).slice(0, 12)
  const maxTotal = Math.max(...sorted.map((r) => r.total), 1)

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-5">
        <p className="text-base font-semibold mb-4">Usuarios por organización</p>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-8 rounded bg-muted/40 animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-base font-semibold">Usuarios por organización</p>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-indigo-500 inline-block" /> Activos
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-rose-300 inline-block" /> Inactivos
          </span>
        </div>
      </div>

      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin datos</p>
      ) : (
        <ul className="space-y-3">
          {sorted.map((r) => {
            const orgName = companyMap.get(r.orgId) ?? r.orgId.slice(0, 8)
            const activePct  = maxTotal > 0 ? (r.active   / maxTotal) * 100 : 0
            const inactivePct = maxTotal > 0 ? (r.inactive / maxTotal) * 100 : 0
            return (
              <li key={r.orgId}>
                <div className="flex items-center justify-between mb-1 gap-2">
                  <span className="text-sm font-medium truncate max-w-[200px]">{orgName}</span>
                  <span className="text-sm text-muted-foreground shrink-0">
                    <span className="font-semibold text-indigo-600 dark:text-indigo-400">{r.active}</span>
                    <span className="mx-1 opacity-40">/</span>
                    <span className="font-semibold">{r.total}</span>
                    <span className="ml-1 opacity-50">usuarios</span>
                  </span>
                </div>
                {/* stacked bar */}
                <div className="h-3 rounded-full bg-muted/40 overflow-hidden flex">
                  <div
                    className="h-full bg-indigo-500 transition-all duration-500"
                    style={{ width: `${activePct}%` }}
                  />
                  <div
                    className="h-full bg-rose-300 dark:bg-rose-400 transition-all duration-500"
                    style={{ width: `${inactivePct}%` }}
                  />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

// ── Storage per org ───────────────────────────────────────────────────────────

function StoragePerOrgChart({ stats, companies, title, noDataLabel }: {
  stats: MergedOrgStorage[]; companies: ApiCompany[]; title: string; noDataLabel: string
}) {
  const companyMap = new Map(companies.map((c) => [c.id, c.name]))
  const rows = stats.slice(0, 10).map((s) => ({
    name: companyMap.get(s.orgId) ?? s.orgId.slice(0, 8),
    bytes: s.storageTotalBytes,
    docs: s.uploadedDocuments,
    attachments: s.workflowAttachments,
  }))
  const maxBytes = Math.max(...rows.map((r) => r.bytes), 1)

  const GRAD_COLORS = [
    ['#6366f1', '#8b5cf6'], ['#10b981', '#059669'], ['#3b82f6', '#6366f1'],
    ['#f59e0b', '#f97316'], ['#ec4899', '#a855f7'],
  ]

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="text-base font-semibold mb-4">{title}</p>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{noDataLabel}</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r, i) => {
            const pct = (r.bytes / maxBytes) * 100
            const [c1, c2] = GRAD_COLORS[i % GRAD_COLORS.length]
            return (
              <li key={r.name}>
                <div className="flex items-center justify-between mb-1 gap-2">
                  <span className="text-sm font-semibold truncate max-w-[200px]">{r.name}</span>
                  <span className="text-sm text-muted-foreground shrink-0">
                    <span className="font-semibold text-foreground">{formatBytes(r.bytes)}</span>
                    <span className="ml-2 opacity-50 text-xs">· {r.docs} tipol. · {r.attachments} flujos</span>
                  </span>
                </div>
                <div className="h-3 rounded-full bg-muted/40 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, background: `linear-gradient(to right, ${c1}, ${c2})` }}
                  />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

// ── Recent orgs ───────────────────────────────────────────────────────────────

function RecentOrgsList({ companies }: { companies: ApiCompany[] }) {
  const recent = [...companies]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 8)

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="text-base font-semibold mb-4">Organizaciones recientes</p>
      {recent.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin datos</p>
      ) : (
        <ul className="divide-y divide-border">
          {recent.map((c) => (
            <li key={c.id} className="flex items-center justify-between py-3 gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={`size-2.5 rounded-full shrink-0 ${c.status === 'active' ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                <span className="text-sm font-medium truncate">{c.name}</span>
              </div>
              <span className="text-sm text-muted-foreground shrink-0">
                {new Date(c.createdAt).toLocaleDateString()}
              </span>
              <span className={`shrink-0 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                c.status === 'active'
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'
                  : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
              }`}>
                {c.status === 'active' ? 'Activa' : 'Inactiva'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface AdminDashboardProps {
  companies: ApiCompany[]
  users: ApiUser[]
  superAdmins: ApiUser[]
  loading: boolean
  storageStats: MergedOrgStorage[]
  storageLoading: boolean
  orgUserCounts: OrgUserCount[]
  orgUserCountsLoading: boolean
}

export function AdminDashboard({
  companies, users, superAdmins, loading,
  storageStats, storageLoading,
  orgUserCounts, orgUserCountsLoading,
}: AdminDashboardProps) {
  const { t } = useTranslation()

  const activeOrgs    = companies.filter((c) => c.status === 'active').length
  const inactiveOrgs  = companies.length - activeOrgs
  const orgUsers      = users.filter((u) => !u.isSuperAdmin)
  const activeUsers   = orgUsers.filter((u) => u.isActive && !u.deletedAt).length
  const inactiveUsers = orgUsers.length - activeUsers
  const monthlyData   = buildMonthlyOrgData(companies)
  const totalStorageBytes = totalStorage(storageStats)

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <KpiCard icon={Building2}  label={t('dashboard.kpi.totalOrgs')}   value={companies.length} sub={`${activeOrgs} activas · ${inactiveOrgs} inactivas`} loading={loading}        colorIdx={0} />
        <KpiCard icon={CheckCircle} label="Orgs activas"                  value={activeOrgs}       sub={`${Math.round(activeOrgs / (companies.length || 1) * 100)}% del total`}       loading={loading}        colorIdx={1} />
        <KpiCard icon={Users}       label={t('dashboard.kpi.totalUsers')} value={orgUsers.length}  sub={`${activeUsers} activos · ${superAdmins.length} super admin`}                  loading={loading}        colorIdx={2} />
        <KpiCard icon={Clock}       label="Registradas este mes"          value={monthlyData[monthlyData.length - 1]?.count ?? 0}                                                       loading={loading}        colorIdx={3} />
        <KpiCard icon={HardDrive}   label={t('dashboard.kpi.storageUsed')} value={storageLoading ? '…' : formatBytes(totalStorageBytes)} sub={`${storageStats.length} orgs con datos`} loading={storageLoading} colorIdx={4} />
      </div>

      {/* Donuts + bar chart */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <DonutChart
          title="Estado de organizaciones"
          centerLabel="orgs"
          slices={[
            { label: 'Activas',   value: activeOrgs,   color: '#10b981' },
            { label: 'Inactivas', value: inactiveOrgs, color: '#94a3b8' },
          ]}
        />
        <DonutChart
          title="Usuarios (globales)"
          centerLabel="usuarios"
          slices={[
            { label: 'Activos',   value: activeUsers,   color: '#6366f1' },
            { label: 'Inactivos', value: inactiveUsers, color: '#f87171' },
          ]}
        />
        <MonthlyBarChart
          title="Registros por mes (6 meses)"
          data={monthlyData}
          noDataLabel={t('dashboard.noData')}
        />
      </div>

      {/* Usuarios por organización */}
      <UsersPerOrgChart
        counts={orgUserCounts}
        companies={companies}
        loading={orgUserCountsLoading}
      />

      {/* Storage per org */}
      <StoragePerOrgChart
        stats={storageStats}
        companies={companies}
        title={t('dashboard.charts.storagePerOrg')}
        noDataLabel={t('dashboard.noData')}
      />

      {/* Recent orgs */}
      <RecentOrgsList companies={companies} />
    </div>
  )
}
