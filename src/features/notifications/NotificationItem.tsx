import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { useAreas, useCompanies } from '@/features/admin/hooks'
import {
  useMarkNotificationRead,
  useMarkNotificationUnread,
} from '@/features/notifications/hooks'
import { cn } from '@/lib/cn'
import { formatRelativeTime } from '@/lib/utils'
import type { AppNotification } from '@/types/notification'

export interface NotificationItemProps {
  notification: AppNotification
  /** Close the dropdown (bell) before navigating. */
  onOpen?: () => void
  /** Show the inline mark read/unread control (hidden in the bell dropdown). */
  showActions?: boolean
}

export function NotificationItem({
  notification,
  onOpen,
  showActions = true,
}: NotificationItemProps) {
  const { t, i18n } = useTranslation()
  const companies = useCompanies()
  const areas = useAreas()
  const markRead = useMarkNotificationRead()
  const markUnread = useMarkNotificationUnread()

  const companyName = notification.companyId
    ? companies.data?.find((c) => c.id === notification.companyId)?.name
    : undefined
  const areaName = notification.areaId
    ? areas.data?.find((a) => a.id === notification.areaId)?.name
    : undefined

  const message = t(notification.messageKey, {
    observationId: notification.observationId,
    companyName: companyName ?? notification.companyId ?? '',
    areaName: areaName ?? notification.areaId ?? '',
  })

  return (
    <div
      className={cn(
        'flex gap-3 border-b border-slate-100 px-3 py-3',
        !notification.read && 'bg-sky-50/60',
      )}
    >
      <div className="min-w-0 flex-1">
        <Link
          to={`/observations/${notification.observationId}`}
          onClick={() => {
            onOpen?.()
            if (!notification.read) markRead.mutate(notification.id)
          }}
          className="block"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-medium text-slate-900">
              {t(notification.titleKey)}
            </p>
            {!notification.read && (
              <span
                className="h-2 w-2 shrink-0 rounded-full bg-sky-500"
                aria-label={t('notifications.unread')}
              />
            )}
          </div>
          <p className="mt-0.5 text-sm text-slate-600">{message}</p>
          <p className="mt-1 text-xs text-slate-400">
            {formatRelativeTime(notification.createdAt, i18n.language)}
          </p>
        </Link>
      </div>

      {showActions && (
        <div className="flex shrink-0 items-start pt-0.5">
          {notification.read ? (
            <button
              type="button"
              onClick={() => markUnread.mutate(notification.id)}
              className="text-xs font-medium text-slate-400 hover:text-slate-600"
            >
              {t('notifications.markUnread')}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => markRead.mutate(notification.id)}
              className="text-xs font-medium text-sky-600 hover:text-sky-700"
            >
              {t('notifications.markRead')}
            </button>
          )}
        </div>
      )}
    </div>
  )
}