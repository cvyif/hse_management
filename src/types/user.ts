import type { Role } from '@/types/roles'

/**
 * Registration & account lifecycle. New accounts start as PENDING and are
 * reviewed by a Super Admin before access is granted. Accounts can later be
 * deactivated (active = false) without deleting history.
 */
export const USER_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const

export type UserStatus = (typeof USER_STATUSES)[number]

/**
 * User profile stored in Firestore at `users/{uid}`.
 *
 * The profile is created during registration with status PENDING, an active
 * flag, and NO role. A Super Admin later approves or rejects it, assigns the
 * role, and optionally the company.
 */
export interface UserProfile {
  uid: string
  email: string
  displayName: string
  phone?: string
  /** Requested during registration; assigned by Super Admin on approval. */
  requestedRole?: Role
  /** Assigned on approval; absent while PENDING. */
  role?: Role
  /** Required for COMPANY_REP. */
  companyId?: string
  /** Areas assigned to an AREA_AUTHORITY (drives rotation notifications). */
  assignedAreaIds: string[]
  status: UserStatus
  /** False disables an approved account (deactivation, audit-safe). */
  active: boolean
  language: 'en' | 'ar'
  rejectedReason?: string
  approvedBy?: string
  approvedAt?: number
  rejectedBy?: string
  rejectedAt?: number
  createdAt: number
  updatedAt: number
}

/** Data required when registering a new account. */
export interface RegistrationData {
  displayName: string
  email: string
  password: string
  phone?: string
  companyId?: string
  requestedRole: Role
  language?: 'en' | 'ar'
}