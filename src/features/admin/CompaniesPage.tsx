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
import { ActiveBadge } from '@/features/admin/Badges'
import { AdminTable, THead, Th, Td, TRow } from '@/features/admin/AdminTable'
import {
  useCompanies,
  useCreateCompany,
  useSetCompanyActive,
  useUpdateCompany,
} from '@/features/admin/hooks'
import { formatDateTime } from '@/lib/utils'
import type { Company } from '@/types/company'

export function CompaniesPage() {
  const { t } = useTranslation()
  const companies = useCompanies()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [dialog, setDialog] = useState<'create' | Company | null>(null)

  const filtered = useMemo(() => {
    if (!companies.data) return []
    const q = search.trim().toLowerCase()
    return companies.data.filter((c) => {
      if (statusFilter === 'active' && !c.active) return false
      if (statusFilter === 'inactive' && c.active) return false
      if (!q) return true
      return c.name.toLowerCase().includes(q) || (c.code ?? '').toLowerCase().includes(q)
    })
  }, [companies.data, search, statusFilter])

  return (
    <div className="flex flex-col gap-4">
      <AdminPageHeader
        title={t('admin.companies.title')}
        description={t('admin.companies.description', { count: companies.data?.length ?? 0 })}
        action={
          <Button onClick={() => setDialog('create')}>
            {t('admin.companies.create')}
          </Button>
        }
      />

      <Card>
        <CardBody className="flex flex-col gap-3 sm:flex-row">
          <Field label={t('admin.common.search')} className="flex-1">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('admin.common.searchName')}
            />
          </Field>
          <Field label={t('admin.common.filterByStatus')} className="sm:w-56">
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">{t('admin.common.allStatuses')}</option>
              <option value="active">{t('common.active')}</option>
              <option value="inactive">{t('common.inactive')}</option>
            </Select>
          </Field>
        </CardBody>
      </Card>

      {companies.isError && <ErrorCard message={companies.error?.message ?? t('errors.generic')} onRetry={() => void companies.refetch()} />}
      {companies.isPending && <LoadingCard />}

      {companies.isSuccess && filtered.length === 0 && (
        <Card>
          <CardBody>
            <EmptyState
              title={t('admin.companies.empty')}
              action={<Button onClick={() => setDialog('create')}>{t('admin.companies.create')}</Button>}
            />
          </CardBody>
        </Card>
      )}

      {companies.isSuccess && filtered.length > 0 && (
        <AdminTable>
          <THead>
            <Th>{t('admin.companies.name')}</Th>
            <Th>{t('admin.companies.code')}</Th>
            <Th>{t('admin.companies.status')}</Th>
            <Th>{t('admin.companies.createdAt')}</Th>
            <Th>{t('admin.common.actions')}</Th>
          </THead>
          <tbody>
            {filtered.map((company) => (
              <CompanyRow
                key={company.id}
                company={company}
                onEdit={() => setDialog(company)}
              />
            ))}
          </tbody>
        </AdminTable>
      )}

      {dialog && (
        <CompanyDialog
          company={dialog === 'create' ? null : dialog}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  )
}

function CompanyRow({ company, onEdit }: { company: Company; onEdit: () => void }) {
  const { t, i18n } = useTranslation()
  const setActive = useSetCompanyActive()
  const [confirming, setConfirming] = useState(false)

  return (
    <TRow>
      <Td className="font-medium text-slate-900">{company.name}</Td>
      <Td>{company.code ?? t('common.notAvailable')}</Td>
      <Td><ActiveBadge active={company.active} /></Td>
      <Td className="whitespace-nowrap">{formatDateTime(company.createdAt, i18n.language)}</Td>
      <Td>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={onEdit}>
            {t('admin.common.edit')}
          </Button>
          <Button
            size="sm"
            variant={company.active ? 'danger' : 'secondary'}
            onClick={() => setConfirming(true)}
          >
            {t(company.active ? 'admin.companies.deactivate' : 'admin.companies.activate')}
          </Button>
        </div>
      </Td>

      {confirming && (
        <ConfirmDialog
          open
          tone={company.active ? 'danger' : 'primary'}
          title={t('admin.companies.confirmToggleTitle', { name: company.name })}
          message={t(
            company.active
              ? 'admin.companies.confirmDeactivateMessage'
              : 'admin.companies.confirmActivateMessage',
          )}
          confirmLabel={t(company.active ? 'admin.companies.deactivate' : 'admin.companies.activate')}
          loading={setActive.isPending}
          onConfirm={() => {
            void setActive.mutateAsync({ id: company.id, active: !company.active }).then(() =>
              setConfirming(false),
            )
          }}
          onCancel={() => setConfirming(false)}
        />
      )}
    </TRow>
  )
}

function CompanyDialog({
  company,
  onClose,
}: {
  company: Company | null
  onClose: () => void
}) {
  const { t } = useTranslation()
  const create = useCreateCompany()
  const update = useUpdateCompany()

  const [name, setName] = useState(company?.name ?? '')
  const [code, setCode] = useState(company?.code ?? '')
  const [nameAr, setNameAr] = useState(company?.nameAr ?? '')
  const [error, setError] = useState<string | null>(null)

  const isCreate = company == null
  const dirty =
    name.trim() !== (company?.name ?? '').trim() ||
    code.trim() !== (company?.code ?? '').trim() ||
    nameAr.trim() !== (company?.nameAr ?? '').trim()

  async function submit() {
    if (!name.trim()) {
      setError(t('admin.companies.nameRequired'))
      return
    }
    if (!code.trim()) {
      setError(t('admin.companies.codeRequired'))
      return
    }
    if (!nameAr.trim()) {
      setError(t('admin.companies.nameArRequired'))
      return
    }
    setError(null)
    try {
      const input = { name, code, nameAr }
      if (isCreate) await create.mutateAsync(input)
      else await update.mutateAsync({ id: company.id, input })
      onClose()
    } catch (mutationError) {
      const message =
        mutationError instanceof Error && mutationError.message
          ? mutationError.message
          : t('errors.generic')
      setError(message)
    }
  }

  return (
    <ConfirmDialog
      open
      title={t(isCreate ? 'admin.companies.createTitle' : 'admin.companies.editTitle')}
      message={
        <form
          onSubmit={(event) => {
            event.preventDefault()
            void submit()
          }}
          className="flex flex-col gap-3"
        >
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Field label={t('admin.companies.name')} required>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label={t('admin.companies.code')} required>
            <Input value={code} onChange={(e) => setCode(e.target.value)} />
          </Field>
          <Field label={t('admin.companies.nameAr')} required>
            <Input value={nameAr} onChange={(e) => setNameAr(e.target.value)} />
          </Field>
        </form>
      }
      confirmLabel={t('common.save')}
      disabled={isCreate ? false : !dirty}
      loading={create.isPending || update.isPending}
      onConfirm={submit}
      onCancel={onClose}
    />
  )
}