import {
  doc,
  getDoc,
  writeBatch,
  type DocumentReference,
} from 'firebase/firestore'

import { db } from '@/config/firebase'
import { hasPermission } from '@/lib/permissions'
import { now } from '@/lib/utils'
import { createAuditEntry } from '@/services/audit.service'
import {
  evidencePublicId,
  isEvidenceUploadConfigured,
  uploadEvidenceFile,
} from '@/services/supabase.service'
import {
  notifyActionAccepted,
  notifyActionRequired,
  notifyActionReturned,
  notifyActionSubmitted,
  notifyObservationClosed,
} from '@/services/notification.service'
import {
  getObservation,
  transitionObservationStatus,
  validateEvidence,
  type ObservationActor,
  type PendingEvidenceFile,
} from '@/services/observation.service'
import type { Permission } from '@/lib/permissions'
import {
  MAX_ACTION_DESCRIPTION_LENGTH,
  MAX_ACTION_RETURN_REASON_LENGTH,
  type CorrectiveAction,
  type CorrectiveActionInput,
} from '@/types/correctiveAction'
import type { AuditAction } from '@/types/audit'
import type { EvidenceItem } from '@/types/observation'

const ACTIONS_COLLECTION = 'correctiveActions'
const ACTION_EVIDENCE_PREFIX = 'correctiveActionEvidence'

/** Verdicts an HSE verifier can apply to an action under verification. */
export type ActionVerdict = 'ACCEPTED' | 'RETURNED'

function actionDocRef(observationId: string): DocumentReference {
  if (!db) throw new Error('Firebase is not configured.')
  return doc(db, ACTIONS_COLLECTION, observationId)
}

function extensionOf(name: string): string {
  const index = name.lastIndexOf('.')
  if (index === -1) return ''
  return name.slice(index).toLowerCase()
}

function assertPermission(role: ObservationActor['role'], permission: Permission): void {
  if (!hasPermission(role, permission)) {
    throw new Error('You do not have permission to perform this action.')
  }
}

/** Single corrective action by its Observation id (== document id). */
export async function getCorrectiveAction(
  observationId: string,
): Promise<CorrectiveAction | null> {
  if (!db) throw new Error('Firebase is not configured.')
  const snapshot = await getDoc(actionDocRef(observationId))
  return snapshot.exists() ? (snapshot.data() as CorrectiveAction) : null
}

/**
 * HSE requests a corrective action for an OPEN Observation:
 * creates the action document (REQUIRED) and transitions the Observation
 * OPEN → ACTION_REQUIRED. Committed in two ordered steps so Firestore rules
 * can validate each invariant against committed state.
 */
export async function requestCorrectiveAction(
  observationId: string,
  actor: ObservationActor,
): Promise<CorrectiveAction> {
  if (!db) throw new Error('Firebase is not configured.')
  assertPermission(actor.role, 'action:verify')

  const observation = await getObservation(observationId)
  if (!observation) throw new Error('Observation not found.')
  const existing = await getCorrectiveAction(observationId)
  if (existing) {
    // Idempotent retry: the action was created but the Observation transition
    // (step 2) failed previously — finish it now.
    if (observation.status === 'OPEN' && existing.status === 'REQUIRED') {
      await transitionObservationStatus(observationId, 'ACTION_REQUIRED', actor, {
        auditAction: 'observation.action_requested',
      })
      await notifyActionRequired(observation, actor.uid)
      return existing
    }
    throw new Error('A corrective action already exists for this observation.')
  }
  if (observation.status !== 'OPEN') {
    throw new Error('A corrective action can only be requested for an OPEN observation.')
  }

  const timestamp = now()
  const data: CorrectiveAction = {
    id: observationId,
    correctiveActionId: observationId,
    observationId,
    companyId: observation.companyId,
    description: '',
    evidence: [],
    status: 'REQUIRED',
    createdBy: actor.uid,
    createdAt: timestamp,
    updatedAt: timestamp,
  }

  // Step 1: create the action + audit.
  const auditCreated = createAuditEntry({
    actorId: actor.uid,
    actorRole: actor.role,
    action: 'corrective_action.created',
    entityType: 'corrective_action',
    entityId: observationId,
    metadata: { observationId },
  })
  const batch = writeBatch(db)
  batch.set(actionDocRef(observationId), data)
  batch.set(auditCreated.ref, auditCreated.log)
  await batch.commit()

  // Step 2: Observation OPEN -> ACTION_REQUIRED + audit.
  await transitionObservationStatus(observationId, 'ACTION_REQUIRED', actor, {
    auditAction: 'observation.action_requested',
  })
  await notifyActionRequired(observation, actor.uid)

  const updated = await getCorrectiveAction(observationId)
  if (!updated) throw new Error('Failed to create the corrective action.')
  return updated
}

/**
 * Company Representative submits the corrective action: uploads evidence to
 * Storage, updates the action (REQUIRED|RETURNED → SUBMITTED) and transitions
 * the Observation ACTION_REQUIRED → ACTION_SUBMITTED.
 */
export async function submitCorrectiveAction(
  observationId: string,
  input: CorrectiveActionInput,
  files: readonly PendingEvidenceFile[],
  actor: ObservationActor,
): Promise<CorrectiveAction> {
  if (!db) throw new Error('Firebase is not configured.')
  if (!isEvidenceUploadConfigured()) {
    throw new Error('Evidence storage is not configured.')
  }
  assertPermission(actor.role, 'action:submit')

  const description = input.description.trim()
  if (!description) throw new Error('Action description is required.')
  if (description.length > MAX_ACTION_DESCRIPTION_LENGTH) {
    throw new Error('Action description is too long.')
  }

  const action = await getCorrectiveAction(observationId)
  if (!action) throw new Error('No corrective action was requested for this observation.')
  const observation = await getObservation(observationId)
  if (!observation) throw new Error('Observation not found.')
  if (observation.companyId !== actor.companyId) {
    throw new Error('You can only submit corrective actions for your own company.')
  }

  // Idempotent retries: a previous attempt may have committed the action
  // update but failed the Observation transition (step 2).
  if (action.status === 'SUBMITTED') {
    if (observation.status === 'ACTION_REQUIRED') {
      await transitionObservationStatus(observationId, 'ACTION_SUBMITTED', actor, {
        auditAction: 'observation.action_submitted',
        auditChanges: { evidenceCount: action.evidence.length },
      })
      await notifyActionSubmitted(observation, action, actor.uid)
    }
    return action
  }
  if (action.status !== 'REQUIRED' && action.status !== 'RETURNED') {
    throw new Error('This corrective action is not awaiting submission.')
  }
  if (observation.status !== 'ACTION_REQUIRED') {
    throw new Error('This observation is not currently awaiting a corrective action.')
  }

  const errors = validateEvidence(files.map((item) => item.file))
  if (errors.length > 0) throw new Error(errors.join(' '))

  const timestamp = now()
  const evidenceItems: EvidenceItem[] = []
  for (const item of files) {
    const publicId = evidencePublicId(ACTION_EVIDENCE_PREFIX, observationId, item.id)
    const uploaded = await uploadEvidenceFile(item.file, publicId)
    evidenceItems.push({
      id: item.id,
      name: item.file.name,
      contentType: item.file.type || 'application/octet-stream',
      sizeBytes: item.file.size,
      uploadedAt: timestamp,
      uploadedBy: actor.uid,
      provider: 'supabase',
      publicId: uploaded.publicId,
      url: uploaded.url,
      format:
        uploaded.format ||
        extensionOf(item.file.name).replace(/^\./, ''),
    })
  }

  // Step 1: update the action + audit (rules forbid touching verification fields).
  const audit = createAuditEntry({
    actorId: actor.uid,
    actorRole: actor.role,
    action: 'corrective_action.submitted',
    entityType: 'corrective_action',
    entityId: observationId,
    changes: { evidenceCount: evidenceItems.length },
    metadata: {
      observationId,
      resubmission: action.submittedAt != null,
    },
  })
  const batch = writeBatch(db)
  batch.update(actionDocRef(observationId), {
    id: observationId,
    correctiveActionId: observationId,
    observationId,
    companyId: action.companyId,
    description,
    evidence: evidenceItems,
    status: 'SUBMITTED',
    submittedBy: actor.uid,
    submittedByName: actor.displayName,
    submittedAt: timestamp,
    createdAt: action.createdAt,
    createdBy: action.createdBy,
    updatedAt: timestamp,
  })
  batch.set(audit.ref, audit.log)
  await batch.commit()

  // Step 2: Observation ACTION_REQUIRED -> ACTION_SUBMITTED + audit.
  await transitionObservationStatus(observationId, 'ACTION_SUBMITTED', actor, {
    auditAction: 'observation.action_submitted',
    auditChanges: { evidenceCount: evidenceItems.length },
  })

  const updated = await getCorrectiveAction(observationId)
  if (!updated) throw new Error('Failed to submit the corrective action.')
  await notifyActionSubmitted(observation, updated, actor.uid)
  return updated
}

/**
 * HSE begins reviewing a submitted action: SUBMITTED → UNDER_VERIFICATION and
 * Observation ACTION_SUBMITTED → UNDER_VERIFICATION.
 */
export async function beginVerification(
  observationId: string,
  actor: ObservationActor,
): Promise<CorrectiveAction> {
  if (!db) throw new Error('Firebase is not configured.')
  assertPermission(actor.role, 'action:verify')

  const action = await getCorrectiveAction(observationId)
  if (!action) throw new Error('No corrective action exists for this observation.')
  const observation = await getObservation(observationId)
  if (!observation) throw new Error('Observation not found.')

  // Idempotent retry: the action update may have committed while the
  // Observation transition (step 2) failed.
  if (action.status === 'UNDER_VERIFICATION') {
    if (observation.status === 'ACTION_SUBMITTED') {
      await transitionObservationStatus(observationId, 'UNDER_VERIFICATION', actor, {
        auditAction: 'observation.verification_started',
      })
    }
    return action
  }
  if (action.status !== 'SUBMITTED' || observation.status !== 'ACTION_SUBMITTED') {
    throw new Error('This observation is not awaiting verification.')
  }

  const timestamp = now()

  // Step 1: action SUBMITTED -> UNDER_VERIFICATION + audit.
  const audit = createAuditEntry({
    actorId: actor.uid,
    actorRole: actor.role,
    action: 'corrective_action.under_review',
    entityType: 'corrective_action',
    entityId: observationId,
    metadata: { observationId },
  })
  const batch = writeBatch(db)
  batch.update(actionDocRef(observationId), actionUpdateWith(action, {
    status: 'UNDER_VERIFICATION',
    updatedAt: timestamp,
  }))
  batch.set(audit.ref, audit.log)
  await batch.commit()

  // Step 2: Observation ACTION_SUBMITTED -> UNDER_VERIFICATION + audit.
  await transitionObservationStatus(observationId, 'UNDER_VERIFICATION', actor, {
    auditAction: 'observation.verification_started',
  })

  const updated = await getCorrectiveAction(observationId)
  if (!updated) throw new Error('Failed to update the corrective action.')
  return updated
}

/**
 * HSE verifies an action under review: ACCEPTED closes the Observation
 * (UNDER_VERIFICATION → CLOSED with closedAt/closedBy); RETURNED sends it back
 * (UNDER_VERIFICATION → ACTION_REQUIRED) with a required return reason.
 */
export async function verifyCorrectiveAction(
  observationId: string,
  verdict: ActionVerdict,
  returnReason: string | undefined,
  actor: ObservationActor,
): Promise<CorrectiveAction> {
  if (!db) throw new Error('Firebase is not configured.')
  assertPermission(actor.role, 'action:verify')

  const action = await getCorrectiveAction(observationId)
  if (!action) throw new Error('No corrective action exists for this observation.')
  const observation = await getObservation(observationId)
  if (!observation) throw new Error('Observation not found.')

  let reason: string | undefined
  if (verdict === 'RETURNED') {
    reason = returnReason?.trim()
    if (!reason) throw new Error('A return reason is required.')
    if (reason.length > MAX_ACTION_RETURN_REASON_LENGTH) {
      throw new Error('Return reason is too long.')
    }
  }
  const targetObservationStatus =
    verdict === 'ACCEPTED' ? ('CLOSED' as const) : ('ACTION_REQUIRED' as const)

  // Idempotent retry: the verdict may have committed while the Observation
  // transition (step 2) failed.
  if (action.status === verdict) {
    if (observation.status === 'UNDER_VERIFICATION') {
      if (verdict === 'ACCEPTED') {
        const timestamp = now()
        await transitionObservationStatus(observationId, 'CLOSED', actor, {
          auditAction: 'observation.closed',
          extra: { closedAt: timestamp, closedBy: actor.uid },
        })
        await notifyActionAccepted(observation, action, actor.uid)
        await notifyObservationClosed(observation, actor.uid)
      } else {
        await transitionObservationStatus(observationId, 'ACTION_REQUIRED', actor, {
          auditAction: 'observation.returned',
          auditChanges: { returnReason: reason },
        })
        await notifyActionReturned(observation, action, actor.uid)
      }
    } else if (observation.status !== targetObservationStatus) {
      throw new Error('This observation is not under verification.')
    }
    return action
  }
  if (action.status !== 'UNDER_VERIFICATION' || observation.status !== 'UNDER_VERIFICATION') {
    throw new Error('This observation is not under verification.')
  }

  const timestamp = now()

  // Step 1: action verdict + audit.
  const auditAction: AuditAction =
    verdict === 'ACCEPTED' ? 'corrective_action.verified' : 'corrective_action.returned'
  const audit = createAuditEntry({
    actorId: actor.uid,
    actorRole: actor.role,
    action: auditAction,
    entityType: 'corrective_action',
    entityId: observationId,
    changes: verdict === 'RETURNED' ? { returnReason: reason } : undefined,
    metadata: { observationId, verdict },
  })
  const batch = writeBatch(db)
  batch.update(
    actionDocRef(observationId),
    actionUpdateWith(action, {
      status: verdict,
      updatedAt: timestamp,
      ...(verdict === 'ACCEPTED'
        ? { verifiedBy: actor.uid, verifiedAt: timestamp }
        : { returnedBy: actor.uid, returnedAt: timestamp, returnReason: reason }),
    }),
  )
  batch.set(audit.ref, audit.log)
  await batch.commit()

  // Step 2: Observation transition + audit.
  if (verdict === 'ACCEPTED') {
    await transitionObservationStatus(observationId, 'CLOSED', actor, {
      auditAction: 'observation.closed',
      extra: { closedAt: timestamp, closedBy: actor.uid },
    })
  } else {
    await transitionObservationStatus(observationId, 'ACTION_REQUIRED', actor, {
      auditAction: 'observation.returned',
      auditChanges: { returnReason: reason },
    })
  }

  const updated = await getCorrectiveAction(observationId)
  if (!updated) throw new Error('Failed to update the corrective action.')
  if (verdict === 'ACCEPTED') {
    await notifyActionAccepted(observation, updated, actor.uid)
    await notifyObservationClosed(observation, actor.uid)
  } else {
    await notifyActionReturned(observation, updated, actor.uid)
  }
  return updated
}

/** Rebuild an action document preserving all immutable fields. */
function actionUpdateWith(
  action: CorrectiveAction,
  changes: Record<string, unknown>,
): Record<string, unknown> {
  return {
    id: action.id,
    correctiveActionId: action.correctiveActionId,
    observationId: action.observationId,
    companyId: action.companyId,
    description: action.description,
    evidence: action.evidence,
    createdAt: action.createdAt,
    createdBy: action.createdBy,
    submittedBy: action.submittedBy,
    submittedByName: action.submittedByName,
    submittedAt: action.submittedAt,
    verifiedBy: action.verifiedBy,
    verifiedAt: action.verifiedAt,
    returnedBy: action.returnedBy,
    returnedAt: action.returnedAt,
    returnReason: action.returnReason,
    ...changes,
  }
}

export const ACTION_DESCRIPTION_LIMITS = {
  maxLength: MAX_ACTION_DESCRIPTION_LENGTH,
} as const

export const RETURN_REASON_LIMITS = {
  maxLength: MAX_ACTION_RETURN_REASON_LENGTH,
} as const