import { useTranslation } from 'react-i18next';
import type { ApiCompany } from '@/lib/api/companies';
import { formatBytes } from '@/lib/formatters';

export interface MergedOrgStorage {
  orgId: string;
  storageTotalBytes: number;
  uploadedDocuments: number;
  workflowAttachments: number;
}

const GRAD_COLORS = [
  ['#6366f1', '#8b5cf6'],
  ['#10b981', '#059669'],
  ['#3b82f6', '#6366f1'],
  ['#f59e0b', '#f97316'],
  ['#ec4899', '#a855f7'],
] as const;

interface StoragePerOrgChartProps {
  stats: MergedOrgStorage[];
  companies: ApiCompany[];
  title: string;
  noDataLabel: string;
  loading?: boolean;
}

export function StoragePerOrgChart({
  stats,
  companies,
  title,
  noDataLabel,
  loading = false,
}: StoragePerOrgChartProps) {
  const { t } = useTranslation();

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-5">
        <p className="text-base font-semibold mb-4">{title}</p>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-8 rounded bg-muted/40 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const companyMap = new Map(companies.map((c) => [c.id, c.name]));
  const rows = stats.slice(0, 10).map((s) => ({
    id: s.orgId,
    name: companyMap.get(s.orgId) ?? s.orgId.slice(0, 8),
    bytes: s.storageTotalBytes,
    docs: s.uploadedDocuments,
    attachments: s.workflowAttachments,
  }));
  const maxBytes = Math.max(...rows.map((r) => r.bytes), 1);

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="text-base font-semibold mb-4">{title}</p>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{noDataLabel}</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r, i) => {
            const pct = (r.bytes / maxBytes) * 100;
            const [c1, c2] = GRAD_COLORS[i % GRAD_COLORS.length];
            return (
              <li key={r.id}>
                <div className="flex items-center justify-between mb-1 gap-2">
                  <span className="text-sm font-semibold truncate max-w-[200px]">{r.name}</span>
                  <span className="text-sm text-muted-foreground shrink-0">
                    <span className="font-semibold text-foreground">{formatBytes(r.bytes)}</span>
                    <span className="ml-2 opacity-50 text-xs">
                      {t('dashboard.kpi.storageDetailBreakdown', {
                        docs: r.docs,
                        attachments: r.attachments,
                      })}
                    </span>
                  </span>
                </div>
                <div
                  role="meter"
                  aria-valuenow={r.bytes}
                  aria-valuemin={0}
                  aria-valuemax={maxBytes}
                  aria-label={t('dashboard.charts.storageBarLabel', {
                    name: r.name,
                    storage: formatBytes(r.bytes),
                  })}
                  className="h-3 rounded-full bg-muted/40 overflow-hidden"
                >
                  <div
                    aria-hidden="true"
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${pct}%`,
                      background: `linear-gradient(to right, ${c1}, ${c2})`,
                    }}
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
