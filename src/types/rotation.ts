/**
 * Rotation / shift definition (e.g. "Rotation A", "Night shift"). Rotations
 * are referenced by Area Authority assignments. Historical rotations are
 * kept (never deleted) because they are needed to determine who was
 * responsible for an Observation at a given time.
 */
export interface Rotation {
  id: string
  label: string
  labelAr?: string
  active: boolean
  createdAt: number
  updatedAt: number
  createdBy?: string
  updatedBy?: string
}

/** Payload for creating or updating a rotation. */
export interface RotationInput {
  label: string
  labelAr?: string
  active?: boolean
}