import type { MapPoint } from '@/types/map'

/** The station is divided into two sections: OIL and GAS. */
export const SECTIONS = ['OIL', 'GAS'] as const

export type Section = (typeof SECTIONS)[number]

/**
 * An operational area of the station. Area names/numbers match the
 * identifiers shown on the station map (e.g. "Area 175"). Each area belongs
 * to exactly one section and has a normalized position on the map.
 */
export interface Area {
  id: string
  /** Area number/identifier as shown on the station map. */
  name: string
  nameAr?: string
  section: Section
  mapPosition: MapPoint
  active: boolean
  createdAt: number
  updatedAt: number
  createdBy?: string
  updatedBy?: string
}

/** Payload for creating or updating an area. */
export interface AreaInput {
  name: string
  nameAr?: string
  section: Section
  mapPosition: MapPoint
  active?: boolean
}