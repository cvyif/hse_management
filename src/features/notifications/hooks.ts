import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import type { QueryDocumentSnapshot } from 'firebase/firestore'

import {
  getUnreadNotificationCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  markNotificationUnread,
} from '@/services/notification.service'
import { useAuthStore } from '@/stores/auth.store'

export type NotificationFilter = 'all' | 'unread' | 'read'

export const notificationKeys = {
  list: (uid: string, filter: NotificationFilter) =>
    ['notifications', uid, 'list', filter] as const,
  unread: (uid: string) => ['notifications', uid, 'unread'] as const,
}

function useCurrentUid(): string | null {
  const authUser = useAuthStore((s) => s.authUser)
  return authUser?.uid ?? null
}

function invalidateNotifications(qc: ReturnType<typeof useQueryClient>): void {
  void qc.invalidateQueries({ queryKey: ['notifications'] })
}

// ---------- queries --------------------------------------------------------

export function useNotifications(filter: NotificationFilter) {
  const uid = useCurrentUid()
  return useInfiniteQuery({
    queryKey: notificationKeys.list(uid ?? '', filter),
    queryFn: ({ pageParam }) =>
      listNotifications(uid as string, {
        ...(filter === 'all' ? {} : { read: filter === 'read' }),
        ...(pageParam ? { startAfter: pageParam } : {}),
      }),
    initialPageParam: undefined as QueryDocumentSnapshot | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: Boolean(uid),
    refetchInterval: 30_000,
  })
}

export function useUnreadCount() {
  const uid = useCurrentUid()
  return useQuery({
    queryKey: notificationKeys.unread(uid ?? ''),
    queryFn: () => getUnreadNotificationCount(uid as string),
    enabled: Boolean(uid),
    refetchInterval: 30_000,
  })
}

// ---------- mutations ------------------------------------------------------

export function useMarkNotificationRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: () => invalidateNotifications(qc),
  })
}

export function useMarkNotificationUnread() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => markNotificationUnread(id),
    onSuccess: () => invalidateNotifications(qc),
  })
}

export function useMarkAllRead() {
  const qc = useQueryClient()
  const uid = useCurrentUid()
  return useMutation({
    mutationFn: () => markAllNotificationsRead(uid as string),
    onSuccess: () => invalidateNotifications(qc),
  })
}