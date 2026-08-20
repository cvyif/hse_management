import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { Field, Input } from '@/components/ui/Field'
import { Select } from '@/components/ui/Select'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorCard, LoadingCard } from '@/features/admin/AsyncState'
import { AdminTable, THead, Th, Td, TRow } from '@/features/admin/AdminTable'
import { AdminPageHeader } from '@/features/admin/AdminHeader'
import { useCompanies, useAreas } from '@/features/admin/hooks'
import {
  ObservationStatusBadge,
  RiskBadge,
} from '@/features/observations/ObservationBadges'
import { useObservationList } from '@/features/observations/hooks'
import { hasPermission } from '@/lib/permissions'
import { formatDateTime } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth.store'
import { RISK_LEVELS, OBSERVATION_STATUSES } from '@/types/observation'

export function ObservationListPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const profile = useAuthStore((s) => s.profile)
  const observations = useObservationList()
  const companies = useCompanies()
  const areas = useAreas()

  const [statusFilter, setStatusFilter] = useState('')
  const [riskFilter, setRiskFilter] = useState('')
  const [areaFilter, setAreaFilter] = useState(searchParams.get('area') ?? '')
  const [companyFilter, setCompanyFilter] = useState(searchParams.get('company') ?? '')
  const [search, setSearch] = useState('')

  const canCreate = hasPermission(profile?.role, 'observation:create')

  const companyName = (id?: string) =>
    id ? (companies.data?.find((c) => c.id === id)?.name ?? id) : t('common.notAvailable')
  const areaName = (id?: string) =>
    id ? (areas.data?.find((a) => a.id === id)?.name ?? id) : t('common.notAvailable')

  const filtered = useMemo(() => {
    if (!observations.data) return []
    const q = search.trim().toLowerCase()
    return observations.data.filter((observation) => {
      if (statusFilter && observation.status !== statusFilter) return false
      if (riskFilter && observation.riskLevel !== riskFilter) return false
      if (areaFilter && observation.areaId !== areaFilter) return false
      if (companyFilter && observation.companyId !== companyFilter) return false
      if (!q) return true
      return (
        observation.observationId.toLowerCase().includes(q) ||
        observation.description.toLowerCase().includes(q)
      )
    })
  }, [observations.data, search, statusFilter, riskFilter, areaFilter, companyFilter])

  /** Set one URL filter param, preserving the others (drill-down friendly). */
  function updateParam(key: 'area' | 'company', value: string) {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    setSearchParams(next)
  }

  function changeAreaFilter(value: string) {
    setAreaFilter(value)
    updateParam('area', value)
  }

  function changeCompanyFilter(value: string) {
    setCompanyFilter(value)
    updateParam('company', value)
  }

  return (
    <div className="flex flex-col gap-4">
      <AdminPageHeader
        title={t('observation.list.title')}
        description={t('observation.list.description', { count: observations.data?.length ?? 0 })}
        action={
          <div className="flex flex-wrap gap-2">
            <Link to="/map">
              <Button variant="secondary">{t('map.viewMap')}</Button>
            </Link>
            {canCreate ? (
              <Button onClick={() => navigate('/observations/new')}>
                {t('observation.list.newObservation')}
              </Button>
            ) : undefined}
          </div>
        }
      />

      <Card>
        <CardBody className="flex flex-col gap-3 sm:flex-row">
          <Field label={t('admin.common.search')} className="flex-1">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('observation.list.search')}
            />
          </Field>
          <Field label={t('observation.list.filterByStatus')} className="sm:w-44">
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">{t('observation.list.allStatuses')}</option>
              {OBSERVATION_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {t(`observationStatus.${status}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('observation.list.filterByRisk')} className="sm:w-44">
            <Select value={riskFilter} onChange={(e) => setRiskFilter(e.target.value)}>
              <option value="">{t('observation.list.allRisks')}</option>
              {RISK_LEVELS.map((risk) => (
                <option key={risk} value={risk}>
                  {t(`observation.risk.${risk}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('observation.list.filterByCompany')} className="sm:w-44">
            <Select value={companyFilter} onChange={(e) => changeCompanyFilter(e.target.value)}>
              <option value="">{t('observation.list.allCompanies')}</option>
              {(companies.data ?? []).map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('observation.list.filterByArea')} className="sm:w-44">
            <Select value={areaFilter} onChange={(e) => changeAreaFilter(e.target.value)}>
              <option value="">{t('observation.list.allAreas')}</option>
              {(areas.data ?? []).map((area) => (
                <option key={area.id} value={area.id}>
                  {area.name}
                </option>
              ))}
            </Select>
          </Field>
        </CardBody>
      </Card>

      {observations.isError && (
        <ErrorCard
          message={observations.error?.message ?? t('errors.generic')}
          onRetry={() => void observations.refetch()}
        />
      )}
      {observations.isPending && <LoadingCard />}

      {observations.isSuccess && filtered.length === 0 && (
        <Card>
          <CardBody>
            <EmptyState
              title={t('observation.list.empty')}
              description={t('observation.list.emptyHint')}
              action={
                canCreate ? (
                  <Button onClick={() => navigate('/observations/new')}>
                    {t('observation.list.newObservation')}
                  </Button>
                ) : undefined
              }
            />
          </CardBody>
        </Card>
      )}

      {observations.isSuccess && filtered.length > 0 && (
        <AdminTable>
          <THead>
            <Th>{t('observation.id')}</Th>
            <Th>{t('observation.list.status')}</Th>
            <Th>{t('observation.list.observationType')}</Th>
            <Th>{t('observation.list.company')}</Th>
            <Th>{t('observation.list.area')}</Th>
            <Th>{t('observation.list.section')}</Th>
            <Th>{t('observation.list.risk')}</Th>
            <Th>{t('observation.list.reporter')}</Th>
            <Th>{t('observation.list.created')}</Th>
          </THead>
          <tbody>
            {filtered.map((observation) => (
              <TRow key={observation.id}>
                <Td className="whitespace-nowrap">
                  <Link
                    to={`/observations/${observation.id}`}
                    className="font-medium text-sky-600 hover:underline"
                  >
                    {observation.observationId}
                  </Link>
                </Td>
                <Td>
                  <ObservationStatusBadge status={observation.status} />
                </Td>
                <Td>
                  {observation.observationTypeId ? (
                    observation.observationTypeId
                  ) : (
                    t('common.notAvailable')
                  )}
                </Td>
                <Td>{companyName(observation.companyId)}</Td>
                <Td>{areaName(observation.areaId)}</Td>
                <Td>
                  {observation.section
                    ? t(`sections.${observation.section}`)
                    : t('common.notAvailable')}
                </Td>
                <Td>
                  {observation.riskLevel ? (
                    <RiskBadge risk={observation.riskLevel} />
                  ) : (
                    t('common.notAvailable')
                  )}
                </Td>
                <Td>{observation.reporterName}</Td>
                <Td className="whitespace-nowrap text-slate-600">
                  {formatDateTime(observation.createdAt, i18n.language)}
                </Td>
              </TRow>
            ))}
          </tbody>
        </AdminTable>
      )}
    </div>
  )
}