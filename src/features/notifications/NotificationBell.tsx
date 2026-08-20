import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import {
  useMarkAllRead,
  useNotifications,
  useUnreadCount,
} from '@/features/notifications/hooks'
import { NotificationItem } from '@/features/notifications/NotificationItem'

/** Bell + unread badge + dropdown with the latest notifications. */
export function NotificationBell() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const unread = useUnreadCount()
  const list = useNotifications('all')
  const markAll = useMarkAllRead()

  useEffect(() => {
    if (!open) return
    function onPointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const count = unread.data ?? 0
  const items = list.data?.pages[0]?.items ?? []

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={t('notifications.title')}
        aria-expanded={open}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 17h5l-1.4-1.4A1.5 1.5 0 0 1 18 14.6V11a6 6 0 1 0-12 0v3.6c0 .4-.2.8-.6 1L4 17h5m6 0v1a3 3 0 1 1-6 0v-1m6 0H9"
          />
        </svg>
        {count > 0 && (
          <span className="absolute -end-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-semibold text-white">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute end-0 top-full z-30 mt-2 w-80 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2">
            <p className="text-sm font-semibold text-slate-900">{t('notifications.title')}</p>
            <button
              type="button"
              onClick={() => markAll.mutate()}
              disabled={count === 0 || markAll.isPending}
              className="text-xs font-medium text-sky-600 hover:text-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t('notifications.markAllRead')}
            </button>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {list.isPending && (
              <p className="px-3 py-6 text-center text-sm text-slate-500">{t('common.loading')}</p>
            )}
            {list.isError && (
              <p className="px-3 py-6 text-center text-sm text-slate-500">
                {t('errors.generic')}
              </p>
            )}
            {list.isSuccess && items.length === 0 && (
              <EmptyState title={t('notifications.empty')} description={t('notifications.emptyHint')} />
            )}
            {list.isSuccess &&
              items.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  showActions={false}
                  onOpen={() => setOpen(false)}
                />
              ))}
          </div>

          <div className="border-t border-slate-100 p-2">
            <Button
              variant="ghost"
              size="sm"
              fullWidth
              onClick={() => {
                setOpen(false)
                navigate('/notifications')
              }}
            >
              {t('notifications.viewAll')}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}