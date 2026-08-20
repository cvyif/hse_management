import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/Button'
import { useAuthStore } from '@/stores/auth.store'
import { useUiStore } from '@/stores/ui.store'
import { LanguageSwitcher } from '@/features/layout/LanguageSwitcher'
import { NotificationBell } from '@/features/notifications/NotificationBell'
import { RoleBadge } from '@/features/layout/RoleBadge'
import { logout } from '@/services/auth.service'

export function Topbar() {
  const { t } = useTranslation()
  const toggleSidebar = useUiStore((s) => s.toggleSidebar)
  const profile = useAuthStore((s) => s.profile)

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur">
      <button
        type="button"
        onClick={toggleSidebar}
        className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100"
        aria-label="Toggle navigation"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <h1 className="truncate text-base font-semibold text-slate-900">{t('app.name')}</h1>

      <div className="ms-auto flex items-center gap-3">
        <NotificationBell />
        <LanguageSwitcher />
        {profile && (
          <div className="hidden items-center gap-2 sm:flex">
            <RoleBadge role={profile.role} />
          </div>
        )}
        <Button variant="ghost" size="sm" onClick={() => void logout()}>
          {t('common.signOut')}
        </Button>
      </div>
    </header>
  )
}