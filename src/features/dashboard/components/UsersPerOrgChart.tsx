import { useTranslation } from 'react-i18next';
import type { ApiCompany } from '@/lib/api/companies';
import type { OrgUserCount } from '@/lib/api/users';

interface UsersPerOrgChartProps {
  counts: OrgUserCount[];
  companies: ApiCompany[];
  loading: boolean;
}

export function UsersPerOrgChart({ counts, companies, loading }: UsersPerOrgChartProps) {
  const { t } = useTranslation();
  const companyMap = new Map(companies.map((c) => [c.id, c.name]));
  const sorted = [...counts].sort((a, b) => b.total - a.total).slice(0, 12);
  const maxTotal = Math.max(...sorted.map((r) => r.total), 1);

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-5">
        <p className="text-base font-semibold mb-4">{t('dashboard.charts.usersPerOrg')}</p>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-8 rounded bg-muted/40 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-base font-semibold">{t('dashboard.charts.usersPerOrg')}</p>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-indigo-500 inline-block" />{' '}
            {t('dashboard.charts.usersActive')}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-rose-300 inline-block" />{' '}
            {t('dashboard.charts.usersInactive')}
          </span>
        </div>
      </div>

      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('dashboard.noData')}</p>
      ) : (
        <ul className="space-y-3">
          {sorted.map((r) => {
            const orgName = companyMap.get(r.orgId) ?? r.orgId.slice(0, 8);
            const activePct = maxTotal > 0 ? (r.active / maxTotal) * 100 : 0;
            const inactivePct = maxTotal > 0 ? (r.inactive / maxTotal) * 100 : 0;
            return (
              <li key={r.orgId}>
                <div className="flex items-center justify-between mb-1 gap-2">
                  <span className="text-sm font-medium truncate max-w-[200px]">{orgName}</span>
                  <span className="text-sm text-muted-foreground shrink-0">
                    <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                      {r.active}
                    </span>
                    <span className="mx-1 opacity-40">/</span>
                    <span className="font-semibold">{r.total}</span>
                    <span className="ml-1 opacity-50">
                      {t('dashboard.charts.usersCenterLabel')}
                    </span>
                  </span>
                </div>
                <div
                  role="meter"
                  aria-valuenow={r.active}
                  aria-valuemin={0}
                  aria-valuemax={r.total}
                  aria-label={t('dashboard.charts.usersPerOrgBarLabel', {
                    org: orgName,
                    active: r.active,
                    inactive: r.inactive,
                    total: r.total,
                  })}
                  className="h-3 rounded-full bg-muted/40 overflow-hidden flex"
                >
                  <div
                    aria-hidden="true"
                    className="h-full bg-indigo-500 transition-all duration-500"
                    style={{ width: `${activePct}%` }}
                  />
                  <div
                    aria-hidden="true"
                    className="h-full bg-rose-300 dark:bg-rose-400 transition-all duration-500"
                    style={{ width: `${inactivePct}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
