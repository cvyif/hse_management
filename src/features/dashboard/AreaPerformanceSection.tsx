import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Card, CardBody } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorCard, LoadingCard } from '@/features/admin/AsyncState'
import { DashboardSection } from '@/features/dashboard/DashboardSection'
import {
  useAreaPerformance,
  useDashboardFilters,
  useDashboardScope,
} from '@/features/dashboard/hooks'
import { EMPTY_PERFORMANCE } from '@/features/dashboard/performance'
import { PerformanceTable, type PerformanceRow } from '@/features/dashboard/PerformanceTable'
import { cn } from '@/lib/cn'
import { SECTIONS, type Section } from '@/types/area'

type SectionFilter = '' | Section

/**
 * Task 7.3 — Area Performance. Exact server-side counts per visible area
 * (role-scoped, period-aware), sorted by total descending. Area rows drill
 * down to /observations?area=…. An OIL/GAS filter narrows the rows
 * (presentational — each Area belongs to exactly one section, so no extra
 * queries). For Company Representatives only areas where their own company
 * has observations are shown.
 */
export function AreaPerformanceSection() {
  const { t } = useTranslation()
  const scope = useDashboardScope()
  const { range } = useDashboardFilters()
  const { areas, visible, performance } = useAreaPerformance(scope, range)
  const [sectionFilter, setSectionFilter] = useState<SectionFilter>('')

  // COMPANY_REP sees only areas where their own company has observations.
  const showOnlyWithData = Boolean(scope.companyId)

  const rows = useMemo<PerformanceRow[]>(() => {
    if (!performance.data) return []
    return visible
      .filter((area) => (sectionFilter ? area.section === sectionFilter : true))
      .map((area) => ({
        id: area.id,
        label: area.name,
        linkTo: `/observations?area=${area.id}`,
        section: area.section,
        counts: performance.data[area.id] ?? EMPTY_PERFORMANCE,
      }))
      .filter((row) => (showOnlyWithData ? row.counts.total > 0 : true))
      .sort((a, b) => b.counts.total - a.counts.total)
  }, [visible, performance.data, sectionFilter, showOnlyWithData])

  const loading = areas.isPending || performance.isPending
  const error = areas.isError || performance.isError
  const empty = areas.isSuccess && visible.length === 0

  return (
    <DashboardSection
      title={t('dashboard.performance.areaTitle')}
      description={t('dashboard.performance.areaDescription')}
      action={
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-700">
            {t('dashboard.performance.sectionFilter')}
          </span>
          <div className="flex h-8 overflow-hidden rounded-md ring-1 ring-slate-300">
            {(['', ...SECTIONS] as const).map((section) => (
              <button
                key={section}
                type="button"
                onClick={() => setSectionFilter(section as SectionFilter)}
                aria-pressed={sectionFilter === section}
                className={cn(
                  'px-3 text-sm font-medium transition-colors',
                  sectionFilter === section
                    ? 'bg-sky-600 text-white'
                    : 'bg-white text-slate-700 hover:bg-slate-50',
                )}
              >
                {section === '' ? t('dashboard.performance.sectionAll') : t(`sections.${section}`)}
              </button>
            ))}
          </div>
        </div>
      }
    >
      {error && (
        <ErrorCard
          message={areas.error?.message ?? performance.error?.message ?? t('errors.generic')}
          onRetry={() => {
            void areas.refetch()
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
      {!error && !loading && !empty && rows.length === 0 && (
        <Card>
          <CardBody>
            <EmptyState
              title={t('dashboard.performance.empty')}
              description={t('dashboard.performance.emptyHint')}
            />
          </CardBody>
        </Card>
      )}
      {!error && !loading && !empty && rows.length > 0 && (
        <PerformanceTable rows={rows} variant="area" />
      )}
    </DashboardSection>
  )
}