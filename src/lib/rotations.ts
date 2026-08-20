import type { AreaAuthorityAssignment } from '@/types/areaAuthorityAssignment'
import { now as nowMs } from '@/lib/utils'

/**
 * True when an assignment covers the given instant (default: now).
 * An assignment is active only if:
 *   - its `active` flag is true, AND
 *   - `startsAt` (if set) is in the past, AND
 *   - `endsAt` (if set) is in the future.
 */
export function isAssignmentActiveAt(
  assignment: Pick<
    AreaAuthorityAssignment,
    'active' | 'startsAt' | 'endsAt'
  >,
  at: number = nowMs(),
): boolean {
  if (!assignment.active) return false
  if (assignment.startsAt != null && at < assignment.startsAt) return false
  if (assignment.endsAt != null && at >= assignment.endsAt) return false
  return true
}

/**
 * Currently responsible Area Authorities for an area, i.e. the users behind
 * assignments that are active right now. When no scheduling rule is set
 * (assignments without a time window), the active flag alone determines the
 * current authority.
 */
export function currentAuthorities(
  assignments: readonly AreaAuthorityAssignment[],
  at: number = nowMs(),
): AreaAuthorityAssignment[] {
  return assignments.filter((assignment) => isAssignmentActiveAt(assignment, at))
}

/** The latest active (non-time-limited) assignment, used as a fallback. */
export function defaultAssignment(
  assignments: readonly AreaAuthorityAssignment[],
): AreaAuthorityAssignment | undefined {
  return assignments
    .filter((assignment) => assignment.active)
    .sort((a, b) => b.updatedAt - a.updatedAt)[0]
}