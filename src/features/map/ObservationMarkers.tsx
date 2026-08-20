import { useTranslation } from 'react-i18next'

import { discreteOffsets, riskDotClass, type ObservationGroup } from '@/features/map/mapLogic'
import { cn } from '@/lib/cn'
import type { Area } from '@/types/area'
import type { Observation } from '@/types/observation'

export interface ObservationMarkersProps {
  groups: readonly ObservationGroup[]
  areasById: Record<string, Area>
  selectedObservationId?: string
  onSelectObservation: (observation: Observation) => void
  onSelectCluster: (areaId: string) => void
}

/**
 * Observation markers. Up to `MAX_DISCRETE_OBSERVATIONS` markers per Area are
 * spread with small deterministic offsets around the Area position; larger
 * groups collapse into a single risk-colored cluster badge (click-to-expand).
 * No coordinates are stored — the Area position is authoritative (Phase 6 §12).
 */
export function ObservationMarkers({
  groups,
  areasById,
  selectedObservationId,
  onSelectObservation,
  onSelectCluster,
}: ObservationMarkersProps) {
  const { t } = useTranslation()
  return (
    <>
      {groups.map((group) => {
        const area = areasById[group.areaId]
        if (!area) return null
        const position = area.mapPosition
        if (group.cluster) {
          return (
            <button
              key={`cluster-${group.areaId}`}
              type="button"
              title={t('map.clusterTitle', { count: group.observations.length })}
              onClick={() => onSelectCluster(group.areaId)}
              className={cn(
                'pointer-events-auto absolute flex h-7 min-w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full px-1.5 text-xs font-bold text-white shadow ring-2 ring-white',
                riskDotClass(group.maxRisk),
              )}
              style={{ left: `${position.x * 100}%`, top: `${position.y * 100}%` }}
            >
              {group.observations.length}
            </button>
          )
        }
        const offsets = discreteOffsets(group.observations.length)
        return group.observations.map((observation, index) => {
          const offset = offsets[index] ?? { x: 0, y: 0 }
          const isSelected = selectedObservationId === observation.id
          return (
            <button
              key={observation.id}
              type="button"
              title={observation.observationId}
              onClick={() => onSelectObservation(observation)}
              aria-label={observation.observationId}
              className={cn(
                'pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow transition-transform',
                isSelected && 'scale-125',
                riskDotClass(observation.riskLevel),
              )}
              style={{
                left: `${(position.x + offset.x) * 100}%`,
                top: `${(position.y + offset.y) * 100}%`,
                width: 14,
                height: 14,
              }}
            />
          )
        })
      })}
    </>
  )
}