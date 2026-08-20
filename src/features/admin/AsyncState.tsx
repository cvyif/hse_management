import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'

export function LoadingCard() {
  const { t } = useTranslation()
  return (
    <Card>
      <CardBody className="py-10 text-center text-sm text-slate-500">{t('common.loading')}</CardBody>
    </Card>
  )
}

export function ErrorCard({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { t } = useTranslation()
  return (
    <Card>
      <CardBody className="flex flex-col items-center gap-3 py-10 text-center">
        <p className="text-sm text-red-600">{message}</p>
        {onRetry && (
          <Button variant="secondary" onClick={onRetry}>
            {t('common.retry')}
          </Button>
        )}
      </CardBody>
    </Card>
  )
}