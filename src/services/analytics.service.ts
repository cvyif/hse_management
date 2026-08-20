import {
  collection,
  getCountFromServer,
  query,
  where,
  type QueryConstraint,
} from 'firebase/firestore'

import { db } from '@/config/firebase'
import { SECTIONS, type Section } from '@/types/area'
import {
  OBSERVATION_STATUSES,
  RISK_LEVELS,
  type ObservationStatus,
  type RiskLevel,
} from '@/types/observation'

/**
 * Task 7.2 — Scalable Observation Analytics.
 *
 * Every metric is computed SERVER-SIDE with Firestore `count()` aggregation
 * queries (`getCountFromServer`). No observation documents are downloaded to
 * the browser, so accuracy is exact regardless of collection size. The query
 * shapes reuse the exact role/company/area scoping the Observation list and
 * Site Map use (companyId for COMPANY_REP, areaId in [...] for AREA_AUTHORITY,
 * none for HSE/Super Admin), so the existing security rules apply unchanged
 * and unscoped queries never match unreadable documents.
 */

/** Role scoping for observation analytics (mirrors list/map scoping). */
export interface AnalyticsScope {
  companyId?: string
  areaIds?: string[]
}

/** Inclusive date window in epoch milliseconds (optional bounds). */
export interface AnalyticsWindow {
  from?: number
  to?: number
}

/** Exact server-side counts per dimension bucket. */
export interface ObservationCounts {
  byStatus: Record<ObservationStatus, number>
  byRisk: Record<RiskLevel, number>
  bySection: Record<Section, number>
  /** Keyed by observationTypeId; an empty list yields an empty record. */
  byType: Record<string, number>
}

/** Shared where-clauses: role scope + date window. */
function baseConstraints(scope: AnalyticsScope, window: AnalyticsWindow): QueryConstraint[] {
  const constraints: QueryConstraint[] = []
  if (scope.companyId) constraints.push(where('companyId', '==', scope.companyId))
  if (scope.areaIds && scope.areaIds.length > 0) {
    constraints.push(where('areaId', 'in', scope.areaIds))
  }
  if (window.from != null) constraints.push(where('createdAt', '>=', window.from))
  if (window.to != null) constraints.push(where('createdAt', '<=', window.to))
  return constraints
}

/** Run one server-side count for the given filters. */
async function countScoped(filters: readonly QueryConstraint[]): Promise<number> {
  if (!db) throw new Error('Firebase is not configured.')
  const snapshot = await getCountFromServer(
    query(collection(db, 'observations'), ...filters),
  )
  return snapshot.data().count
}

/** Count observations grouped by each value of a field (one query per value). */
async function countByField<const T extends string>(
  field: string,
  values: readonly T[],
  base: readonly QueryConstraint[],
): Promise<Record<T, number>> {
  const entries = await Promise.all(
    values.map(
      async (value) =>
        [value, await countScoped([...base, where(field, '==', value)])] as const,
    ),
  )
  return Object.fromEntries(entries) as Record<T, number>
}

/**
 * Exact, scalable dashboard analytics for a scoped observation window:
 * status, risk, section (OIL/GAS) and observation-type distributions.
 * Queries run in parallel; the count of buckets is fixed and small.
 */
export async function aggregateObservationCounts(
  scope: AnalyticsScope,
  window: AnalyticsWindow,
  typeIds: readonly string[],
): Promise<ObservationCounts> {
  if (!db) throw new Error('Firebase is not configured.')
  const base = baseConstraints(scope, window)
  const [byStatus, byRisk, bySection, byType] = await Promise.all([
    countByField('status', OBSERVATION_STATUSES, base),
    countByField('riskLevel', RISK_LEVELS, base),
    countByField('section', SECTIONS, base),
    countByField('observationTypeId', typeIds, base),
  ])
  return { byStatus, byRisk, bySection, byType }
}