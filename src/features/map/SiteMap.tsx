import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject } from 'react'

import { SITE_MAP_IMAGE_ALT, SITE_MAP_IMAGE_URL } from '@/config/map'
import { MapControls } from '@/features/map/MapControls'
import { cn } from '@/lib/cn'
import { clampMapPoint } from '@/lib/utils'
import type { MapPoint } from '@/types/map'

const MIN_SCALE = 1
const MAX_SCALE = 4

export interface SiteMapProps {
  /** Marker layers rendered inside the scaled map world. */
  children?: ReactNode
  imageUrl?: string
  imageAlt?: string
  className?: string
  controls?: 'full' | 'none'
  /**
   * When true the viewport is fixed (no zoom/pan). The map renders at scale 1
   * so `onClickPoint` can map clicks to normalized coordinates directly
   * (used by the admin position editor).
   */
  lockViewport?: boolean
  /** Normalized map position of a click (editor). */
  onClickPoint?: (point: MapPoint) => void
  /** Receives the map container element (editor coordinate math). */
  containerRef?: RefObject<HTMLDivElement | null>
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/**
 * Image-based Site Map viewer: renders the fixed station map asset and
 * absolutely-positioned marker layers, with zoom-in/out/reset and panning.
 * Markers live inside the scaled world, so their normalized positions always
 * stay glued to the image regardless of size, zoom or pan (Phase 6 §3).
 */
export function SiteMap({
  children,
  imageUrl = SITE_MAP_IMAGE_URL,
  imageAlt = SITE_MAP_IMAGE_ALT,
  className,
  controls = 'full',
  lockViewport = false,
  onClickPoint,
  containerRef,
}: SiteMapProps) {
  const containerRefLocal = useRef<HTMLDivElement>(null)
  const containerElement = containerRef ?? containerRefLocal
  const [scale, setScale] = useState(1)
  const [tx, setTx] = useState(0)
  const [ty, setTy] = useState(0)
  const [aspect, setAspect] = useState(4 / 3)
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null)

  useEffect(() => {
    if (lockViewport) {
      setScale(1)
      setTx(0)
      setTy(0)
    }
  }, [lockViewport])

  // Wheel zoom (manual non-passive listener so the page does not scroll).
  useEffect(() => {
    const el = containerElement.current
    if (!el || lockViewport) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      setScale((current) => clamp(current + (event.deltaY < 0 ? 0.25 : -0.25), MIN_SCALE, MAX_SCALE))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [lockViewport, containerElement])

  // Keep the world covering the viewport after zoom.
  useEffect(() => {
    const el = containerElement.current
    if (!el) return
    const maxX = (el.clientWidth * (scale - 1)) / 2
    const maxY = (el.clientHeight * (scale - 1)) / 2
    setTx((current) => clamp(current, -maxX, maxX))
    setTy((current) => clamp(current, -maxY, maxY))
  }, [scale, containerElement])

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (lockViewport || scale <= 1) return
    drag.current = { x: event.clientX, y: event.clientY, moved: false }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const state = drag.current
    if (!state) return
    setTx((current) => current + (event.clientX - state.x))
    setTy((current) => current + (event.clientY - state.y))
    state.x = event.clientX
    state.y = event.clientY
  }

  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    drag.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  function handleClickPoint(event: ReactMouseEvent<HTMLDivElement>) {
    if (!onClickPoint) return
    const rect = event.currentTarget.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return
    onClickPoint(
      clampMapPoint({
        x: (event.clientX - rect.left) / rect.width,
        y: (event.clientY - rect.top) / rect.height,
      }),
    )
  }

  function zoomIn() {
    setScale((current) => clamp(current + 0.25, MIN_SCALE, MAX_SCALE))
  }

  function zoomOut() {
    setScale((current) => clamp(current - 0.25, MIN_SCALE, MAX_SCALE))
  }

  function resetView() {
    setScale(1)
    setTx(0)
    setTy(0)
  }

  const panEnabled = !lockViewport && scale > 1

  return (
    <div
      ref={containerRef ?? containerRefLocal}
      className={cn(
        'relative w-full touch-pan-y overflow-hidden rounded-lg ring-1 ring-slate-200',
        panEnabled && 'cursor-grab touch-none active:cursor-grabbing',
        className,
      )}
      style={{ aspectRatio: aspect, minHeight: lockViewport ? 320 : undefined }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClick={lockViewport ? handleClickPoint : undefined}
      data-lock-viewport={lockViewport || undefined}
    >
      <div
        className="absolute inset-0 will-change-transform"
        style={{
          transform: `translate3d(${tx}px, ${ty}px, 0) scale(${scale})`,
          transformOrigin: 'center center',
        }}
      >
        <img
          src={imageUrl}
          alt={imageAlt}
          draggable={false}
          className="block h-full w-full select-none object-fill"
          onLoad={(event) => {
            const { naturalWidth, naturalHeight } = event.currentTarget
            if (naturalWidth > 0 && naturalHeight > 0) {
              setAspect(naturalWidth / naturalHeight)
            }
          }}
        />
        <div className="pointer-events-none absolute inset-0">{children}</div>
      </div>

      {controls === 'full' && !lockViewport && (
        <MapControls
          className="absolute end-3 top-3 z-10"
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
          onReset={resetView}
          canZoomIn={scale < MAX_SCALE}
          canZoomOut={scale > MIN_SCALE}
        />
      )}
    </div>
  )
}