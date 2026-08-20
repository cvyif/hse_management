import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useAuthStore } from '@/stores/auth.store'
import {
  beginVerification,
  getCorrectiveAction,
  requestCorrectiveAction,
  submitCorrectiveAction,
  verifyCorrectiveAction,
  type ActionVerdict,
} from '@/services/correctiveAction.service'
import type { ObservationActor, PendingEvidenceFile } from '@/services/observation.service'
import type { CorrectiveAction, CorrectiveActionInput } from '@/types/correctiveAction'

export const correctiveActionKeys = {
  detail: (observationId: string) => ['correctiveActions', 'detail', observationId] as const,
}

function useCorrectiveActionActor(): ObservationActor | null {
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

export function useCorrectiveAction(observationId: string | undefined) {
  return useQuery({
    queryKey: correctiveActionKeys.detail(observationId ?? ''),
    queryFn: () => getCorrectiveAction(observationId as string),
    enabled: Boolean(observationId),
  })
}

// ---------- mutations ------------------------------------------------------

export function useRequestCorrectiveAction(observationId: string) {
  const qc = useQueryClient()
  const actor = useCorrectiveActionActor()
  return useMutation({
    mutationFn: (): Promise<CorrectiveAction> =>
      actor ? requestCorrectiveAction(observationId, actor) : noActor(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: correctiveActionKeys.detail(observationId) })
      void qc.invalidateQueries({ queryKey: ['observations', 'detail', observationId] })
      void qc.invalidateQueries({ queryKey: ['observations', 'list'] })
    },
  })
}

export function useSubmitCorrectiveAction(observationId: string) {
  const qc = useQueryClient()
  const actor = useCorrectiveActionActor()
  return useMutation({
    mutationFn: ({
      input,
      files,
    }: {
      input: CorrectiveActionInput
      files: readonly PendingEvidenceFile[]
    }): Promise<CorrectiveAction> =>
      actor ? submitCorrectiveAction(observationId, input, files, actor) : noActor(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: correctiveActionKeys.detail(observationId) })
      void qc.invalidateQueries({ queryKey: ['observations', 'detail', observationId] })
      void qc.invalidateQueries({ queryKey: ['observations', 'list'] })
    },
  })
}

export function useBeginVerification(observationId: string) {
  const qc = useQueryClient()
  const actor = useCorrectiveActionActor()
  return useMutation({
    mutationFn: (): Promise<CorrectiveAction> =>
      actor ? beginVerification(observationId, actor) : noActor(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: correctiveActionKeys.detail(observationId) })
      void qc.invalidateQueries({ queryKey: ['observations', 'detail', observationId] })
      void qc.invalidateQueries({ queryKey: ['observations', 'list'] })
    },
  })
}

export function useVerifyCorrectiveAction(observationId: string) {
  const qc = useQueryClient()
  const actor = useCorrectiveActionActor()
  return useMutation({
    mutationFn: ({
      verdict,
      returnReason,
    }: {
      verdict: ActionVerdict
      returnReason?: string
    }): Promise<CorrectiveAction> =>
      actor ? verifyCorrectiveAction(observationId, verdict, returnReason, actor) : noActor(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: correctiveActionKeys.detail(observationId) })
      void qc.invalidateQueries({ queryKey: ['observations', 'detail', observationId] })
      void qc.invalidateQueries({ queryKey: ['observations', 'list'] })
    },
  })
}