/**
 * Company performing work at the station. Company Representatives are
 * restricted to their own company.
 */
export interface Company {
  id: string
  name: string
  /** Optional stable identifier/code used on the site. */
  code?: string
  nameAr?: string
  active: boolean
  createdAt: number
  updatedAt: number
  createdBy?: string
  updatedBy?: string
}

/** Payload for creating or updating a company. */
export interface CompanyInput {
  name: string
  code?: string
  nameAr?: string
  active?: boolean
}