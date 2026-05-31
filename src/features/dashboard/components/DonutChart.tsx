import { useTranslation } from 'react-i18next';

interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  slices: DonutSlice[];
  title: string;
  centerLabel?: string;
  noDataLabel?: string;
}

type PathEntry = DonutSlice & { path: string; _endAngle: number };

export function DonutChart({ slices, title, centerLabel, noDataLabel }: DonutChartProps) {
  const { t } = useTranslation();
  const total = slices.reduce((s, sl) => s + sl.value, 0);
  const visible = slices.filter((sl) => sl.value > 0);
  const cx = 64;
  const cy = 64;
  const r = 52;
  const innerR = 33;
  const gap = 0.03;

  const paths = visible.reduce<PathEntry[]>((acc, sl) => {
    const prevAngle = acc.length === 0 ? -Math.PI / 2 : acc[acc.length - 1]._endAngle;
    const fullAngle = (sl.value / total) * 2 * Math.PI;
    const appliedGap = Math.min(gap, fullAngle * 0.8);
    const angle = Math.max(fullAngle - appliedGap, 0);
    const startA = prevAngle + appliedGap / 2;
    const endA = startA + angle;
    const large = angle > Math.PI ? 1 : 0;
    const path = `M ${cx + r * Math.cos(startA)} ${cy + r * Math.sin(startA)}
      A ${r} ${r} 0 ${large} 1 ${cx + r * Math.cos(endA)} ${cy + r * Math.sin(endA)}
      L ${cx + innerR * Math.cos(endA)} ${cy + innerR * Math.sin(endA)}
      A ${innerR} ${innerR} 0 ${large} 0 ${cx + innerR * Math.cos(startA)} ${cy + innerR * Math.sin(startA)} Z`;
    return [...acc, { ...sl, path, _endAngle: prevAngle + fullAngle }];
  }, []);

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="text-base font-semibold mb-4">{title}</p>
      {total === 0 ? (
        <p className="text-sm text-muted-foreground">{noDataLabel ?? t('dashboard.noData')}</p>
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
              {centerLabel}
            </text>
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
  );
}
