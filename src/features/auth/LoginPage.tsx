import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { Field, Input } from '@/components/ui/Field'
import { isFirebaseConfigured } from '@/config/env'
import { authErrorKey, login } from '@/services/auth.service'
import { useAuthStore } from '@/stores/auth.store'

export function LoginPage() {
  const { t } = useTranslation()
  const setAuthUser = useAuthStore((s) => s.setAuthUser)
  const setError = useAuthStore((s) => s.setError)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setFormError(null)
    if (!isFirebaseConfigured()) {
      setFormError(t('errors.notConfigured'))
      return
    }
    setSubmitting(true)
    try {
      const user = await login(email, password)
      setAuthUser(user)
      setError(null)
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
            <h2 className="mb-4 text-lg font-medium text-slate-900">{t('auth.loginTitle')}</h2>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <Field label={t('auth.email')} required>
                <Input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </Field>

              <Field label={t('auth.password')} required>
                <Input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </Field>

              {formError && (
                <p role="alert" className="text-sm text-red-600">
                  {formError}
                </p>
              )}

              <Button type="submit" loading={submitting} fullWidth>
                {t('auth.login')}
              </Button>
            </form>

            <p className="mt-4 text-sm text-slate-600">
              {t('auth.noAccount')}{' '}
              <Link to="/register" className="font-medium text-sky-600 hover:underline">
                {t('auth.toRegister')}
              </Link>
            </p>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}