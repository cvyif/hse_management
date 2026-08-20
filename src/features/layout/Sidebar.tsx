import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router-dom'

import { Badge } from '@/components/ui/Badge'
import { useUsers } from '@/features/admin/hooks'
import { useUnreadCount } from '@/features/notifications/hooks'
import { cn } from '@/lib/cn'
import { hasPermission } from '@/lib/permissions'
import { useAuthStore } from '@/stores/auth.store'

const NAV_ITEMS = [
  { to: '/dashboard', labelKey: 'nav.dashboard', end: true },
  { to: '/notifications', labelKey: 'nav.notifications', end: true },
] as const

const OBSERVATION_ITEMS = [
  { to: '/observations', labelKey: 'nav.observations', end: true },
  { to: '/map', labelKey: 'nav.siteMap', end: false },
  { to: '/observations/new', labelKey: 'nav.newObservation', end: true },
] as const

const ADMIN_ITEMS = [
  { to: '/admin/registrations', labelKey: 'nav.admin.registrations', end: false },
  { to: '/admin/users', labelKey: 'nav.admin.users', end: false },
  { to: '/admin/companies', labelKey: 'nav.admin.companies', end: false },
  { to: '/admin/areas', labelKey: 'nav.admin.areas', end: false },
  { to: '/admin/rotations', labelKey: 'nav.admin.rotations', end: false },
  { to: '/admin/assignments', labelKey: 'nav.admin.assignments', end: false },
] as const

function NavItem({
  to,
  label,
  end,
  badge,
}: {
  to: string
  label: string
  end?: boolean
  badge?: number
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors',
          isActive
            ? 'bg-sky-600 text-white'
            : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900',
        )
      }
    >
      <span>{label}</span>
      {badge != null && badge > 0 && <Badge tone="amber">{badge}</Badge>}
    </NavLink>
  )
}

export function SidebarContent() {
  const { t } = useTranslation()
  const profile = useAuthStore((s) => s.profile)

  const isAdmin = profile?.role === 'SUPER_ADMIN'
  const canReadObservations = hasPermission(profile?.role, 'observation:read')
  const canCreateObservations = hasPermission(profile?.role, 'observation:create')
  const users = useUsers(isAdmin)
  const unread = useUnreadCount()
  const pendingCount =
    users.data?.filter((u) => u.status === 'PENDING').length ?? 0

  return (
    <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
      {NAV_ITEMS.map((item) => (
        <NavItem
          key={item.to}
          to={item.to}
          label={t(item.labelKey)}
          end={item.end}
          badge={
            item.to === '/notifications' && (unread.data ?? 0) > 0
              ? (unread.data ?? 0)
              : undefined
          }
        />
      ))}

      {canReadObservations && (
        <>
          <p className="px-3 pb-1 pt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
            {t('nav.observationsSection')}
          </p>
          {OBSERVATION_ITEMS.map((item) =>
            item.to === '/observations/new' && !canCreateObservations ? null : (
              <NavItem key={item.to} to={item.to} label={t(item.labelKey)} end={item.end} />
            ),
          )}
        </>
      )}

      {isAdmin && (
        <>
          <p className="px-3 pb-1 pt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
            {t('nav.admin.section')}
          </p>
          {ADMIN_ITEMS.map((item) => (
            <NavItem
              key={item.to}
              to={item.to}
              label={t(item.labelKey)}
              badge={item.to === '/admin/registrations' ? pendingCount : undefined}
            />
          ))}
        </>
      )}

      <div className="mt-auto px-3 pt-4">
        <p className="text-xs text-slate-500">{profile?.displayName}</p>
      </div>
    </nav>
  )
}