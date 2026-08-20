import { useTranslation } from 'react-i18next'

import { RISK_LEVELS, type RiskLevel } from '@/types/observation'
import { riskDotClass } from '@/features/map/mapLogic'

const RISK_DOT_LABELS: Record<RiskLevel, string> = {
  LOW: 'text-green-700',
  MEDIUM: 'text-amber-700',
  HIGH: 'text-red-700',
  CRITICAL: 'text-rose-700',
}

/** Map legend: risk-level dots plus the Area / Observation layer symbols. */
export function MapLegend({ className }: { className?: string }) {
  const { t } = useTranslation()
  return (
    <div className={`flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-600 ${className ?? ''}`}>
      <span className="font-semibold uppercase tracking-wide text-slate-500">{t('map.legendRisk')}</span>
      {RISK_LEVELS.map((risk) => (
        <span key={risk} className="inline-flex items-center gap-1.5">
          <span className={`h-3 w-3 rounded-full ${riskDotClass(risk)}`} aria-hidden="true" />
          <span className={RISK_DOT_LABELS[risk]}>{t(`observation.risk.${risk}`)}</span>
        </span>
      ))}
      <span className="ms-2 inline-flex items-center gap-1.5">
        <span className="flex h-4 min-w-4 items-center justify-center rounded bg-slate-700 px-1 text-[10px] font-bold text-white" aria-hidden="true">
          {t('map.area')}
        </span>
        <span>{t('map.layerAreas')}</span>
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-3 w-3 rounded-full border-2 border-white bg-sky-600 shadow" aria-hidden="true" />
        <span>{t('map.layerObservations')}</span>
      </span>
    </div>
  )
}