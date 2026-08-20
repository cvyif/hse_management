import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'

import { db } from '@/config/firebase'
import { now } from '@/lib/utils'
import { createAuditEntry } from '@/services/audit.service'
import type { RegistrationData, UserProfile } from '@/types/user'
import type { Role } from '@/types/roles'

const USERS_COLLECTION = 'users'

/** Profile data sent to Firestore. The password is never persisted. */
export type PendingProfileData = Omit<RegistrationData, 'password'>

/** Roles that may be assigned through the client (never SUPER_ADMIN). */
export const ASSIGNABLE_ROLES: readonly Role[] = [
  'HSE_MANAGER',
  'HSE_OFFICER',
  'PA',
  'AREA_AUTHORITY',
  'COMPANY_REP',
]

function userDocRef(uid: string) {
  if (!db) throw new Error('Firebase is not configured.')
  return doc(db, USERS_COLLECTION, uid)
}

/**
 * Create the PENDING user profile written during self-registration.
 * The profile is created by the server rules only when the request is
 * self-registration (see `isPendingSelfRegistration` in firestore.rules).
 */
export async function createPendingProfile(
  uid: string,
  data: PendingProfileData,
): Promise<UserProfile> {
  const timestamp = now()
  const profile: UserProfile = {
    uid,
    email: data.email.trim().toLowerCase(),
    displayName: data.displayName.trim(),
    phone: data.phone?.trim() || undefined,
    companyId: data.companyId || undefined,
    requestedRole: data.requestedRole,
    assignedAreaIds: [],
    status: 'PENDING',
    active: true,
    language: data.language ?? 'en',
    createdAt: timestamp,
    updatedAt: timestamp,
  }
  await setDoc(userDocRef(uid), profile)
  return profile
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snapshot = await getDoc(userDocRef(uid))
  return snapshot.exists() ? (snapshot.data() as UserProfile) : null
}

/** Update only the given fields of a user profile (self-service fields). */
export async function updateUserProfile(
  uid: string,
  fields: Partial<UserProfile>,
): Promise<void> {
  await updateDoc(userDocRef(uid), { ...fields, updatedAt: now() })
}

/** All user profiles, newest first (admin only). */
export async function listUsers(): Promise<UserProfile[]> {
  if (!db) throw new Error('Firebase is not configured.')
  const snapshot = await getDocs(query(collection(db, USERS_COLLECTION), orderBy('createdAt', 'desc')))
  return snapshot.docs.map((d) => d.data() as UserProfile)
}

/**
 * Roles that receive corrective-action workflow notifications (HSE reviewers
 * with `action:verify`). Readable even by Company Representatives via the
 * narrowly relaxed users read rule, so reps can resolve reviewers when
 * creating the SUBMITTED notification (documented Phase 5 trade-off).
 */
export const REVIEWER_ROLES: readonly Role[] = ['HSE_MANAGER', 'HSE_OFFICER', 'SUPER_ADMIN']

/** Approved HSE reviewers (HSE Manager/HSE Officer/Super Admin), newest first. */
export async function listReviewerUsers(): Promise<UserProfile[]> {
  if (!db) throw new Error('Firebase is not configured.')
  const snapshot = await getDocs(
    query(
      collection(db, USERS_COLLECTION),
      where('role', 'in', REVIEWER_ROLES),
      orderBy('createdAt', 'desc'),
    ),
  )
  return snapshot.docs.map((d) => d.data() as UserProfile)
}

/** Approve a pending registration and assign the requested/selected role. */
export async function approveUser(
  uid: string,
  role: Role,
  actor: { uid: string; role?: Role },
  companyId?: string,
): Promise<void> {
  if (!db) throw new Error('Firebase is not configured.')
  if (role === 'SUPER_ADMIN') throw new Error('SUPER_ADMIN cannot be assigned through user management.')
  if (role === 'COMPANY_REP' && !companyId) {
    throw new Error('A company is required for COMPANY_REP.')
  }
  const timestamp = now()
  const profileRef = userDocRef(uid)
  const audit = createAuditEntry({
    actorId: actor.uid,
    actorRole: actor.role,
    action: 'user.approved',
    entityType: 'user',
    entityId: uid,
    changes: { role, status: 'APPROVED', companyId },
  })
  const batch = writeBatch(db)
  batch.update(profileRef, {
    status: 'APPROVED',
    role,
    companyId: companyId ?? null,
    active: true,
    approvedBy: actor.uid,
    approvedAt: timestamp,
    updatedAt: timestamp,
  })
  batch.set(audit.ref, audit.log)
  await batch.commit()
}

/** Reject a pending registration (kept for auditability, never deleted). */
export async function rejectUser(
  uid: string,
  reason: string,
  actor: { uid: string; role?: Role },
): Promise<void> {
  if (!db) throw new Error('Firebase is not configured.')
  const timestamp = now()
  const profileRef = userDocRef(uid)
  const audit = createAuditEntry({
    actorId: actor.uid,
    actorRole: actor.role,
    action: 'user.rejected',
    entityType: 'user',
    entityId: uid,
    changes: { status: 'REJECTED', reason },
  })
  const batch = writeBatch(db)
  batch.update(profileRef, {
    status: 'REJECTED',
    rejectedBy: actor.uid,
    rejectedAt: timestamp,
    rejectedReason: reason || '',
    updatedAt: timestamp,
  })
  batch.set(audit.ref, audit.log)
  await batch.commit()
}

/** Change a user's role (never SUPER_ADMIN; admin cannot act on self). */
export async function setUserRole(
  uid: string,
  role: Role,
  actor: { uid: string; role?: Role },
): Promise<void> {
  if (!db) throw new Error('Firebase is not configured.')
  if (uid === actor.uid) throw new Error('You cannot change your own role.')
  if (role === 'SUPER_ADMIN') throw new Error('SUPER_ADMIN cannot be assigned through user management.')
  const timestamp = now()
  const audit = createAuditEntry({
    actorId: actor.uid,
    actorRole: actor.role,
    action: 'user.role_changed',
    entityType: 'user',
    entityId: uid,
    changes: { role },
  })
  const batch = writeBatch(db)
  batch.update(userDocRef(uid), { role, updatedAt: timestamp })
  batch.set(audit.ref, audit.log)
  await batch.commit()
}

/** Activate/deactivate an approved account (audit-safe, no deletion). */
export async function setUserActive(
  uid: string,
  active: boolean,
  actor: { uid: string; role?: Role },
): Promise<void> {
  if (!db) throw new Error('Firebase is not configured.')
  if (uid === actor.uid) throw new Error('You cannot deactivate your own account.')
  const timestamp = now()
  const audit = createAuditEntry({
    actorId: actor.uid,
    actorRole: actor.role,
    action: active ? 'user.activated' : 'user.deactivated',
    entityType: 'user',
    entityId: uid,
    changes: { active },
  })
  const batch = writeBatch(db)
  batch.update(userDocRef(uid), { active, updatedAt: timestamp })
  batch.set(audit.ref, audit.log)
  await batch.commit()
}

/** Assign/change the company a user belongs to (Super Admin controlled). */
export async function setUserCompany(
  uid: string,
  companyId: string | null,
  actor: { uid: string; role?: Role },
): Promise<void> {
  if (!db) throw new Error('Firebase is not configured.')
  if (uid === actor.uid) throw new Error('You cannot change your own company.')
  const timestamp = now()
  const audit = createAuditEntry({
    actorId: actor.uid,
    actorRole: actor.role,
    action: 'user.company_changed',
    entityType: 'user',
    entityId: uid,
    changes: { companyId },
  })
  const batch = writeBatch(db)
  batch.update(userDocRef(uid), { companyId: companyId ?? null, updatedAt: timestamp })
  batch.set(audit.ref, audit.log)
  await batch.commit()
}