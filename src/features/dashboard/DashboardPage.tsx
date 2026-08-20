import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorCard } from '@/features/admin/AsyncState'
import { DashboardFilters } from '@/features/dashboard/DashboardFilters'
import { DashboardHeader } from '@/features/dashboard/DashboardHeader'
import { DashboardSection } from '@/features/dashboard/DashboardSection'
import { KpiCard, type KpiTone } from '@/features/dashboard/KpiCard'
import { computeDashboardKpis, inRange, type DashboardKpis } from '@/features/dashboard/dashboardLogic'
import {
  useDashboardData,
  useDashboardFilters,
  useDashboardScope,
} from '@/features/dashboard/hooks'
import { hasPermission } from '@/lib/permissions'
import { formatDate } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth.store'

const KPI_ITEMS: { key: keyof DashboardKpis; tone: KpiTone }[] = [
  { key: 'total', tone: 'blue' },
  { key: 'open', tone: 'amber' },
  { key: 'inProgress', tone: 'red' },
  { key: 'closed', tone: 'green' },
]

/**
 * Task 7.1 Dashboard foundation: page shell, header, date/filter foundation,
 * KPI card grid with loading/error/empty states and role-aware scoping.
 * Actual analytics and charts arrive in Tasks 7.2–7.6.
 */
export function DashboardPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const profile = useAuthStore((s) => s.profile)

  const scope = useDashboardScope()
  const { period, setPeriod, range } = useDashboardFilters()
  const observations = useDashboardData(scope)
  const canCreate = hasPermission(profile?.role, 'observation:create')

  const kpis = useMemo(() => {
    if (!observations.data) return null
    const visible = observations.data.filter((observation) => inRange(observation.createdAt, range))
    return computeDashboardKpis(visible)
  }, [observations.data, range])

  const scopeLabel = scope.companyId
    ? t('dashboard.scope.company')
    : scope.areaIds
      ? t('dashboard.scope.areas')
      : t('dashboard.scope.all')

  const rangeHint =
    range.from != null
      ? t('dashboard.filters.since', { date: formatDate(range.from, i18n.language) })
      : t('dashboard.filters.allHint')

  const empty = observations.isSuccess && kpis != null && kpis.total === 0

  return (
    <div className="flex flex-col gap-6">
      <DashboardHeader scopeLabel={scopeLabel} />

      <DashboardFilters period={period} onChange={setPeriod} rangeHint={rangeHint} />

      {observations.isError && (
        <ErrorCard
          message={observations.error?.message ?? t('errors.generic')}
          onRetry={() => void observations.refetch()}
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
              loading={observations.isPending}
            />
          ))}
        </div>
        {empty && (
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
        )}
      </DashboardSection>

      <DashboardSection
        title={t('dashboard.analytics.title')}
        description={t('dashboard.analytics.description')}
      >
        <Card>
          <CardBody>
            <EmptyState
              title={t('dashboard.analytics.empty')}
              description={t('dashboard.analytics.emptyHint')}
            />
          </CardBody>
        </Card>
      </DashboardSection>
    </div>
  )
}