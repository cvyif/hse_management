import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { Field, Input } from '@/components/ui/Field'
import { Select } from '@/components/ui/Select'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { AdminPageHeader } from '@/features/admin/AdminHeader'
import { ErrorCard, LoadingCard } from '@/features/admin/AsyncState'
import { ActiveBadge } from '@/features/admin/Badges'
import { SectionSelect } from '@/features/admin/FormControls'
import { AdminTable, THead, Th, Td, TRow } from '@/features/admin/AdminTable'
import {
  useAreas,
  useAssignments,
  useCreateArea,
  useSetAreaActive,
  useUpdateArea,
} from '@/features/admin/hooks'
import { clampMapPoint } from '@/lib/utils'
import { SECTIONS, type Section } from '@/types/area'
import type { Area } from '@/types/area'

/** Convert a normalized map coordinate (0..1) to a percentage for input. */
const toPercent = (value: number) => Math.round(value * 100)

/** Convert a percentage input to a normalized map coordinate (0..1). */
const fromPercent = (value: number) => value / 100

export function AreasPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const areas = useAreas()
  const assignments = useAssignments()
  const [search, setSearch] = useState('')
  const [sectionFilter, setSectionFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [dialog, setDialog] = useState<'create' | Area | null>(null)

  const assignmentCount = (areaId: string) =>
    assignments.data?.filter((a) => a.areaId === areaId && a.active).length ?? 0

  const filtered = useMemo(() => {
    if (!areas.data) return []
    const q = search.trim().toLowerCase()
    return areas.data.filter((a) => {
      if (sectionFilter && a.section !== sectionFilter) return false
      if (statusFilter === 'active' && !a.active) return false
      if (statusFilter === 'inactive' && a.active) return false
      if (!q) return true
      return a.name.toLowerCase().includes(q)
    })
  }, [areas.data, search, sectionFilter, statusFilter])

  return (
    <div className="flex flex-col gap-4">
      <AdminPageHeader
        title={t('admin.areas.title')}
        description={t('admin.areas.description', { count: areas.data?.length ?? 0 })}
        action={<Button onClick={() => setDialog('create')}>{t('admin.areas.create')}</Button>}
      />

      <Card>
        <CardBody className="flex flex-col gap-3 sm:flex-row">
          <Field label={t('admin.common.search')} className="flex-1">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('admin.common.searchArea')}
            />
          </Field>
          <Field label={t('admin.areas.filterBySection')} className="sm:w-48">
            <Select value={sectionFilter} onChange={(e) => setSectionFilter(e.target.value)}>
              <option value="">{t('admin.common.allSections')}</option>
              {SECTIONS.map((section) => (
                <option key={section} value={section}>
                  {t(`sections.${section}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('admin.common.filterByStatus')} className="sm:w-48">
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">{t('admin.common.allStatuses')}</option>
              <option value="active">{t('common.active')}</option>
              <option value="inactive">{t('common.inactive')}</option>
            </Select>
          </Field>
        </CardBody>
      </Card>

      {areas.isError && <ErrorCard message={areas.error?.message ?? t('errors.generic')} onRetry={() => void areas.refetch()} />}
      {areas.isPending && <LoadingCard />}

      {areas.isSuccess && filtered.length === 0 && (
        <Card>
          <CardBody>
            <EmptyState
              title={t('admin.areas.empty')}
              action={<Button onClick={() => setDialog('create')}>{t('admin.areas.create')}</Button>}
            />
          </CardBody>
        </Card>
      )}

      {areas.isSuccess && filtered.length > 0 && (
        <AdminTable>
          <THead>
            <Th>{t('admin.areas.areaNumber')}</Th>
            <Th>{t('admin.areas.section')}</Th>
            <Th>{t('admin.areas.mapPosition')}</Th>
            <Th>{t('admin.areas.authorities')}</Th>
            <Th>{t('admin.areas.status')}</Th>
            <Th>{t('admin.common.actions')}</Th>
          </THead>
          <tbody>
            {filtered.map((area) => (
              <AreaRow
                key={area.id}
                area={area}
                authorityCount={assignmentCount(area.id)}
                onEdit={() => setDialog(area)}
                onSetMapLocation={() => navigate(`/admin/areas/${area.id}/map`)}
                onManageAuthorities={() => navigate(`/admin/assignments?area=${area.id}`)}
              />
            ))}
          </tbody>
        </AdminTable>
      )}

      {dialog && <AreaDialog area={dialog === 'create' ? null : dialog} onClose={() => setDialog(null)} />}
    </div>
  )
}

function AreaRow({
  area,
  authorityCount,
  onEdit,
  onSetMapLocation,
  onManageAuthorities,
}: {
  area: Area
  authorityCount: number
  onEdit: () => void
  onSetMapLocation: () => void
  onManageAuthorities: () => void
}) {
  const { t } = useTranslation()
  const setActive = useSetAreaActive()
  const [confirming, setConfirming] = useState(false)

  return (
    <TRow>
      <Td className="font-medium text-slate-900">{area.name}</Td>
      <Td>
        <span className={area.section === 'OIL' ? 'font-medium text-emerald-700' : 'font-medium text-amber-700'}>
          {t(`sections.${area.section}`)}
        </span>
      </Td>
      <Td className="whitespace-nowrap">
        {toPercent(area.mapPosition.x)}%, {toPercent(area.mapPosition.y)}%
      </Td>
      <Td>{authorityCount}</Td>
      <Td><ActiveBadge active={area.active} /></Td>
      <Td>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={onManageAuthorities}>
            {t('admin.areas.manageAuthorities')}
          </Button>
          <Button size="sm" variant="secondary" onClick={onSetMapLocation}>
            {t('admin.areas.setMapLocation')}
          </Button>
          <Button size="sm" variant="secondary" onClick={onEdit}>
            {t('admin.common.edit')}
          </Button>
          <Button
            size="sm"
            variant={area.active ? 'danger' : 'secondary'}
            onClick={() => setConfirming(true)}
          >
            {t(area.active ? 'admin.areas.deactivate' : 'admin.areas.activate')}
          </Button>
        </div>
      </Td>

      {confirming && (
        <ConfirmDialog
          open
          tone={area.active ? 'danger' : 'primary'}
          title={t('admin.areas.confirmToggleTitle', { name: area.name })}
          message={t(area.active ? 'admin.areas.confirmDeactivateMessage' : 'admin.areas.confirmActivateMessage')}
          confirmLabel={t(area.active ? 'admin.areas.deactivate' : 'admin.areas.activate')}
          loading={setActive.isPending}
          onConfirm={() => {
            void setActive.mutateAsync({ id: area.id, active: !area.active }).then(() =>
              setConfirming(false),
            )
          }}
          onCancel={() => setConfirming(false)}
        />
      )}
    </TRow>
  )
}

function AreaDialog({ area, onClose }: { area: Area | null; onClose: () => void }) {
  const { t } = useTranslation()
  const create = useCreateArea()
  const update = useUpdateArea()

  const [name, setName] = useState(area?.name ?? '')
  const [nameAr, setNameAr] = useState(area?.nameAr ?? '')
  const [section, setSection] = useState<Section>(area?.section ?? 'OIL')
  const [x, setX] = useState(String(area ? toPercent(area.mapPosition.x) : 50))
  const [y, setY] = useState(String(area ? toPercent(area.mapPosition.y) : 50))
  const [error, setError] = useState<string | null>(null)

  const isCreate = area == null
  const xValue = Number(x)
  const yValue = Number(y)
  const coordsValid = Number.isFinite(xValue) && Number.isFinite(yValue) &&
    xValue >= 0 && xValue <= 100 && yValue >= 0 && yValue <= 100
  const dirty =
    name.trim() !== (area?.name ?? '').trim() ||
    section !== (area?.section ?? 'OIL') ||
    (Number.isFinite(xValue) && xValue !== toPercent(area?.mapPosition.x ?? 0.5)) ||
    (Number.isFinite(yValue) && yValue !== toPercent(area?.mapPosition.y ?? 0.5))

  function submit() {
    if (!name.trim()) {
      setError(t('admin.areas.nameRequired'))
      return
    }
    if (!coordsValid) {
      setError(t('admin.areas.coordsInvalid'))
      return
    }
    const input = {
      name,
      nameAr,
      section,
      mapPosition: clampMapPoint({ x: fromPercent(xValue), y: fromPercent(yValue) }),
    }
    void (isCreate ? create.mutateAsync(input) : update.mutateAsync({ id: area.id, input })).then(
      onClose,
    )
  }

  return (
    <ConfirmDialog
      open
      title={t(isCreate ? 'admin.areas.createTitle' : 'admin.areas.editTitle')}
      message={
        <div className="flex flex-col gap-3">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Field label={t('admin.areas.areaNumber')} required>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="175" />
          </Field>
          <Field label={t('admin.areas.areaNameAr')}>
            <Input value={nameAr} onChange={(e) => setNameAr(e.target.value)} />
          </Field>
          <Field label={t('admin.areas.section')} required>
            <SectionSelect value={section} onChange={setSection} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('admin.areas.mapX')} hint={t('admin.areas.mapHint')}>
              <Input
                type="number"
                min={0}
                max={100}
                value={x}
                onChange={(e) => setX(e.target.value)}
              />
            </Field>
            <Field label={t('admin.areas.mapY')} hint={t('admin.areas.mapHint')}>
              <Input
                type="number"
                min={0}
                max={100}
                value={y}
                onChange={(e) => setY(e.target.value)}
              />
            </Field>
          </div>
        </div>
      }
      confirmLabel={t('common.save')}
      disabled={isCreate ? false : !dirty}
      loading={create.isPending || update.isPending}
      onConfirm={submit}
      onCancel={onClose}
    />
  )
}