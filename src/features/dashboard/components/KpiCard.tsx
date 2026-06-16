import type { ElementType } from 'react';

interface KpiColor {
  bg: string;
  iconBg: string;
  icon: string;
  accent: string;
}

const KPI_COLORS: KpiColor[] = [
  {
    bg: 'bg-indigo-50 dark:bg-indigo-950/40',
    iconBg: 'bg-indigo-100 dark:bg-indigo-900/60',
    icon: 'text-indigo-600 dark:text-indigo-400',
    accent: 'text-indigo-700 dark:text-indigo-300',
  },
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
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    iconBg: 'bg-amber-100 dark:bg-amber-900/60',
    icon: 'text-amber-600 dark:text-amber-400',
    accent: 'text-amber-700 dark:text-amber-300',
  },
  {
    bg: 'bg-violet-50 dark:bg-violet-950/40',
    iconBg: 'bg-violet-100 dark:bg-violet-900/60',
    icon: 'text-violet-600 dark:text-violet-400',
    accent: 'text-violet-700 dark:text-violet-300',
  },
];

interface KpiCardProps {
  icon: ElementType;
  label: string;
  value: string | number;
  valueNote?: string;
  valueSize?: string;
  sub?: string;
  loading?: boolean;
  colorIdx?: number;
}

export function KpiCard({
  icon: Icon,
  label,
  value,
  valueNote,
  valueSize = 'text-3xl',
  sub,
  loading,
  colorIdx = 0,
}: KpiCardProps) {
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
}
