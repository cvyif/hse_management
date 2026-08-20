import type { Observation, ObservationStatus } from '@/types/observation'
import type { UserProfile } from '@/types/user'

/**
 * Task 7.1 — Dashboard foundation logic: pure, UI-free helpers that establish
 * the role-aware scoping and date/filter foundations future dashboard tasks
 * (7.2–7.6) extend. No Firebase access, no analytics/charts yet.
 */

/** Statuses that are not part of the operational dashboard counts. */
export const DASHBOARD_EXCLUDED_STATUSES: readonly ObservationStatus[] = ['DRAFT', 'ASSIGNED']

/**
 * Upper bound on observations the dashboard loads (newest first). The
 * foundation KPI counts are derived from this bounded scoped window; exact
 * totals over the whole history (count aggregation) are deferred to a later
 * dashboard task.
 */
export const DASHBOARD_OBSERVATION_LIMIT = 1000

/**
 * The scoped read window for dashboard data. Mirrors the Observation list and
 * Site Map scoping exactly so Firestore rules are never weakened:
 * - COMPANY_REP → their company only.
 * - AREA_AUTHORITY → their assigned areas only (sentinel when none assigned).
 * - PA / HSE / SUPER_ADMIN → full authorized scope.
 */
export interface DashboardScope {
  companyId?: string
  areaIds?: string[]
}

export function resolveDashboardScope(profile: UserProfile | null): DashboardScope {
  if (!profile) return {}
  const companyId = profile.role === 'COMPANY_REP' ? profile.companyId : undefined
  const areaIds =
    profile.role === 'AREA_AUTHORITY'
      ? profile.assignedAreaIds.length > 0
        ? profile.assignedAreaIds
        : ['__no_areas__']
      : undefined
  return {
    ...(companyId ? { companyId } : {}),
    ...(areaIds ? { areaIds } : {}),
  }
}

/** Preset dashboard periods driving the date/filter foundation. */
export const DASHBOARD_PERIODS = ['all', '7d', '30d', '90d'] as const

export type DashboardPeriod = (typeof DASHBOARD_PERIODS)[number]

/** Inclusive date window in epoch milliseconds; `null` means unbounded. */
export interface DateRange {
  from: number | null
  to: number | null
}

/** Epoch-millisecond range for a dashboard period. */
export function periodRange(period: DashboardPeriod, nowMs: number = Date.now()): DateRange {
  if (period === 'all') return { from: null, to: null }
  const days = period === '7d' ? 7 : period === '30d' ? 30 : 90
  return { from: nowMs - days * 86_400_000, to: null }
}

/** True when an epoch-millisecond timestamp falls inside the range. */
export function inRange(ms: number, range: DateRange): boolean {
  if (range.from != null && ms < range.from) return false
  if (range.to != null && ms > range.to) return false
  return true
}

/**
 * Foundational KPI counts derived from the scoped observation window.
 * Deliberately minimal status buckets (no rates/trends/risk analysis — those
 * arrive in 7.2+). The buckets partition the non-excluded statuses:
 * OPEN, corrective-action in progress, CLOSED.
 */
export interface DashboardKpis {
  total: number
  open: number
  inProgress: number
  closed: number
}

export function computeDashboardKpis(observations: readonly Observation[]): DashboardKpis {
  let total = 0
  let open = 0
  let inProgress = 0
  let closed = 0
  for (const observation of observations) {
    if (DASHBOARD_EXCLUDED_STATUSES.includes(observation.status)) continue
    total += 1
    if (observation.status === 'OPEN') open += 1
    else if (observation.status === 'CLOSED') closed += 1
    else inProgress += 1
  }
  return { total, open, inProgress, closed }
}