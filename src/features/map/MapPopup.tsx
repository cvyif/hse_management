import { type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/Button'
import {
  ObservationStatusBadge,
  RiskBadge,
} from '@/features/observations/ObservationBadges'
import { riskDotClass, type MapSelection } from '@/features/map/mapLogic'
import { currentAuthorities } from '@/lib/rotations'
import { formatDateTime } from '@/lib/utils'
import type { Area } from '@/types/area'
import type { AreaAuthorityAssignment } from '@/types/areaAuthorityAssignment'
import type { Company } from '@/types/company'
import type { Observation } from '@/types/observation'
import type { Rotation } from '@/types/rotation'
import type { UserProfile } from '@/types/user'

export interface MapPopupProps {
  selection: NonNullable<MapSelection>
  areas: readonly Area[]
  observations: readonly Observation[]
  observationsByArea: Record<string, Observation[]>
  companies?: readonly Company[]
  types?: { id: string; label?: string; name?: string }[]
  assignments?: readonly AreaAuthorityAssignment[]
  rotations?: readonly Rotation[]
  users?: readonly UserProfile[]
  canReadUsers: boolean
  onClose: () => void
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-2 text-sm">
      <dt className="text-slate-500">{label}</dt>
      <dd className="min-w-0 text-slate-900">{children}</dd>
    </div>
  )
}

/**
 * Selection panel for a map marker. Rendered as an overlay on the map so it
 * stays in view and inside the viewport on mobile. Only data the current user
 * is authorized to see is shown (e.g. authority names are hidden for company
 * representatives).
 */
export function MapPopup({
  selection,
  areas,
  observations,
  observationsByArea,
  companies,
  types,
  assignments,
  rotations,
  users,
  canReadUsers,
  onClose,
}: MapPopupProps) {
  const { t, i18n } = useTranslation()
  const companyName = (id?: string) =>
    id ? (companies?.find((c) => c.id === id)?.name ?? id) : t('common.notAvailable')
  const areaName = (id: string) =>
    areas.find((a) => a.id === id)?.name ?? t('common.notAvailable')
  const typeLabel = (id?: string) =>
    id ? (types?.find((x) => x.id === id)?.label ?? id) : t('common.notAvailable')

  if (selection.kind === 'area') {
    const area = areas.find((a) => a.id === selection.id)
    if (!area) return null
    const areaObservations = observationsByArea[area.id] ?? []
    const open = areaObservations.filter((o) => o.status !== 'CLOSED').length
    const closed = areaObservations.filter((o) => o.status === 'CLOSED').length
    const current = currentAuthorities(
      (assignments ?? []).filter((a) => a.areaId === area.id),
    )
    const authority = canReadUsers
      ? current
          .map((assignment) => {
            const name = users?.find((u) => u.uid === assignment.userId)?.displayName
            const rotation = rotations?.find((r) => r.id === assignment.rotationId)?.label
            return { name: name ?? assignment.userId, rotation: rotation ?? null }
          })
          .filter((x): x is { name: string; rotation: string | null } => Boolean(x.name))
      : []

    return (
      <Panel title={`${t('map.area')} ${area.name}`} onClose={onClose}>
        <dl className="flex flex-col gap-2">
          <Row label={t('map.section')}>{t(`sections.${area.section}`)}</Row>
          <Row label={t('map.currentAuthority')}>
            {canReadUsers ? (
              authority.length > 0 ? (
                <span className="inline-flex flex-col gap-1">
                  {authority.map((a) => (
                    <span key={a.name}>
                      {a.name}
                      {a.rotation ? <span className="text-slate-500"> · {a.rotation}</span> : null}
                    </span>
                  ))}
                </span>
              ) : (
                <span className="text-slate-500">{t('map.authorityNotAssigned')}</span>
              )
            ) : (
              t('map.notDisplayed')
            )}
          </Row>
          <Row label={t('map.observations')}>{areaObservations.length}</Row>
          <Row label={t('map.open')}>{open}</Row>
          <Row label={t('map.closed')}>{closed}</Row>
        </dl>
        <div className="mt-3">
          <Link to={`/observations?area=${area.id}`}>
            <Button size="sm" variant="secondary" fullWidth>
              {t('map.viewArea')}
            </Button>
          </Link>
        </div>
      </Panel>
    )
  }

  if (selection.kind === 'observation') {
    const observation = observations.find((o) => o.id === selection.id)
    if (!observation) return null
    return (
      <Panel title={observation.observationId} onClose={onClose}>
        <dl className="flex flex-col gap-2">
          <Row label={t('map.company')}>{companyName(observation.companyId)}</Row>
          <Row label={t('map.area')}>{areaName(observation.areaId)}</Row>
          <Row label={t('map.risk')}>
            <RiskBadge risk={observation.riskLevel} />
          </Row>
          <Row label={t('map.type')}>{typeLabel(observation.observationTypeId)}</Row>
          <Row label={t('map.status')}>
            <ObservationStatusBadge status={observation.status} />
          </Row>
          <Row label={t('map.date')}>
            {formatDateTime(observation.createdAt, i18n.language)}
          </Row>
        </dl>
        <div className="mt-3">
          <Link to={`/observations/${observation.id}`}>
            <Button size="sm" fullWidth>
              {t('map.viewObservation')}
            </Button>
          </Link>
        </div>
      </Panel>
    )
  }

  const cluster = observationsByArea[selection.areaId] ?? []
  return (
    <Panel
      title={t('map.clusterTitle', { count: cluster.length })}
      onClose={onClose}
    >
      <ul className="flex max-h-56 flex-col gap-1 overflow-y-auto">
        {cluster.map((observation) => (
          <li key={observation.id} className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-slate-50">
            <span className="inline-flex min-w-0 items-center gap-2 text-sm">
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${riskDotClass(observation.riskLevel)}`} aria-hidden="true" />
              <span className="truncate font-medium text-slate-900">{observation.observationId}</span>
              <ObservationStatusBadge status={observation.status} />
            </span>
            <Link to={`/observations/${observation.id}`} className="shrink-0 text-xs font-medium text-sky-600 hover:underline">
              {t('map.viewObservation')}
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  )
}

function Panel({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  return (
    <div className="absolute inset-x-3 bottom-3 z-20 flex max-h-[calc(100%-2rem)] flex-col gap-2 overflow-hidden rounded-lg bg-white/95 p-3 shadow-lg ring-1 ring-slate-200 backdrop-blur sm:inset-x-auto sm:right-3 sm:top-3 sm:w-80">
      <div className="flex items-center justify-between gap-2">
        <h3 className="truncate text-sm font-semibold text-slate-900">{title}</h3>
        <Button size="sm" variant="ghost" onClick={onClose} aria-label="Close">
          ✕
        </Button>
      </div>
      <div className="overflow-y-auto">{children}</div>
    </div>
  )
}