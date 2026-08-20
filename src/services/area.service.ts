import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  writeBatch,
} from 'firebase/firestore'

import { db } from '@/config/firebase'
import { clampMapPoint, now } from '@/lib/utils'
import { createAuditEntry } from '@/services/audit.service'
import type { Area, AreaInput } from '@/types/area'
import type { MapPoint } from '@/types/map'
import type { Role } from '@/types/roles'

const AREAS_COLLECTION = 'areas'

export interface Actor {
  uid: string
  role?: Role
}

function areaDocRef(id: string) {
  if (!db) throw new Error('Firebase is not configured.')
  return doc(db, AREAS_COLLECTION, id)
}

/** All areas, by section then name (admin only). */
export async function listAreas(): Promise<Area[]> {
  if (!db) throw new Error('Firebase is not configured.')
  const snapshot = await getDocs(query(collection(db, AREAS_COLLECTION), orderBy('name')))
  return snapshot.docs.map((d) => d.data() as Area)
}

export async function createArea(input: AreaInput, actor: Actor): Promise<Area> {
  if (!db) throw new Error('Firebase is not configured.')
  const timestamp = now()
  const id = doc(collection(db, AREAS_COLLECTION)).id
  const area: Area = {
    id,
    name: input.name.trim(),
    nameAr: input.nameAr?.trim() || undefined,
    section: input.section,
    mapPosition: input.mapPosition,
    active: input.active ?? true,
    createdAt: timestamp,
    updatedAt: timestamp,
    createdBy: actor.uid,
    updatedBy: actor.uid,
  }
  const audit = createAuditEntry({
    actorId: actor.uid,
    actorRole: actor.role,
    action: 'area.created',
    entityType: 'area',
    entityId: id,
    changes: { name: area.name, section: area.section },
  })
  const batch = writeBatch(db)
  batch.set(areaDocRef(id), area)
  batch.set(audit.ref, audit.log)
  await batch.commit()
  return area
}

export async function updateArea(id: string, input: AreaInput, actor: Actor): Promise<void> {
  if (!db) throw new Error('Firebase is not configured.')
  const timestamp = now()
  const fields = {
    name: input.name.trim(),
    nameAr: input.nameAr?.trim() || null,
    section: input.section,
    mapPosition: input.mapPosition,
    updatedAt: timestamp,
    updatedBy: actor.uid,
  }
  const audit = createAuditEntry({
    actorId: actor.uid,
    actorRole: actor.role,
    action: 'area.updated',
    entityType: 'area',
    entityId: id,
    changes: { name: fields.name, section: fields.section, mapPosition: fields.mapPosition },
  })
  const batch = writeBatch(db)
  batch.update(areaDocRef(id), fields)
  batch.set(audit.ref, audit.log)
  await batch.commit()
}

export async function setAreaActive(
  id: string,
  active: boolean,
  actor: Actor,
): Promise<void> {
  if (!db) throw new Error('Firebase is not configured.')
  const timestamp = now()
  const audit = createAuditEntry({
    actorId: actor.uid,
    actorRole: actor.role,
    action: active ? 'area.activated' : 'area.deactivated',
    entityType: 'area',
    entityId: id,
    changes: { active },
  })
  const batch = writeBatch(db)
  batch.update(areaDocRef(id), { active, updatedAt: timestamp, updatedBy: actor.uid })
  batch.set(audit.ref, audit.log)
  await batch.commit()
}

/**
 * Update ONLY the map position of an Area (Phase 6 map-position editor).
 * The position is clamped to normalized 0..1 before being persisted. Only
 * administrative users may do this (enforced by the Firestore rules).
 */
export async function updateAreaMapPosition(
  id: string,
  mapPosition: MapPoint,
  actor: Actor,
): Promise<void> {
  if (!db) throw new Error('Firebase is not configured.')
  const timestamp = now()
  const position = clampMapPoint(mapPosition)
  const audit = createAuditEntry({
    actorId: actor.uid,
    actorRole: actor.role,
    action: 'area.map_position_updated',
    entityType: 'area',
    entityId: id,
    changes: { mapPosition: position },
  })
  const batch = writeBatch(db)
  batch.update(areaDocRef(id), { mapPosition: position, updatedAt: timestamp, updatedBy: actor.uid })
  batch.set(audit.ref, audit.log)
  await batch.commit()
}