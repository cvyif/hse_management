import type { ReactNode } from 'react'

import { Card, CardBody } from '@/components/ui/Card'
import { cn } from '@/lib/cn'

/**
 * Task 7.1 KPI card architecture — a reusable dashboard card that future
 * tasks (7.2+) populate with real metrics. Renders a label, a value
 * (or a skeleton while loading / an em dash when empty) and an optional
 * subtitle. The tone drives both the value color and the accent bar, and all
 * layout uses logical properties so it mirrors correctly in RTL.
 */

export type KpiTone = 'default' | 'blue' | 'green' | 'amber' | 'red'

const TONE_TEXT: Record<KpiTone, string> = {
  default: 'text-slate-900',
  blue: 'text-sky-700',
  green: 'text-emerald-700',
  amber: 'text-amber-700',
  red: 'text-red-700',
}

const TONE_ACCENT: Record<KpiTone, string> = {
  default: 'bg-slate-400',
  blue: 'bg-sky-500',
  green: 'bg-emerald-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
}

export interface KpiCardProps {
  label: string
  /** Numeric value; when undefined an em dash is shown (empty state). */
  value?: number | string
  subtitle?: string
  icon?: ReactNode
  tone?: KpiTone
  /** Shows a skeleton instead of the value while data is loading. */
  loading?: boolean
}

export function KpiCard({
  label,
  value,
  subtitle,
  icon,
  tone = 'default',
  loading = false,
}: KpiCardProps) {
  return (
    <Card className="relative overflow-hidden">
      <span aria-hidden className={cn('absolute inset-y-0 start-0 w-1', TONE_ACCENT[tone])} />
      <CardBody className="ps-5">
        <p className="flex items-center gap-1.5 text-sm font-medium text-slate-600">
          {icon}
          {label}
        </p>
        {loading ? (
          <div className="mt-2 h-8 w-20 animate-pulse rounded bg-slate-200" />
        ) : (
          <p className={cn('mt-1 text-3xl font-semibold tabular-nums', TONE_TEXT[tone])}>
            {value ?? '—'}
          </p>
        )}
        {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
      </CardBody>
    </Card>
  )
}