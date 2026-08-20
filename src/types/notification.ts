/**
 * In-app notification model (Phase 5).
 *
 * Notifications are created CLIENT-SIDE by the centralized notification
 * service immediately AFTER the business event commits (no server backend
 * exists yet), so the Firestore security rules validate every creation
 * strictly: the actor must be the event's author and the recipient must be a
 * real relationship (active Area Authority, Company Representative of the
 * responsible company, or an HSE reviewer). Message text is never stored —
 * only i18n keys are stored and resolved per recipient locale.
 *
 * Deduplication: the document id equals the `dedupeKey`. One-shot events use
 * `TYPE:observationId:recipientUserId`; reoccurring events append a cycle
 * token (`...:c<timestamp>`) so each submit/return cycle creates a fresh
 * document. Re-writing the same id routes through the `update` rule, which
 * the non-recipient actor can never satisfy, so the batch is rejected and
 * treated as an already-existing notification (idempotent).
 *
 * Best-effort: notification creation failures are swallowed and never
 * corrupt the business transaction. Emails for the main workflow are
 * documented in the architecture (interface only) — no email backend exists.
 */
export const NOTIFICATION_TYPES = [
  'OBSERVATION_CREATED',
  'CORRECTIVE_ACTION_REQUIRED',
  'CORRECTIVE_ACTION_SUBMITTED',
  'CORRECTIVE_ACTION_RETURNED',
  'CORRECTIVE_ACTION_ACCEPTED',
  'OBSERVATION_CLOSED',
] as const

export type NotificationType = (typeof NOTIFICATION_TYPES)[number]

/** Entity the notification points at (corrective actions share the observation id). */
export type NotificationEntityType = 'observation' | 'corrective_action'

export interface AppNotification {
  /** Document id == dedupeKey. */
  id: string
  /** The user this notification is addressed to (rules enforce ownership). */
  recipientUserId: string
  type: NotificationType
  /** i18n key pattern: `notifications.<lower(type)>.title` / `.message`. */
  titleKey: string
  messageKey: string
  messageParams?: Record<string, string | number>
  entityType: NotificationEntityType
  /** == observationId for both observation and corrective-action notifications. */
  entityId: string
  observationId: string
  /** Present only for corrective-action notifications. */
  correctiveActionId?: string
  companyId?: string
  areaId?: string
  read: boolean
  readAt?: number
  /** Idempotency key; == document id. */
  dedupeKey: string
  createdAt: number
}