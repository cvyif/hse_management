import { useQuery } from '@tanstack/react-query'

import {
  useAreas,
  useAssignments,
  useCompanies,
  useRotations,
  useUsers,
} from '@/features/admin/hooks'
import { useObservationTypes } from '@/features/observations/hooks'
import { listObservations } from '@/services/observation.service'
import { MAP_OBSERVATION_LIMIT } from '@/features/map/mapLogic'
import { useAuthStore } from '@/stores/auth.store'

export const mapKeys = {
  observations: ['map', 'observations'] as const,
}

/**
 * Data backing the Site Map. All reads reuse the existing scoped services:
 * the observation query mirrors the Observation list scoping (companyId for
 * COMPANY_REP, assignedAreaIds for AREA_AUTHORITY, all for HSE/Super Admin)
 * and is bounded to the newest `MAP_OBSERVATION_LIMIT` records.
 */
export function useSiteMapData() {
  const profile = useAuthStore((s) => s.profile)
  const companyId = profile?.role === 'COMPANY_REP' ? profile.companyId : undefined
  const areaIds =
    profile?.role === 'AREA_AUTHORITY'
      ? profile.assignedAreaIds.length > 0
        ? profile.assignedAreaIds
        : ['__no_areas__']
      : undefined

  const areas = useAreas()
  const companies = useCompanies()
  const types = useObservationTypes()
  const assignments = useAssignments()
  const rotations = useRotations()
  // Company Representatives are restricted by the users read rule to their
  // own company + HSE reviewers, so the unfiltered user list is not fetched
  // for them (area-authority names are hidden for reps).
  const canReadUsers = profile?.role !== 'COMPANY_REP'
  const users = useUsers(canReadUsers)

  const observations = useQuery({
    queryKey: [
      ...mapKeys.observations,
      companyId ?? 'all',
      areaIds ? areaIds.join('|') : 'all',
    ],
    queryFn: () =>
      listObservations(
        {
          ...(companyId ? { companyId } : {}),
          ...(areaIds ? { areaIds } : {}),
        },
        MAP_OBSERVATION_LIMIT,
      ),
    // New observations appear on the map within a minute without a reload.
    refetchInterval: 60_000,
  })

  return {
    profile,
    areas,
    companies,
    types,
    assignments,
    rotations,
    users,
    observations,
    canReadUsers,
  }
}

export type { MapSelection } from '@/features/map/mapLogic'