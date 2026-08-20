import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { Field, Input } from '@/components/ui/Field'
import { Select } from '@/components/ui/Select'
import { isFirebaseConfigured } from '@/config/env'
import { authErrorKey, registerAccount } from '@/services/auth.service'
import { createPendingProfile } from '@/services/user.service'
import { useAuthStore } from '@/stores/auth.store'
import { NON_ADMIN_ROLES, type Role } from '@/types/roles'

export function RegisterPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const setAuthUser = useAuthStore((s) => s.setAuthUser)

  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [requestedRole, setRequestedRole] = useState<Role>('HSE_OFFICER')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const isCompanyRep = requestedRole === 'COMPANY_REP'

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setFormError(null)

    if (password !== confirmPassword) {
      setFormError(t('auth.passwordMismatch'))
      return
    }
    if (!isFirebaseConfigured()) {
      setFormError(t('errors.notConfigured'))
      return
    }

    setSubmitting(true)
    try {
      const user = await registerAccount(email, password)
      await createPendingProfile(user.uid, {
        displayName,
        email,
        phone,
        requestedRole,
      })
      setAuthUser(user)
      navigate('/register-pending', { replace: true })
    } catch (error) {
      const code = error instanceof Error && 'code' in error ? String(error.code) : 'unknown'
      setFormError(t(authErrorKey(code)))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold text-slate-900">{t('app.name')}</h1>
          <p className="mt-1 text-sm text-slate-500">{t('app.tagline')}</p>
        </div>

        <Card>
          <CardBody>
            <h2 className="mb-4 text-lg font-medium text-slate-900">{t('auth.registerTitle')}</h2>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <Field label={t('auth.fullName')} required>
                <Input
                  autoComplete="name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                />
              </Field>

              <Field label={t('auth.email')} required>
                <Input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </Field>

              <Field label={t('auth.phone')}>
                <Input
                  type="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </Field>

              <Field
                label={t('auth.requestedRole')}
                required
                hint={isCompanyRep ? t('auth.companyAssignedByAdmin') : undefined}
              >
                <Select value={requestedRole} onChange={(e) => setRequestedRole(e.target.value as Role)}>
                  {NON_ADMIN_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {t(`roles.${role}`)}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label={t('auth.password')} required>
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  required
                />
              </Field>

              <Field label={t('auth.confirmPassword')} required>
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  minLength={8}
                  required
                />
              </Field>

              {formError && (
                <p role="alert" className="text-sm text-red-600">
                  {formError}
                </p>
              )}

              <Button type="submit" loading={submitting} fullWidth>
                {t('auth.register')}
              </Button>
            </form>

            <p className="mt-4 text-sm text-slate-600">
              {t('auth.hasAccount')}{' '}
              <Link to="/login" className="font-medium text-sky-600 hover:underline">
                {t('auth.toLogin')}
              </Link>
            </p>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}