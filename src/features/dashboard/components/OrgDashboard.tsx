import { memo, useMemo, type ElementType } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, GitBranch, HardDrive, CheckCircle, ClipboardList, Users } from 'lucide-react';
import type { TypologyStats } from '@/lib/api/typologies';
import type { WorkflowStats } from '@/lib/api/workflows';
import type { ApiUserWithRoles } from '@/lib/api/users';
import { isPendingRegistration } from '@/lib/formatters';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatBytesToGB(bytes: number): string {
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb < 0.001) return '< 0.001 GB';
  return `${gb.toFixed(3)} GB`;
}

const WORKFLOW_STATUS_COLORS: Record<string, string> = {
  DRAFT: '#94a3b8',
  PENDING_APPROVAL: '#f59e0b',
  RETURNED_TO_CREATOR: '#ef4444', // legacy
  REJECTED: '#dc2626',
  PENDING_REVIEW_CYCLE: '#8b5cf6',
  AVAILABLE_FOR_FINAL_USERS: '#10b981',
  ADMIN_CYCLE_IN_PROGRESS: '#3b82f6',
  CLOSED: '#6b7280',
  CANCELLED: '#6b7280',
};

const WORKFLOW_STATUS_LABEL_KEYS: Record<string, string> = {
  DRAFT: 'workflows.status.DRAFT',
  PENDING_APPROVAL: 'workflows.status.PENDING_APPROVAL',
  RETURNED_TO_CREATOR: 'workflows.status.RETURNED_TO_CREATOR',
  REJECTED: 'workflows.status.REJECTED',
  PENDING_REVIEW_CYCLE: 'workflows.status.PENDING_REVIEW_CYCLE',
  AVAILABLE_FOR_FINAL_USERS: 'workflows.status.AVAILABLE_FOR_FINAL_USERS',
  ADMIN_CYCLE_IN_PROGRESS: 'workflows.status.ADMIN_CYCLE_IN_PROGRESS',
  CLOSED: 'workflows.status.CLOSED',
  CANCELLED: 'workflows.status.CANCELLED',
};

const EXTRACTION_STATUS_COLORS: Record<string, string> = {
  NOT_UPLOADED: '#e2e8f0',
  PROCESSING: '#fbbf24',
  COMPLETED: '#34d399',
  DISCREPANCY: '#f87171',
  PENDING_CONFIRMATION: '#a78bfa',
  CONFIRMED: '#10b981',
  FAILED: '#dc2626',
};

const EXTRACTION_STATUS_LABEL_KEYS: Record<string, string> = {
  NOT_UPLOADED: 'docGovernance.extractionStatus.NOT_UPLOADED',
  PROCESSING: 'docGovernance.extractionStatus.PROCESSING',
  COMPLETED: 'docGovernance.extractionStatus.COMPLETED',
  DISCREPANCY: 'docGovernance.extractionStatus.DISCREPANCY',
  PENDING_CONFIRMATION: 'docGovernance.extractionStatus.PENDING_CONFIRMATION',
  CONFIRMED: 'docGovernance.extractionStatus.CONFIRMED',
  FAILED: 'docGovernance.extractionStatus.FAILED',
};

// ── KPI Card ──────────────────────────────────────────────────────────────────

interface KpiColor {
  bg: string;
  iconBg: string;
  icon: string;
  accent: string;
}

const KPI_COLORS: KpiColor[] = [
  {
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    iconBg: 'bg-emerald-100 dark:bg-emerald-900/60',
    icon: 'text-emerald-600 dark:text-emerald-400',
    accent: 'text-emerald-700 dark:text-emerald-300',
  },
  {
    bg: 'bg-blue-50 dark:bg-blue-950/40',
    iconBg: 'bg-blue-100 dark:bg-blue-900/60',
    icon: 'text-blue-600 dark:text-blue-400',
    accent: 'text-blue-700 dark:text-blue-300',
  },
  {
    bg: 'bg-violet-50 dark:bg-violet-950/40',
    iconBg: 'bg-violet-100 dark:bg-violet-900/60',
    icon: 'text-violet-600 dark:text-violet-400',
    accent: 'text-violet-700 dark:text-violet-300',
  },
  {
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    iconBg: 'bg-amber-100 dark:bg-amber-900/60',
    icon: 'text-amber-600 dark:text-amber-400',
    accent: 'text-amber-700 dark:text-amber-300',
  },
  {
    bg: 'bg-rose-50 dark:bg-rose-950/40',
    iconBg: 'bg-rose-100 dark:bg-rose-900/60',
    icon: 'text-rose-600 dark:text-rose-400',
    accent: 'text-rose-700 dark:text-rose-300',
  },
  {
    bg: 'bg-indigo-50 dark:bg-indigo-950/40',
    iconBg: 'bg-indigo-100 dark:bg-indigo-900/60',
    icon: 'text-indigo-600 dark:text-indigo-400',
    accent: 'text-indigo-700 dark:text-indigo-300',
  },
];

const KpiCard = memo(function KpiCard({
  icon: Icon,
  label,
  value,
  valueSize = 'text-3xl',
  valueNote,
  sub,
  loading,
  colorIdx = 0,
}: {
  icon: ElementType;
  label: string;
  value: string | number;
  valueSize?: string;
  valueNote?: string;
  sub?: string;
  loading?: boolean;
  colorIdx?: number;
}) {
  const c = KPI_COLORS[colorIdx % KPI_COLORS.length];
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
          <p className={`${valueSize} font-bold leading-tight whitespace-nowrap ${c.accent}`}>
            {value}
          </p>
        )}
        {valueNote && !loading && (
          <p className="text-xs font-medium text-muted-foreground mt-0.5">{valueNote}</p>
        )}
        {sub && <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{sub}</p>}
      </div>
    </div>
  );
});

// ── Donut Chart (SVG) ─────────────────────────────────────────────────────────

function DonutChart({
  slices,
  title,
  centerLabel,
  noDataLabel,
}: {
  slices: { label: string; value: number; color: string }[];
  title: string;
  centerLabel?: string;
  noDataLabel: string;
}) {
  const visible = slices.filter((s) => s.value > 0);
  const total = visible.reduce((s, sl) => s + sl.value, 0);
  const cx = 64;
  const cy = 64;
  const r = 52;
  const innerR = 33;
  const gap = 0.03;

  type PathEntry = { label: string; value: number; color: string; path: string; _endAngle: number };
  const paths = visible.reduce<PathEntry[]>((acc, sl) => {
    const prevAngle = acc.length === 0 ? -Math.PI / 2 : acc[acc.length - 1]._endAngle;
    const angle = (sl.value / total) * 2 * Math.PI - gap;
    const startA = prevAngle + gap / 2;
    const endA = startA + angle;
    const large = angle > Math.PI ? 1 : 0;
    const path = `M ${cx + r * Math.cos(startA)} ${cy + r * Math.sin(startA)}
      A ${r} ${r} 0 ${large} 1 ${cx + r * Math.cos(endA)} ${cy + r * Math.sin(endA)}
      L ${cx + innerR * Math.cos(endA)} ${cy + innerR * Math.sin(endA)}
      A ${innerR} ${innerR} 0 ${large} 0 ${cx + innerR * Math.cos(startA)} ${cy + innerR * Math.sin(startA)} Z`;
    return [...acc, { ...sl, path, _endAngle: prevAngle + (sl.value / total) * 2 * Math.PI }];
  }, []);

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
            <text
              x={cx}
              y={cy - 4}
              textAnchor="middle"
              fontSize={18}
              fontWeight="bold"
              fill="currentColor"
            >
              {total}
            </text>
            <text
              x={cx}
              y={cy + 13}
              textAnchor="middle"
              fontSize={9}
              fill="currentColor"
              opacity={0.5}
            >
              {centerLabel ?? 'total'}
            </text>
          </svg>
          <ul className="space-y-2.5 min-w-0 flex-1">
            {/* Every slice is listed, even at 0 — a category silently vanishing
                from the legend reads as missing/broken data, not "none yet". */}
            {slices.map((sl) => (
              <li
                key={sl.label}
                className={`flex items-center gap-2 ${sl.value === 0 ? 'opacity-40' : ''}`}
              >
                <span
                  className="size-3 rounded-sm shrink-0"
                  style={{ backgroundColor: sl.color }}
                />
                <span className="text-sm text-muted-foreground truncate">{sl.label}</span>
                <span className="ml-auto text-sm font-bold shrink-0">{sl.value}</span>
                <span className="text-xs text-muted-foreground w-8 text-right shrink-0">
                  {total > 0 ? Math.round((sl.value / total) * 100) : 0}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── Status donut (from Record<string,number>) ─────────────────────────────────

function StatusDonutChart({
  data,
  colorMap,
  labelKeyMap,
  title,
  noDataLabel,
  loading = false,
  showAllCategories = false,
}: {
  data: Record<string, number>;
  colorMap: Record<string, string>;
  labelKeyMap: Record<string, string>;
  title: string;
  noDataLabel: string;
  loading?: boolean;
  // When true, every known category is listed (0 if it never occurred)
  // instead of only the ones present in `data` — for enums with a small,
  // stable set of values where an always-zero category is still useful
  // context, not clutter.
  showAllCategories?: boolean;
}) {
  const { t } = useTranslation();
  const slices = useMemo(
    () =>
      (showAllCategories
        ? Object.keys(labelKeyMap)
        : Object.keys(data).filter((k) => data[k] > 0)
      ).map((key) => ({
        label: labelKeyMap[key] ? t(labelKeyMap[key]) : key,
        value: data[key] ?? 0,
        color: colorMap[key] ?? '#cbd5e1',
      })),
    [data, colorMap, labelKeyMap, showAllCategories, t],
  );
  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-5">
        <p className="text-base font-semibold mb-4">{title}</p>
        <div className="flex items-center gap-5">
          <div className="size-32 rounded-full bg-muted/40 animate-pulse shrink-0" />
          <div className="space-y-2 flex-1">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-4 rounded bg-muted/40 animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }
  return <DonutChart slices={slices} title={title} noDataLabel={noDataLabel} />;
}

// ── Weekly bar chart ──────────────────────────────────────────────────────────

function WeeklyBarChart({
  data,
  title,
  noDataLabel,
  loading = false,
}: {
  data: { week: string; count: number }[];
  title: string;
  noDataLabel: string;
  loading?: boolean;
}) {
  const { t } = useTranslation();

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-5">
        <p className="text-base font-semibold mb-4">{title}</p>
        <div className="flex items-end gap-1.5 h-24">
          {[60, 80, 45, 90, 55, 70, 40].map((h, i) => (
            <div
              key={i}
              className="flex-1 rounded-t bg-muted/40 animate-pulse"
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
      </div>
    );
  }

  const hasData = data.length > 0;
  const maxCount = hasData ? Math.max(...data.map((d) => d.count), 1) : 0;
  const chartH = 100;
  const chartW = 320;
  const cols = data.length || 1;
  const barW = Math.floor(chartW / cols) - 5;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="text-base font-semibold mb-4">{title}</p>
      {!hasData ? (
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
            const barH = Math.max((d.count / maxCount) * chartH, d.count > 0 ? 6 : 0);
            const x = i * (chartW / cols) + 2;
            const y = chartH - barH;
            const barLabel = t('dashboard.charts.weeklyTrendBarLabel', {
              week: d.week,
              count: d.count,
            });
            return (
              <g key={d.week} role="img" aria-label={barLabel}>
                <title>{barLabel}</title>
                <rect x={x} y={y} width={barW} height={barH} rx={4} fill="url(#orgBarGrad)" />
                <text
                  x={x + barW / 2}
                  y={chartH + 17}
                  textAnchor="middle"
                  fontSize={9}
                  fill="currentColor"
                  opacity={0.6}
                >
                  {d.week}
                </text>
                <text
                  x={x + barW / 2}
                  y={d.count > 0 ? y - 5 : chartH - 5}
                  textAnchor="middle"
                  fontSize={10}
                  fill={d.count > 0 ? '#6366f1' : 'currentColor'}
                  fillOpacity={d.count > 0 ? 1 : 0.4}
                  fontWeight="bold"
                >
                  {d.count}
                </text>
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface OrgDashboardProps {
  typologyStats: TypologyStats | undefined;
  workflowStats: WorkflowStats | undefined;
  isLoading: boolean;
  users: ApiUserWithRoles[];
  usersLoading: boolean;
  // Each section is only rendered when the viewer holds the permission that
  // backs its module — mirrors the guards already applied to the other tabs,
  // so the overview can't leak counts/status data the role isn't authorized to see.
  canViewOrgStructure: boolean;
  canViewWorkflows: boolean;
  canViewUsers: boolean;
}

export function OrgDashboard({
  typologyStats,
  workflowStats,
  isLoading,
  users,
  usersLoading,
  canViewOrgStructure,
  canViewWorkflows,
  canViewUsers,
}: OrgDashboardProps) {
  const { t } = useTranslation();
  const noData = t('dashboard.noData');

  const totalStorageBytes =
    (canViewOrgStructure ? (typologyStats?.storageTotalBytes ?? 0) : 0) +
    (canViewWorkflows ? (workflowStats?.storageTotalBytes ?? 0) : 0);
  const totalAttachments =
    (canViewOrgStructure ? (typologyStats?.uploadedDocuments ?? 0) : 0) +
    (canViewWorkflows ? (workflowStats?.totalAttachments ?? 0) : 0);

  const { activeUsers, inactiveUsers, registeredUsers, pendingUsers } = useMemo(() => {
    // A user removed from the org (orgRemovedAt set) must not count as an active
    // member here — matches the "active" definition used everywhere else (CompanyTab,
    // RoleDialogs' assignable-users list), so this KPI doesn't disagree with them.
    const isRemoved = (u: ApiUserWithRoles) => !!u.deletedAt || !!u.orgRemovedAt;
    return {
      activeUsers: users.filter((u) => u.isActive && !isRemoved(u)).length,
      inactiveUsers: users.filter((u) => !u.isActive && !isRemoved(u)).length,
      registeredUsers: users.filter((u) => u.registrationStatus === 'active').length,
      pendingUsers: users.filter((u) => isPendingRegistration(u)).length,
    };
  }, [users]);

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* KPIs */}
      {(canViewOrgStructure || canViewWorkflows || canViewUsers) && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {canViewOrgStructure && (
            <KpiCard
              icon={FileText}
              label={t('dashboard.kpi.activeTypologies')}
              value={typologyStats?.activeTypologies ?? '—'}
              sub={t('dashboard.kpi.typologiesTotal', {
                count: typologyStats?.totalTypologies ?? 0,
              })}
              loading={isLoading}
              colorIdx={0}
            />
          )}
          {(canViewOrgStructure || canViewWorkflows) && (
            <KpiCard
              icon={CheckCircle}
              label={t('dashboard.kpi.uploadedDocuments')}
              value={isLoading ? '—' : totalAttachments}
              sub={t('dashboard.kpi.docsBreakdown', {
                typologies: canViewOrgStructure ? (typologyStats?.uploadedDocuments ?? 0) : 0,
                workflows: canViewWorkflows ? (workflowStats?.totalAttachments ?? 0) : 0,
              })}
              loading={isLoading}
              colorIdx={1}
            />
          )}
          {(canViewOrgStructure || canViewWorkflows) && (
            <KpiCard
              icon={HardDrive}
              label={t('dashboard.kpi.storageUsed')}
              value={isLoading ? '—' : formatBytes(totalStorageBytes)}
              valueSize="text-lg"
              valueNote={isLoading ? undefined : formatBytesToGB(totalStorageBytes)}
              sub={t('dashboard.kpi.storageBreakdown', {
                typologies: formatBytes(
                  canViewOrgStructure ? (typologyStats?.storageTotalBytes ?? 0) : 0,
                ),
                workflows: formatBytes(
                  canViewWorkflows ? (workflowStats?.storageTotalBytes ?? 0) : 0,
                ),
              })}
              loading={isLoading}
              colorIdx={2}
            />
          )}
          {canViewWorkflows && (
            <KpiCard
              icon={GitBranch}
              label={t('dashboard.kpi.totalWorkflows')}
              value={workflowStats?.totalWorkflows ?? '—'}
              loading={isLoading}
              colorIdx={3}
            />
          )}
          {canViewWorkflows && (
            <KpiCard
              icon={ClipboardList}
              label={t('dashboard.kpi.myPendingTasks')}
              value={workflowStats?.myPendingTasks ?? '—'}
              loading={isLoading}
              colorIdx={4}
            />
          )}
          {canViewUsers && (
            <KpiCard
              icon={Users}
              label={t('dashboard.kpi.users')}
              value={usersLoading ? '—' : users.length}
              sub={
                usersLoading
                  ? undefined
                  : t('dashboard.kpi.usersActiveSub', {
                      active: activeUsers,
                      inactive: inactiveUsers,
                    })
              }
              loading={usersLoading}
              colorIdx={5}
            />
          )}
        </div>
      )}

      {/* Charts row 1: status donuts + weekly trend */}
      {(canViewWorkflows || canViewOrgStructure) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {canViewWorkflows && (
            <StatusDonutChart
              data={workflowStats?.statusCounts ?? {}}
              colorMap={WORKFLOW_STATUS_COLORS}
              labelKeyMap={WORKFLOW_STATUS_LABEL_KEYS}
              title={t('dashboard.charts.workflowStatus')}
              noDataLabel={noData}
              loading={isLoading}
              showAllCategories
            />
          )}
          {canViewOrgStructure && (
            <StatusDonutChart
              data={typologyStats?.extractionStatusCounts ?? {}}
              colorMap={EXTRACTION_STATUS_COLORS}
              labelKeyMap={EXTRACTION_STATUS_LABEL_KEYS}
              title={t('dashboard.charts.extractionStatus')}
              noDataLabel={noData}
              loading={isLoading}
            />
          )}
          {canViewWorkflows && (
            <WeeklyBarChart
              data={workflowStats?.weeklyTrend ?? []}
              title={t('dashboard.charts.weeklyTrend')}
              noDataLabel={noData}
              loading={isLoading}
            />
          )}
        </div>
      )}

      {/* Charts row 2: users active/inactive */}
      {canViewUsers && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <DonutChart
            slices={[
              { label: t('dashboard.charts.usersActive'), value: activeUsers, color: '#6366f1' },
              {
                label: t('dashboard.charts.usersInactive'),
                value: inactiveUsers,
                color: '#f87171',
              },
            ]}
            title={t('dashboard.charts.usersActiveTitle')}
            centerLabel={t('dashboard.charts.usersCenterLabel')}
            noDataLabel={usersLoading ? t('dashboard.kpi.loadingUsers') : noData}
          />
          <DonutChart
            slices={[
              {
                label: t('dashboard.charts.usersRegistered'),
                value: registeredUsers,
                color: '#10b981',
              },
              { label: t('dashboard.charts.usersPending'), value: pendingUsers, color: '#f59e0b' },
            ]}
            title={t('dashboard.charts.usersRegistrationTitle')}
            centerLabel={t('dashboard.charts.usersCenterLabel')}
            noDataLabel={usersLoading ? t('dashboard.kpi.loadingUsers') : noData}
          />
        </div>
      )}
    </div>
  );
}
