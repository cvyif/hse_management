import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { logout } from '@/services/auth.service'
import { useAuthStore } from '@/stores/auth.store'

/** Shown while a user's registration awaits Super Admin review. */
export function RegisterPendingPage() {
  const { t } = useTranslation()

  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-md">
        <Card>
          <CardBody>
            <h1 className="text-xl font-semibold text-slate-900">{t('auth.pendingTitle')}</h1>
            <p className="mt-2 text-sm text-slate-600">{t('auth.pendingMessage')}</p>
            <div className="mt-6">
              <Button variant="secondary" onClick={() => void logout()}>
                {t('common.signOut')}
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}

/** Shown when a registration was rejected or an account was deactivated. */
export function RejectedPage() {
  const { t } = useTranslation()
  const profile = useAuthStore((s) => s.profile)

  const deactivated = profile?.status === 'APPROVED' && profile.active === false

  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-md">
        <Card>
          <CardBody>
            <h1 className="text-xl font-semibold text-red-700">
              {t(deactivated ? 'auth.deactivatedTitle' : 'auth.rejectedTitle')}
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              {t(deactivated ? 'auth.deactivatedMessage' : 'auth.rejectedMessage')}
            </p>
            {!deactivated && profile?.rejectedReason && (
              <p className="mt-3 rounded-md bg-slate-100 p-3 text-sm text-slate-700">
                <span className="font-medium">{t('auth.reasons')}: </span>
                {profile.rejectedReason}
              </p>
            )}
            <div className="mt-6">
              <Button variant="secondary" onClick={() => void logout()}>
                {t('common.signOut')}
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}