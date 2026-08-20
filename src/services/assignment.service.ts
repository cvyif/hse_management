import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  where,
  writeBatch,
  type DocumentReference,
} from 'firebase/firestore'

import { db } from '@/config/firebase'
import { now } from '@/lib/utils'
import { createAuditEntry } from '@/services/audit.service'
import { getUserProfile } from '@/services/user.service'
import type {
  AreaAuthorityAssignment,
  AreaAuthorityAssignmentInput,
} from '@/types/areaAuthorityAssignment'
import type { Role } from '@/types/roles'

const ASSIGNMENTS_COLLECTION = 'areaAuthorityAssignments'
const USERS_COLLECTION = 'users'
const AREA_AUTHORITY_ROLE = 'AREA_AUTHORITY'

export interface Actor {
  uid: string
  role?: Role
}

function assignmentDocRef(id: string) {
  if (!db) throw new Error('Firebase is not configured.')
  return doc(db, ASSIGNMENTS_COLLECTION, id)
}

/** All assignments, newest first (admin only). */
export async function listAssignments(): Promise<AreaAuthorityAssignment[]> {
  if (!db) throw new Error('Firebase is not configured.')
  const snapshot = await getDocs(
    query(collection(db, ASSIGNMENTS_COLLECTION), orderBy('createdAt', 'desc')),
  )
  return snapshot.docs.map((d) => d.data() as AreaAuthorityAssignment)
}

/** Assignments for a specific area (historical + current). */
export async function listAssignmentsForArea(areaId: string): Promise<AreaAuthorityAssignment[]> {
  if (!db) throw new Error('Firebase is not configured.')
  const snapshot = await getDocs(
    query(
      collection(db, ASSIGNMENTS_COLLECTION),
      where('areaId', '==', areaId),
      orderBy('createdAt', 'desc'),
    ),
  )
  return snapshot.docs.map((d) => d.data() as AreaAuthorityAssignment)
}

/** Areas each user is actively assigned to (assignments with active == true). */
function buildAssignedAreaMap(
  assignments: readonly AreaAuthorityAssignment[],
): Map<string, string[]> {
  const map = new Map<string, string[]>()
  for (const assignment of assignments) {
    if (!assignment.active) continue
    const areas = map.get(assignment.userId) ?? []
    if (!areas.includes(assignment.areaId)) areas.push(assignment.areaId)
    map.set(assignment.userId, areas)
  }
  return map
}

/**
 * Phase 5: recompute `assignedAreaIds` for every Area Authority whose area
 * set changed after an assignment write. Returns user-document updates meant
 * to be committed in the SAME batch as the assignment write so the two stay
 * atomic (the users update rule restricts these writes to only the
 * `assignedAreaIds`/`updatedAt` fields).
 *
 * Note: the list is based on the `active` flag only, not the optional shift
 * window — window expiry cannot be evaluated in rules, so the notification
 * service re-filters with `currentAuthorities()` at send time (documented).
 */
async function collectAssignedAreaIdUpdates(
  assignments: readonly AreaAuthorityAssignment[],
): Promise<{ ref: DocumentReference; data: Record<string, unknown> }[]> {
  if (!db) throw new Error('Firebase is not configured.')
  const timestamp = now()
  const updates: { ref: DocumentReference; data: Record<string, unknown> }[] = []
  for (const [uid, areaIds] of buildAssignedAreaMap(assignments)) {
    const user = await getUserProfile(uid)
    if (!user || user.role !== AREA_AUTHORITY_ROLE) continue
    const current = user.assignedAreaIds ?? []
    if (current.length === areaIds.length && current.every((id) => areaIds.includes(id))) continue
    updates.push({
      ref: doc(db, USERS_COLLECTION, uid),
      data: { assignedAreaIds: areaIds, updatedAt: timestamp },
    })
  }
  return updates
}

export async function createAssignment(
  input: AreaAuthorityAssignmentInput,
  actor: Actor,
): Promise<AreaAuthorityAssignment> {
  if (!db) throw new Error('Firebase is not configured.')
  const timestamp = now()
  const id = doc(collection(db, ASSIGNMENTS_COLLECTION)).id
  const assignment: AreaAuthorityAssignment = {
    id,
    areaId: input.areaId,
    userId: input.userId,
    rotationId: input.rotationId,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    active: input.active ?? true,
    createdAt: timestamp,
    updatedAt: timestamp,
    createdBy: actor.uid,
    updatedBy: actor.uid,
  }
  const audit = createAuditEntry({
    actorId: actor.uid,
    actorRole: actor.role,
    action: 'area_authority_assignment.created',
    entityType: 'area_authority_assignment',
    entityId: id,
    changes: { areaId: assignment.areaId, userId: assignment.userId, rotationId: assignment.rotationId },
  })
  const assignments = await listAssignments()
  const userUpdates = await collectAssignedAreaIdUpdates([...assignments, assignment])
  const batch = writeBatch(db)
  batch.set(assignmentDocRef(id), assignment)
  batch.set(audit.ref, audit.log)
  for (const update of userUpdates) batch.update(update.ref, update.data)
  await batch.commit()
  return assignment
}

export async function updateAssignment(
  id: string,
  input: AreaAuthorityAssignmentInput,
  actor: Actor,
): Promise<void> {
  if (!db) throw new Error('Firebase is not configured.')
  const timestamp = now()
  const snapshot = await getDoc(assignmentDocRef(id))
  if (!snapshot.exists()) throw new Error('Assignment not found.')
  const fields = {
    areaId: input.areaId,
    userId: input.userId,
    rotationId: input.rotationId,
    startsAt: input.startsAt ?? null,
    endsAt: input.endsAt ?? null,
    updatedAt: timestamp,
    updatedBy: actor.uid,
  }
  const audit = createAuditEntry({
    actorId: actor.uid,
    actorRole: actor.role,
    action: 'area_authority_assignment.updated',
    entityType: 'area_authority_assignment',
    entityId: id,
    changes: fields,
  })
  const assignments = await listAssignments()
  const simulated: AreaAuthorityAssignment[] = assignments.map((a) =>
    a.id === id
      ? {
          ...a,
          areaId: fields.areaId,
          userId: fields.userId,
          rotationId: fields.rotationId,
          startsAt: fields.startsAt ?? undefined,
          endsAt: fields.endsAt ?? undefined,
          updatedAt: fields.updatedAt,
          updatedBy: fields.updatedBy,
        }
      : a,
  )
  const userUpdates = await collectAssignedAreaIdUpdates(simulated)
  const batch = writeBatch(db)
  batch.update(assignmentDocRef(id), fields)
  batch.set(audit.ref, audit.log)
  for (const update of userUpdates) batch.update(update.ref, update.data)
  await batch.commit()
}

/** Deactivate an assignment instead of deleting it (history preserved). */
export async function setAssignmentActive(
  id: string,
  active: boolean,
  actor: Actor,
): Promise<void> {
  if (!db) throw new Error('Firebase is not configured.')
  const timestamp = now()
  const snapshot = await getDoc(assignmentDocRef(id))
  if (!snapshot.exists()) throw new Error('Assignment not found.')
  const audit = createAuditEntry({
    actorId: actor.uid,
    actorRole: actor.role,
    action: active
      ? 'area_authority_assignment.activated'
      : 'area_authority_assignment.deactivated',
    entityType: 'area_authority_assignment',
    entityId: id,
    changes: { active },
  })
  const assignments = await listAssignments()
  const simulated = assignments.map((a) =>
    a.id === id ? { ...a, active, updatedAt: timestamp, updatedBy: actor.uid } : a,
  )
  const userUpdates = await collectAssignedAreaIdUpdates(simulated)
  const batch = writeBatch(db)
  batch.update(assignmentDocRef(id), { active, updatedAt: timestamp, updatedBy: actor.uid })
  batch.set(audit.ref, audit.log)
  for (const update of userUpdates) batch.update(update.ref, update.data)
  await batch.commit()
}