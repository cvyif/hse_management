import { useTranslation } from 'react-i18next'

import { sectionChipClass } from '@/features/map/mapLogic'
import { cn } from '@/lib/cn'
import type { Area } from '@/types/area'

export interface AreaMarkersProps {
  areas: readonly Area[]
  selectedAreaId?: string
  onSelect: (area: Area) => void
  /** Observation counts per area (shown as a badge on the chip). */
  counts?: Record<string, number>
  /** Editor mode: markers are informational, only the edited one is interactive. */
  interactiveOnly?: string
}

/**
 * Area markers: a chip showing the real Area number at the Area's normalized
 * map position. The number is the authoritative label — no invented names.
 */
export function AreaMarkers({
  areas,
  selectedAreaId,
  onSelect,
  counts,
  interactiveOnly,
}: AreaMarkersProps) {
  const { t } = useTranslation()
  return (
    <>
      {areas.map((area) => {
        const isSelected = selectedAreaId === area.id
        const editable = interactiveOnly == null || interactiveOnly === area.id
        const count = counts?.[area.id] ?? 0
        return (
          <button
            key={area.id}
            type="button"
            title={`${t('map.area')} ${area.name}`}
            onClick={() => onSelect(area)}
            disabled={!editable}
            className={cn(
              'pointer-events-auto absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold shadow-sm ring-2 ring-white/80 transition-transform',
              sectionChipClass(area.section),
              !area.active && 'opacity-50',
              isSelected && 'scale-125 ring-sky-400',
              !editable && 'cursor-default',
            )}
            style={{ left: `${area.mapPosition.x * 100}%`, top: `${area.mapPosition.y * 100}%` }}
          >
            {area.name}
            {count > 0 && (
              <span className="rounded-full bg-black/25 px-1.5 text-[10px] leading-4" aria-label={t('map.observations')}>
                {count}
              </span>
            )}
          </button>
        )
      })}
    </>
  )
}