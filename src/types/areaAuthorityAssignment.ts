/**
 * Area Authority assignment: links an Area Authority user to an Area for a
 * specific rotation/period. An area can have multiple simultaneous
 * assignments (rotation/shift based). Assignments are deactivated, never
 * deleted, so historical responsibility can be reconstructed.
 */
export interface AreaAuthorityAssignment {
  id: string
  areaId: string
  userId: string
  rotationId: string
  /** Optional shift window. When both are empty the assignment is open-ended. */
  startsAt?: number
  endsAt?: number
  active: boolean
  createdAt: number
  updatedAt: number
  createdBy?: string
  updatedBy?: string
}

/** Payload for creating or updating an assignment. */
export interface AreaAuthorityAssignmentInput {
  areaId: string
  userId: string
  rotationId: string
  startsAt?: number
  endsAt?: number
  active?: boolean
}