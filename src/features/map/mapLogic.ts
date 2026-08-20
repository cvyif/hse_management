import type { Area, Section } from '@/types/area'
import type { MapPoint } from '@/types/map'
import type {
  Observation,
  ObservationStatus,
  RiskLevel,
} from '@/types/observation'

/**
 * Phase 6 map logic — pure, UI-free helpers used by the Site Map page and the
 * observation layer. Markers inherit the Area map position; observations are
 * grouped per area and spread with small deterministic offsets (never random,
 * never persisted — the Area position is authoritative).
 */

/** Upper bound on observations the map loads (newest first). */
export const MAP_OBSERVATION_LIMIT = 500

/**
 * A statuses that should never appear as map markers: DRAFT is private to the
 * reporter and ASSIGNED is a reserved, unreachable status.
 */
export const MAP_EXCLUDED_STATUSES: readonly ObservationStatus[] = ['DRAFT', 'ASSIGNED']

export interface MapFilters {
  section: '' | Section
  areaId: string
  risk: '' | RiskLevel
  status: '' | ObservationStatus
  companyId: string
  observationTypeId: string
  showAreas: boolean
  showObservations: boolean
}

export const MAP_EMPTY_FILTERS: MapFilters = {
  section: '',
  areaId: '',
  risk: '',
  status: '',
  companyId: '',
  observationTypeId: '',
  showAreas: true,
  showObservations: true,
}

/** True when an Area has a usable normalized map position. */
export function areaHasPosition(area: Area): boolean {
  return (
    area.mapPosition != null &&
    Number.isFinite(area.mapPosition.x) &&
    Number.isFinite(area.mapPosition.y)
  )
}

/** Areas that are eligible for map markers (have a position, section filter). */
export function mapAreas(areas: readonly Area[], section: '' | Section): Area[] {
  return areas.filter(
    (area) => areaHasPosition(area) && (!section || area.section === section),
  )
}

/** Observations that may be shown on the map (excludes DRAFT/ASSIGNED). */
export function mapObservations(observations: readonly Observation[]): Observation[] {
  return observations.filter((o) => !MAP_EXCLUDED_STATUSES.includes(o.status))
}

export function filterObservations(
  observations: readonly Observation[],
  filters: MapFilters,
): Observation[] {
  return observations.filter((o) => {
    if (filters.section && o.section !== filters.section) return false
    if (filters.areaId && o.areaId !== filters.areaId) return false
    if (filters.risk && o.riskLevel !== filters.risk) return false
    if (filters.status && o.status !== filters.status) return false
    if (filters.companyId && o.companyId !== filters.companyId) return false
    if (filters.observationTypeId && o.observationTypeId !== filters.observationTypeId) {
      return false
    }
    return true
  })
}

/** Up to this many observations per Area are spread discretely; more cluster. */
export const MAX_DISCRETE_OBSERVATIONS = 6

const OFFSET_STEP = 0.022
const OFFSET_COLUMNS = 3

/**
 * Small deterministic grid offsets (normalized units) so several observations
 * of the same Area do not overlap exactly. Derived from the index only — no
 * coordinates are persisted.
 */
export function discreteOffsets(count: number): MapPoint[] {
  const offsets: MapPoint[] = []
  for (let i = 0; i < count; i += 1) {
    const col = i % OFFSET_COLUMNS
    const row = Math.floor(i / OFFSET_COLUMNS)
    const x = (col - (OFFSET_COLUMNS - 1) / 2) * OFFSET_STEP
    const y = (row - (count - 1) / (2 * Math.ceil(count / OFFSET_COLUMNS))) * OFFSET_STEP * 2
    offsets.push({ x, y })
  }
  return offsets
}

export interface ObservationGroup {
  areaId: string
  observations: Observation[]
  /** Max risk in the group, used to color the cluster badge. */
  maxRisk: RiskLevel
  cluster: boolean
}

/** Group map observations by Area; groups of ≤ 6 are spread discretely. */
export function groupObservationsByArea(
  observations: readonly Observation[],
): ObservationGroup[] {
  const byArea = new Map<string, Observation[]>()
  for (const observation of observations) {
    const list = byArea.get(observation.areaId) ?? []
    list.push(observation)
    byArea.set(observation.areaId, list)
  }
  const groups: ObservationGroup[] = []
  for (const [areaId, list] of byArea) {
    const maxRisk = list.reduce<RiskLevel>((max, o) =>
      RISK_ORDER[o.riskLevel] > RISK_ORDER[max] ? o.riskLevel : max,
      'LOW',
    )
    groups.push({
      areaId,
      observations: list,
      maxRisk,
      cluster: list.length > MAX_DISCRETE_OBSERVATIONS,
    })
  }
  return groups
}

export const RISK_ORDER: Record<RiskLevel, number> = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
  CRITICAL: 3,
}

/** Tailwind classes for risk-colored observation markers (LOW → CRITICAL). */
export function riskDotClass(risk: RiskLevel): string {
  return risk === 'LOW'
    ? 'bg-green-500'
    : risk === 'MEDIUM'
      ? 'bg-amber-500'
      : risk === 'HIGH'
        ? 'bg-red-500'
        : 'bg-rose-600'
}

/** Tailwind classes for the Section chip (matches the Areas page tones). */
export function sectionChipClass(section: Section): string {
  return section === 'OIL'
    ? 'bg-emerald-600 text-white'
    : 'bg-amber-600 text-white'
}

/** Which marker a user has selected on the map (drives the popup panel). */
export type MapSelection =
  | { kind: 'area'; id: string }
  | { kind: 'observation'; id: string }
  | { kind: 'cluster'; areaId: string }
  | null