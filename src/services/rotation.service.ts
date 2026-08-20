import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  writeBatch,
} from 'firebase/firestore'

import { db } from '@/config/firebase'
import { now } from '@/lib/utils'
import { createAuditEntry } from '@/services/audit.service'
import type { Role } from '@/types/roles'
import type { Rotation, RotationInput } from '@/types/rotation'

const ROTATIONS_COLLECTION = 'rotations'

export interface Actor {
  uid: string
  role?: Role
}

function rotationDocRef(id: string) {
  if (!db) throw new Error('Firebase is not configured.')
  return doc(db, ROTATIONS_COLLECTION, id)
}

/** All rotations, by label (admin only). */
export async function listRotations(): Promise<Rotation[]> {
  if (!db) throw new Error('Firebase is not configured.')
  const snapshot = await getDocs(query(collection(db, ROTATIONS_COLLECTION), orderBy('label')))
  return snapshot.docs.map((d) => d.data() as Rotation)
}

export async function createRotation(input: RotationInput, actor: Actor): Promise<Rotation> {
  if (!db) throw new Error('Firebase is not configured.')
  const timestamp = now()
  const id = doc(collection(db, ROTATIONS_COLLECTION)).id
  const rotation: Rotation = {
    id,
    label: input.label.trim(),
    labelAr: input.labelAr?.trim() || undefined,
    active: input.active ?? true,
    createdAt: timestamp,
    updatedAt: timestamp,
    createdBy: actor.uid,
    updatedBy: actor.uid,
  }
  const audit = createAuditEntry({
    actorId: actor.uid,
    actorRole: actor.role,
    action: 'rotation.created',
    entityType: 'rotation',
    entityId: id,
    changes: { label: rotation.label },
  })
  const batch = writeBatch(db)
  batch.set(rotationDocRef(id), rotation)
  batch.set(audit.ref, audit.log)
  await batch.commit()
  return rotation
}

export async function updateRotation(id: string, input: RotationInput, actor: Actor): Promise<void> {
  if (!db) throw new Error('Firebase is not configured.')
  const timestamp = now()
  const fields = {
    label: input.label.trim(),
    labelAr: input.labelAr?.trim() || null,
    updatedAt: timestamp,
    updatedBy: actor.uid,
  }
  const audit = createAuditEntry({
    actorId: actor.uid,
    actorRole: actor.role,
    action: 'rotation.updated',
    entityType: 'rotation',
    entityId: id,
    changes: { label: fields.label },
  })
  const batch = writeBatch(db)
  batch.update(rotationDocRef(id), fields)
  batch.set(audit.ref, audit.log)
  await batch.commit()
}

export async function setRotationActive(
  id: string,
  active: boolean,
  actor: Actor,
): Promise<void> {
  if (!db) throw new Error('Firebase is not configured.')
  const timestamp = now()
  const audit = createAuditEntry({
    actorId: actor.uid,
    actorRole: actor.role,
    action: active ? 'rotation.activated' : 'rotation.deactivated',
    entityType: 'rotation',
    entityId: id,
    changes: { active },
  })
  const batch = writeBatch(db)
  batch.update(rotationDocRef(id), { active, updatedAt: timestamp, updatedBy: actor.uid })
  batch.set(audit.ref, audit.log)
  await batch.commit()
}