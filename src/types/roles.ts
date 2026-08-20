/**
 * User roles defined by the HSE Management System brief.
 *
 * HSE Manager, HSE Staff and PA intentionally share operational
 * capabilities but remain separate roles so their permissions can be
 * managed independently.
 */
export const ROLES = [
  'SUPER_ADMIN',
  'HSE_MANAGER',
  'HSE_OFFICER',
  'PA',
  'AREA_AUTHORITY',
  'COMPANY_REP',
] as const

export type Role = (typeof ROLES)[number]

/** Roles with HSE operational capabilities. */
export const HSE_ROLES: readonly Role[] = ['HSE_MANAGER', 'HSE_OFFICER', 'PA']

/**
 * Roles that may be requested during registration or assigned by a Super
 * Admin through client-side user management. SUPER_ADMIN is intentionally
 * absent — it is only granted through the secure bootstrap process.
 */
export const NON_ADMIN_ROLES: readonly Role[] = [
  'HSE_MANAGER',
  'HSE_OFFICER',
  'PA',
  'AREA_AUTHORITY',
  'COMPANY_REP',
]

/** True when the role is one of the HSE operational roles. */
export function isHseRole(role: Role | undefined): boolean {
  return role != null && (HSE_ROLES as readonly Role[]).includes(role)
}