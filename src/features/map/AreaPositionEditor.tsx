import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorCard, LoadingCard } from '@/features/admin/AsyncState'
import { AdminPageHeader } from '@/features/admin/AdminHeader'
import { useAreas, useUpdateAreaMapPosition } from '@/features/admin/hooks'
import { AreaMarkers } from '@/features/map/AreaMarkers'
import { SiteMap } from '@/features/map/SiteMap'
import { mapAreas } from '@/features/map/mapLogic'
import { clampMapPoint } from '@/lib/utils'
import type { MapPoint } from '@/types/map'

const toPercent = (value: number) => Math.round(value * 100)

/**
 * Super Admin map-position editor (Phase 6 §5/§25). Positions the selected
 * Area on the Site Map by clicking or dragging its marker; saves normalized
 * 0..1 coordinates. Other Areas are shown for reference only.
 */
export function AreaPositionEditor() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { id = '' } = useParams()
  const areas = useAreas()
  const update = useUpdateAreaMapPosition()
  const containerRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<MapPoint | null>(null)
  const [saved, setSaved] = useState(false)

  const area = areas.data?.find((a) => a.id === id)
  const positionedAreas = mapAreas(areas.data ?? [], '')

  useEffect(() => {
    if (area) setPosition(area.mapPosition)
  }, [area])

  function toNormalized(clientX: number, clientY: number): MapPoint {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0 || rect.height === 0) {
      return clampMapPoint({ x: 0.5, y: 0.5 })
    }
    return clampMapPoint({
      x: (clientX - rect.left) / rect.width,
      y: (clientY - rect.top) / rect.height,
    })
  }

  function onPinPointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function onPinPointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
    setPosition(toNormalized(event.clientX, event.clientY))
  }

  function onPinPointerUp(event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const initial = area?.mapPosition
  const dirty =
    position != null && initial != null && (position.x !== initial.x || position.y !== initial.y)

  return (
    <div className="flex flex-col gap-4">
      <AdminPageHeader
        title={t('map.editorTitle', { name: area?.name ?? id })}
        description={t('map.editorDescription', { name: area?.name ?? id })}
        action={
          <Link to="/admin/areas">
            <Button variant="secondary">{t('map.backToAreas')}</Button>
          </Link>
        }
      />

      {areas.isError && (
        <ErrorCard message={areas.error?.message ?? t('errors.generic')} onRetry={() => void areas.refetch()} />
      )}
      {areas.isPending && <LoadingCard />}

      {areas.isSuccess && !area && (
        <Card>
          <CardBody>
            <EmptyState
              title={t('map.areaNotFound')}
              action={
                <Button onClick={() => navigate('/admin/areas')}>{t('map.backToAreas')}</Button>
              }
            />
          </CardBody>
        </Card>
      )}

      {areas.isSuccess && area && (
        <Card>
          <CardBody className="flex flex-col gap-3">
            <p className="text-sm text-slate-600">{t('map.editorHint')}</p>
            <div className="relative">
              <SiteMap
                lockViewport
                controls="none"
                containerRef={containerRef}
                onClickPoint={(point) => setPosition(point)}
              >
                <AreaMarkers areas={positionedAreas} interactiveOnly={area.id} onSelect={() => {}} />
                {position != null && (
                  <button
                    type="button"
                    aria-label={t('map.editorMarkerLabel', { name: area.name })}
                    title={t('map.editorDragHint')}
                    className="pointer-events-auto absolute z-10 -translate-x-1/2 -translate-y-1/2 cursor-move touch-none"
                    style={{ left: `${position.x * 100}%`, top: `${position.y * 100}%` }}
                    onPointerDown={onPinPointerDown}
                    onPointerMove={onPinPointerMove}
                    onPointerUp={onPinPointerUp}
                    onPointerCancel={onPinPointerUp}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <span className="flex h-9 min-w-9 items-center justify-center rounded-full bg-sky-600 px-2 text-sm font-bold text-white shadow-lg ring-4 ring-sky-300/60">
                      {area.name}
                    </span>
                  </button>
                )}
              </SiteMap>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-slate-700">
                {t('map.positionValue', {
                  x: position != null ? toPercent(position.x) : 50,
                  y: position != null ? toPercent(position.y) : 50,
                })}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {saved && <p className="text-sm font-medium text-emerald-700">{t('map.positionSaved')}</p>}
                <Button
                  disabled={!dirty}
                  loading={update.isPending}
                  onClick={() => {
                    if (position == null) return
                    setSaved(false)
                    void update.mutateAsync({ id: area.id, mapPosition: position }).then(() => setSaved(true))
                  }}
                >
                  {t('map.savePosition')}
                </Button>
              </div>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  )
}