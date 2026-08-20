import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import {
  DASHBOARD_OBSERVATION_LIMIT,
  periodRange,
  resolveDashboardScope,
  type DashboardPeriod,
  type DashboardScope,
} from '@/features/dashboard/dashboardLogic'
import { listObservations } from '@/services/observation.service'
import { useAuthStore } from '@/stores/auth.store'

export const dashboardKeys = {
  observations: ['dashboard', 'observations'] as const,
}

/**
 * Role-aware scoped observation query backing the dashboard foundation. The
 * scope is resolved from the signed-in profile (Task 7.1 scoping foundation)
 * and the query is bounded to the newest `DASHBOARD_OBSERVATION_LIMIT`
 * records, exactly like the Site Map. Advanced aggregation is deferred.
 */
export function useDashboardData(scope: DashboardScope) {
  return useQuery({
    queryKey: [
      ...dashboardKeys.observations,
      scope.companyId ?? 'all',
      scope.areaIds ? scope.areaIds.join('|') : 'all',
    ],
    queryFn: () => listObservations(scope, DASHBOARD_OBSERVATION_LIMIT),
    // Stale counts are refreshed within a minute without a reload.
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
 * Future dashboard tasks reuse this to filter analytics by period.
 */
export function useDashboardFilters() {
  const [period, setPeriod] = useState<DashboardPeriod>('all')
  const range = useMemo(() => periodRange(period), [period])
  return { period, setPeriod, range }
}