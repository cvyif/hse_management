import {
  collection,
  deleteField,
  doc,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  updateDoc,
  where,
  writeBatch,
  type QueryConstraint,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'

import { db } from '@/config/firebase'
import { now } from '@/lib/utils'
import { currentAuthorities } from '@/lib/rotations'
import { listAssignmentsForArea } from '@/services/assignment.service'
import { listReviewerUsers, listUsers } from '@/services/user.service'
import type { AppNotification, NotificationType } from '@/types/notification'
import type { CorrectiveAction } from '@/types/correctiveAction'
import type { UserProfile } from '@/types/user'

const NOTIFICATIONS_COLLECTION = 'notifications'
const NOTIFICATION_PAGE_SIZE = 20
const MARK_ALL_PAGE_SIZE = 500

const HSE_RECIPIENT_ROLES = ['HSE_MANAGER', 'HSE_OFFICER'] as const

/** The minimal Observation fields a notification needs. */
export interface NotifyObservation {
  observationId: string
  /** Optional — an Observation may exist without a company. */
  companyId?: string
  areaId: string
}

/** A notification record before its timestamps/dedupe bookkeeping is applied. */
interface NotificationRecord {
  dedupeKey: string
  recipientUserId: string
  type: NotificationType
  titleKey: string
  messageKey: string
  messageParams?: Record<string, string | number>
  entityType: 'observation' | 'corrective_action'
  entityId: string
  observationId: string
  correctiveActionId?: string
  companyId?: string
  areaId?: string
}

function isActiveUser(user: UserProfile): boolean {
  return user.status === 'APPROVED' && user.active
}

function dedupeUids(users: readonly UserProfile[], excludeUid: string): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const user of users) {
    if (user.uid === excludeUid) continue
    if (seen.has(user.uid)) continue
    seen.add(user.uid)
    result.push(user.uid)
  }
  return result
}

/**
 * Build a notification record. The dedupe key doubles as the document id;
 * `cycleToken` (e.g. `:c<submittedAt>`) distinguishes reoccurring events so
 * each submit/return cycle creates a fresh document.
 */
function baseRecord(
  ctx: NotifyObservation,
  type: NotificationType,
  recipientUserId: string,
  cycleToken = '',
): NotificationRecord {
  const entityType = type.startsWith('OBSERVATION_')
    ? 'observation'
    : 'corrective_action'
  const dedupeKey = `${type}:${ctx.observationId}:${recipientUserId}${cycleToken}`
  return {
    dedupeKey,
    recipientUserId,
    type,
    titleKey: `notifications.${type.toLowerCase()}.title`,
    messageKey: `notifications.${type.toLowerCase()}.message`,
    messageParams: {
      observationId: ctx.observationId,
      companyId: ctx.companyId ?? '',
      areaId: ctx.areaId,
    },
    entityType,
    entityId: ctx.observationId,
    observationId: ctx.observationId,
    correctiveActionId: entityType === 'corrective_action' ? ctx.observationId : undefined,
    companyId: ctx.companyId,
    areaId: ctx.areaId,
  }
}

/** Atomic best-effort write. Re-writing an existing id is rejected (idempotent). */
async function writeNotifications(records: NotificationRecord[]): Promise<void> {
  if (!db) throw new Error('Firebase is not configured.')
  if (records.length === 0) return
  const timestamp = now()
  const batch = writeBatch(db)
  for (const record of records) {
    batch.set(doc(db, NOTIFICATIONS_COLLECTION, record.dedupeKey), {
      id: record.dedupeKey,
      ...record,
      read: false,
      createdAt: timestamp,
    })
  }
  await batch.commit()
}

/** Run a notification step; failures are swallowed (best-effort by design). */
async function bestEffort(run: () => Promise<void>): Promise<void> {
  try {
    await run()
  } catch {
    // Notifications must never break the business operation that triggered them.
  }
}

// ---------- event notification creators ------------------------------------

/**
 * HSE role recipients and currently-active Area Authorities for an area.
 * Used by OBSERVATION_CREATED and OBSERVATION_CLOSED.
 */
async function hseAndAuthorityRecipients(
  ctx: NotifyObservation,
  excludeUid: string,
): Promise<string[]> {
  const users = await listUsers()
  const active = users.filter(isActiveUser)
  const hse = active.filter((u) =>
    (HSE_RECIPIENT_ROLES as readonly string[]).includes(u.role ?? ''),
  )
  const assignments = await listAssignmentsForArea(ctx.areaId)
  const authorityIds = new Set(currentAuthorities(assignments).map((a) => a.userId))
  const authorities = active.filter(
    (u) => u.role === 'AREA_AUTHORITY' && authorityIds.has(u.uid),
  )
  return dedupeUids([...hse, ...authorities], excludeUid)
}

/** Company Representatives of the responsible company (excludes the actor). */
async function companyRepRecipients(
  ctx: NotifyObservation,
  excludeUid: string,
): Promise<string[]> {
  const users = await listUsers()
  const reps = users.filter(
    (u) =>
      isActiveUser(u) && u.role === 'COMPANY_REP' && u.companyId === ctx.companyId,
  )
  return dedupeUids(reps, excludeUid)
}

/** HSE reviewers (HSE Manager/HSE Officer/Super Admin), readable by reps too. */
async function reviewerRecipients(excludeUid: string): Promise<string[]> {
  const reviewers = await listReviewerUsers()
  const active = reviewers.filter(isActiveUser)
  return dedupeUids(active, excludeUid)
}

/** Observation OPEN -> notify the area authority + HSE staff. */
export function notifyObservationCreated(
  observation: NotifyObservation,
  actorUid: string,
): Promise<void> {
  return bestEffort(async () => {
    const recipientUids = await hseAndAuthorityRecipients(observation, actorUid)
    const records = recipientUids.map((uid) =>
      baseRecord(observation, 'OBSERVATION_CREATED', uid),
    )
    await writeNotifications(records)
  })
}

/** HSE requests an action -> notify the responsible company reps. */
export function notifyActionRequired(
  observation: NotifyObservation,
  actorUid: string,
): Promise<void> {
  return bestEffort(async () => {
    const recipientUids = await companyRepRecipients(observation, actorUid)
    const records = recipientUids.map((uid) =>
      baseRecord(observation, 'CORRECTIVE_ACTION_REQUIRED', uid),
    )
    await writeNotifications(records)
  })
}

/** Company submits the action -> notify the HSE reviewers. */
export function notifyActionSubmitted(
  observation: NotifyObservation,
  action: Pick<CorrectiveAction, 'submittedAt'>,
  actorUid: string,
): Promise<void> {
  return bestEffort(async () => {
    const recipientUids = await reviewerRecipients(actorUid)
    const cycle = action.submittedAt != null ? `:c${action.submittedAt}` : ''
    const records = recipientUids.map((uid) =>
      baseRecord(observation, 'CORRECTIVE_ACTION_SUBMITTED', uid, cycle),
    )
    await writeNotifications(records)
  })
}

/** HSE returns the action -> notify the responsible company reps. */
export function notifyActionReturned(
  observation: NotifyObservation,
  action: Pick<CorrectiveAction, 'returnedAt'>,
  actorUid: string,
): Promise<void> {
  return bestEffort(async () => {
    const recipientUids = await companyRepRecipients(observation, actorUid)
    const cycle = action.returnedAt != null ? `:c${action.returnedAt}` : ''
    const records = recipientUids.map((uid) =>
      baseRecord(observation, 'CORRECTIVE_ACTION_RETURNED', uid, cycle),
    )
    await writeNotifications(records)
  })
}

/** HSE accepts the action -> notify the responsible company reps. */
export function notifyActionAccepted(
  observation: NotifyObservation,
  action: Pick<CorrectiveAction, 'verifiedAt'>,
  actorUid: string,
): Promise<void> {
  return bestEffort(async () => {
    const recipientUids = await companyRepRecipients(observation, actorUid)
    const cycle = action.verifiedAt != null ? `:c${action.verifiedAt}` : ''
    const records = recipientUids.map((uid) =>
      baseRecord(observation, 'CORRECTIVE_ACTION_ACCEPTED', uid, cycle),
    )
    await writeNotifications(records)
  })
}

/** Observation CLOSED -> notify HSE staff + area authority (excludes verifier). */
export function notifyObservationClosed(
  observation: NotifyObservation,
  actorUid: string,
): Promise<void> {
  return bestEffort(async () => {
    const recipientUids = await hseAndAuthorityRecipients(observation, actorUid)
    const records = recipientUids.map((uid) =>
      baseRecord(observation, 'OBSERVATION_CLOSED', uid),
    )
    await writeNotifications(records)
  })
}

// ---------- reading & read-state management --------------------------------

export interface NotificationListResult {
  items: AppNotification[]
  nextCursor?: QueryDocumentSnapshot
}

/** Paginated notifications for the current user, newest first. */
export async function listNotifications(
  uid: string,
  options: { read?: boolean; pageSize?: number; startAfter?: QueryDocumentSnapshot } = {},
): Promise<NotificationListResult> {
  if (!db) throw new Error('Firebase is not configured.')
  const pageSize = options.pageSize ?? NOTIFICATION_PAGE_SIZE
  const constraints: QueryConstraint[] = [where('recipientUserId', '==', uid)]
  if (options.read !== undefined) constraints.push(where('read', '==', options.read))
  constraints.push(orderBy('createdAt', 'desc'), limit(pageSize))
  if (options.startAfter) constraints.push(startAfter(options.startAfter))
  const snapshot = await getDocs(query(collection(db, NOTIFICATIONS_COLLECTION), ...constraints))
  const items = snapshot.docs.map((d) => d.data() as AppNotification)
  const last = snapshot.docs[snapshot.docs.length - 1]
  return {
    items,
    nextCursor: snapshot.docs.length === pageSize ? last : undefined,
  }
}

/** Unread count without loading the history (server-side count). */
export async function getUnreadNotificationCount(uid: string): Promise<number> {
  if (!db) throw new Error('Firebase is not configured.')
  const snapshot = await getCountFromServer(
    query(
      collection(db, NOTIFICATIONS_COLLECTION),
      where('recipientUserId', '==', uid),
      where('read', '==', false),
    ),
  )
  return snapshot.data().count
}

/** Mark a single notification read (rules enforce recipient ownership). */
export async function markNotificationRead(id: string): Promise<void> {
  if (!db) throw new Error('Firebase is not configured.')
  await updateDoc(doc(db, NOTIFICATIONS_COLLECTION, id), { read: true, readAt: now() })
}

/** Mark a single notification unread (readAt is removed via deleteField). */
export async function markNotificationUnread(id: string): Promise<void> {
  if (!db) throw new Error('Firebase is not configured.')
  await updateDoc(doc(db, NOTIFICATIONS_COLLECTION, id), { read: false, readAt: deleteField() })
}

/** Mark every unread notification of the user as read (paginated batches). */
export async function markAllNotificationsRead(uid: string): Promise<void> {
  if (!db) throw new Error('Firebase is not configured.')
  const timestamp = now()
  let cursor: QueryDocumentSnapshot | undefined
  let hasMore = true
  while (hasMore) {
    const constraints: QueryConstraint[] = [
      where('recipientUserId', '==', uid),
      where('read', '==', false),
      limit(MARK_ALL_PAGE_SIZE),
    ]
    if (cursor) constraints.push(startAfter(cursor))
    const snapshot = await getDocs(query(collection(db, NOTIFICATIONS_COLLECTION), ...constraints))
    if (snapshot.docs.length === 0) break
    const batch = writeBatch(db)
    for (const item of snapshot.docs) batch.update(item.ref, { read: true, readAt: timestamp })
    await batch.commit()
    if (snapshot.docs.length < MARK_ALL_PAGE_SIZE) break
    cursor = snapshot.docs[snapshot.docs.length - 1]
  }
}