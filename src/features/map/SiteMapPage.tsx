import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { Field } from '@/components/ui/Field'
import { Select } from '@/components/ui/Select'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorCard, LoadingCard } from '@/features/admin/AsyncState'
import { AdminPageHeader } from '@/features/admin/AdminHeader'
import { useSiteMapData, type MapSelection } from '@/features/map/hooks'
import {
  MAP_EMPTY_FILTERS,
  filterObservations,
  groupObservationsByArea,
  mapAreas,
  mapObservations,
  type MapFilters,
} from '@/features/map/mapLogic'
import { AreaMarkers } from '@/features/map/AreaMarkers'
import { MapLegend } from '@/features/map/MapLegend'
import { MapPopup } from '@/features/map/MapPopup'
import { ObservationMarkers } from '@/features/map/ObservationMarkers'
import { SiteMap } from '@/features/map/SiteMap'
import { cn } from '@/lib/cn'
import { hasPermission } from '@/lib/permissions'
import { RISK_LEVELS, OBSERVATION_STATUSES } from '@/types/observation'
import { SECTIONS, type Section } from '@/types/area'

const MAP_STATUSES = OBSERVATION_STATUSES.filter((s) => s !== 'DRAFT' && s !== 'ASSIGNED')

export function SiteMapPage() {
  const { t } = useTranslation()
  const data = useSiteMapData()
  const [filters, setFilters] = useState<MapFilters>(MAP_EMPTY_FILTERS)
  const [selection, setSelection] = useState<MapSelection>(null)

  const areas = useMemo(() => data.areas.data ?? [], [data.areas.data])
  const allObservations = useMemo(
    () => mapObservations(data.observations.data ?? []),
    [data.observations.data],
  )
  const positionedAreas = useMemo(
    () => mapAreas(areas, filters.section),
    [areas, filters.section],
  )
  const visibleObservations = useMemo(
    () => filterObservations(allObservations, filters),
    [allObservations, filters],
  )
  const groups = useMemo(() => groupObservationsByArea(visibleObservations), [visibleObservations])
  const areasById = useMemo(() => Object.fromEntries(areas.map((a) => [a.id, a])), [areas])
  const observationsByArea = useMemo(() => {
    const map: Record<string, (typeof allObservations)[number][]> = {}
    for (const observation of allObservations) {
      const list = map[observation.areaId] ?? []
      list.push(observation)
      map[observation.areaId] = list
    }
    return map
  }, [allObservations])
  const areaCounts = useMemo(
    () => Object.fromEntries(areas.map((a) => [a.id, observationsByArea[a.id]?.length ?? 0])),
    [areas, observationsByArea],
  )

  const canManageAreas = hasPermission(data.profile?.role, 'area:manage')

  function updateFilters(patch: Partial<MapFilters>) {
    setFilters((current) => ({ ...current, ...patch }))
    setSelection(null)
  }

  return (
    <div className="flex flex-col gap-4">
      <AdminPageHeader
        title={t('map.title')}
        description={t('map.description', {
          areas: positionedAreas.length,
          observations: visibleObservations.length,
        })}
        action={
          <div className="flex flex-wrap gap-2">
            <Link to="/observations">
              <Button variant="secondary">{t('map.viewList')}</Button>
            </Link>
            {canManageAreas && (
              <Link to="/admin/areas">
                <Button variant="secondary">{t('map.managePositions')}</Button>
              </Link>
            )}
          </div>
        }
      />

      <Card>
        <CardBody className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end gap-3">
            <Field label={t('map.section')}>
              <div className="flex h-10 overflow-hidden rounded-md ring-1 ring-slate-300">
                {(['', ...SECTIONS] as const).map((section) => (
                  <button
                    key={section}
                    type="button"
                    onClick={() => updateFilters({ section: section as '' | Section })}
                    className={cn(
                      'px-3 text-sm font-medium transition-colors',
                      filters.section === section
                        ? 'bg-sky-600 text-white'
                        : 'bg-white text-slate-700 hover:bg-slate-50',
                    )}
                  >
                    {section === '' ? t('map.all') : t(`sections.${section}`)}
                  </button>
                ))}
              </div>
            </Field>
            <Field label={t('map.area')} className="w-full sm:w-44">
              <Select value={filters.areaId} onChange={(e) => updateFilters({ areaId: e.target.value })}>
                <option value="">{t('map.areaAll')}</option>
                {areas.map((area) => (
                  <option key={area.id} value={area.id}>
                    {area.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('map.risk')} className="w-full sm:w-44">
              <Select value={filters.risk} onChange={(e) => updateFilters({ risk: e.target.value as MapFilters['risk'] })}>
                <option value="">{t('map.riskAll')}</option>
                {RISK_LEVELS.map((risk) => (
                  <option key={risk} value={risk}>
                    {t(`observation.risk.${risk}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('map.status')} className="w-full sm:w-44">
              <Select value={filters.status} onChange={(e) => updateFilters({ status: e.target.value as MapFilters['status'] })}>
                <option value="">{t('map.statusAll')}</option>
                {MAP_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {t(`observationStatus.${status}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('map.company')} className="w-full sm:w-44">
              <Select value={filters.companyId} onChange={(e) => updateFilters({ companyId: e.target.value })}>
                <option value="">{t('map.companyAll')}</option>
                {(data.companies.data ?? []).map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('map.type')} className="w-full sm:w-44">
              <Select value={filters.observationTypeId} onChange={(e) => updateFilters({ observationTypeId: e.target.value })}>
                <option value="">{t('map.typeAll')}</option>
                {(data.types.data ?? []).map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.label ?? type.id}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-700">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={filters.showAreas}
                onChange={(e) => updateFilters({ showAreas: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300"
              />
              {t('map.layerAreas')}
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={filters.showObservations}
                onChange={(e) => updateFilters({ showObservations: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300"
              />
              {t('map.layerObservations')}
            </label>
          </div>
        </CardBody>
      </Card>

      {data.areas.isError && (
        <ErrorCard message={data.areas.error?.message ?? t('errors.generic')} onRetry={() => void data.areas.refetch()} />
      )}

      {data.areas.isPending && <LoadingCard />}

      {data.areas.isSuccess && areas.length === 0 && (
        <Card>
          <CardBody>
            <EmptyState
              title={t('map.noAreas')}
              description={t('map.noAreasHint')}
              action={
                canManageAreas ? (
                  <Link to="/admin/areas">
                    <Button>{t('map.managePositions')}</Button>
                  </Link>
                ) : undefined
              }
            />
          </CardBody>
        </Card>
      )}

      {data.areas.isSuccess && areas.length > 0 && positionedAreas.length === 0 && (
        <Card>
          <CardBody>
            <EmptyState
              title={t('map.noPositions')}
              description={t('map.noPositionsHint')}
              action={
                canManageAreas ? (
                  <Link to="/admin/areas">
                    <Button>{t('map.managePositions')}</Button>
                  </Link>
                ) : undefined
              }
            />
          </CardBody>
        </Card>
      )}

      {data.areas.isSuccess && positionedAreas.length > 0 && (
        <Card>
          <CardBody className="flex flex-col gap-3">
            <div className="relative">
              <SiteMap>
                {filters.showAreas && (
                  <AreaMarkers
                    areas={positionedAreas}
                    selectedAreaId={selection?.kind === 'area' ? selection.id : undefined}
                    onSelect={(area) => setSelection({ kind: 'area', id: area.id })}
                    counts={areaCounts}
                  />
                )}
                {filters.showObservations && (
                  <ObservationMarkers
                    groups={groups}
                    areasById={areasById}
                    selectedObservationId={selection?.kind === 'observation' ? selection.id : undefined}
                    onSelectObservation={(observation) => setSelection({ kind: 'observation', id: observation.id })}
                    onSelectCluster={(areaId) => setSelection({ kind: 'cluster', areaId })}
                  />
                )}
              </SiteMap>
              {selection != null && (
                <MapPopup
                  selection={selection}
                  areas={areas}
                  observations={allObservations}
                  observationsByArea={observationsByArea}
                  companies={data.companies.data}
                  types={data.types.data}
                  assignments={data.assignments.data}
                  rotations={data.rotations.data}
                  users={data.users.data}
                  canReadUsers={data.canReadUsers}
                  onClose={() => setSelection(null)}
                />
              )}
            </div>
            {filters.showObservations && visibleObservations.length === 0 && (
              <p className="text-center text-sm text-slate-500">{t('map.noObservations')}</p>
            )}
            <MapLegend className="mt-1" />
          </CardBody>
        </Card>
      )}
    </div>
  )
}