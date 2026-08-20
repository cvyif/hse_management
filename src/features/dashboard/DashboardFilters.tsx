import { useTranslation } from 'react-i18next'

import { Card, CardBody } from '@/components/ui/Card'
import { cn } from '@/lib/cn'
import { DASHBOARD_PERIODS, type DashboardPeriod } from '@/features/dashboard/dashboardLogic'

/**
 * Task 7.1 date/filter foundation: a period segmented control (All time /
 * 7 / 30 / 90 days) with a derived range caption. Future analytics tasks
 * consume the selected period through `useDashboardFilters`.
 */
export interface DashboardFiltersProps {
  period: DashboardPeriod
  onChange: (period: DashboardPeriod) => void
  /** Caption describing the currently selected range. */
  rangeHint: string
}

export function DashboardFilters({ period, onChange, rangeHint }: DashboardFiltersProps) {
  const { t } = useTranslation()

  return (
    <Card>
      <CardBody className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-700">{t('dashboard.filters.period')}</span>
          <div className="inline-flex rounded-md border border-slate-300 bg-white p-0.5">
            {DASHBOARD_PERIODS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => onChange(option)}
                aria-pressed={option === period}
                className={cn(
                  'h-8 rounded px-3 text-sm font-medium transition-colors',
                  option === period
                    ? 'bg-sky-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                )}
              >
                {t(`dashboard.filters.periods.${option}`)}
              </button>
            ))}
          </div>
        </div>
        <p className="text-sm text-slate-500">{rangeHint}</p>
      </CardBody>
    </Card>
  )
}