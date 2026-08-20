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
 * Task 7.2/7.3 — Scalable Observation Analytics.
 *
 * Every metric is computed SERVER-SIDE with Firestore `count()` aggregation
 * queries (`getCountFromServer`). No observation documents are downloaded to
 * the browser, so accuracy is exact regardless of collection size. The query
 * shapes reuse the exact role/company/area scoping the Observation list and
 * Site Map use (companyId for COMPANY_REP, areaId in [...] for AREA_AUTHORITY,
 * none for HSE/Super Admin), so the existing security rules apply unchanged
 * and unscoped queries never match unreadable documents.
 */

/**
 * The operational statuses counted by the dashboard (Task 7.2 KPIs and the
 * Task 7.3 Company/Area performance). DRAFT/ASSIGNED are deliberately
 * excluded so the "Total" reflects submitted observations in the lifecycle,
 * exactly like the existing dashboard.
 */
export const OPERATIONAL_STATUSES: readonly ObservationStatus[] = [
  'OPEN',
  'ACTION_REQUIRED',
  'ACTION_SUBMITTED',
  'UNDER_VERIFICATION',
  'CLOSED',
]

/** Max entities whose count queries run concurrently (bounded parallelism). */
const PERFORMANCE_BATCH_SIZE = 8

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
function baseConstraints(
  scope: AnalyticsScope,
  window: AnalyticsWindow,
  excludeField?: 'companyId' | 'areaId',
): QueryConstraint[] {
  const constraints: QueryConstraint[] = []
  // A per-entity query on the entity field already pins the id (which is
  // always within the role scope), so the matching scope constraint is
  // omitted — otherwise `in` + `==` on the same field would be redundant.
  // Scope constraints on the OTHER field (e.g. areaIds on a company query)
  // stay applied, so cross-entity scoping is never weakened.
  if (scope.companyId && excludeField !== 'companyId') {
    constraints.push(where('companyId', '==', scope.companyId))
  }
  if (scope.areaIds && scope.areaIds.length > 0 && excludeField !== 'areaId') {
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

/**
 * Per-entity performance counts (one row of the Company/Area tables).
 *
 * Status buckets partition the operational statuses (DRAFT/ASSIGNED excluded,
 * matching the dashboard KPIs) and `total` is their exact sum. The risk
 * buckets (`HIGH`/`CRITICAL`) are counted across all statuses, exactly like
 * the Task 7.2 risk chart, so a HIGH/CRITICAL draft is still a HIGH/CRITICAL
 * risk.
 */
export interface EntityPerformance {
  total: number
  open: number
  actionRequired: number
  actionSubmitted: number
  underVerification: number
  closed: number
  highRisk: number
  criticalRisk: number
}

const PERFORMANCE_RISKS: readonly RiskLevel[] = ['HIGH', 'CRITICAL']

/**
 * Exact per-entity counts for a field (`companyId` or `areaId`), e.g. Company
 * and Area performance tables (Task 7.3). Runs a fixed, small number of
 * server-side `count()` queries per entity (5 operational status + 2 risk) —
 * never a document download. The role scope and date window are pushed into
 * every query, so the results are role-scoped and period-accurate.
 *
 * Query volume: 7 × entity count. Entities are processed in bounded batches
 * (`PERFORMANCE_BATCH_SIZE`) so at most ~8 × 7 queries are in flight at once,
 * and the entity count itself is bounded by the domain (the companies/areas
 * registered at the station).
 *
 * Indexes: the unscoped and single-dimension cases reuse the Task 7.2
 * composite indexes `((companyId|areaId) + (status|riskLevel) + createdAt)`.
 * The cross-scoped combinations add four new ones (see
 * `firestore.indexes.json`): `(areaId, companyId, status, createdAt)`,
 * `(areaId, companyId, riskLevel, createdAt)` (AREA_AUTHORITY company
 * counts) and `(companyId, areaId, status, createdAt)`,
 * `(companyId, areaId, riskLevel, createdAt)` (COMPANY_REP area counts).
 */
export async function aggregateEntityPerformance(
  entityField: 'companyId' | 'areaId',
  entityIds: readonly string[],
  scope: AnalyticsScope,
  window: AnalyticsWindow,
): Promise<Record<string, EntityPerformance>> {
  if (!db) throw new Error('Firebase is not configured.')
  const base = baseConstraints(scope, window, entityField)
  const results: Record<string, EntityPerformance> = {}

  for (let start = 0; start < entityIds.length; start += PERFORMANCE_BATCH_SIZE) {
    const batch = entityIds.slice(start, start + PERFORMANCE_BATCH_SIZE)
    const batchResults = await Promise.all(
      batch.map(async (id) => {
        const scoped = [...base, where(entityField, '==', id)]
        const [open, actionRequired, actionSubmitted, underVerification, closed, ...riskCounts] =
          await Promise.all([
            countScoped([...scoped, where('status', '==', 'OPEN')]),
            countScoped([...scoped, where('status', '==', 'ACTION_REQUIRED')]),
            countScoped([...scoped, where('status', '==', 'ACTION_SUBMITTED')]),
            countScoped([...scoped, where('status', '==', 'UNDER_VERIFICATION')]),
            countScoped([...scoped, where('status', '==', 'CLOSED')]),
            ...PERFORMANCE_RISKS.map((risk) =>
              countScoped([...scoped, where('riskLevel', '==', risk)]),
            ),
          ])
        const [highRisk, criticalRisk] = riskCounts
        return [
          id,
          {
            total: open + actionRequired + actionSubmitted + underVerification + closed,
            open,
            actionRequired,
            actionSubmitted,
            underVerification,
            closed,
            highRisk,
            criticalRisk,
          },
        ] as const
      }),
    )
    for (const [id, counts] of batchResults) results[id] = counts
  }

  return results
}