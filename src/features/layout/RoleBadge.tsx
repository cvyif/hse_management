import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/Badge'
import type { Role } from '@/types/roles'

const ROLE_TONES: Record<Role, 'gray' | 'blue' | 'green' | 'amber' | 'red'> = {
  SUPER_ADMIN: 'red',
  HSE_MANAGER: 'blue',
  HSE_OFFICER: 'blue',
  PA: 'blue',
  AREA_AUTHORITY: 'amber',
  COMPANY_REP: 'green',
}

/** Role label with a tone, driven by the active language. */
export function RoleBadge({ role }: { role: Role | undefined }) {
  const { t } = useTranslation()
  if (!role) return <Badge tone="gray">{t('common.notAvailable')}</Badge>
  return <Badge tone={ROLE_TONES[role]}>{t(`roles.${role}`)}</Badge>
}