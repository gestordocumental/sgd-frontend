import { useId } from 'react';

interface OrgGrowthChartProps {
  title: string;
  data: { label: string; count: number }[];
  noDataLabel: string;
}

export function OrgGrowthChart({ title, data, noDataLabel }: OrgGrowthChartProps) {
  const gradientId = useId();
  const hasData = data.length > 0 && data.some((d) => d.count > 0);
  const maxCount = Math.max(...data.map((d) => d.count), 1);
  const chartH = 100;
  const chartW = 320;
  const cols = data.length || 1;
  const barW = Math.floor(chartW / cols) - 6;
  // Headroom above the tallest bar for its count label — without this, the
  // month with the highest count has its bar reach y=0 and the label (drawn
  // at y - countLabelGap) lands outside the viewBox and gets clipped, i.e. invisible.
  const topPad = 16;
  // Vertical space reserved below the bars for the month-name axis labels.
  const axisLabelAreaH = 26;
  // Baseline offset (from the bottom of the bars) for the month-name labels.
  const axisLabelOffsetY = 18;
  // Gap between the top of a bar and the baseline of its count label.
  const countLabelGap = 5;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="text-base font-semibold mb-4">{title}</p>
      {!hasData ? (
        <p className="text-sm text-muted-foreground">{noDataLabel}</p>
      ) : (
        <svg viewBox={`0 0 ${chartW} ${topPad + chartH + axisLabelAreaH}`} className="w-full">
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#059669" stopOpacity="0.6" />
            </linearGradient>
          </defs>
          {data.map((d, i) => {
            const barH = Math.max((d.count / maxCount) * chartH, d.count > 0 ? 6 : 0);
            const x = i * (chartW / cols) + 3;
            const y = topPad + (chartH - barH);
            return (
              <g key={d.label}>
                <rect x={x} y={y} width={barW} height={barH} rx={4} fill={`url(#${gradientId})`} />
                <text
                  x={x + barW / 2}
                  y={topPad + chartH + axisLabelOffsetY}
                  textAnchor="middle"
                  fontSize={10}
                  fill="currentColor"
                  opacity={0.6}
                >
                  {d.label}
                </text>
                <text
                  x={x + barW / 2}
                  y={y - countLabelGap}
                  textAnchor="middle"
                  fontSize={11}
                  fill={d.count > 0 ? '#10b981' : 'currentColor'}
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
