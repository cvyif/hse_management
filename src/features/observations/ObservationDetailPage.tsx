import { type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorCard, LoadingCard } from '@/features/admin/AsyncState'
import { useCompanies, useAreas } from '@/features/admin/hooks'
import { ObservationStatusBadge, RiskBadge } from '@/features/observations/ObservationBadges'
import { useObservation, useObservationTypes } from '@/features/observations/hooks'
import { EvidenceGallery } from '@/features/observations/EvidenceGallery'
import { CorrectiveActionSection } from '@/features/correctiveActions/CorrectiveActionSection'
import { hasPermission } from '@/lib/permissions'
import { formatDateTime } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth.store'

export function ObservationDetailPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { id = '' } = useParams()
  const profile = useAuthStore((s) => s.profile)

  const observation = useObservation(id)
  const companies = useCompanies()
  const areas = useAreas()
  const types = useObservationTypes()

  const data = observation.data
  const canEdit =
    data != null &&
    data.status === 'DRAFT' &&
    data.reporterId === profile?.uid &&
    hasPermission(profile?.role, 'observation:create')

  if (observation.isPending) return <LoadingCard />

  if (observation.isError) {
    return (
      <ErrorCard
        message={observation.error?.message ?? t('errors.generic')}
        onRetry={() => void observation.refetch()}
      />
    )
  }

  if (!data) {
    return (
      <Card>
        <CardBody>
          <EmptyState title={t('observation.detail.notFound')} />
        </CardBody>
      </Card>
    )
  }

  const companyName = companies.data?.find((c) => c.id === data.companyId)?.name ?? data.companyId
  const areaName = areas.data?.find((a) => a.id === data.areaId)?.name ?? data.areaId
  const typeLabel =
    types.data?.find((x) => x.id === data.observationTypeId)?.label ??
    data.observationTypeId ??
    t('common.notAvailable')

  const rows: { label: string; value: ReactNode }[] = [
    { label: t('observation.review.company'), value: companyName ?? t('common.notAvailable') },
    { label: t('observation.review.area'), value: areaName ?? t('common.notAvailable') },
    {
      label: t('observation.review.section'),
      value: data.section ? t(`sections.${data.section}`) : t('common.notAvailable'),
    },
    {
      label: t('observation.review.permitType'),
      value: t(`observation.permitTypes.${data.permit?.type ?? 'NOT_APPLICABLE'}`),
    },
    {
      label: t('observation.review.permitNumber'),
      value: data.permit?.number ?? t('common.notAvailable'),
    },
    { label: t('observation.review.observationType'), value: typeLabel },
    {
      label: t('observation.review.riskLevel'),
      value: data.riskLevel ? <RiskBadge risk={data.riskLevel} /> : t('common.notAvailable'),
    },
    { label: t('observation.review.description'), value: data.description || t('common.notAvailable') },
    {
      label: t('observation.review.immediateAction'),
      value: data.immediateAction || t('common.notAvailable'),
    },
    {
      label: t('observation.review.reporter'),
      value: `${data.reporterName} · ${t(`roles.${data.reporterRole}`)}`,
    },
    {
      label: t('observation.detail.createdAt'),
      value: formatDateTime(data.createdAt, i18n.language),
    },
    {
      label: t('observation.detail.submittedAt'),
      value: data.submittedAt ? formatDateTime(data.submittedAt, i18n.language) : t('common.notAvailable'),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Link to="/observations" className="text-sm font-medium text-sky-600 hover:underline">
            {t('observation.detail.back')}
          </Link>
          <h1 className="mt-1 text-xl font-semibold text-slate-900">{data.observationId}</h1>
        </div>
        <div className="flex items-center gap-2">
          <ObservationStatusBadge status={data.status} />
          {canEdit && (
            <Button variant="secondary" onClick={() => navigate(`/observations/new?edit=${data.id}`)}>
              {t('observation.detail.editDraft')}
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardBody>
          <dl className="divide-y divide-slate-100">
            {rows.map((row) => (
              <div key={row.label} className="grid grid-cols-1 gap-1 py-2 sm:grid-cols-3">
                <dt className="text-sm font-medium text-slate-500 sm:col-span-1">{row.label}</dt>
                <dd className="whitespace-pre-wrap text-sm text-slate-900 sm:col-span-2">{row.value}</dd>
              </div>
            ))}
          </dl>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <h2 className="mb-3 text-base font-semibold text-slate-900">
            {t('observation.detail.evidence')} ({data.evidence.length})
          </h2>
          <EvidenceGallery items={data.evidence} />
        </CardBody>
      </Card>

      <CorrectiveActionSection observation={data} />
    </div>
  )
}