import { useTranslation } from 'react-i18next';
import type { ApiCompany } from '@/lib/api/companies';

interface RecentOrgsListProps {
  companies: ApiCompany[];
}

export function RecentOrgsList({ companies }: RecentOrgsListProps) {
  const { t, i18n } = useTranslation();
  const recent = [...companies]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 8);

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="text-base font-semibold mb-4">{t('dashboard.charts.recentOrgs')}</p>
      {recent.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('dashboard.noData')}</p>
      ) : (
        <ul className="divide-y divide-border">
          {recent.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 py-3">
              {/* No flex-1 here: growing this div to fill the row left a huge
                  blank trailing area after short names (the dot+name content
                  doesn't itself stretch), which visually pushed the date away
                  from the name while the date/badge group looked glued
                  together right after it. min-w-0 (without grow) lets it
                  shrink down to its natural width and truncate only when a
                  long name actually needs the room. */}
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`size-2.5 rounded-full shrink-0 ${c.status === 'active' ? 'bg-emerald-500' : 'bg-slate-300'}`}
                />
                <span className="text-sm font-medium truncate min-w-0">{c.name}</span>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-sm text-muted-foreground">
                  {new Date(c.createdAt).toLocaleDateString(i18n.resolvedLanguage ?? i18n.language)}
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    c.status === 'active'
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'
                      : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                  }`}
                >
                  {c.status === 'active'
                    ? t('dashboard.orgStatus.active')
                    : t('dashboard.orgStatus.inactive')}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
