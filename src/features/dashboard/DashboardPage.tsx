import { useMemo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorCard } from '@/features/admin/AsyncState'
import { BarChart, DonutChart, StackedBar, type ChartDatum } from '@/features/dashboard/charts'
import { DashboardFilters } from '@/features/dashboard/DashboardFilters'
import { DashboardHeader } from '@/features/dashboard/DashboardHeader'
import { DashboardSection } from '@/features/dashboard/DashboardSection'
import { KpiCard, type KpiTone } from '@/features/dashboard/KpiCard'
import {
  OPERATIONAL_STATUSES,
  RISK_COLORS,
  SECTION_COLORS,
  STATUS_COLORS,
  TYPE_PALETTE,
  deriveKpis,
  type DashboardKpis,
} from '@/features/dashboard/dashboardLogic'
import {
  useDashboardAnalytics,
  useDashboardFilters,
  useDashboardScope,
} from '@/features/dashboard/hooks'
import { useObservationTypes } from '@/features/observations/hooks'
import { hasPermission } from '@/lib/permissions'
import { formatDate } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth.store'
import { SECTIONS } from '@/types/area'
import { RISK_LEVELS } from '@/types/observation'

const KPI_ITEMS: { key: keyof DashboardKpis; tone: KpiTone }[] = [
  { key: 'total', tone: 'blue' },
  { key: 'open', tone: 'amber' },
  { key: 'inProgress', tone: 'red' },
  { key: 'closed', tone: 'green' },
]

const OTHER_COLOR = '#94a3b8'

/** Append an "Other" bucket when the known buckets do not cover the total. */
function withOther(data: ChartDatum[], total: number, otherLabel: string): ChartDatum[] {
  const sum = data.reduce((acc, d) => acc + d.value, 0)
  const remainder = total - sum
  if (remainder > 0) data.push({ label: otherLabel, value: remainder, color: OTHER_COLOR })
  return data
}

/** A titled card that shows skeleton bars while the analytics are loading. */
function ChartCard({
  title,
  loading,
  children,
}: {
  title: string
  loading: boolean
  children: ReactNode
}) {
  return (
    <Card>
      <CardHeader>
        <h3 className="text-base font-medium text-slate-900">{title}</h3>
      </CardHeader>
      <CardBody>
        {loading ? (
          <div className="flex flex-col gap-3">
            <div className="h-3 w-full animate-pulse rounded bg-slate-200" />
            <div className="h-3 w-3/4 animate-pulse rounded bg-slate-200" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-slate-200" />
          </div>
        ) : (
          children
        )}
      </CardBody>
    </Card>
  )
}

/**
 * Task 7.2 — Scalable Observation Analytics & accurate KPIs. All counts come
 * from server-side Firestore `count()` aggregation (no full downloads); the
 * selected period is pushed into those queries, so every number is exact.
 */
export function DashboardPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const profile = useAuthStore((s) => s.profile)

  const scope = useDashboardScope()
  const { period, setPeriod, range } = useDashboardFilters()
  const typesQuery = useObservationTypes()
  const typeIds = useMemo(() => typesQuery.data?.map((type) => type.id) ?? [], [typesQuery.data])
  const analytics = useDashboardAnalytics(scope, range, typeIds)
  const canCreate = hasPermission(profile?.role, 'observation:create')

  const kpis = useMemo(
    () => (analytics.data ? deriveKpis(analytics.data.byStatus) : null),
    [analytics.data],
  )

  const charts = useMemo(() => {
    const counts = analytics.data
    if (!counts) return null
    const total = deriveKpis(counts.byStatus).total

    const risk = withOther(
      RISK_LEVELS.map((risk) => ({
        label: t(`observation.risk.${risk}`),
        value: counts.byRisk[risk] ?? 0,
        color: RISK_COLORS[risk],
      })),
      total,
      t('dashboard.charts.other'),
    )

    const status = OPERATIONAL_STATUSES.map((status) => ({
      label: t(`observationStatus.${status}`),
      value: counts.byStatus[status] ?? 0,
      color: STATUS_COLORS[status],
    }))

    const section = withOther(
      SECTIONS.map((section) => ({
        label: t(`sections.${section}`),
        value: counts.bySection[section] ?? 0,
        color: SECTION_COLORS[section],
      })),
      total,
      t('dashboard.charts.other'),
    )

    const type = withOther(
      typeIds
        .map((id, index) => ({
          label: typesQuery.data?.find((type) => type.id === id)?.label ?? id,
          value: counts.byType[id] ?? 0,
          color: TYPE_PALETTE[index % TYPE_PALETTE.length],
        }))
        .filter((datum) => datum.value > 0),
      total,
      t('dashboard.charts.other'),
    )

    return { risk, status, section, type }
  }, [analytics.data, typeIds, typesQuery.data, t])

  const scopeLabel = scope.companyId
    ? t('dashboard.scope.company')
    : scope.areaIds
      ? t('dashboard.scope.areas')
      : t('dashboard.scope.all')

  const rangeHint =
    range.from != null
      ? t('dashboard.filters.since', { date: formatDate(range.from, i18n.language) })
      : t('dashboard.filters.allHint')

  const empty = analytics.isSuccess && kpis != null && kpis.total === 0

  return (
    <div className="flex flex-col gap-6">
      <DashboardHeader scopeLabel={scopeLabel} />

      <DashboardFilters period={period} onChange={setPeriod} rangeHint={rangeHint} />

      {analytics.isError && (
        <ErrorCard
          message={analytics.error?.message ?? t('errors.generic')}
          onRetry={() => void analytics.refetch()}
        />
      )}

      <DashboardSection
        title={t('dashboard.overview.title')}
        description={t('dashboard.overview.description')}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {KPI_ITEMS.map(({ key, tone }) => (
            <KpiCard
              key={key}
              label={t(`dashboard.kpi.${key}`)}
              value={kpis?.[key]}
              subtitle={t(`dashboard.kpi.${key}Hint`)}
              tone={tone}
              loading={analytics.isPending}
            />
          ))}
        </div>
      </DashboardSection>

      {empty ? (
        <Card>
          <CardBody>
            <EmptyState
              title={t('dashboard.empty')}
              description={t('dashboard.emptyHint')}
              action={
                canCreate ? (
                  <Button onClick={() => navigate('/observations/new')}>
                    {t('nav.newObservation')}
                  </Button>
                ) : undefined
              }
            />
          </CardBody>
        </Card>
      ) : (
        <DashboardSection
          title={t('dashboard.analytics.title')}
          description={t('dashboard.analytics.description')}
        >
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ChartCard title={t('dashboard.charts.riskTitle')} loading={analytics.isPending}>
              {charts && charts.risk.length > 0 && (
                <DonutChart data={charts.risk} centerLabel={t('dashboard.charts.totalLabel')} />
              )}
            </ChartCard>
            <ChartCard title={t('dashboard.charts.statusTitle')} loading={analytics.isPending}>
              {charts && <BarChart data={charts.status} />}
            </ChartCard>
            <ChartCard title={t('dashboard.charts.sectionTitle')} loading={analytics.isPending}>
              {charts && charts.section.length > 0 && <StackedBar data={charts.section} />}
            </ChartCard>
            <ChartCard title={t('dashboard.charts.typeTitle')} loading={analytics.isPending}>
              {charts && charts.type.length > 0 ? (
                <BarChart data={charts.type} />
              ) : (
                <p className="text-sm text-slate-500">{t('dashboard.charts.noData')}</p>
              )}
            </ChartCard>
          </div>
        </DashboardSection>
      )}
    </div>
  )
}