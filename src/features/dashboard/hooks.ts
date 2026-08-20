import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { useCompanies, useAreas } from '@/features/admin/hooks'
import {
  periodRange,
  resolveDashboardScope,
  visibleAreas,
  visibleCompanies,
  type DashboardPeriod,
  type DashboardScope,
  type DateRange,
} from '@/features/dashboard/dashboardLogic'
import {
  aggregateEntityPerformance,
  aggregateObservationCounts,
  aggregateTrends,
  type TrendGranularity,
} from '@/services/analytics.service'
import { useAuthStore } from '@/stores/auth.store'

export const dashboardKeys = {
  analytics: ['dashboard', 'analytics'] as const,
  performance: ['dashboard', 'performance'] as const,
  trends: ['dashboard', 'trends'] as const,
}

/**
 * Role-aware, exact dashboard analytics. The scope is resolved from the
 * signed-in profile (Task 7.1 scoping foundation) and the date window is
 * pushed into the server-side count queries (Task 7.2): no observation
 * documents are downloaded — every count is computed by Firestore.
 */
export function useDashboardAnalytics(
  scope: DashboardScope,
  range: DateRange,
  typeIds: readonly string[],
) {
  return useQuery({
    queryKey: [
      ...dashboardKeys.analytics,
      scope.companyId ?? 'all',
      scope.areaIds ? scope.areaIds.join('|') : 'all',
      range.from ?? 'all',
      range.to ?? 'all',
      typeIds.join('|'),
    ],
    queryFn: () =>
      aggregateObservationCounts(scope, {
        from: range.from ?? undefined,
        to: range.to ?? undefined,
      }, typeIds),
    // Counts are refreshed within a minute without a reload.
    refetchInterval: 60_000,
  })
}

/** The current dashboard scope derived from the signed-in profile. */
export function useDashboardScope(): DashboardScope {
  const profile = useAuthStore((s) => s.profile)
  return useMemo(() => resolveDashboardScope(profile), [profile])
}

/**
 * Date/filter foundation: the selected period and its derived date range.
 * The range is pushed into the server-side count queries by
 * `useDashboardAnalytics` / the performance hooks.
 */
export function useDashboardFilters() {
  const [period, setPeriod] = useState<DashboardPeriod>('all')
  const range = useMemo(() => periodRange(period), [period])
  return { period, setPeriod, range }
}

/**
 * Exact per-entity performance counts (Company/Area tables, Task 7.3). Runs a
 * fixed, small set of server-side `count()` queries per entity — no document
 * downloads. Role scope and date window are pushed into every query.
 */
export function useEntityPerformance(
  field: 'companyId' | 'areaId',
  ids: readonly string[],
  scope: DashboardScope,
  range: DateRange,
) {
  return useQuery({
    queryKey: [
      ...dashboardKeys.performance,
      field,
      ids.join('|'),
      scope.companyId ?? 'all',
      scope.areaIds ? scope.areaIds.join('|') : 'all',
      range.from ?? 'all',
      range.to ?? 'all',
    ],
    queryFn: () =>
      aggregateEntityPerformance(
        field,
        ids,
        scope,
        {
          from: range.from ?? undefined,
          to: range.to ?? undefined,
        },
      ),
    enabled: ids.length > 0,
    // Counts are refreshed within a minute without a reload.
    refetchInterval: 60_000,
  })
}

/** Company Performance: the visible companies + their exact counts. */
export function useCompanyPerformance(scope: DashboardScope, range: DateRange) {
  const companies = useCompanies()
  const visible = useMemo(
    () => visibleCompanies(scope, companies.data ?? []),
    [scope, companies.data],
  )
  const ids = useMemo(() => visible.map((company) => company.id), [visible])
  const performance = useEntityPerformance('companyId', ids, scope, range)
  return { companies, visible, performance }
}

/** Area Performance: the visible areas + their exact counts. */
export function useAreaPerformance(scope: DashboardScope, range: DateRange) {
  const areas = useAreas()
  const visible = useMemo(
    () => visibleAreas(scope, areas.data ?? []),
    [scope, areas.data],
  )
  const ids = useMemo(() => visible.map((area) => area.id), [visible])
  const performance = useEntityPerformance('areaId', ids, scope, range)
  return { areas, visible, performance }
}

/**
 * Observation Trends (Task 7.4): exact server-side time-series counts for the
 * scope, the selected dashboard period and a granularity. The range is pushed
 * into every bucket query; the previous-period total is computed server-side
 * too. Refreshed with the same 60-second strategy as the rest of the
 * dashboard.
 */
export function useObservationTrends(
  scope: DashboardScope,
  range: DateRange,
  granularity: TrendGranularity,
) {
  return useQuery({
    queryKey: [
      ...dashboardKeys.trends,
      granularity,
      scope.companyId ?? 'all',
      scope.areaIds ? scope.areaIds.join('|') : 'all',
      range.from ?? 'all',
      range.to ?? 'all',
    ],
    queryFn: () =>
      aggregateTrends(
        scope,
        {
          from: range.from ?? undefined,
          to: range.to ?? undefined,
        },
        granularity,
      ),
    refetchInterval: 60_000,
  })
}