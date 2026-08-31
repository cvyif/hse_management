import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { Field, Input } from '@/components/ui/Field'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { useCompanies, useAreas } from '@/features/admin/hooks'
import { ErrorCard, LoadingCard } from '@/features/admin/AsyncState'
import { RiskBadge } from '@/features/observations/ObservationBadges'
import { EvidencePicker } from '@/features/observations/EvidencePicker'
import {
  useCreateDraft,
  useObservation,
  useObservationTypes,
  useSubmitObservation,
  useUpdateDraft,
} from '@/features/observations/hooks'
import { validateEvidence, type PendingEvidenceFile } from '@/services/observation.service'
import { useAuthStore } from '@/stores/auth.store'
import {
  MAX_DESCRIPTION_LENGTH,
  MAX_EVIDENCE_FILES,
  MAX_IMMEDIATE_ACTION_LENGTH,
  PERMIT_NUMBER_MAX_DIGITS,
  PERMIT_TYPES,
  RISK_LEVELS,
  type ObservationInput,
  type PermitType,
  type RiskLevel,
} from '@/types/observation'
import { cn } from '@/lib/cn'

const STEPS = [
  { key: 'company', labelKey: 'observation.steps.company' },
  { key: 'area', labelKey: 'observation.steps.area' },
  { key: 'permit', labelKey: 'observation.steps.permit' },
  { key: 'details', labelKey: 'observation.steps.details' },
  { key: 'evidence', labelKey: 'observation.steps.evidence' },
  { key: 'review', labelKey: 'observation.steps.review' },
] as const

const PERMIT_TYPE_OPTIONS: readonly PermitType[] = PERMIT_TYPES
const RISK_OPTIONS: readonly RiskLevel[] = RISK_LEVELS

function mapError(error: unknown): string {
  if (error instanceof Error) {
    const code = 'code' in error ? String(error.code) : ''
    switch (code) {
      case 'permission-denied':
        return 'errors.permissionDenied'
      case 'storage/unauthorized':
        return 'errors.storageUnauthorized'
      case 'storage/quota-exceeded':
        return 'errors.storageQuota'
      case 'storage/unknown':
        return 'errors.storageError'
      case 'not-found':
        return 'errors.notFound'
      default:
        return error.message || 'errors.generic'
    }
  }
  return 'errors.generic'
}

export function NewObservationPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const editingId = searchParams.get('edit') ?? ''

  const companies = useCompanies()
  const areas = useAreas()
  const types = useObservationTypes()
  const createDraft = useCreateDraft()
  const updateDraft = useUpdateDraft()
  const submit = useSubmitObservation()
  const draftQuery = useObservation(editingId || undefined)
  const profile = useAuthStore((s) => s.profile)

  const [step, setStep] = useState(0)
  const [companyId, setCompanyId] = useState('')
  const [areaId, setAreaId] = useState('')
  const [permitType, setPermitType] = useState<PermitType>('NOT_APPLICABLE')
  const [permitNumber, setPermitNumber] = useState('')
  const [observationTypeId, setObservationTypeId] = useState('')
  const [riskLevel, setRiskLevel] = useState<RiskLevel | ''>('')
  const [description, setDescription] = useState('')
  const [immediateAction, setImmediateAction] = useState('')
  const [files, setFiles] = useState<PendingEvidenceFile[]>([])
  const [formError, setFormError] = useState<string | null>(null)
  const [savedNotice, setSavedNotice] = useState<string | null>(null)
  const [initialized, setInitialized] = useState(false)

  const activeCompanies = (companies.data ?? []).filter((c) => c.active)
  const activeAreas = (areas.data ?? []).filter((a) => a.active)
  const activeTypes = (types.data ?? []).filter((x) => x.active)
  const selectedArea = areas.data?.find((a) => a.id === areaId)
  const section = selectedArea?.section
  const loading =
    companies.isPending || areas.isPending || types.isPending || (Boolean(editingId) && draftQuery.isPending)

  // Populate the form when editing an existing DRAFT.
  useEffect(() => {
    const draft = draftQuery.data
    if (!editingId || !draft || initialized) return
    if (draft.status !== 'DRAFT') {
      setFormError(t('observation.errors.notDraft'))
      return
    }
    if (draft.reporterId !== profile?.uid) {
      setFormError(t('observation.errors.notOwner'))
      return
    }
    setCompanyId(draft.companyId ?? '')
    setAreaId(draft.areaId ?? '')
    setPermitType(draft.permit?.type ?? 'NOT_APPLICABLE')
    setPermitNumber(draft.permit?.number ?? '')
    setObservationTypeId(draft.observationTypeId ?? '')
    setRiskLevel(draft.riskLevel ?? '')
    setDescription(draft.description ?? '')
    setImmediateAction(draft.immediateAction ?? '')
    setInitialized(true)
  }, [draftQuery.data, editingId, initialized, profile?.uid, t])

  function permitValid(): boolean {
    if (permitType === 'NOT_APPLICABLE') return true
    return /^\d{1,10}$/.test(permitNumber.trim())
  }

  function stepError(stepIndex: number): string | null {
    switch (stepIndex) {
      case 0:
        // Company is optional; an Observation can exist without a company.
        return null
      case 1:
        return areaId ? null : t('observation.errors.areaRequired')
      case 2:
        return permitValid() ? null : t('observation.errors.permitNumberInvalid')
      case 3: {
        if (!observationTypeId) return t('observation.errors.typeRequired')
        if (!riskLevel) return t('observation.errors.riskRequired')
        if (!description.trim()) return t('observation.errors.descriptionRequired')
        if (description.length > MAX_DESCRIPTION_LENGTH) {
          return t('observation.errors.descriptionTooLong')
        }
        return null
      }
      case 4: {
        const errors = validateEvidence(files.map((item) => item.file))
        return errors.length > 0 ? errors[0] : null
      }
      default:
        return null
    }
  }

  function goNext() {
    const error = stepError(step)
    if (error) {
      setFormError(error)
      return
    }
    setFormError(null)
    setStep((current) => Math.min(current + 1, STEPS.length - 1))
  }

  function buildPartialInput(): Partial<ObservationInput> {
    return {
      companyId: companyId || undefined,
      areaId: areaId || undefined,
      section,
      permit: {
        type: permitType,
        number:
          permitType !== 'NOT_APPLICABLE' && permitNumber.trim()
            ? permitNumber.trim()
            : undefined,
      },
      observationTypeId: observationTypeId || undefined,
      riskLevel: riskLevel || undefined,
      description: description.trim() || undefined,
      immediateAction: immediateAction.trim() || undefined,
    }
  }

  async function saveDraft() {
    setFormError(null)
    setSavedNotice(null)
    try {
      const input = buildPartialInput()
      if (editingId) {
        await updateDraft.mutateAsync({ id: editingId, input })
      } else {
        const created = await createDraft.mutateAsync(input)
        setSearchParams({ edit: created.id }, { replace: true })
      }
      setSavedNotice(t('observation.new.draftSaved'))
    } catch (error) {
      setFormError(t(mapError(error)))
    }
  }

  function buildInput(): ObservationInput | null {
    if (!selectedArea || !riskLevel) return null
    return {
      companyId: companyId || undefined,
      areaId,
      section: selectedArea.section,
      permit: {
        type: permitType,
        number:
          permitType !== 'NOT_APPLICABLE' && permitNumber.trim()
            ? permitNumber.trim()
            : undefined,
      },
      observationTypeId,
      riskLevel,
      description: description.trim(),
      immediateAction: immediateAction.trim() || undefined,
    }
  }

  async function handleSubmit() {
    setFormError(null)
    setSavedNotice(null)
    for (let index = 0; index <= 4; index += 1) {
      const error = stepError(index)
      if (error) {
        setFormError(error)
        setStep(index)
        return
      }
    }
    const input = buildInput()
    if (!input) {
      setFormError(t('observation.errors.areaRequired'))
      setStep(1)
      return
    }
    let id = editingId
    try {
      if (!id) {
        const created = await createDraft.mutateAsync(input)
        id = created.id
      }
      const submitted = await submit.mutateAsync({ id, input, files })
      navigate(`/observations/${submitted.id}`, { replace: true })
    } catch (error) {
      setFormError(t(mapError(error)))
    }
  }

  if (loading) return <LoadingCard />

  if (draftQuery.isError) {
    return (
      <ErrorCard
        message={draftQuery.error?.message ?? t('errors.generic')}
        onRetry={() => void draftQuery.refetch()}
      />
    )
  }

  const isReview = step === STEPS.length - 1

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            {t(editingId ? 'observation.new.titleEdit' : 'observation.new.title')}
          </h1>
          {editingId && (
            <p className="mt-0.5 text-sm text-slate-500">
              {t('observation.id')}: <span className="font-medium text-slate-700">{editingId}</span>
            </p>
          )}
        </div>
      </div>

      <StepIndicator current={step} labels={STEPS.map((s) => t(s.labelKey))} />

      {formError && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {formError}
        </p>
      )}
      {savedNotice && (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{savedNotice}</p>
      )}

      <Card>
        <CardBody>
          {step === 0 && (
            <div className="flex flex-col gap-4">
              <Field label={t('observation.form.company')} hint={t('observation.form.companyOptionalHint')}>
                <Select value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
                  <option value="">{t('observation.form.noCompany')}</option>
                  {activeCompanies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          )}

          {step === 1 && (
            <div className="flex flex-col gap-4">
              <Field label={t('observation.form.area')} required hint={t('observation.form.areaHint')}>
                <Select value={areaId} onChange={(e) => setAreaId(e.target.value)}>
                  <option value="" disabled>
                    {t('admin.common.select')}
                  </option>
                  {activeAreas.map((area) => (
                    <option key={area.id} value={area.id}>
                      {area.name}
                    </option>
                  ))}
                </Select>
              </Field>
              {selectedArea && (
                <Field label={t('observation.form.section')} hint={t('observation.form.sectionFromArea')}>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'rounded-md px-3 py-1.5 text-sm font-medium',
                        selectedArea.section === 'OIL'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800',
                      )}
                    >
                      {t(`sections.${selectedArea.section}`)}
                    </span>
                  </div>
                </Field>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-4">
              <Field label={t('observation.form.permitType')} hint={t('observation.form.permitTypeHint')}>
                <Select value={permitType} onChange={(e) => setPermitType(e.target.value as PermitType)}>
                  {PERMIT_TYPE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {t(`observation.permitTypes.${option}`)}
                    </option>
                  ))}
                </Select>
              </Field>
              {permitType !== 'NOT_APPLICABLE' && (
                <Field
                  label={t('observation.form.permitNumber')}
                  required
                  hint={t('observation.form.permitNumberHint', { digits: PERMIT_NUMBER_MAX_DIGITS })}
                >
                  <Input
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={PERMIT_NUMBER_MAX_DIGITS}
                    value={permitNumber}
                    onChange={(e) => setPermitNumber(e.target.value.replace(/[^0-9]/g, ''))}
                    invalid={Boolean(permitNumber) && !permitValid()}
                  />
                </Field>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="flex flex-col gap-4">
              <Field label={t('observation.form.observationType')} required>
                <Select value={observationTypeId} onChange={(e) => setObservationTypeId(e.target.value)}>
                  <option value="" disabled>
                    {t('admin.common.select')}
                  </option>
                  {activeTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t('observation.form.riskLevel')} required>
                <Select value={riskLevel} onChange={(e) => setRiskLevel(e.target.value as RiskLevel)}>
                  <option value="" disabled>
                    {t('admin.common.select')}
                  </option>
                  {RISK_OPTIONS.map((risk) => (
                    <option key={risk} value={risk}>
                      {t(`observation.risk.${risk}`)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                label={t('observation.form.description')}
                required
                error={
                  description.length > MAX_DESCRIPTION_LENGTH
                    ? t('observation.errors.descriptionTooLong')
                    : undefined
                }
                hint={t('observation.form.descriptionHint', { max: MAX_DESCRIPTION_LENGTH })}
              >
                <Textarea
                  rows={5}
                  maxLength={MAX_DESCRIPTION_LENGTH}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t('observation.form.descriptionPlaceholder')}
                />
              </Field>
              <Field
                label={t('observation.form.immediateAction')}
                hint={t('observation.form.immediateActionHint', { max: MAX_IMMEDIATE_ACTION_LENGTH })}
              >
                <Textarea
                  rows={3}
                  maxLength={MAX_IMMEDIATE_ACTION_LENGTH}
                  value={immediateAction}
                  onChange={(e) => setImmediateAction(e.target.value)}
                  placeholder={t('observation.form.immediateActionPlaceholder')}
                />
              </Field>
            </div>
          )}

          {step === 4 && (
            <EvidencePicker
              files={files}
              onChange={setFiles}
              disabled={submit.isPending}
            />
          )}

          {step === 5 && (
            <ReviewSummary
              input={{
                company: companyId
                  ? activeCompanies.find((c) => c.id === companyId)?.name
                  : undefined,
                noCompany: !companyId,
                area: activeAreas.find((a) => a.id === areaId)?.name,
                section,
                permitType,
                permitNumber: permitType !== 'NOT_APPLICABLE' ? permitNumber : undefined,
                observationType: activeTypes.find((x) => x.id === observationTypeId)?.label,
                riskLevel,
                description,
                immediateAction,
                evidenceCount: files.length,
              }}
              reporter={profile}
            />
          )}
        </CardBody>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="secondary" disabled={step === 0} onClick={() => setStep((current) => Math.max(0, current - 1))}>
          {t('observation.new.back')}
        </Button>
        <div className="flex flex-wrap gap-2">
          {!isReview && (
            <Button variant="secondary" onClick={() => void saveDraft()} loading={createDraft.isPending || updateDraft.isPending}>
              {t('observation.new.saveDraft')}
            </Button>
          )}
          {isReview ? (
            <Button onClick={() => void handleSubmit()} loading={submit.isPending}>
              {t('observation.new.submit')}
            </Button>
          ) : (
            <Button onClick={goNext}>{t('observation.new.next')}</Button>
          )}
        </div>
      </div>
    </div>
  )
}

function StepIndicator({ current, labels }: { current: number; labels: readonly string[] }) {
  return (
    <ol className="flex flex-wrap items-center gap-1">
      {labels.map((label, index) => (
        <li
          key={label}
          className={cn(
            'flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium',
            index === current
              ? 'bg-sky-600 text-white'
              : index < current
                ? 'bg-sky-100 text-sky-800'
                : 'bg-slate-100 text-slate-500',
          )}
        >
          <span aria-hidden="true">{index + 1}.</span>
          {label}
        </li>
      ))}
    </ol>
  )
}

function ReviewSummary({
  input,
  reporter,
}: {
  input: {
    company?: string
    noCompany?: boolean
    area?: string
    section?: 'OIL' | 'GAS'
    permitType: PermitType
    permitNumber?: string
    observationType?: string
    riskLevel: RiskLevel | ''
    description: string
    immediateAction: string
    evidenceCount: number
  }
  reporter: { displayName?: string; role?: string } | null
}) {
  const { t } = useTranslation()
  const rows: { label: string; value: ReactNode }[] = [
    {
      label: t('observation.review.company'),
      value: input.noCompany ? t('observation.form.noCompany') : input.company ?? t('common.notAvailable'),
    },
    { label: t('observation.review.area'), value: input.area ?? t('common.notAvailable') },
    {
      label: t('observation.review.section'),
      value: input.section ? t(`sections.${input.section}`) : t('common.notAvailable'),
    },
    {
      label: t('observation.review.permitType'),
      value: t(`observation.permitTypes.${input.permitType}`),
    },
    {
      label: t('observation.review.permitNumber'),
      value: input.permitNumber ?? t('common.notAvailable'),
    },
    {
      label: t('observation.review.observationType'),
      value: input.observationType ?? t('common.notAvailable'),
    },
    {
      label: t('observation.review.riskLevel'),
      value: input.riskLevel ? <RiskBadge risk={input.riskLevel} /> : t('common.notAvailable'),
    },
    { label: t('observation.review.description'), value: input.description },
    {
      label: t('observation.review.immediateAction'),
      value: input.immediateAction || t('common.notAvailable'),
    },
    {
      label: t('observation.review.evidenceCount'),
      value: t('observation.review.evidenceCountValue', { count: input.evidenceCount, max: MAX_EVIDENCE_FILES }),
    },
    {
      label: t('observation.review.reporter'),
      value: reporter?.displayName ?? t('common.notAvailable'),
    },
  ]

  return (
    <div>
      <h2 className="mb-3 text-lg font-semibold text-slate-900">{t('observation.review.title')}</h2>
      <dl className="divide-y divide-slate-100">
        {rows.map((row) => (
          <div key={row.label} className="grid grid-cols-1 gap-1 py-2 sm:grid-cols-3">
            <dt className="text-sm font-medium text-slate-500 sm:col-span-1">{row.label}</dt>
            <dd className="whitespace-pre-wrap text-sm text-slate-900 sm:col-span-2">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}