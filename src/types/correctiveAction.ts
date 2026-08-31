import type { EvidenceItem } from '@/types/observation'

/**
 * Corrective Action submitted by the responsible company and verified by HSE.
 *
 * The document id equals the Observation id (`OBS-YYYY-NNNNN`), enforcing one
 * active Corrective Action per Observation (documented decision — the
 * workflow is strictly per-Observation in Phase 4).
 *
 * Lifecycle (mirrors the Observation lifecycle it drives):
 *
 *   REQUIRED → SUBMITTED → UNDER_VERIFICATION → ACCEPTED
 *                                    │
 *                                    └→ RETURNED → (resubmit) → SUBMITTED
 *
 * The company can never verify/close an action or its Observation; HSE
 * accepts (closing the Observation) or returns it for correction.
 */
export const CORRECTIVE_ACTION_STATUSES = [
  'REQUIRED',
  'SUBMITTED',
  'UNDER_VERIFICATION',
  'ACCEPTED',
  'RETURNED',
] as const

export type CorrectiveActionStatus = (typeof CORRECTIVE_ACTION_STATUSES)[number]

/** Limits enforced by the UI, the service layer and the security rules. */
export const MAX_ACTION_DESCRIPTION_LENGTH = 5_000
export const MAX_ACTION_RETURN_REASON_LENGTH = 2_000

export interface CorrectiveAction {
  /** Document id == observationId. */
  id: string
  /** Human-readable id (== document id == observationId). */
  correctiveActionId: string
  observationId: string
  /**
   * The responsible company (copied from the Observation, never edited).
   * Absent when the Observation has no company.
   */
  companyId?: string
  /** The corrective action description (the action itself). */
  description: string
  /** Metadata for the latest submitted evidence (binaries live in Storage). */
  evidence: EvidenceItem[]
  status: CorrectiveActionStatus
  /** HSE verifier who requested the corrective action. */
  createdBy: string
  /** Set when the company submits for verification. */
  submittedBy?: string
  submittedByName?: string
  submittedAt?: number
  /** Set when HSE accepts (closes the Observation). */
  verifiedBy?: string
  verifiedAt?: number
  /** Set when HSE returns the action for correction. */
  returnedBy?: string
  returnedAt?: number
  returnReason?: string
  createdAt: number
  updatedAt: number
}

/** Editable fields of a Corrective Action (company submits description+evidence). */
export interface CorrectiveActionInput {
  description: string
}