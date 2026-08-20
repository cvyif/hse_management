import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/Badge'
import type { UserStatus } from '@/types/user'

/** User registration status badge. */
export function UserStatusBadge({ status }: { status: UserStatus }) {
  const { t } = useTranslation()
  const tone =
    status === 'APPROVED' ? 'green' : status === 'PENDING' ? 'amber' : 'red'
  return <Badge tone={tone}>{t(`userStatus.${status}`)}</Badge>
}

/** Active/inactive badge. */
export function ActiveBadge({ active }: { active: boolean }) {
  const { t } = useTranslation()
  return active ? (
    <Badge tone="green">{t('common.active')}</Badge>
  ) : (
    <Badge tone="gray">{t('common.inactive')}</Badge>
  )
}

/** Indicates whether an area-authority assignment is currently in effect. */
export function CurrentBadge({ current }: { current: boolean }) {
  const { t } = useTranslation()
  return current ? (
    <Badge tone="blue">{t('admin.assignments.current')}</Badge>
  ) : (
    <Badge tone="gray">{t('admin.assignments.notCurrent')}</Badge>
  )
}