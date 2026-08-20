import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'

import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { Field, Input } from '@/components/ui/Field'
import { Select } from '@/components/ui/Select'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { AdminPageHeader } from '@/features/admin/AdminHeader'
import { ErrorCard, LoadingCard } from '@/features/admin/AsyncState'
import { ActiveBadge, CurrentBadge } from '@/features/admin/Badges'
import { AdminTable, THead, Th, Td, TRow } from '@/features/admin/AdminTable'
import {
  useAreas,
  useAssignments,
  useCreateAssignment,
  useRotations,
  useSetAssignmentActive,
  useUpdateAssignment,
  useUsers,
} from '@/features/admin/hooks'
import { currentAuthorities } from '@/lib/rotations'
import { formatDateTime } from '@/lib/utils'
import type { AreaAuthorityAssignment } from '@/types/areaAuthorityAssignment'

/** Epoch ms -> datetime-local input value. */
function toLocalInput(ms?: number): string {
  if (!ms) return ''
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** datetime-local input value -> epoch ms (undefined when empty/invalid). */
function fromLocalInput(value: string): number | undefined {
  if (!value) return undefined
  const ms = new Date(value).getTime()
  return Number.isFinite(ms) ? ms : undefined
}

export function AssignmentsPage() {
  const { t } = useTranslation()
  const [params] = useSearchParams()
  const preselectedArea = params.get('area') ?? ''

  const assignments = useAssignments()
  const areas = useAreas()
  const users = useUsers()
  const rotations = useRotations()

  const [areaFilter, setAreaFilter] = useState(preselectedArea)
  const [dialog, setDialog] = useState<'create' | AreaAuthorityAssignment | null>(null)

  const authorities = useMemo(
    () => (users.data ?? []).filter((u) => u.role === 'AREA_AUTHORITY'),
    [users.data],
  )

  const filtered = useMemo(() => {
    if (!assignments.data) return []
    return assignments.data.filter((a) => !areaFilter || a.areaId === areaFilter)
  }, [assignments.data, areaFilter])

  const areaName = (id: string) => areas.data?.find((a) => a.id === id)?.name
  const userNames = useMemo(() => {
    const map = new Map<string, string>()
    for (const u of users.data ?? []) map.set(u.uid, u.displayName)
    return map
  }, [users.data])
  const rotationName = (id: string) => rotations.data?.find((r) => r.id === id)?.label
  const currentByArea = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const assignment of assignments.data ?? []) {
      for (const current of currentAuthorities([assignment])) {
        const set = map.get(current.areaId) ?? new Set<string>()
        set.add(current.id)
        map.set(current.areaId, set)
      }
    }
    return map
  }, [assignments.data])

  return (
    <div className="flex flex-col gap-4">
      <AdminPageHeader
        title={t('admin.assignments.title')}
        description={t('admin.assignments.description', { count: assignments.data?.length ?? 0 })}
        action={
          <Button
            onClick={() => setDialog('create')}
            disabled={areas.data?.length === 0 || authorities.length === 0 || rotations.data?.length === 0}
          >
            {t('admin.assignments.create')}
          </Button>
        }
      />

      <Card>
        <CardBody>
          <Field label={t('admin.assignments.filterByArea')} className="max-w-sm">
            <Select value={areaFilter} onChange={(e) => setAreaFilter(e.target.value)}>
              <option value="">{t('admin.common.allAreas')}</option>
              {areas.data?.map((area) => (
                <option key={area.id} value={area.id}>
                  {area.name}
                </option>
              ))}
            </Select>
          </Field>
        </CardBody>
      </Card>

      {assignments.isError && <ErrorCard message={assignments.error?.message ?? t('errors.generic')} onRetry={() => void assignments.refetch()} />}
      {assignments.isPending && <LoadingCard />}

      {assignments.isSuccess && filtered.length === 0 && (
        <Card>
          <CardBody>
            <EmptyState
              title={t('admin.assignments.empty')}
              description={t('admin.assignments.emptyHint')}
              action={
                <Button onClick={() => setDialog('create')}>{t('admin.assignments.create')}</Button>
              }
            />
          </CardBody>
        </Card>
      )}

      {assignments.isSuccess && filtered.length > 0 && (
        <AdminTable>
          <THead>
            <Th>{t('admin.assignments.area')}</Th>
            <Th>{t('admin.assignments.authority')}</Th>
            <Th>{t('admin.assignments.rotation')}</Th>
            <Th>{t('admin.assignments.period')}</Th>
            <Th>{t('admin.assignments.current')}</Th>
            <Th>{t('admin.assignments.status')}</Th>
            <Th>{t('admin.common.actions')}</Th>
          </THead>
          <tbody>
            {filtered.map((assignment) => (
              <AssignmentRow
                key={assignment.id}
                assignment={assignment}
                areaName={areaName(assignment.areaId) ?? assignment.areaId}
                authorityName={userNames.get(assignment.userId) ?? assignment.userId}
                rotationName={rotationName(assignment.rotationId) ?? assignment.rotationId}
                current={currentByArea.get(assignment.areaId)?.has(assignment.id) ?? false}
                onEdit={() => setDialog(assignment)}
              />
            ))}
          </tbody>
        </AdminTable>
      )}

      {dialog && (
        <AssignmentDialog
          assignment={dialog === 'create' ? null : dialog}
          areas={areas.data ?? []}
          authorities={authorities.map((u) => ({ uid: u.uid, name: u.displayName }))}
          rotations={rotations.data ?? []}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  )
}

function AssignmentRow({
  assignment,
  areaName,
  authorityName,
  rotationName,
  current,
  onEdit,
}: {
  assignment: AreaAuthorityAssignment
  areaName: string
  authorityName: string
  rotationName: string
  current: boolean
  onEdit: () => void
}) {
  const { t, i18n } = useTranslation()
  const setActive = useSetAssignmentActive()
  const [confirming, setConfirming] = useState(false)

  const period = assignment.startsAt || assignment.endsAt
    ? `${assignment.startsAt ? formatDateTime(assignment.startsAt, i18n.language) : '…'} → ${assignment.endsAt ? formatDateTime(assignment.endsAt, i18n.language) : '…'}`
    : t('admin.assignments.openEnded')

  return (
    <TRow>
      <Td className="font-medium text-slate-900">{areaName}</Td>
      <Td>{authorityName}</Td>
      <Td>{rotationName}</Td>
      <Td className="text-slate-600">{period}</Td>
      <Td><CurrentBadge current={current} /></Td>
      <Td><ActiveBadge active={assignment.active} /></Td>
      <Td>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={onEdit}>
            {t('admin.common.edit')}
          </Button>
          <Button
            size="sm"
            variant={assignment.active ? 'danger' : 'secondary'}
            onClick={() => setConfirming(true)}
          >
            {t(assignment.active ? 'admin.assignments.deactivate' : 'admin.assignments.activate')}
          </Button>
        </div>
      </Td>

      {confirming && (
        <ConfirmDialog
          open
          tone={assignment.active ? 'danger' : 'primary'}
          title={t('admin.assignments.confirmToggleTitle')}
          message={t(
            assignment.active
              ? 'admin.assignments.confirmDeactivateMessage'
              : 'admin.assignments.confirmActivateMessage',
          )}
          confirmLabel={t(assignment.active ? 'admin.assignments.deactivate' : 'admin.assignments.activate')}
          loading={setActive.isPending}
          onConfirm={() => {
            void setActive.mutateAsync({ id: assignment.id, active: !assignment.active }).then(() =>
              setConfirming(false),
            )
          }}
          onCancel={() => setConfirming(false)}
        />
      )}
    </TRow>
  )
}

function AssignmentDialog({
  assignment,
  areas,
  authorities,
  rotations,
  onClose,
}: {
  assignment: AreaAuthorityAssignment | null
  areas: { id: string; name: string; active: boolean }[]
  rotations: { id: string; label: string; active: boolean }[]
  authorities: { uid: string; name: string }[]
  onClose: () => void
}) {
  const { t } = useTranslation()
  const create = useCreateAssignment()
  const update = useUpdateAssignment()

  const [areaId, setAreaId] = useState(assignment?.areaId ?? '')
  const [userId, setUserId] = useState(assignment?.userId ?? '')
  const [rotationId, setRotationId] = useState(assignment?.rotationId ?? '')
  const [startsAt, setStartsAt] = useState(toLocalInput(assignment?.startsAt))
  const [endsAt, setEndsAt] = useState(toLocalInput(assignment?.endsAt))
  const [error, setError] = useState<string | null>(null)

  const isCreate = assignment == null
  const valid = Boolean(areaId && userId && rotationId)

  function submit() {
    if (!valid) {
      setError(t('admin.assignments.requiredFields'))
      return
    }
    const input = {
      areaId,
      userId,
      rotationId,
      startsAt: fromLocalInput(startsAt),
      endsAt: fromLocalInput(endsAt),
    }
    void (isCreate
      ? create.mutateAsync(input)
      : update.mutateAsync({ id: assignment.id, input })
    ).then(onClose)
  }

  return (
    <ConfirmDialog
      open
      title={t(isCreate ? 'admin.assignments.createTitle' : 'admin.assignments.editTitle')}
      message={
        <div className="flex flex-col gap-3">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Field label={t('admin.assignments.area')} required>
            <Select value={areaId} onChange={(e) => setAreaId(e.target.value)}>
              <option value="" disabled>
                {t('admin.common.select')}
              </option>
              {areas
                .filter((a) => a.active)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
            </Select>
          </Field>
          <Field label={t('admin.assignments.authority')} required>
            <Select value={userId} onChange={(e) => setUserId(e.target.value)}>
              <option value="" disabled>
                {t('admin.common.select')}
              </option>
              {authorities.map((u) => (
                <option key={u.uid} value={u.uid}>
                  {u.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('admin.assignments.rotation')} required>
            <Select value={rotationId} onChange={(e) => setRotationId(e.target.value)}>
              <option value="" disabled>
                {t('admin.common.select')}
              </option>
              {rotations
                .filter((r) => r.active)
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
            </Select>
          </Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={t('admin.assignments.startsAt')} hint={t('admin.assignments.optional')}>
              <Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
            </Field>
            <Field label={t('admin.assignments.endsAt')} hint={t('admin.assignments.optional')}>
              <Input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
            </Field>
          </div>
        </div>
      }
      confirmLabel={t('common.save')}
      loading={create.isPending || update.isPending}
      onConfirm={submit}
      onCancel={onClose}
    />
  )
}