import { useTranslation } from 'react-i18next'

import { Select } from '@/components/ui/Select'
import { NON_ADMIN_ROLES } from '@/types/roles'
import { SECTIONS, type Section } from '@/types/area'
import type { Role } from '@/types/roles'

/** Role selector limited to roles assignable via user management. */
export function RoleSelect({
  value,
  onChange,
  invalid,
}: {
  value: string
  onChange: (role: Role) => void
  invalid?: boolean
}) {
  const { t } = useTranslation()
  return (
    <Select
      value={value}
      invalid={invalid}
      onChange={(e) => onChange(e.target.value as Role)}
    >
      <option value="" disabled>
        {t('admin.common.selectRole')}
      </option>
      {NON_ADMIN_ROLES.map((role) => (
        <option key={role} value={role}>
          {t(`roles.${role}`)}
        </option>
      ))}
    </Select>
  )
}

/** Station section selector (OIL / GAS). */
export function SectionSelect({
  value,
  onChange,
  invalid,
}: {
  value: Section
  onChange: (section: Section) => void
  invalid?: boolean
}) {
  const { t } = useTranslation()
  return (
    <Select
      value={value}
      invalid={invalid}
      onChange={(e) => onChange(e.target.value as Section)}
    >
      {SECTIONS.map((section) => (
        <option key={section} value={section}>
          {t(`sections.${section}`)}
        </option>
      ))}
    </Select>
  )
}