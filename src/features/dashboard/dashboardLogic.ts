import type { Section } from '@/types/area'
import type { ObservationStatus, RiskLevel } from '@/types/observation'
import type { UserProfile } from '@/types/user'

/**
 * Task 7.2 — Dashboard logic: pure, UI-free helpers for the analytics layer.
 *
 * All counts come from Firestore server-side `count()` aggregation
 * (`aggregateObservationCounts`); nothing here reads or filters full
 * documents. This file provides the role scope, the date/filter foundation
 * and the KPI/chart derivations built on those exact counts.
 */

/** Statuses that are not part of the operational dashboard counts. */
export const DASHBOARD_EXCLUDED_STATUSES: readonly ObservationStatus[] = ['DRAFT', 'ASSIGNED']

/** Operational statuses shown on the dashboard (submitted + in lifecycle). */
export const OPERATIONAL_STATUSES: readonly ObservationStatus[] = [
  'OPEN',
  'ACTION_REQUIRED',
  'ACTION_SUBMITTED',
  'UNDER_VERIFICATION',
  'CLOSED',
]

/**
 * The scoped read window for dashboard analytics. Mirrors the Observation
 * list and Site Map scoping exactly so Firestore rules are never weakened:
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

/**
 * Foundational KPI buckets derived from the exact per-status counts. The
 * buckets partition the operational statuses (DRAFT/ASSIGNED excluded):
 * OPEN, corrective-action in progress, CLOSED. Totals are exact because each
 * status count is computed server-side.
 */
export interface DashboardKpis {
  total: number
  open: number
  inProgress: number
  closed: number
}

export function deriveKpis(byStatus: Record<ObservationStatus, number>): DashboardKpis {
  const total = OPERATIONAL_STATUSES.reduce((sum, status) => sum + (byStatus[status] ?? 0), 0)
  return {
    total,
    open: byStatus.OPEN ?? 0,
    inProgress:
      (byStatus.ACTION_REQUIRED ?? 0) +
      (byStatus.ACTION_SUBMITTED ?? 0) +
      (byStatus.UNDER_VERIFICATION ?? 0),
    closed: byStatus.CLOSED ?? 0,
  }
}

// ---- Chart colors (domain → hex). Charts stay generic; the maps live here
// ---- so they are pure and reusable.

export const RISK_COLORS: Record<RiskLevel, string> = {
  LOW: '#10b981',
  MEDIUM: '#f59e0b',
  HIGH: '#ef4444',
  CRITICAL: '#e11d48',
}

export const SECTION_COLORS: Record<Section, string> = {
  OIL: '#059669',
  GAS: '#d97706',
}

export const STATUS_COLORS: Record<ObservationStatus, string> = {
  DRAFT: '#94a3b8',
  OPEN: '#0ea5e9',
  ASSIGNED: '#6366f1',
  ACTION_REQUIRED: '#f59e0b',
  ACTION_SUBMITTED: '#f97316',
  UNDER_VERIFICATION: '#a855f7',
  CLOSED: '#22c55e',
}

export const TYPE_PALETTE: readonly string[] = [
  '#0ea5e9',
  '#8b5cf6',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#14b8a6',
  '#f43f5e',
  '#6366f1',
  '#84cc16',
  '#f97316',
  '#06b6d4',
  '#a855f7',
]