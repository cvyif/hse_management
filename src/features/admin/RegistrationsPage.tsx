import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { Field, Input } from '@/components/ui/Field'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { AdminPageHeader } from '@/features/admin/AdminHeader'
import { ErrorCard, LoadingCard } from '@/features/admin/AsyncState'
import { UserStatusBadge } from '@/features/admin/Badges'
import { RoleSelect } from '@/features/admin/FormControls'
import { AdminTable, THead, Th, Td, TRow } from '@/features/admin/AdminTable'
import {
  useApproveUser,
  useCompanies,
  useRejectUser,
  useUsers,
} from '@/features/admin/hooks'
import { RoleBadge } from '@/features/layout/RoleBadge'
import { formatDateTime } from '@/lib/utils'
import { NON_ADMIN_ROLES, type Role } from '@/types/roles'
import type { UserProfile } from '@/types/user'

export function RegistrationsPage() {
  const { t } = useTranslation()
  const users = useUsers()
  const companies = useCompanies()

  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')

  const pendingUsers = useMemo(() => {
    if (!users.data) return []
    const q = search.trim().toLowerCase()
    return users.data
      .filter((u) => u.status === 'PENDING')
      .filter((u) => {
        if (roleFilter && u.requestedRole !== roleFilter) return false
        if (!q) return true
        return (
          u.displayName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
        )
      })
  }, [users.data, search, roleFilter])

  const companyName = (id?: string) =>
    companies.data?.find((c) => c.id === id)?.name

  return (
    <div className="flex flex-col gap-4">
      <AdminPageHeader
        title={t('admin.registrations.title')}
        description={t('admin.registrations.description', { count: pendingUsers.length })}
      />

      <Card>
        <CardBody className="flex flex-col gap-3 sm:flex-row">
          <Field label={t('admin.common.search')} className="flex-1">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('admin.common.searchNameEmail')}
            />
          </Field>
          <Field label={t('admin.common.filterByRole')} className="sm:w-56">
            <Select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
              <option value="">{t('admin.common.allRoles')}</option>
              {NON_ADMIN_ROLES.map((role) => (
                <option key={role} value={role}>
                  {t(`roles.${role}`)}
                </option>
              ))}
            </Select>
          </Field>
        </CardBody>
      </Card>

      {users.isError && <ErrorCard message={users.error?.message ?? t('errors.generic')} onRetry={() => void users.refetch()} />}
      {users.isPending && <LoadingCard />}

      {users.isSuccess && pendingUsers.length === 0 && (
        <Card>
          <CardBody>
            <EmptyState title={t('admin.registrations.empty')} />
          </CardBody>
        </Card>
      )}

      {users.isSuccess && pendingUsers.length > 0 && (
        <AdminTable>
          <THead>
            <Th>{t('admin.users.name')}</Th>
            <Th>{t('admin.users.email')}</Th>
            <Th>{t('admin.users.company')}</Th>
            <Th>{t('admin.users.requestedRole')}</Th>
            <Th>{t('admin.users.registeredAt')}</Th>
            <Th>{t('admin.users.status')}</Th>
            <Th>{t('admin.common.actions')}</Th>
          </THead>
          <tbody>
            {pendingUsers.map((user) => (
              <PendingRow
                key={user.uid}
                user={user}
                companyName={companyName(user.companyId)}
              />
            ))}
          </tbody>
        </AdminTable>
      )}
    </div>
  )
}

function PendingRow({ user, companyName }: { user: UserProfile; companyName?: string }) {
  const { t, i18n } = useTranslation()
  const [approving, setApproving] = useState(false)
  const [rejecting, setRejecting] = useState(false)

  return (
    <TRow>
      <Td className="font-medium text-slate-900">{user.displayName}</Td>
      <Td>{user.email}</Td>
      <Td>{companyName ?? t('common.notAvailable')}</Td>
      <Td>{user.requestedRole ? <RoleBadge role={user.requestedRole} /> : t('common.notAvailable')}</Td>
      <Td className="whitespace-nowrap">{formatDateTime(user.createdAt, i18n.language)}</Td>
      <Td><UserStatusBadge status={user.status} /></Td>
      <Td>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => setApproving(true)}>
            {t('admin.registrations.approve')}
          </Button>
          <Button size="sm" variant="danger" onClick={() => setRejecting(true)}>
            {t('admin.registrations.reject')}
          </Button>
        </div>
      </Td>

      {approving && (
        <ApproveDialog user={user} onClose={() => setApproving(false)} />
      )}
      {rejecting && (
        <RejectDialog user={user} onClose={() => setRejecting(false)} />
      )}
    </TRow>
  )
}

function ApproveDialog({ user, onClose }: { user: UserProfile; onClose: () => void }) {
  const { t } = useTranslation()
  const approve = useApproveUser()
  const companies = useCompanies()
  const [role, setRole] = useState<Role>(user.requestedRole ?? 'HSE_OFFICER')
  const [companyId, setCompanyId] = useState(user.companyId ?? '')
  const needsCompany = role === 'COMPANY_REP'

  return (
    <ConfirmDialog
      open
      title={t('admin.registrations.confirmApproveTitle', { name: user.displayName })}
      message={
        <div className="flex flex-col gap-3">
          <p className="text-slate-600">{t('admin.registrations.confirmApproveMessage')}</p>
          <RoleSelect value={role} onChange={setRole} />
          {needsCompany && (
            <Field label={t('admin.users.company')} required>
              <Select value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
                <option value="" disabled>
                  {t('admin.common.select')}
                </option>
                {(companies.data ?? [])
                  .filter((c) => c.active)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </Select>
            </Field>
          )}
        </div>
      }
      confirmLabel={t('admin.registrations.approve')}
      disabled={needsCompany && !companyId}
      loading={approve.isPending}
      onConfirm={() => {
        void approve
          .mutateAsync({ uid: user.uid, role, companyId: needsCompany ? companyId : undefined })
          .then(onClose)
      }}
      onCancel={onClose}
    />
  )
}

function RejectDialog({ user, onClose }: { user: UserProfile; onClose: () => void }) {
  const { t } = useTranslation()
  const reject = useRejectUser()
  const [reason, setReason] = useState('')

  return (
    <ConfirmDialog
      open
      tone="danger"
      title={t('admin.registrations.confirmRejectTitle', { name: user.displayName })}
      message={
        <Field label={t('admin.registrations.rejectReason')}>
          <Textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t('admin.registrations.rejectReasonPlaceholder')}
          />
        </Field>
      }
      confirmLabel={t('admin.registrations.reject')}
      loading={reject.isPending}
      onConfirm={() => {
        void reject.mutateAsync({ uid: user.uid, reason }).then(onClose)
      }}
      onCancel={onClose}
    />
  )
}