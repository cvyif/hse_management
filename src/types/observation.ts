import type { Section } from '@/types/area'
import type { Role } from '@/types/roles'
import type { MapPoint } from '@/types/map'

/**
 * Observation lifecycle.
 *
 * Phase 3 implements the creation lifecycle only:
 *
 *   DRAFT → OPEN
 *
 * DRAFT is the pre-submission state a reporter saves before the final
 * submit. OPEN is the first state of the final workflow, which remains
 * compatible with the planned corrective-action pipeline:
 *
 *   OPEN → ASSIGNED → ACTION REQUIRED → ACTION SUBMITTED
 *        → UNDER VERIFICATION → CLOSED
 *
 * An Observation is never marked CLOSED in Phase 3.
 */
export const OBSERVATION_STATUSES = [
  'DRAFT',
  'OPEN',
  'ASSIGNED',
  'ACTION_REQUIRED',
  'ACTION_SUBMITTED',
  'UNDER_VERIFICATION',
  'CLOSED',
] as const

export type ObservationStatus = (typeof OBSERVATION_STATUSES)[number]

export const RISK_LEVELS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const

export type RiskLevel = (typeof RISK_LEVELS)[number]

/**
 * Permit types recorded with an Observation. The application does NOT
 * implement a PTW system; this is permit information related only to the
 * Observation.
 */
export const PERMIT_TYPES = [
  'COLD',
  'SPARK',
  'HOT',
  'BREAKING_CONTAINMENT',
  'NOT_APPLICABLE',
] as const

export type PermitType = (typeof PERMIT_TYPES)[number]

/** Permit information linked to an Observation. */
export interface PermitInfo {
  type: PermitType
  /** Numeric, up to 10 digits. Only present when type != NOT_APPLICABLE. */
  number?: string
}

/** Binary storage providers for evidence files. */
export const EVIDENCE_PROVIDERS = ['supabase'] as const

export type EvidenceProvider = (typeof EVIDENCE_PROVIDERS)[number]

/**
 * Metadata for one evidence file. The binary lives on the external provider
 * (Supabase Storage); only metadata is stored in Firestore, which remains the
 * authorization source of truth for the owning Observation.
 */
export interface EvidenceItem {
  /** Unique file id (also part of the provider public id). */
  id: string
  /** Original file name as chosen by the reporter. */
  name: string
  /**
   * Legacy Firebase Storage path. Present only on pre-Supabase items;
   * new items use provider/publicId/url instead.
   */
  storagePath?: string
  contentType: string
  sizeBytes: number
  uploadedAt: number
  uploadedBy: string
  /** Binary host for this file. */
  provider: EvidenceProvider
  /** Provider public id, bound to <prefix>/<observationId>/<fileId>. */
  publicId: string
  /** Provider-delivered secure URL used by the gallery. */
  url: string
  /** Provider-reported format (e.g. jpg, pdf). */
  format: string
}

/** A single status change in an Observation timeline. */
export interface StatusChange {
  from?: ObservationStatus
  to: ObservationStatus
  at: number
  by: string
}

/** Limits enforced by the UI, the security rules and the service layer. */
export const MAX_EVIDENCE_FILES = 20
export const MAX_EVIDENCE_BYTES = 10 * 1024 * 1024
export const MAX_DESCRIPTION_LENGTH = 10_000
export const MAX_IMMEDIATE_ACTION_LENGTH = 5_000
export const PERMIT_NUMBER_MAX_DIGITS = 10

/**
 * An HSE Observation. The document id equals the human-readable
 * `observationId` (`OBS-YYYY-NNNNN`), which Firestore guarantees to be
 * unique; the counter document `counters/observationIds` provides a safe
 * sequence under concurrent creation.
 */
export interface Observation {
  id: string
  /** Human-readable sequential id, e.g. `OBS-2026-00001` (== document id). */
  observationId: string
  /** Optional owning company. Absent when no company is applicable. */
  companyId?: string
  areaId: string
  /** Derived from the Area — never supplied independently by the user. */
  section: Section
  permit: PermitInfo
  /** Reference to an active document in the `observationTypes` collection. */
  observationTypeId: string
  riskLevel: RiskLevel
  description: string
  immediateAction?: string
  evidence: EvidenceItem[]
  /** Reporter is captured automatically from the authenticated account. */
  reporterId: string
  reporterName: string
  reporterRole: Role
  reporterCompanyId?: string
  /** Optional custom position on the station map (normalized 0..1). */
  mapPosition?: MapPoint
  status: ObservationStatus
  /** Authority reference resolved by a later phase from the Area rotation. */
  areaAuthorityId?: string
  dueDate?: number
  timeline: StatusChange[]
  submittedAt?: number
  closedAt?: number
  closedBy?: string
  createdAt: number
  updatedAt: number
}

/** Editable fields of an Observation (everything except audit/history data). */
export interface ObservationInput {
  /** Optional owning company. Omit when no company is applicable. */
  companyId?: string
  areaId: string
  section: Section
  permit: PermitInfo
  observationTypeId: string
  riskLevel: RiskLevel
  description: string
  immediateAction?: string
  mapPosition?: MapPoint
}