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

/**
 * Task 7.4 — Lightweight dependency-free time-series line chart. Rendered as
 * an SVG polyline with grid lines, dots and sparse bucket labels; the time
 * axis mirrors in RTL (oldest on the right). Values are also conveyed through
 * the legend/summary outside the chart, so color alone is never the only
 * signal.
 */
export function LineChart({
  labels,
  values,
  color,
  ariaLabel,
}: {
  labels: readonly string[]
  values: readonly number[]
  color: string
  ariaLabel: string
}) {
  const n = values.length
  if (n === 0) return null
  const max = Math.max(1, ...values)
  const width = 640
  const height = 180
  const padX = 8
  const padY = 14
  const plotW = width - padX * 2
  const plotH = height - padY * 2
  const rtl = typeof document !== 'undefined' && document.documentElement.dir === 'rtl'
  const xAt = (i: number) =>
    rtl ? width - padX - (i / (n - 1)) * plotW : padX + (i / (n - 1)) * plotW
  const yAt = (v: number) => padY + plotH - (v / max) * plotH
  const points = values.map((v, i) => `${xAt(i)},${yAt(v)}`).join(' ')
  const labelStep = Math.max(1, Math.ceil(n / 6))
  const axisX = rtl ? padX : width - padX
  const axisAnchor = rtl ? 'start' : 'end'

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full"
      role="img"
      aria-label={ariaLabel}
    >
      {[0, 0.5, 1].map((fraction) => {
        const y = yAt(max * fraction)
        return (
          <line
            key={fraction}
            x1={padX}
            x2={width - padX}
            y1={y}
            y2={y}
            strokeWidth="1"
            className="stroke-slate-100"
          />
        )
      })}
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {values.map((v, i) => (
        <circle key={`dot-${i}`} cx={xAt(i)} cy={yAt(v)} r="3" fill={color} />
      ))}
      <text x={axisX} y={padY + 3} fontSize="10" textAnchor={axisAnchor} className="fill-slate-500">
        {max}
      </text>
      <text
        x={axisX}
        y={height - padY + 10}
        fontSize="10"
        textAnchor={axisAnchor}
        className="fill-slate-500"
      >
        0
      </text>
      {labels.map((label, i) =>
        i % labelStep === 0 ? (
          <text
            key={`label-${i}`}
            x={xAt(i)}
            y={height - 2}
            fontSize="10"
            textAnchor="middle"
            className="fill-slate-500"
          >
            {label}
          </text>
        ) : null,
      )}
    </svg>
  )
}

/** One series of a time-series stacked bar chart. */
export interface TimeSeriesSeries {
  label: string
  color: string
  /** Aligned to the shared bucket labels. */
  values: number[]
}

/**
 * Task 7.4 — Stacked bar chart across time buckets (status/risk/section
 * trends). Column totals are shown numerically above each bar; a legend lists
 * every series with its total and share, so values are never color-only. The
 * flex column layout follows the document direction, mirroring in RTL, and
 * fits any container width without overflow.
 */
export function StackedTimeBars({
  labels,
  series,
  ariaLabel,
}: {
  labels: readonly string[]
  series: readonly TimeSeriesSeries[]
  ariaLabel: string
}) {
  const n = labels.length
  if (n === 0) return null
  const totals = labels.map((_, i) => series.reduce((sum, s) => sum + (s.values[i] ?? 0), 0))
  const grandTotal = totals.reduce((a, b) => a + b, 0)
  const max = Math.max(1, ...totals)
  const labelStep = Math.max(1, Math.ceil(n / 6))

  return (
    <div>
      <div className="flex items-end gap-1.5" role="img" aria-label={ariaLabel}>
        {labels.map((label, i) => (
          <div key={`${label}-${i}`} className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <span className="text-[10px] tabular-nums text-slate-500">{totals[i]}</span>
            <div className="flex h-36 w-full flex-col justify-end overflow-hidden rounded-sm bg-slate-100">
              {series.map((s) => {
                const value = s.values[i] ?? 0
                if (value <= 0) return null
                return (
                  <div
                    key={s.label}
                    className="w-full"
                    style={{
                      height: `${(value / max) * 100}%`,
                      backgroundColor: s.color,
                    }}
                  />
                )
              })}
            </div>
            {i % labelStep === 0 ? (
              <span className="truncate text-[10px] text-slate-500">{label}</span>
            ) : (
              <span className="text-[10px] text-slate-500">&nbsp;</span>
            )}
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1">
        {series.map((s) => {
          const total = s.values.reduce((a, b) => a + b, 0)
          return (
            <span key={s.label} className="flex items-center gap-1.5 text-sm">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: s.color }}
              />
              <span className="font-medium text-slate-700">{s.label}</span>
              <span className="tabular-nums text-slate-500">
                {total} · {percent(total, grandTotal)}%
              </span>
            </span>
          )
        })}
      </div>
    </div>
  )
}