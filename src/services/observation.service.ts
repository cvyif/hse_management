import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  where,
  writeBatch,
  type DocumentReference,
  type QueryConstraint,
} from 'firebase/firestore'

import { db } from '@/config/firebase'
import { hasPermission } from '@/lib/permissions'
import { buildObservationId, now } from '@/lib/utils'
import { canTransition, transitionPermission } from '@/lib/workflow'
import { createAuditEntry } from '@/services/audit.service'
import {
  evidencePublicId,
  isEvidenceUploadConfigured,
  uploadEvidenceFile,
} from '@/services/supabase.service'
import { notifyObservationCreated } from '@/services/notification.service'
import type { AuditAction } from '@/types/audit'
import type { Role } from '@/types/roles'
import {
  MAX_DESCRIPTION_LENGTH,
  MAX_EVIDENCE_BYTES,
  MAX_EVIDENCE_FILES,
  MAX_IMMEDIATE_ACTION_LENGTH,
  type EvidenceItem,
  type Observation,
  type ObservationInput,
  type ObservationStatus,
  type StatusChange,
} from '@/types/observation'

const OBSERVATIONS_COLLECTION = 'observations'
const COUNTERS_COLLECTION = 'counters'
const COUNTER_DOC_ID = 'observationIds'

/** Actor context captured from the authenticated session. */
export interface ObservationActor {
  uid: string
  role: Role
  displayName: string
  companyId?: string
}

/** A file selected by the reporter, pending upload at submission. */
export interface PendingEvidenceFile {
  /** Stable file id reused across retries so re-uploads overwrite paths. */
  id: string
  file: File
}

/** Sensible image/document formats allowed as evidence. */
export const ALLOWED_EVIDENCE_EXTENSIONS: readonly string[] = [
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.heic',
  '.heif',
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.csv',
]

function observationDocRef(id: string): DocumentReference {
  if (!db) throw new Error('Firebase is not configured.')
  return doc(db, OBSERVATIONS_COLLECTION, id)
}

function counterDocRef(): DocumentReference {
  if (!db) throw new Error('Firebase is not configured.')
  return doc(db, COUNTERS_COLLECTION, COUNTER_DOC_ID)
}

function extensionOf(name: string): string {
  const index = name.lastIndexOf('.')
  if (index === -1) return ''
  return name.slice(index).toLowerCase()
}

/**
 * Validate evidence against the defined limits. Returns a list of
 * user-facing error messages (empty when valid). The Firestore and Storage
 * rules enforce the same limits authoritatively.
 */
export function validateEvidence(files: readonly File[]): string[] {
  if (files.length > MAX_EVIDENCE_FILES) {
    return [`Maximum ${MAX_EVIDENCE_FILES} files are allowed.`]
  }
  const errors: string[] = []
  for (const file of files) {
    if (file.size > MAX_EVIDENCE_BYTES) {
      errors.push(`"${file.name}" exceeds the 10 MB per-file limit.`)
    }
    if (!ALLOWED_EVIDENCE_EXTENSIONS.includes(extensionOf(file.name))) {
      errors.push(`"${file.name}" has an unsupported file type.`)
    }
  }
  return errors
}

/**
 * Generate the next human-readable Observation ID (`OBS-YYYY-NNNNN`) in a
 * Firestore transaction against the `counters/observationIds` document. The
 * transaction makes concurrent creation safe: every call atomically reads and
 * increments the counter, and the ID is also used as the Firestore document
 * id, so duplicates are impossible.
 */
export async function nextObservationId(): Promise<string> {
  if (!db) throw new Error('Firebase is not configured.')
  const counterRef = counterDocRef()
  const year = new Date().getFullYear()
  const sequence = await runTransaction(db, async (tx) => {
    const snapshot = await tx.get(counterRef)
    const current = snapshot.exists()
      ? (snapshot.data() as { year: number; sequence: number })
      : null
    if (!current || current.year !== year) {
      tx.set(counterRef, { year, sequence: 1 })
      return 1
    }
    tx.set(counterRef, { year, sequence: current.sequence + 1 })
    return current.sequence + 1
  })
  return buildObservationId(year, sequence)
}

/** Create a DRAFT observation (reserving a unique Observation ID). */
export async function createDraft(
  input: Partial<ObservationInput>,
  actor: ObservationActor,
): Promise<Observation> {
  if (!db) throw new Error('Firebase is not configured.')
  const observationId = await nextObservationId()
  const timestamp = now()
  const data: Record<string, unknown> = {
    id: observationId,
    observationId,
    evidence: [],
    reporterId: actor.uid,
    reporterName: actor.displayName,
    reporterRole: actor.role,
    status: 'DRAFT',
    timeline: [{ to: 'DRAFT', at: timestamp, by: actor.uid }],
    createdAt: timestamp,
    updatedAt: timestamp,
  }
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) data[key] = value
  }
  if (actor.companyId !== undefined) data.reporterCompanyId = actor.companyId
  const observation = data as unknown as Observation
  const audit = createAuditEntry({
    actorId: actor.uid,
    actorRole: actor.role,
    action: 'observation.created',
    entityType: 'observation',
    entityId: observationId,
  })
  const batch = writeBatch(db)
  batch.set(observationDocRef(observationId), data)
  batch.set(audit.ref, audit.log)
  await batch.commit()
  return observation
}

/** Update an existing DRAFT (creator only; enforced by rules). */
export async function updateDraft(
  id: string,
  input: Partial<ObservationInput>,
  actor: ObservationActor,
): Promise<void> {
  if (!db) throw new Error('Firebase is not configured.')
  const timestamp = now()
  const snapshot = await getDoc(observationDocRef(id))
  if (!snapshot.exists()) throw new Error('Observation not found.')
  const existing = snapshot.data() as Observation
  // A DRAFT keeps its timeline and (empty) evidence list unchanged.
  const data: Record<string, unknown> = {
    id: existing.id,
    observationId: existing.observationId,
    reporterId: existing.reporterId,
    reporterName: existing.reporterName,
    reporterRole: existing.reporterRole,
    createdAt: existing.createdAt,
    updatedAt: timestamp,
    timeline: existing.timeline,
    evidence: existing.evidence,
  }
  if (existing.reporterCompanyId !== undefined) data.reporterCompanyId = existing.reporterCompanyId
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) data[key] = value
  }
  const audit = createAuditEntry({
    actorId: actor.uid,
    actorRole: actor.role,
    action: 'observation.updated',
    entityType: 'observation',
    entityId: id,
  })
  const batch = writeBatch(db)
  batch.update(observationDocRef(id), data)
  batch.set(audit.ref, audit.log)
  await batch.commit()
}

/**
 * Submit an Observation: upload all evidence files to Storage first, then
 * transition the document DRAFT → OPEN together with the evidence metadata
 * and the audit entry in one atomic batch.
 *
 * If a file upload fails, the document stays a DRAFT and the operation can be
 * retried; stable file ids make re-uploads overwrite the same Storage paths,
 * so a failed attempt leaves no orphaned metadata.
 */
export async function submitObservation(
  id: string,
  input: ObservationInput,
  files: readonly PendingEvidenceFile[],
  actor: ObservationActor,
): Promise<Observation> {
  if (!db) throw new Error('Firebase is not configured.')
  if (!isEvidenceUploadConfigured()) {
    throw new Error('Evidence storage is not configured.')
  }

  const errors = validateEvidence(files.map((item) => item.file))
  if (errors.length > 0) throw new Error(errors.join(' '))

  const timestamp = now()
  const evidenceItems: EvidenceItem[] = []
  for (const item of files) {
    const publicId = evidencePublicId('evidence', id, item.id)
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

  const snapshot = await getDoc(observationDocRef(id))
  if (!snapshot.exists()) throw new Error('Observation not found.')
  const existing = snapshot.data() as Observation

  const timeline: StatusChange[] = [
    ...(existing.timeline ?? []),
    { from: existing.status, to: 'OPEN', at: timestamp, by: actor.uid },
  ]
  const audit = createAuditEntry({
    actorId: actor.uid,
    actorRole: actor.role,
    action: 'observation.submitted',
    entityType: 'observation',
    entityId: id,
    changes: { status: 'OPEN', evidenceCount: evidenceItems.length },
  })
  const batch = writeBatch(db)
  const update: Record<string, unknown> = {
    id: existing.id,
    observationId: existing.observationId,
    reporterId: existing.reporterId,
    reporterName: existing.reporterName,
    reporterRole: existing.reporterRole,
    createdAt: existing.createdAt,
    evidence: evidenceItems,
    status: 'OPEN',
    submittedAt: timestamp,
    timeline,
    updatedAt: timestamp,
  }
  if (existing.reporterCompanyId !== undefined) update.reporterCompanyId = existing.reporterCompanyId
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) update[key] = value
  }
  batch.update(observationDocRef(id), update)
  batch.set(audit.ref, audit.log)
  await batch.commit()

  const observation: Observation = {
    ...existing,
    ...input,
    evidence: evidenceItems,
    status: 'OPEN',
    submittedAt: timestamp,
    timeline,
    updatedAt: timestamp,
  }
  // Best-effort notification after the transition commits (never throws).
  await notifyObservationCreated(observation, actor.uid)

  return observation
}

/** All observations, newest first (readable by HSE roles & Super Admin). */
export async function listObservations(
  scope?: {
    companyId?: string
    areaIds?: string[]
  },
  limitCount?: number,
): Promise<Observation[]> {
  if (!db) throw new Error('Firebase is not configured.')
  const constraints: QueryConstraint[] = [orderBy('createdAt', 'desc')]
  if (scope?.companyId) {
    // Company Representatives can only list their own company's Observations
    // (the read rule requires the query to be scoped by companyId).
    constraints.push(where('companyId', '==', scope.companyId))
  }
  if (scope?.areaIds && scope.areaIds.length > 0) {
    // Area Authorities can only list Observations in their assigned areas
    // (the read rule requires the query to be scoped by areaId).
    constraints.push(where('areaId', 'in', scope.areaIds))
  }
  if (limitCount != null && limitCount > 0) {
    // Bounded map queries (Phase 6): only the N most recent matching
    // observations are loaded; the map never pulls the whole history.
    constraints.push(limit(limitCount))
  }
  const snapshot = await getDocs(
    query(collection(db, OBSERVATIONS_COLLECTION), ...constraints),
  )
  return snapshot.docs.map((d) => d.data() as Observation)
}

/** Single observation by its `OBS-YYYY-NNNNN` document id. */
export async function getObservation(id: string): Promise<Observation | null> {
  if (!db) throw new Error('Firebase is not configured.')
  const snapshot = await getDoc(observationDocRef(id))
  return snapshot.exists() ? (snapshot.data() as Observation) : null
}

/**
 * Transition an Observation to a new status (Phase 4 corrective-action
 * lifecycle). Validates the transition and the actor's permission centrally,
 * appends the timeline entry and writes the audit record atomically with the
 * status change. The Firestore rules enforce the same transition + role
 * constraints authoritatively.
 */
export interface ObservationTransitionOptions {
  /** Audit action recorded for this transition. */
  auditAction: AuditAction
  /** Optional audit changes payload. */
  auditChanges?: Record<string, unknown>
  /** Extra fields to set on the Observation (e.g. closedAt/closedBy). */
  extra?: Record<string, unknown>
}

export async function transitionObservationStatus(
  id: string,
  to: ObservationStatus,
  actor: ObservationActor,
  options: ObservationTransitionOptions,
): Promise<void> {
  if (!db) throw new Error('Firebase is not configured.')
  const snapshot = await getDoc(observationDocRef(id))
  if (!snapshot.exists()) throw new Error('Observation not found.')
  const existing = snapshot.data() as Observation
  if (!canTransition(existing.status, to)) {
    throw new Error(`Invalid transition from ${existing.status} to ${to}.`)
  }
  const permission = transitionPermission(existing.status, to)
  if (permission && !hasPermission(actor.role, permission)) {
    throw new Error('You do not have permission to perform this action.')
  }
  const timestamp = now()
  const timeline: StatusChange[] = [
    ...(existing.timeline ?? []),
    { from: existing.status, to, at: timestamp, by: actor.uid },
  ]
  const update: Record<string, unknown> = {
    ...existing,
    status: to,
    timeline,
    updatedAt: timestamp,
    ...options.extra,
  }
  const audit = createAuditEntry({
    actorId: actor.uid,
    actorRole: actor.role,
    action: options.auditAction,
    entityType: 'observation',
    entityId: id,
    changes: options.auditChanges,
    metadata: { observationId: id, from: existing.status, to },
  })
  const batch = writeBatch(db)
  batch.update(observationDocRef(id), update)
  batch.set(audit.ref, audit.log)
  await batch.commit()
}

export const DESCRIPTION_LIMITS = {
  maxLength: MAX_DESCRIPTION_LENGTH,
  minLength: 1,
} as const

export const IMMEDIATE_ACTION_LIMITS = {
  maxLength: MAX_IMMEDIATE_ACTION_LENGTH,
} as const