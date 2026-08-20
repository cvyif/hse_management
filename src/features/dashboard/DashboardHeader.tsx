import { useTranslation } from 'react-i18next'

import { RoleBadge } from '@/features/layout/RoleBadge'
import { formatDate } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth.store'

/**
 * Task 7.1 dashboard header: page title, today's localized date, the current
 * user's role badge and a label describing the role-aware data scope shown on
 * the dashboard.
 */
export function DashboardHeader({ scopeLabel }: { scopeLabel: string }) {
  const { t, i18n } = useTranslation()
  const profile = useAuthStore((s) => s.profile)

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{t('dashboard.title')}</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          {t('dashboard.today', { date: formatDate(Date.now(), i18n.language) })}
        </p>
        <p className="mt-0.5 text-sm text-slate-500">{scopeLabel}</p>
      </div>
      {profile && <RoleBadge role={profile.role} />}
    </div>
  )
}