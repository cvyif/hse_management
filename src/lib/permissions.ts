import type { Role } from '@/types/roles'

/**
 * Central role-based access control matrix.
 *
 * Permissions are assigned per role so overlapping HSE capabilities can be
 * managed independently. Adjust this map to change what each role may do.
 *
 * Phase 3: Observation creation is limited to HSE operational roles and the
 * Super Admin.
 *
 * Phase 4: Corrective Action management. The only NEW permission added is
 * `action:verify` (request/begin/accept/return/close), granted to
 * HSE_MANAGER and HSE_OFFICER. PA retains `action:review` but does NOT gain
 * verification authority (documented decision — PA reviews only).
 * COMPANY_REP gains scoped `observation:read` (their own company only,
 * enforced by Firestore rules) and submits actions via the existing
 * `action:submit`. AREA_AUTHORITY keeps `action:review` per the existing
 * matrix and receives NO verification permissions (documented decision).
 *
 * Phase 5: AREA_AUTHORITY gains scoped `observation:read` so notification
 * links can navigate to their assigned areas' Observations (read scoping by
 * `assignedAreaIds` is enforced by the Firestore rules).
 *
 * IMPORTANT: Client permissions are an authorization convenience only.
 * Firestore security rules are the authoritative enforcement layer.
 */
export const PERMISSIONS = [
  'user:manage',
  'user:read',
  'registration:manage',
  'company:manage',
  'area:manage',
  'areaAuthority:manage',
  'rotation:manage',
  'observation:create',
  'observation:read',
  'observation:assign',
  'observation:verify',
  'action:submit',
  'action:review',
  'action:verify',
  'report:view',
  'audit:read',
] as const

export type Permission = (typeof PERMISSIONS)[number]

const ALL_PERMISSIONS: readonly Permission[] = PERMISSIONS

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  SUPER_ADMIN: ALL_PERMISSIONS,
  HSE_MANAGER: [
    'user:read',
    'company:manage',
    'area:manage',
    'observation:create',
    'observation:read',
    'observation:assign',
    'observation:verify',
    'action:review',
    'action:verify',
    'report:view',
    'audit:read',
  ],
  HSE_OFFICER: [
    'observation:create',
    'observation:read',
    'observation:assign',
    'observation:verify',
    'action:review',
    'action:verify',
    'report:view',
  ],
  PA: [
    'observation:create',
    'observation:read',
    'action:review',
    'report:view',
  ],
  AREA_AUTHORITY: [
    'observation:read',
    'action:review',
    'report:view',
  ],
  COMPANY_REP: ['observation:read', 'action:submit'],
}

/** True when the given role holds the requested permission. */
export function hasPermission(role: Role | undefined, permission: Permission): boolean {
  if (!role) return false
  return ROLE_PERMISSIONS[role].includes(permission)
}

/** True when the role holds at least one of the requested permissions. */
export function hasAnyPermission(
  role: Role | undefined,
  permissions: readonly Permission[],
): boolean {
  if (!role) return false
  const granted = ROLE_PERMISSIONS[role]
  return permissions.some((permission) => granted.includes(permission))
}