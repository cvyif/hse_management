import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { Card, CardBody } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorCard, LoadingCard } from '@/features/admin/AsyncState'
import { DashboardSection } from '@/features/dashboard/DashboardSection'
import {
  useCompanyPerformance,
  useDashboardFilters,
  useDashboardScope,
} from '@/features/dashboard/hooks'
import { EMPTY_PERFORMANCE } from '@/features/dashboard/performance'
import { PerformanceTable, type PerformanceRow } from '@/features/dashboard/PerformanceTable'

/**
 * Task 7.3 — Company Performance. Exact server-side counts per visible
 * company (role-scoped, period-aware), sorted by total descending. Company
 * rows drill down to /observations?company=…
 */
export function CompanyPerformanceSection() {
  const { t } = useTranslation()
  const scope = useDashboardScope()
  const { range } = useDashboardFilters()
  const { companies, visible, performance } = useCompanyPerformance(scope, range)

  const rows = useMemo<PerformanceRow[]>(() => {
    if (!performance.data) return []
    return visible
      .map((company) => ({
        id: company.id,
        label: company.name,
        linkTo: `/observations?company=${company.id}`,
        counts: performance.data[company.id] ?? EMPTY_PERFORMANCE,
      }))
      .sort((a, b) => b.counts.total - a.counts.total)
  }, [visible, performance.data])

  const loading = companies.isPending || performance.isPending
  const error = companies.isError || performance.isError
  const empty = companies.isSuccess && visible.length === 0

  return (
    <DashboardSection
      title={t('dashboard.performance.companyTitle')}
      description={t('dashboard.performance.companyDescription')}
    >
      {error && (
        <ErrorCard
          message={companies.error?.message ?? performance.error?.message ?? t('errors.generic')}
          onRetry={() => {
            void companies.refetch()
            void performance.refetch()
          }}
        />
      )}
      {!error && loading && <LoadingCard />}
      {!error && !loading && empty && (
        <Card>
          <CardBody>
            <EmptyState title={t('dashboard.empty')} description={t('dashboard.emptyHint')} />
          </CardBody>
        </Card>
      )}
      {!error && !loading && !empty && rows.length > 0 && (
        <PerformanceTable rows={rows} variant="company" />
      )}
    </DashboardSection>
  )
}