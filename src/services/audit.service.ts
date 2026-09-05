import { collection, doc, type DocumentReference } from 'firebase/firestore'

import { db } from '@/config/firebase'
import { now } from '@/lib/utils'
import type { AuditAction, AuditEntityType, AuditLog } from '@/types/audit'
import type { Role } from '@/types/roles'

const AUDIT_COLLECTION = 'auditLogs'

export interface AuditEntryInput {
  actorId: string
  actorRole?: Role
  action: AuditAction
  entityType: AuditEntityType
  entityId?: string
  changes?: Record<string, unknown>
  metadata?: Record<string, unknown>
}

/**
 * Prepare an audit entry with an auto-generated id. The returned ref + log
 * can be committed atomically together with the entity write via a batch.
 */
export function createAuditEntry(
  input: AuditEntryInput,
): { ref: DocumentReference; log: AuditLog } {
  if (!db) throw new Error('Firebase is not configured.')
  const ref = doc(collection(db, AUDIT_COLLECTION))
  const log: AuditLog = {
    id: ref.id,
    actorId: input.actorId,
    actorRole: input.actorRole,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    createdAt: now(),
    ...(input.changes !== undefined ? { changes: input.changes } : {}),
    ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
  }
  return { ref, log }
}