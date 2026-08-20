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
 * Task 7.2/7.3/7.4 — Scalable Observation Analytics.
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
  exclusiveEnd = false,
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
  if (window.to != null) {
    // Time buckets use a half-open `[start, end)` window so bucket boundaries
    // are never double-counted.
    constraints.push(where('createdAt', exclusiveEnd ? '<' : '<=', window.to))
  }
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

// ---- Task 7.4: Trends & Time Analytics -------------------------------

/** Time-bucket granularity for trend series. */
export type TrendGranularity = 'day' | 'week' | 'month'

export const TREND_GRANULARITIES: readonly TrendGranularity[] = ['day', 'week', 'month']

/**
 * Hard cap on trend buckets. It bounds the per-bucket query cost (11 count
 * queries per bucket) so a single Dashboard load never issues an unbounded
 * number of aggregation queries. 14 fits the recommended presets: 7 days →
 * daily (8), 30 days → weekly (5), 90 days → weekly (14), all time → monthly.
 * See `aggregateTrends` for the exact query budget.
 */
export const MAX_TREND_BUCKETS = 14

/** Buckets are aggregated in chunks so at most ~44 count queries are in flight. */
const TREND_BATCH_SIZE = 4

const DAY_MS = 86_400_000

/** One time bucket `[start, end)` in epoch milliseconds. */
export interface TrendBucket {
  start: number
  end: number
}

/** Exact per-bucket counts for one time bucket. */
export interface TrendBucketCounts {
  /** Sum of the 5 operational statuses (DRAFT/ASSIGNED excluded). */
  total: number
  /** Operational statuses only (OPEN…CLOSED); DRAFT/ASSIGNED never present. */
  status: Partial<Record<ObservationStatus, number>>
  risk: Record<RiskLevel, number>
  section: Record<Section, number>
}

/** Exact time-series analytics for the Observation Trends section. */
export interface ObservationTrends {
  granularity: TrendGranularity
  buckets: TrendBucket[]
  /** Keyed by bucket `start` (epoch ms). */
  series: Record<string, TrendBucketCounts>
  currentTotal: number
  /**
   * Total of the equivalent-duration window immediately before the selected
   * range; `null` when no previous period exists (e.g. all time).
   */
  previousTotal: number | null
  /** True when the buckets were capped to `MAX_TREND_BUCKETS`. */
  capped: boolean
}

function startOfDay(ms: number): number {
  const d = new Date(ms)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function startOfWeek(ms: number): number {
  const d = new Date(startOfDay(ms))
  const sinceMonday = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - sinceMonday)
  return d.getTime()
}

function startOfMonth(ms: number): number {
  const d = new Date(ms)
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function startOfUnit(ms: number, granularity: TrendGranularity): number {
  if (granularity === 'day') return startOfDay(ms)
  if (granularity === 'week') return startOfWeek(ms)
  return startOfMonth(ms)
}

function addUnit(ms: number, granularity: TrendGranularity, direction: 1 | -1): number {
  const d = new Date(ms)
  if (granularity === 'day') d.setDate(d.getDate() + direction)
  else if (granularity === 'week') d.setDate(d.getDate() + direction * 7)
  else d.setMonth(d.getMonth() + direction)
  return d.getTime()
}

/**
 * Aligned time buckets covering the window `[from, to)` in calendar units.
 * The first bucket is clamped to `from` and the last to `to`, so the buckets
 * partition the window exactly and their count sums match the full-window
 * total. When no `from` is given (all time) the buckets cover the most recent
 * `MAX_TREND_BUCKETS` units, keeping the aggregation bounded. Never returns
 * more than `MAX_TREND_BUCKETS` buckets.
 */
export function buildTrendBuckets(
  granularity: TrendGranularity,
  range: AnalyticsWindow,
  nowMs: number = Date.now(),
): { buckets: TrendBucket[]; capped: boolean } {
  const to = range.to ?? nowMs
  let from: number
  let capped: boolean
  if (range.from == null) {
    // All time → the most recent MAX_TREND_BUCKETS calendar units.
    let anchor = startOfDay(to)
    for (let i = 1; i < MAX_TREND_BUCKETS; i += 1) anchor = addUnit(anchor, granularity, -1)
    from = anchor
    capped = true
  } else {
    from = range.from
    capped = false
  }

  const buckets: TrendBucket[] = []
  let start = startOfUnit(from, granularity)
  while (start < to && buckets.length < MAX_TREND_BUCKETS) {
    let end = addUnit(start, granularity, 1)
    if (end > to) end = to
    if (start < from) start = from
    buckets.push({ start, end })
    start = end
  }
  // When the loop stopped because of the cap, the range is only partially
  // covered (already flagged for the all-time case; also true for a huge
  // custom window at a coarse granularity).
  capped = capped || start < to
  return { buckets, capped }
}

/**
 * Granularities that are meaningful for the range: the natural bucket count
 * must be within [3, MAX] AND fully cover the range (a capped granularity
 * would silently show only part of the window, so it is never offered).
 * All time has no meaningful start → monthly (capped, documented in the UI).
 */
export function availableTrendGranularities(range: AnalyticsWindow): TrendGranularity[] {
  if (range.from == null) return ['month']
  return TREND_GRANULARITIES.filter((granularity) => {
    const { buckets, capped } = buildTrendBuckets(granularity, range)
    if (capped || buckets.length < 3) return false
    // A monthly granularity is only meaningful for ranges of ~a month or more.
    const days = (buckets[buckets.length - 1].end - buckets[0].start) / DAY_MS
    if (granularity === 'month' && days < 28) return false
    return true
  })
}

/** The finest granularity whose buckets fit the range. */
export function defaultTrendGranularity(range: AnalyticsWindow): TrendGranularity {
  return availableTrendGranularities(range)[0] ?? 'month'
}

/**
 * Equivalent-duration window immediately before `range` (used for the
 * previous-period comparison). `null` when the range has no start (all time).
 */
export function previousRange(
  range: AnalyticsWindow,
  nowMs: number = Date.now(),
): AnalyticsWindow | null {
  if (range.from == null) return null
  const from = range.from
  const to = range.to ?? nowMs
  const duration = to - from
  return { from: from - duration, to: from }
}

/** Exact operational total for a window (DRAFT/ASSIGNED excluded). */
export async function aggregateOperationalTotal(
  scope: AnalyticsScope,
  window: AnalyticsWindow,
): Promise<number> {
  if (!db) throw new Error('Firebase is not configured.')
  const snapshot = await getCountFromServer(
    query(
      collection(db, 'observations'),
      ...baseConstraints(scope, window, undefined, true),
      where('status', 'in', [...OPERATIONAL_STATUSES]),
    ),
  )
  return snapshot.data().count
}

/**
 * Exact, bounded time-series analytics (Task 7.4). For every time bucket it
 * runs a fixed set of server-side `count()` queries — 5 operational statuses,
 * 4 risk levels, 2 sections — and the main trend is derived from the status
 * sums (no separate total query). The role scope and the bucket window are
 * pushed into every query, so results are role-scoped and period-accurate.
 *
 * Query budget: 11 × bucket count (+ 1 previous-period total when the range
 * has a start). Bucket count is capped at `MAX_TREND_BUCKETS`, and buckets
 * are processed in chunks of `TREND_BATCH_SIZE` so at most ~44 aggregation
 * queries are in flight at once. Worst common cases: 7 days → 8 daily buckets
 * (89 queries), 30 days → 5 weekly buckets (56), 90 days → 14 weekly buckets
 * (155), all time → 14 monthly buckets (154). Each query aggregates a bounded
 * window; no observation documents are ever downloaded.
 *
 * Indexes: every query reuses existing composite indexes — the scope fields
 * (companyId / areaId) + `(status | riskLevel | section)` + `createdAt`. No
 * new indexes are required.
 */
export async function aggregateTrends(
  scope: AnalyticsScope,
  range: AnalyticsWindow,
  granularity: TrendGranularity,
): Promise<ObservationTrends> {
  if (!db) throw new Error('Firebase is not configured.')
  const now = Date.now()
  const { buckets, capped } = buildTrendBuckets(granularity, range, now)
  const series: Record<string, TrendBucketCounts> = {}

  for (let i = 0; i < buckets.length; i += TREND_BATCH_SIZE) {
    const chunk = buckets.slice(i, i + TREND_BATCH_SIZE)
    const chunkResults = await Promise.all(
      chunk.map(async (bucket) => {
        const base = baseConstraints(
          scope,
          { from: bucket.start, to: bucket.end },
          undefined,
          true,
        )
        const [open, actionRequired, actionSubmitted, underVerification, closed, ...rest] =
          await Promise.all([
            countScoped([...base, where('status', '==', 'OPEN')]),
            countScoped([...base, where('status', '==', 'ACTION_REQUIRED')]),
            countScoped([...base, where('status', '==', 'ACTION_SUBMITTED')]),
            countScoped([...base, where('status', '==', 'UNDER_VERIFICATION')]),
            countScoped([...base, where('status', '==', 'CLOSED')]),
            ...RISK_LEVELS.map((risk) => countScoped([...base, where('riskLevel', '==', risk)])),
            ...SECTIONS.map((section) => countScoped([...base, where('section', '==', section)])),
          ])
        const risk = {
          LOW: rest[0],
          MEDIUM: rest[1],
          HIGH: rest[2],
          CRITICAL: rest[3],
        } as Record<RiskLevel, number>
        const section = { OIL: rest[4], GAS: rest[5] } as Record<Section, number>
        const total =
          open + actionRequired + actionSubmitted + underVerification + closed
        const counts: TrendBucketCounts = {
          total,
          status: {
            OPEN: open,
            ACTION_REQUIRED: actionRequired,
            ACTION_SUBMITTED: actionSubmitted,
            UNDER_VERIFICATION: underVerification,
            CLOSED: closed,
          },
          risk,
          section,
        }
        return [bucket.start, counts] as const
      }),
    )
    for (const [start, counts] of chunkResults) series[start] = counts
  }

  const currentTotal = buckets.reduce((sum, bucket) => sum + (series[bucket.start]?.total ?? 0), 0)
  const previous = previousRange(range, now)
  const previousTotal = previous ? await aggregateOperationalTotal(scope, previous) : null

  return { granularity, buckets, series, currentTotal, previousTotal, capped }
}