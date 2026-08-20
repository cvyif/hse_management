/**
 * Task 7.2 chart components — lightweight, dependency-free SVG/CSS charts
 * for the dashboard analytics. Rendered from exact server-side counts
 * (`ChartDatum`); all layout uses logical/block flow so bars and legends
 * mirror correctly in RTL.
 */

export interface ChartDatum {
  label: string
  value: number
  color: string
}

function percent(value: number, total: number): number {
  if (total <= 0) return 0
  return Math.round((value / total) * 100)
}

/** Horizontal proportional bars (label, count, percentage). */
export function BarChart({ data }: { data: readonly ChartDatum[] }) {
  const max = Math.max(1, ...data.map((d) => d.value))
  const total = data.reduce((sum, d) => sum + d.value, 0)
  if (total <= 0) return null
  return (
    <ul className="flex flex-col gap-3">
      {data.map((d) => (
        <li key={d.label}>
          <div className="mb-1 flex items-center justify-between gap-2 text-sm">
            <span className="truncate font-medium text-slate-700">{d.label}</span>
            <span className="shrink-0 tabular-nums text-slate-500">
              {d.value} · {percent(d.value, total)}%
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full"
              style={{ width: `${(d.value / max) * 100}%`, backgroundColor: d.color }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}

/** A single stacked bar (e.g. OIL vs GAS) with a legend. */
export function StackedBar({ data }: { data: readonly ChartDatum[] }) {
  const total = data.reduce((sum, d) => sum + d.value, 0)
  if (total <= 0) return null
  return (
    <div>
      <div className="flex h-4 w-full overflow-hidden rounded-full bg-slate-100">
        {data.map((d) => (
          <div
            key={d.label}
            className="h-full"
            style={{ width: `${(d.value / total) * 100}%`, backgroundColor: d.color }}
          />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1">
        {data.map((d) => (
          <span key={d.label} className="flex items-center gap-1.5 text-sm">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: d.color }} />
            <span className="font-medium text-slate-700">{d.label}</span>
            <span className="tabular-nums text-slate-500">
              {d.value} · {percent(d.value, total)}%
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}

/** Donut chart with a centered total and a legend (e.g. risk distribution). */
export function DonutChart({
  data,
  centerLabel,
}: {
  data: readonly ChartDatum[]
  centerLabel?: string
}) {
  const total = data.reduce((sum, d) => sum + d.value, 0)
  if (total <= 0) return null
  const radius = 42
  const circumference = 2 * Math.PI * radius
  let offset = 0
  return (
    <div className="flex flex-wrap items-center gap-5">
      <div className="relative h-36 w-36 shrink-0">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            strokeWidth="14"
            className="stroke-slate-100"
          />
          {data.map((d) => {
            const fraction = d.value / total
            const segment = (
              <circle
                key={d.label}
                cx="50"
                cy="50"
                r={radius}
                fill="none"
                strokeWidth="14"
                stroke={d.color}
                strokeDasharray={`${fraction * circumference} ${circumference}`}
                strokeDashoffset={-offset * circumference}
              />
            )
            offset += fraction
            return segment
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold tabular-nums text-slate-900">{total}</span>
          {centerLabel && <span className="text-xs text-slate-500">{centerLabel}</span>}
        </div>
      </div>
      <ul className="flex flex-col gap-1.5">
        {data.map((d) => (
          <li key={d.label} className="flex items-center gap-2 text-sm">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: d.color }} />
            <span className="text-slate-700">{d.label}</span>
            <span className="tabular-nums text-slate-500">
              {d.value} · {percent(d.value, total)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}