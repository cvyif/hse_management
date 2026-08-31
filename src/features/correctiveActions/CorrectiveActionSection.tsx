import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Textarea } from '@/components/ui/Textarea'
import { ErrorCard, LoadingCard } from '@/features/admin/AsyncState'
import { EvidenceGallery } from '@/features/observations/EvidenceGallery'
import { EvidencePicker } from '@/features/observations/EvidencePicker'
import {
  useBeginVerification,
  useCorrectiveAction,
  useRequestCorrectiveAction,
  useSubmitCorrectiveAction,
  useVerifyCorrectiveAction,
} from '@/features/correctiveActions/hooks'
import { hasPermission } from '@/lib/permissions'
import { formatDateTime } from '@/lib/utils'
import type { Role } from '@/types/roles'
import type { CorrectiveAction, CorrectiveActionStatus } from '@/types/correctiveAction'
import type { PendingEvidenceFile } from '@/services/observation.service'
import {
  ACTION_DESCRIPTION_LIMITS,
  RETURN_REASON_LIMITS,
} from '@/services/correctiveAction.service'
import type { Observation } from '@/types/observation'
import { useAuthStore } from '@/stores/auth.store'

function ActionStatusBadge({ status }: { status: CorrectiveActionStatus }) {
  const { t } = useTranslation()
  const tone =
    status === 'ACCEPTED'
      ? 'green'
      : status === 'SUBMITTED' || status === 'UNDER_VERIFICATION'
        ? 'amber'
        : status === 'RETURNED'
          ? 'red'
          : 'gray'
  return <Badge tone={tone}>{t(`correctiveAction.status.${status}`)}</Badge>
}

function ActionSummary({
  action,
  observation,
  language,
}: {
  action: CorrectiveAction
  observation: Observation
  language: string
}) {
  const { t } = useTranslation()
  const rows: { label: string; value: string }[] = []

  if (action.submittedByName && action.submittedAt) {
    rows.push({
      label: t('correctiveAction.submittedBy'),
      value: `${action.submittedByName} · ${formatDateTime(action.submittedAt, language)}`,
    })
  }
  if (action.verifiedBy && action.verifiedAt) {
    rows.push({
      label: t('correctiveAction.verifiedBy'),
      value: formatDateTime(action.verifiedAt, language),
    })
  }
  if (action.returnedBy && action.returnedAt && action.status === 'RETURNED') {
    rows.push({
      label: t('correctiveAction.returnedBy'),
      value: formatDateTime(action.returnedAt, language),
    })
  }
  if (action.returnReason && action.status === 'RETURNED') {
    rows.push({ label: t('correctiveAction.returnReason'), value: action.returnReason })
  }
  if (observation.closedAt) {
    rows.push({
      label: t('correctiveAction.closedAt'),
      value: formatDateTime(observation.closedAt, language),
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {action.description && (
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            {t('correctiveAction.description')}
          </h3>
          <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{action.description}</p>
        </div>
      )}
      {action.evidence.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-slate-900">
            {t('correctiveAction.evidence')} ({action.evidence.length})
          </h3>
          <EvidenceGallery items={action.evidence} />
        </div>
      )}
      {rows.length > 0 && (
        <dl className="divide-y divide-slate-100">
          {rows.map((row) => (
            <div key={row.label} className="grid grid-cols-1 gap-1 py-2 sm:grid-cols-3">
              <dt className="text-sm font-medium text-slate-500">{row.label}</dt>
              <dd className="whitespace-pre-wrap text-sm text-slate-900 sm:col-span-2">{row.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}

function CompanySubmissionForm({
  observationId,
  companyId,
  profileCompanyId,
}: {
  observationId: string
  companyId?: string
  profileCompanyId?: string
}) {
  const { t } = useTranslation()
  const [description, setDescription] = useState('')
  const [files, setFiles] = useState<PendingEvidenceFile[]>([])
  const [error, setError] = useState<string | null>(null)
  const submit = useSubmitCorrectiveAction(observationId)

  const isOwnCompany = companyId === profileCompanyId
  if (!isOwnCompany) {
    return (
      <p className="text-sm text-slate-500">
        {t('correctiveAction.notYourCompany')}
      </p>
    )
  }

  function handleSubmit() {
    setError(null)
    if (!description.trim()) {
      setError(t('correctiveAction.descriptionRequired'))
      return
    }
    submit.mutate(
      { input: { description }, files },
      {
        onError: (err) => setError(err.message),
      },
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label htmlFor="action-description" className="mb-1 block text-sm font-medium text-slate-700">
          {t('correctiveAction.description')}
        </label>
        <Textarea
          id="action-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={ACTION_DESCRIPTION_LIMITS.maxLength}
          rows={5}
          placeholder={t('correctiveAction.descriptionPlaceholder')}
          disabled={submit.isPending}
        />
        <p className="mt-1 text-xs text-slate-500">
          {t('correctiveAction.descriptionHint', { max: ACTION_DESCRIPTION_LIMITS.maxLength })}
        </p>
      </div>
      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-900">
          {t('correctiveAction.evidence')}
        </h3>
        <EvidencePicker files={files} onChange={setFiles} disabled={submit.isPending} />
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      <div>
        <Button onClick={handleSubmit} loading={submit.isPending}>
          {t('correctiveAction.submit')}
        </Button>
      </div>
    </div>
  )
}

export function CorrectiveActionSection({ observation }: { observation: Observation }) {
  const { t, i18n } = useTranslation()
  const profile = useAuthStore((s) => s.profile)
  const actionQuery = useCorrectiveAction(observation.id)
  const requestAction = useRequestCorrectiveAction(observation.id)
  const beginVerification = useBeginVerification(observation.id)
  const verify = useVerifyCorrectiveAction(observation.id)
  const [returnOpen, setReturnOpen] = useState(false)
  const [returnReason, setReturnReason] = useState('')
  const [returnError, setReturnError] = useState<string | null>(null)

  const role = profile?.role as Role | undefined
  const canVerify = hasPermission(role, 'action:verify')
  const canSubmit = hasPermission(role, 'action:submit')

  const action = actionQuery.data

  let body: ReactNode
  if (actionQuery.isPending) {
    body = <LoadingCard />
  } else if (actionQuery.isError) {
    body = <ErrorCard message={actionQuery.error?.message ?? t('errors.generic')} />
  } else if (!action) {
    body = (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-slate-600">{t('correctiveAction.noAction')}</p>
        {observation.status === 'OPEN' && canVerify && (
          <div>
            <Button
              onClick={() => requestAction.mutate()}
              loading={requestAction.isPending}
            >
              {t('correctiveAction.request')}
            </Button>
          </div>
        )}
      </div>
    )
  } else {
    const status = action.status
    body = (
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <ActionStatusBadge status={status} />
          {status === 'SUBMITTED' && observation.status === 'ACTION_SUBMITTED' && canVerify && (
            <Button
              variant="secondary"
              onClick={() => beginVerification.mutate()}
              loading={beginVerification.isPending}
            >
              {t('correctiveAction.beginVerification')}
            </Button>
          )}
          {status === 'UNDER_VERIFICATION' && observation.status === 'UNDER_VERIFICATION' && canVerify && (
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => verify.mutate({ verdict: 'ACCEPTED' })}
                loading={verify.isPending}
              >
                {t('correctiveAction.accept')}
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setReturnReason('')
                  setReturnError(null)
                  setReturnOpen(true)
                }}
                disabled={verify.isPending}
              >
                {t('correctiveAction.return')}
              </Button>
            </div>
          )}
        </div>

        {status === 'REQUIRED' && observation.status === 'ACTION_REQUIRED' && canSubmit && (
          <CompanySubmissionForm
            observationId={observation.id}
            companyId={observation.companyId}
            profileCompanyId={profile?.companyId}
          />
        )}

        {status === 'RETURNED' && observation.status === 'ACTION_REQUIRED' && canSubmit && (
          <CompanySubmissionForm
            observationId={observation.id}
            companyId={observation.companyId}
            profileCompanyId={profile?.companyId}
          />
        )}

        <ActionSummary action={action} observation={observation} language={i18n.language} />
      </div>
    )
  }

  return (
    <Card>
      <CardBody>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-slate-900">
            {t('correctiveAction.title')}
          </h2>
          {observation.status === 'ACTION_REQUIRED' && (
            <Badge tone="amber">{t('correctiveAction.requiresAction')}</Badge>
          )}
        </div>
        <div className="mt-3">{body}</div>
      </CardBody>

      <ConfirmDialog
        open={returnOpen}
        title={t('correctiveAction.returnDialogTitle')}
        message={
          <div className="flex flex-col gap-3">
            <p>{t('correctiveAction.returnDialogMessage')}</p>
            <Textarea
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
              rows={4}
              maxLength={RETURN_REASON_LIMITS.maxLength}
              placeholder={t('correctiveAction.returnReasonPlaceholder')}
            />
            {returnError && <p className="text-sm text-red-600">{returnError}</p>}
          </div>
        }
        confirmLabel={t('correctiveAction.return')}
        tone="danger"
        loading={verify.isPending}
        disabled={!returnReason.trim()}
        onConfirm={() => {
          setReturnError(null)
          verify.mutate(
            { verdict: 'RETURNED', returnReason },
            {
              onSuccess: () => setReturnOpen(false),
              onError: (err) => setReturnError(err.message),
            },
          )
        }}
        onCancel={() => setReturnOpen(false)}
      />
    </Card>
  )
}