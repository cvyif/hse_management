import type { CorrectiveActionStatus } from '@/types/correctiveAction'
import type { ObservationStatus } from '@/types/observation'
import { OBSERVATION_STATUSES } from '@/types/observation'
import type { Permission } from '@/lib/permissions'

/**
 * Allowed Observation status transitions.
 *
 * Phase 4 implements the corrective-action lifecycle:
 *
 *   OPEN → ACTION_REQUIRED → ACTION_SUBMITTED → UNDER_VERIFICATION → CLOSED
 *            ▲                                        │
 *            └────────────────────────────────────────┘ (return)
 *
 * DRAFT → OPEN remains the Phase 3 reporting transition. ASSIGNED is kept as a
 * reserved status for a future assignment phase but is not reachable yet.
 *
 * A closed Observation is terminal in Phase 4 (reopening is a future phase).
 */
export const OBSERVATION_TRANSITIONS: Record<
  ObservationStatus,
  readonly ObservationStatus[]
> = {
  DRAFT: ['OPEN'],
  OPEN: ['ACTION_REQUIRED'],
  ACTION_REQUIRED: ['ACTION_SUBMITTED'],
  ACTION_SUBMITTED: ['UNDER_VERIFICATION'],
  UNDER_VERIFICATION: ['CLOSED', 'ACTION_REQUIRED'],
  CLOSED: [],
  ASSIGNED: [],
}

/**
 * Allowed Corrective Action status transitions. The action lifecycle mirrors
 * the Observation lifecycle it drives:
 *
 *   REQUIRED → SUBMITTED → UNDER_VERIFICATION → ACCEPTED
 *                                    │
 *                                    └→ RETURNED → (resubmit) → SUBMITTED
 */
export const CORRECTIVE_ACTION_TRANSITIONS: Record<
  CorrectiveActionStatus,
  readonly CorrectiveActionStatus[]
> = {
  REQUIRED: ['SUBMITTED'],
  SUBMITTED: ['UNDER_VERIFICATION'],
  UNDER_VERIFICATION: ['ACCEPTED', 'RETURNED'],
  ACCEPTED: [],
  RETURNED: ['SUBMITTED'],
}

/** Statuses that still require attention (used for dashboards/overdue). */
export const OPEN_STATUSES: readonly ObservationStatus[] = [
  'OPEN',
  'ACTION_REQUIRED',
  'ACTION_SUBMITTED',
  'UNDER_VERIFICATION',
]

/** True when `to` is a valid next status from `from`. */
export function canTransition(
  from: ObservationStatus,
  to: ObservationStatus,
): boolean {
  return OBSERVATION_TRANSITIONS[from].includes(to)
}

/** True when `to` is a valid next Corrective Action status from `from`. */
export function canActionTransition(
  from: CorrectiveActionStatus,
  to: CorrectiveActionStatus,
): boolean {
  return CORRECTIVE_ACTION_TRANSITIONS[from].includes(to)
}

/**
 * The permission required to perform a given Observation transition. DRAFT
 * transitions are reporter-owned (no permission gate) and return null;
 * Phase 4 lifecycle transitions are gated by the centralized RBAC.
 */
export function transitionPermission(
  from: ObservationStatus,
  to: ObservationStatus,
): Permission | null {
  if (!canTransition(from, to)) return null
  switch (from) {
    case 'OPEN':
    case 'ACTION_SUBMITTED':
    case 'UNDER_VERIFICATION':
      return 'action:verify'
    case 'ACTION_REQUIRED':
      return 'action:submit'
    default:
      return null
  }
}

/**
 * Resolves the Observation status change driven by a Corrective Action
 * verdict. ACCEPTED closes the Observation; RETURNED sends it back to the
 * company for correction.
 */
export function statusAfterReview(
  verdict: CorrectiveActionStatus,
): ObservationStatus | null {
  if (verdict === 'ACCEPTED') return 'CLOSED'
  if (verdict === 'RETURNED') return 'ACTION_REQUIRED'
  return null
}

/** Valid statuses for the current workflow step. */
export function nextStatuses(from: ObservationStatus): readonly ObservationStatus[] {
  return OBSERVATION_TRANSITIONS[from]
}

export function isClosed(status: ObservationStatus): boolean {
  return status === 'CLOSED'
}

export function isValidStatus(value: unknown): value is ObservationStatus {
  return typeof value === 'string' && (OBSERVATION_STATUSES as readonly string[]).includes(value)
}