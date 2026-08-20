import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { Field, Input } from '@/components/ui/Field'
import { Select } from '@/components/ui/Select'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { AdminPageHeader } from '@/features/admin/AdminHeader'
import { ErrorCard, LoadingCard } from '@/features/admin/AsyncState'
import { ActiveBadge, UserStatusBadge } from '@/features/admin/Badges'
import { RoleSelect } from '@/features/admin/FormControls'
import { AdminTable, THead, Th, Td, TRow } from '@/features/admin/AdminTable'
import {
  useCompanies,
  useSetUserActive,
  useSetUserCompany,
  useSetUserRole,
  useUsers,
} from '@/features/admin/hooks'
import { RoleBadge } from '@/features/layout/RoleBadge'
import { formatDateTime } from '@/lib/utils'
import { NON_ADMIN_ROLES } from '@/types/roles'
import { USER_STATUSES, type UserProfile } from '@/types/user'
import { useAuthStore } from '@/stores/auth.store'

export function UsersPage() {
  const { t } = useTranslation()
  const users = useUsers()
  const companies = useCompanies()
  const currentUid = useAuthStore((s) => s.authUser?.uid)

  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [companyFilter, setCompanyFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [editing, setEditing] = useState<UserProfile | null>(null)
  const [toggling, setToggling] = useState<UserProfile | null>(null)

  const filtered = useMemo(() => {
    if (!users.data) return []
    const q = search.trim().toLowerCase()
    return users.data.filter((u) => {
      if (roleFilter && u.role !== roleFilter) return false
      if (companyFilter && u.companyId !== companyFilter) return false
      if (statusFilter && u.status !== statusFilter) return false
      if (!q) return true
      return u.displayName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    })
  }, [users.data, search, roleFilter, companyFilter, statusFilter])

  const companyName = (id?: string) => companies.data?.find((c) => c.id === id)?.name

  return (
    <div className="flex flex-col gap-4">
      <AdminPageHeader
        title={t('admin.users.title')}
        description={t('admin.users.description', { count: users.data?.length ?? 0 })}
      />

      <Card>
        <CardBody className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label={t('admin.common.search')}>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('admin.common.searchNameEmail')}
            />
          </Field>
          <Field label={t('admin.common.filterByRole')}>
            <Select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
              <option value="">{t('admin.common.allRoles')}</option>
              {NON_ADMIN_ROLES.map((role) => (
                <option key={role} value={role}>
                  {t(`roles.${role}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('admin.common.filterByCompany')}>
            <Select value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)}>
              <option value="">{t('admin.common.allCompanies')}</option>
              {companies.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('admin.common.filterByStatus')}>
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">{t('admin.common.allStatuses')}</option>
              {USER_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {t(`userStatus.${status}`)}
                </option>
              ))}
            </Select>
          </Field>
        </CardBody>
      </Card>

      {users.isError && <ErrorCard message={users.error?.message ?? t('errors.generic')} onRetry={() => void users.refetch()} />}
      {users.isPending && <LoadingCard />}

      {users.isSuccess && filtered.length === 0 && (
        <Card>
          <CardBody>
            <EmptyState title={t('admin.users.empty')} />
          </CardBody>
        </Card>
      )}

      {users.isSuccess && filtered.length > 0 && (
        <AdminTable>
          <THead>
            <Th>{t('admin.users.name')}</Th>
            <Th>{t('admin.users.email')}</Th>
            <Th>{t('admin.users.company')}</Th>
            <Th>{t('admin.users.role')}</Th>
            <Th>{t('admin.users.status')}</Th>
            <Th>{t('admin.users.active')}</Th>
            <Th>{t('admin.common.actions')}</Th>
          </THead>
          <tbody>
            {filtered.map((user) => (
              <TRow key={user.uid}>
                <Td>
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-slate-900">{user.displayName}</span>
                    {user.uid === currentUid && (
                      <span className="text-xs text-slate-400">({t('admin.users.you')})</span>
                    )}
                  </div>
                </Td>
                <Td>{user.email}</Td>
                <Td>{companyName(user.companyId) ?? t('common.notAvailable')}</Td>
                <Td>{user.role ? <RoleBadge role={user.role} /> : t('common.notAvailable')}</Td>
                <Td><UserStatusBadge status={user.status} /></Td>
                <Td><ActiveBadge active={user.active} /></Td>
                <Td>
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => setEditing(user)}>
                      {t('admin.common.edit')}
                    </Button>
                    {user.status === 'APPROVED' && user.uid !== currentUid && (
                      <Button
                        size="sm"
                        variant={user.active ? 'danger' : 'secondary'}
                        onClick={() => setToggling(user)}
                      >
                        {t(user.active ? 'admin.users.deactivate' : 'admin.users.activate')}
                      </Button>
                    )}
                  </div>
                </Td>
              </TRow>
            ))}
          </tbody>
        </AdminTable>
      )}

      {editing && (
        <EditUserDialog
          user={editing}
          companies={companies.data ?? []}
          onClose={() => setEditing(null)}
        />
      )}

      {toggling && (
        <ToggleActiveDialog
          user={toggling}
          onClose={() => setToggling(null)}
        />
      )}
    </div>
  )
}

function EditUserDialog({
  user,
  companies,
  onClose,
}: {
  user: UserProfile
  companies: { id: string; name: string }[]
  onClose: () => void
}) {
  const { t, i18n } = useTranslation()
  const setRole = useSetUserRole()
  const setCompany = useSetUserCompany()

  const [role, setRoleState] = useState(user.role)
  const [companyId, setCompanyId] = useState(user.companyId ?? '')

  const dirty =
    (role && role !== user.role) || (companyId || null) !== (user.companyId ?? null)

  function save() {
    void (async () => {
      if (role && role !== user.role) await setRole.mutateAsync({ uid: user.uid, role })
      if ((companyId || null) !== (user.companyId ?? null)) {
        await setCompany.mutateAsync({ uid: user.uid, companyId: companyId || null })
      }
    })().then(onClose)
  }

  return (
    <ConfirmDialog
      open
      title={t('admin.users.editTitle', { name: user.displayName })}
      message={
        <div className="flex flex-col gap-4">
          <dl className="grid grid-cols-1 gap-2 rounded-md bg-slate-50 p-3 text-sm text-slate-600 sm:grid-cols-2">
            <div>
              <dt className="font-medium">{t('admin.users.email')}</dt>
              <dd>{user.email}</dd>
            </div>
            <div>
              <dt className="font-medium">{t('admin.users.registeredAt')}</dt>
              <dd>{formatDateTime(user.createdAt, i18n.language)}</dd>
            </div>
            {user.approvedAt && (
              <div>
                <dt className="font-medium">{t('admin.users.approvedAt')}</dt>
                <dd>{formatDateTime(user.approvedAt, i18n.language)}</dd>
              </div>
            )}
            {user.rejectedAt && (
              <div>
                <dt className="font-medium">{t('admin.users.rejectedAt')}</dt>
                <dd>{formatDateTime(user.rejectedAt, i18n.language)}</dd>
              </div>
            )}
          </dl>

          <Field label={t('admin.users.role')} hint={t('admin.users.roleHint')}>
            <RoleSelect value={role ?? ''} onChange={setRoleState} />
          </Field>

          <Field label={t('admin.users.company')}>
            <Select value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
              <option value="">{t('admin.common.noCompany')}</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      }
      confirmLabel={t('common.save')}
      disabled={!dirty}
      loading={setRole.isPending || setCompany.isPending}
      onConfirm={save}
      onCancel={onClose}
    />
  )
}

function ToggleActiveDialog({ user, onClose }: { user: UserProfile; onClose: () => void }) {
  const { t } = useTranslation()
  const setActive = useSetUserActive()

  return (
    <ConfirmDialog
      open
      tone={user.active ? 'danger' : 'primary'}
      title={t('admin.users.confirmToggleTitle', { name: user.displayName })}
      message={t(
        user.active
          ? 'admin.users.confirmDeactivateMessage'
          : 'admin.users.confirmActivateMessage',
      )}
      confirmLabel={t(user.active ? 'admin.users.deactivate' : 'admin.users.activate')}
      loading={setActive.isPending}
      onConfirm={() => {
        void setActive.mutateAsync({ uid: user.uid, active: !user.active }).then(onClose)
      }}
      onCancel={onClose}
    />
  )
}