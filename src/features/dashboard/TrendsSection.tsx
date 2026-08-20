import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorCard, LoadingCard } from '@/features/admin/AsyncState'
import { LineChart, StackedTimeBars } from '@/features/dashboard/charts'
import {
  RISK_COLORS,
  SECTION_COLORS,
  STATUS_COLORS,
} from '@/features/dashboard/dashboardLogic'
import { DashboardSection } from '@/features/dashboard/DashboardSection'
import {
  useDashboardFilters,
  useDashboardScope,
  useObservationTrends,
} from '@/features/dashboard/hooks'
import { cn } from '@/lib/cn'
import {
  OPERATIONAL_STATUSES,
  TREND_GRANULARITIES,
  availableTrendGranularities,
  defaultTrendGranularity,
  type TrendGranularity,
} from '@/services/analytics.service'
import { SECTIONS } from '@/types/area'
import { RISK_LEVELS } from '@/types/observation'

/** Localized bucket label for a trend series. */
function bucketLabel(start: number, granularity: TrendGranularity, locale: string): string {
  const date = new Date(start)
  if (granularity === 'month') {
    return new Intl.DateTimeFormat(locale, { month: 'short', year: 'numeric' }).format(date)
  }
  return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(date)
}

interface TrendSummary {
  direction: 'up' | 'down' | 'flat'
  change: number
  /** Change rate vs the previous period; null when there is no baseline. */
  rate: number | null
}

function deriveSummary(current: number, previous: number): TrendSummary {
  const change = current - previous
  const direction = change > 0 ? 'up' : change < 0 ? 'down' : 'flat'
  const rate = previous > 0 ? Math.round((change / previous) * 1000) / 10 : null
  return { direction, change, rate }
}

/** Concise current vs previous-period comparison (neutral wording). */
function TrendSummaryBlock({
  current,
  previous,
}: {
  current: number
  previous: number | null
}) {
  const { t } = useTranslation()
  const summary = previous != null ? deriveSummary(current, previous) : null

  const caption = (() => {
    if (previous == null) return t('dashboard.trends.summary.noComparison')
    if (summary?.rate == null) return t('dashboard.trends.summary.noBaseline')
    if (summary.direction === 'flat') return t('dashboard.trends.summary.noChange')
    const direction =
      summary.direction === 'up'
        ? t('dashboard.trends.summary.increased')
        : t('dashboard.trends.summary.decreased')
    return t('dashboard.trends.summary.caption', {
      direction,
      amount: Math.abs(summary.change),
      rate: summary.rate,
    })
  })()

  return (
    <div className="flex flex-col gap-3">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg bg-slate-50 p-3">
          <dt className="text-xs text-slate-500">{t('dashboard.trends.summary.current')}</dt>
          <dd className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{current}</dd>
        </div>
        <div className="rounded-lg bg-slate-50 p-3">
          <dt className="text-xs text-slate-500">{t('dashboard.trends.summary.previous')}</dt>
          <dd className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">
            {previous != null ? previous : '—'}
          </dd>
        </div>
        <div className="rounded-lg bg-slate-50 p-3">
          <dt className="text-xs text-slate-500">{t('dashboard.trends.summary.change')}</dt>
          <dd className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">
            {summary == null ? '—' : `${summary.change > 0 ? '+' : ''}${summary.change}`}
          </dd>
        </div>
        <div className="rounded-lg bg-slate-50 p-3">
          <dt className="text-xs text-slate-500">{t('dashboard.trends.summary.rate')}</dt>
          <dd className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">
            {summary?.rate != null ? `${summary.change > 0 ? '+' : ''}${summary.rate}%` : '—'}
          </dd>
        </div>
      </dl>
      <p className="text-sm text-slate-600">{caption}</p>
    </div>
  )
}

/**
 * Task 7.4 — Observation Trends. Exact server-side time-series counts for the
 * role scope and the selected dashboard period: a main observation trend (with
 * a previous-period summary), plus status, risk and OIL/GAS trends. The
 * granularity (Daily/Weekly/Monthly) is auto-selected from the range and can
 * be switched when more than one option is meaningful. Renders its own
 * loading/empty/error states so it never breaks the rest of the Dashboard.
 */
export function TrendsSection() {
  const { t, i18n } = useTranslation()
  const scope = useDashboardScope()
  const { range } = useDashboardFilters()
  const rangeWindow = useMemo(
    () => ({ from: range.from ?? undefined, to: range.to ?? undefined }),
    [range.from, range.to],
  )

  const granularities = useMemo(() => availableTrendGranularities(rangeWindow), [rangeWindow])
  const [granularity, setGranularity] = useState<TrendGranularity>(() =>
    defaultTrendGranularity(rangeWindow),
  )

  // When the dashboard period changes, fall back to a granularity that is
  // meaningful for the new range (e.g. 7d→30d drops Daily).
  useEffect(() => {
    setGranularity((current) =>
      granularities.includes(current) ? current : (granularities[0] ?? 'month'),
    )
  }, [granularities])

  const trends = useObservationTrends(scope, range, granularity)
  const showControl = granularities.length > 1
  const data = trends.data

  const labels = useMemo(
    () =>
      data?.buckets.map((bucket) => bucketLabel(bucket.start, data.granularity, i18n.language)) ??
      [],
    [data, i18n.language],
  )

  const totalValues = useMemo(
    () => data?.buckets.map((bucket) => data.series[bucket.start]?.total ?? 0) ?? [],
    [data],
  )

  const statusSeries = useMemo(
    () =>
      data
        ? OPERATIONAL_STATUSES.map((status) => ({
            label: t(`observationStatus.${status}`),
            color: STATUS_COLORS[status],
            values: data.buckets.map((bucket) => data.series[bucket.start]?.status[status] ?? 0),
          }))
        : [],
    [data, t],
  )

  const riskSeries = useMemo(
    () =>
      data
        ? RISK_LEVELS.map((risk) => ({
            label: t(`observation.risk.${risk}`),
            color: RISK_COLORS[risk],
            values: data.buckets.map((bucket) => data.series[bucket.start]?.risk[risk] ?? 0),
          }))
        : [],
    [data, t],
  )

  const sectionSeries = useMemo(
    () =>
      data
        ? SECTIONS.map((section) => ({
            label: t(`sections.${section}`),
            color: SECTION_COLORS[section],
            values: data.buckets.map((bucket) => data.series[bucket.start]?.section[section] ?? 0),
          }))
        : [],
    [data, t],
  )

  const loading = trends.isPending
  const error = trends.isError
  const empty = trends.isSuccess && (trends.data?.currentTotal ?? 0) === 0

  return (
    <DashboardSection
      title={t('dashboard.trends.title')}
      description={t('dashboard.trends.description')}
      action={
        showControl ? (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-700">
              {t('dashboard.trends.granularity.label')}
            </span>
            <div className="inline-flex rounded-md border border-slate-300 bg-white p-0.5">
              {TREND_GRANULARITIES.filter((option) => granularities.includes(option)).map(
                (option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setGranularity(option)}
                    aria-pressed={granularity === option}
                    className={cn(
                      'h-8 rounded px-3 text-sm font-medium transition-colors',
                      granularity === option
                        ? 'bg-sky-600 text-white'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                    )}
                  >
                    {t(`dashboard.trends.granularity.${option}`)}
                  </button>
                ),
              )}
            </div>
          </div>
        ) : undefined
      }
    >
      {error && (
        <ErrorCard
          message={trends.error?.message ?? t('errors.generic')}
          onRetry={() => void trends.refetch()}
        />
      )}
      {!error && loading && <LoadingCard />}
      {!error && !loading && empty && (
        <Card>
          <CardBody>
            <EmptyState
              title={t('dashboard.trends.empty')}
              description={t('dashboard.trends.emptyHint')}
            />
          </CardBody>
        </Card>
      )}
      {!error && !loading && !empty && trends.data && (
        <div className="flex flex-col gap-4">
          {trends.data.capped && (
            <p className="text-sm text-slate-500">
              {t('dashboard.trends.capped', { count: trends.data.buckets.length })}
            </p>
          )}
          <TrendSummaryBlock
            current={trends.data.currentTotal}
            previous={trends.data.previousTotal}
          />
          <Card>
            <CardHeader>
              <h3 className="text-base font-medium text-slate-900">
                {t('dashboard.trends.chart.totalTitle')}
              </h3>
            </CardHeader>
            <CardBody>
              <LineChart
                labels={labels}
                values={totalValues}
                color="#0ea5e9"
                ariaLabel={t('dashboard.trends.chart.totalAria')}
              />
            </CardBody>
          </Card>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <h3 className="text-base font-medium text-slate-900">
                  {t('dashboard.trends.chart.statusTitle')}
                </h3>
              </CardHeader>
              <CardBody>
                <StackedTimeBars
                  labels={labels}
                  series={statusSeries}
                  ariaLabel={t('dashboard.trends.chart.statusAria')}
                />
              </CardBody>
            </Card>
            <Card>
              <CardHeader>
                <h3 className="text-base font-medium text-slate-900">
                  {t('dashboard.trends.chart.riskTitle')}
                </h3>
              </CardHeader>
              <CardBody>
                <StackedTimeBars
                  labels={labels}
                  series={riskSeries}
                  ariaLabel={t('dashboard.trends.chart.riskAria')}
                />
              </CardBody>
            </Card>
            <Card>
              <CardHeader>
                <h3 className="text-base font-medium text-slate-900">
                  {t('dashboard.trends.chart.sectionTitle')}
                </h3>
              </CardHeader>
              <CardBody>
                <StackedTimeBars
                  labels={labels}
                  series={sectionSeries}
                  ariaLabel={t('dashboard.trends.chart.sectionAria')}
                />
              </CardBody>
            </Card>
          </div>
        </div>
      )}
    </DashboardSection>
  )
}