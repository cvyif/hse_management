import type { Role } from '@/types/roles'

/**
 * Append-only Audit Trail entry recording important actions and status
 * changes. Created by Super Admin/HSE client actions in Phase 2; later phases
 * move critical writes server-side (Cloud Functions / Admin SDK) to guarantee
 * integrity.
 */
export const AUDIT_ENTITY_TYPES = [
  'observation',
  'corrective_action',
  'user',
  'company',
  'area',
  'rotation',
  'area_authority_assignment',
] as const

export type AuditEntityType = (typeof AUDIT_ENTITY_TYPES)[number]

/** Canonical administrative actions recorded by the audit trail. */
export const AUDIT_ACTIONS = [
  'user.registered',
  'user.approved',
  'user.rejected',
  'user.role_changed',
  'user.activated',
  'user.deactivated',
  'user.company_changed',
  'company.created',
  'company.updated',
  'company.activated',
  'company.deactivated',
  'area.created',
  'area.updated',
  'area.activated',
  'area.deactivated',
  'area.map_position_updated',
  'rotation.created',
  'rotation.updated',
  'rotation.activated',
  'rotation.deactivated',
  'area_authority_assignment.created',
  'area_authority_assignment.updated',
  'area_authority_assignment.activated',
  'area_authority_assignment.deactivated',
  'observation.created',
  'observation.updated',
  'observation.submitted',
  'observation.action_requested',
  'observation.action_submitted',
  'observation.verification_started',
  'observation.returned',
  'observation.closed',
  'corrective_action.created',
  'corrective_action.updated',
  'corrective_action.submitted',
  'corrective_action.under_review',
  'corrective_action.returned',
  'corrective_action.verified',
] as const

export type AuditAction = (typeof AUDIT_ACTIONS)[number]

export interface AuditLog {
  id: string
  actorId: string
  actorRole?: Role
  action: AuditAction
  entityType: AuditEntityType
  entityId?: string
  changes?: Record<string, unknown>
  metadata?: Record<string, unknown>
  createdAt: number
}