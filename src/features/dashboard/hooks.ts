import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import {
  periodRange,
  resolveDashboardScope,
  type DashboardPeriod,
  type DashboardScope,
  type DateRange,
} from '@/features/dashboard/dashboardLogic'
import { aggregateObservationCounts } from '@/services/analytics.service'
import { useAuthStore } from '@/stores/auth.store'

export const dashboardKeys = {
  analytics: ['dashboard', 'analytics'] as const,
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
 * `useDashboardAnalytics`.
 */
export function useDashboardFilters() {
  const [period, setPeriod] = useState<DashboardPeriod>('all')
  const range = useMemo(() => periodRange(period), [period])
  return { period, setPeriod, range }
}