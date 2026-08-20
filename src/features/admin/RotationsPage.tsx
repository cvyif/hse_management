import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { Field, Input } from '@/components/ui/Field'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { AdminPageHeader } from '@/features/admin/AdminHeader'
import { ErrorCard, LoadingCard } from '@/features/admin/AsyncState'
import { ActiveBadge } from '@/features/admin/Badges'
import { AdminTable, THead, Th, Td, TRow } from '@/features/admin/AdminTable'
import {
  useCreateRotation,
  useRotations,
  useSetRotationActive,
  useUpdateRotation,
} from '@/features/admin/hooks'
import type { Rotation } from '@/types/rotation'

export function RotationsPage() {
  const { t } = useTranslation()
  const rotations = useRotations()
  const [dialog, setDialog] = useState<'create' | Rotation | null>(null)

  return (
    <div className="flex flex-col gap-4">
      <AdminPageHeader
        title={t('admin.rotations.title')}
        description={t('admin.rotations.description', { count: rotations.data?.length ?? 0 })}
        action={<Button onClick={() => setDialog('create')}>{t('admin.rotations.create')}</Button>}
      />

      {rotations.isError && <ErrorCard message={rotations.error?.message ?? t('errors.generic')} onRetry={() => void rotations.refetch()} />}
      {rotations.isPending && <LoadingCard />}

      {rotations.isSuccess && rotations.data.length === 0 && (
        <Card>
          <CardBody>
            <EmptyState
              title={t('admin.rotations.empty')}
              action={<Button onClick={() => setDialog('create')}>{t('admin.rotations.create')}</Button>}
            />
          </CardBody>
        </Card>
      )}

      {rotations.isSuccess && rotations.data.length > 0 && (
        <AdminTable>
          <THead>
            <Th>{t('admin.rotations.label')}</Th>
            <Th>{t('admin.rotations.labelAr')}</Th>
            <Th>{t('admin.rotations.status')}</Th>
            <Th>{t('admin.common.actions')}</Th>
          </THead>
          <tbody>
            {rotations.data.map((rotation) => (
              <RotationRow
                key={rotation.id}
                rotation={rotation}
                onEdit={() => setDialog(rotation)}
              />
            ))}
          </tbody>
        </AdminTable>
      )}

      {dialog && (
        <RotationDialog rotation={dialog === 'create' ? null : dialog} onClose={() => setDialog(null)} />
      )}
    </div>
  )
}

function RotationRow({ rotation, onEdit }: { rotation: Rotation; onEdit: () => void }) {
  const { t } = useTranslation()
  const setActive = useSetRotationActive()
  const [confirming, setConfirming] = useState(false)

  return (
    <TRow>
      <Td className="font-medium text-slate-900">{rotation.label}</Td>
      <Td>{rotation.labelAr ?? t('common.notAvailable')}</Td>
      <Td><ActiveBadge active={rotation.active} /></Td>
      <Td>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={onEdit}>
            {t('admin.common.edit')}
          </Button>
          <Button
            size="sm"
            variant={rotation.active ? 'danger' : 'secondary'}
            onClick={() => setConfirming(true)}
          >
            {t(rotation.active ? 'admin.rotations.deactivate' : 'admin.rotations.activate')}
          </Button>
        </div>
      </Td>

      {confirming && (
        <ConfirmDialog
          open
          tone={rotation.active ? 'danger' : 'primary'}
          title={t('admin.rotations.confirmToggleTitle', { label: rotation.label })}
          message={t(
            rotation.active
              ? 'admin.rotations.confirmDeactivateMessage'
              : 'admin.rotations.confirmActivateMessage',
          )}
          confirmLabel={t(rotation.active ? 'admin.rotations.deactivate' : 'admin.rotations.activate')}
          loading={setActive.isPending}
          onConfirm={() => {
            void setActive.mutateAsync({ id: rotation.id, active: !rotation.active }).then(() =>
              setConfirming(false),
            )
          }}
          onCancel={() => setConfirming(false)}
        />
      )}
    </TRow>
  )
}

function RotationDialog({
  rotation,
  onClose,
}: {
  rotation: Rotation | null
  onClose: () => void
}) {
  const { t } = useTranslation()
  const create = useCreateRotation()
  const update = useUpdateRotation()

  const [label, setLabel] = useState(rotation?.label ?? '')
  const [labelAr, setLabelAr] = useState(rotation?.labelAr ?? '')
  const [error, setError] = useState<string | null>(null)

  const isCreate = rotation == null
  const dirty = label.trim() !== (rotation?.label ?? '').trim()

  function submit() {
    if (!label.trim()) {
      setError(t('admin.rotations.labelRequired'))
      return
    }
    const input = { label, labelAr }
    void (isCreate
      ? create.mutateAsync(input)
      : update.mutateAsync({ id: rotation.id, input })
    ).then(onClose)
  }

  return (
    <ConfirmDialog
      open
      title={t(isCreate ? 'admin.rotations.createTitle' : 'admin.rotations.editTitle')}
      message={
        <div className="flex flex-col gap-3">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Field label={t('admin.rotations.label')} required>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} />
          </Field>
          <Field label={t('admin.rotations.labelAr')}>
            <Input value={labelAr} onChange={(e) => setLabelAr(e.target.value)} />
          </Field>
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