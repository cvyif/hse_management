import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { AdminPageHeader } from '@/features/admin/AdminHeader'
import { ErrorCard, LoadingCard } from '@/features/admin/AsyncState'
import {
  useMarkAllRead,
  useNotifications,
  type NotificationFilter,
} from '@/features/notifications/hooks'
import { NotificationItem } from '@/features/notifications/NotificationItem'
import { cn } from '@/lib/cn'

const FILTERS: NotificationFilter[] = ['all', 'unread', 'read']

export function NotificationsPage() {
  const { t } = useTranslation()
  const [filter, setFilter] = useState<NotificationFilter>('all')
  const query = useNotifications(filter)
  const markAll = useMarkAllRead()

  const items = query.data?.pages.flatMap((page) => page.items) ?? []
  const nextCursor = query.hasNextPage
  const hasUnread = items.some((notification) => !notification.read)

  return (
    <div className="flex flex-col gap-4">
      <AdminPageHeader
        title={t('notifications.title')}
        description={t('notifications.description', { count: items.length })}
        action={
          <Button
            variant="secondary"
            onClick={() => markAll.mutate()}
            loading={markAll.isPending}
            disabled={!hasUnread}
          >
            {t('notifications.markAllRead')}
          </Button>
        }
      />

      <Card>
        <CardBody className="flex flex-wrap items-center gap-2">
          {FILTERS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setFilter(item)}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                filter === item
                  ? 'bg-sky-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
              )}
            >
              {t(`notifications.filters.${item}`)}
            </button>
          ))}
        </CardBody>
      </Card>

      <Card>
        {query.isError && (
          <ErrorCard
            message={query.error?.message ?? t('errors.generic')}
            onRetry={() => void query.refetch()}
          />
        )}

        {query.isPending && <LoadingCard />}

        {query.isSuccess && items.length === 0 && (
          <CardBody>
            <EmptyState
              title={t('notifications.empty')}
              description={t('notifications.emptyHint')}
            />
          </CardBody>
        )}

        {query.isSuccess && items.length > 0 && (
          <>
            {items.map((notification) => (
              <NotificationItem key={notification.id} notification={notification} />
            ))}
            <CardBody className="border-t border-slate-100">
              {nextCursor ? (
                <Button
                  variant="secondary"
                  fullWidth
                  onClick={() => void query.fetchNextPage()}
                  loading={query.isFetchingNextPage}
                >
                  {t('notifications.loadMore')}
                </Button>
              ) : (
                <p className="text-center text-sm text-slate-500">
                  {t('notifications.noMore')}
                </p>
              )}
            </CardBody>
          </>
        )}
      </Card>
    </div>
  )
}