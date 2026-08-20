import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useAuthStore } from '@/stores/auth.store'
import {
  createDraft,
  getObservation,
  listObservations,
  submitObservation,
  updateDraft,
  type ObservationActor,
  type PendingEvidenceFile,
} from '@/services/observation.service'
import { listObservationTypes } from '@/services/observationType.service'
import type { Observation, ObservationInput } from '@/types/observation'

export const observationKeys = {
  types: ['observations', 'types'] as const,
  list: ['observations', 'list'] as const,
  detail: (id: string) => ['observations', 'detail', id] as const,
}

function useObservationActor(): ObservationActor | null {
  const authUser = useAuthStore((s) => s.authUser)
  const profile = useAuthStore((s) => s.profile)
  if (!authUser || !profile?.role) return null
  return {
    uid: authUser.uid,
    role: profile.role,
    displayName: profile.displayName,
    companyId: profile.companyId,
  }
}

function noActor(): Promise<never> {
  return Promise.reject(new Error('Authenticated user has no role.'))
}

// ---------- queries --------------------------------------------------------

export function useObservationTypes() {
  return useQuery({ queryKey: observationKeys.types, queryFn: listObservationTypes })
}

export function useObservationList() {
  const profile = useAuthStore((s) => s.profile)
  const companyId = profile?.role === 'COMPANY_REP' ? profile.companyId : undefined
  const areaIds =
    profile?.role === 'AREA_AUTHORITY'
      ? profile.assignedAreaIds.length > 0
        ? profile.assignedAreaIds
        : ['__no_areas__']
      : undefined
  return useQuery({
    queryKey: [
      ...observationKeys.list,
      companyId ?? 'all',
      areaIds ? areaIds.join('|') : 'all',
    ],
    queryFn: () =>
      listObservations({
        ...(companyId ? { companyId } : {}),
        ...(areaIds ? { areaIds } : {}),
      }),
  })
}

export function useObservation(id: string | undefined) {
  return useQuery({
    queryKey: observationKeys.detail(id ?? ''),
    queryFn: () => getObservation(id as string),
    enabled: Boolean(id),
  })
}

// ---------- mutations ------------------------------------------------------

export function useCreateDraft() {
  const qc = useQueryClient()
  const actor = useObservationActor()
  return useMutation({
    mutationFn: (input: Partial<ObservationInput>): Promise<Observation> =>
      actor ? createDraft(input, actor) : noActor(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: observationKeys.list })
    },
  })
}

export function useUpdateDraft() {
  const qc = useQueryClient()
  const actor = useObservationActor()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<ObservationInput> }) =>
      actor ? updateDraft(id, input, actor) : noActor(),
    onSuccess: (_data, { id }) => {
      void qc.invalidateQueries({ queryKey: observationKeys.list })
      void qc.invalidateQueries({ queryKey: observationKeys.detail(id) })
    },
  })
}

export function useSubmitObservation() {
  const qc = useQueryClient()
  const actor = useObservationActor()
  return useMutation({
    mutationFn: ({
      id,
      input,
      files,
    }: {
      id: string
      input: ObservationInput
      files: readonly PendingEvidenceFile[]
    }) => (actor ? submitObservation(id, input, files, actor) : noActor()),
    onSuccess: (observation) => {
      void qc.invalidateQueries({ queryKey: observationKeys.list })
      void qc.invalidateQueries({ queryKey: observationKeys.detail(observation.id) })
    },
  })
}