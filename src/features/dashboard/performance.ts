import type { EntityPerformance } from '@/services/analytics.service'

/**
 * Shared Task 7.3 performance-table constants, kept outside the component
 * file so Fast Refresh is unaffected. Column keys are the `EntityPerformance`
 * field names; their display labels come from `dashboard.performance.columns.*`.
 */

/** Zero-filled counts used while entity rows are pending. */
export const EMPTY_PERFORMANCE: EntityPerformance = {
  total: 0,
  open: 0,
  actionRequired: 0,
  actionSubmitted: 0,
  underVerification: 0,
  closed: 0,
  highRisk: 0,
  criticalRisk: 0,
}

/** Numeric columns shown in both Company and Area performance tables. */
export const PERFORMANCE_COLUMNS = [
  'total',
  'open',
  'actionRequired',
  'underVerification',
  'closed',
  'highRisk',
  'criticalRisk',
] as const

export type PerformanceColumn = (typeof PERFORMANCE_COLUMNS)[number]