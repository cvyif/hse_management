import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'

export interface MapControlsProps {
  className?: string
  onZoomIn: () => void
  onZoomOut: () => void
  onReset: () => void
  canZoomIn: boolean
  canZoomOut: boolean
}

/** Floating zoom/reset controls for the Site Map (RTL-aware via `end`/`start`). */
export function MapControls({
  className,
  onZoomIn,
  onZoomOut,
  onReset,
  canZoomIn,
  canZoomOut,
}: MapControlsProps) {
  const { t } = useTranslation()
  return (
    <div className={cn('flex flex-col gap-1 rounded-lg bg-white/90 p-1 shadow ring-1 ring-slate-200', className)}>
      <Button size="sm" variant="ghost" onClick={onZoomIn} disabled={!canZoomIn} aria-label={t('map.zoomIn')} title={t('map.zoomIn')}>
        +
      </Button>
      <Button size="sm" variant="ghost" onClick={onZoomOut} disabled={!canZoomOut} aria-label={t('map.zoomOut')} title={t('map.zoomOut')}>
        −
      </Button>
      <Button size="sm" variant="ghost" onClick={onReset} aria-label={t('map.reset')} title={t('map.reset')}>
        ⟲
      </Button>
    </div>
  )
}