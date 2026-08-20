import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'

export function ForbiddenPage() {
  const { t } = useTranslation()
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="max-w-md">
        <CardBody className="text-center">
          <p className="text-5xl font-bold text-slate-300">403</p>
          <h1 className="mt-3 text-xl font-semibold text-slate-900">{t('forbidden.title')}</h1>
          <p className="mt-2 text-sm text-slate-600">{t('forbidden.message')}</p>
          <div className="mt-6">
            <Link to="/dashboard">
              <Button>{t('nav.dashboard')}</Button>
            </Link>
          </div>
        </CardBody>
      </Card>
    </div>
  )
}

export function NotFoundPage() {
  const { t } = useTranslation()
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="max-w-md">
        <CardBody className="text-center">
          <p className="text-5xl font-bold text-slate-300">404</p>
          <h1 className="mt-3 text-xl font-semibold text-slate-900">{t('notFound.title')}</h1>
          <p className="mt-2 text-sm text-slate-600">{t('notFound.message')}</p>
          <div className="mt-6">
            <Link to="/dashboard">
              <Button>{t('nav.dashboard')}</Button>
            </Link>
          </div>
        </CardBody>
      </Card>
    </div>
  )
}