import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  approveUser,
  listUsers,
  rejectUser,
  setUserActive,
  setUserCompany,
  setUserRole,
} from '@/services/user.service'
import {
  createCompany,
  listCompanies,
  setCompanyActive,
  updateCompany,
} from '@/services/company.service'
import { createArea, listAreas, setAreaActive, updateArea, updateAreaMapPosition } from '@/services/area.service'
import {
  createRotation,
  listRotations,
  setRotationActive,
  updateRotation,
} from '@/services/rotation.service'
import {
  createAssignment,
  listAssignments,
  setAssignmentActive,
  updateAssignment,
} from '@/services/assignment.service'
import { useAuthStore } from '@/stores/auth.store'
import type { AreaInput } from '@/types/area'
import type { CompanyInput } from '@/types/company'
import type { AreaAuthorityAssignmentInput } from '@/types/areaAuthorityAssignment'
import type { MapPoint } from '@/types/map'
import type { Role } from '@/types/roles'
import type { RotationInput } from '@/types/rotation'

export const adminKeys = {
  users: ['admin', 'users'] as const,
  companies: ['admin', 'companies'] as const,
  areas: ['admin', 'areas'] as const,
  rotations: ['admin', 'rotations'] as const,
  assignments: ['admin', 'assignments'] as const,
}

function useActor(): { uid: string; role?: Role } {
  const authUser = useAuthStore((s) => s.authUser)
  const profile = useAuthStore((s) => s.profile)
  return { uid: authUser?.uid ?? '', role: profile?.role }
}

// ---------- queries --------------------------------------------------------

export function useUsers(enabled = true) {
  return useQuery({ queryKey: adminKeys.users, queryFn: listUsers, enabled })
}

export function useCompanies() {
  return useQuery({ queryKey: adminKeys.companies, queryFn: listCompanies })
}

export function useAreas() {
  return useQuery({ queryKey: adminKeys.areas, queryFn: listAreas })
}

export function useRotations() {
  return useQuery({ queryKey: adminKeys.rotations, queryFn: listRotations })
}

export function useAssignments() {
  return useQuery({ queryKey: adminKeys.assignments, queryFn: listAssignments })
}

// ---------- user mutations ------------------------------------------------

export function useApproveUser() {
  const qc = useQueryClient()
  const actor = useActor()
  return useMutation({
    mutationFn: ({
      uid,
      role,
      companyId,
    }: {
      uid: string
      role: Role
      companyId?: string
    }) => approveUser(uid, role, actor, companyId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: adminKeys.users })
    },
  })
}

export function useRejectUser() {
  const qc = useQueryClient()
  const actor = useActor()
  return useMutation({
    mutationFn: ({ uid, reason }: { uid: string; reason: string }) => rejectUser(uid, reason, actor),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: adminKeys.users })
    },
  })
}

export function useSetUserRole() {
  const qc = useQueryClient()
  const actor = useActor()
  return useMutation({
    mutationFn: ({ uid, role }: { uid: string; role: Role }) => setUserRole(uid, role, actor),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: adminKeys.users })
    },
  })
}

export function useSetUserActive() {
  const qc = useQueryClient()
  const actor = useActor()
  return useMutation({
    mutationFn: ({ uid, active }: { uid: string; active: boolean }) =>
      setUserActive(uid, active, actor),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: adminKeys.users })
    },
  })
}

export function useSetUserCompany() {
  const qc = useQueryClient()
  const actor = useActor()
  return useMutation({
    mutationFn: ({ uid, companyId }: { uid: string; companyId: string | null }) =>
      setUserCompany(uid, companyId, actor),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: adminKeys.users })
    },
  })
}

// ---------- company mutations ---------------------------------------------

export function useCreateCompany() {
  const qc = useQueryClient()
  const actor = useActor()
  return useMutation({
    mutationFn: (input: CompanyInput) => createCompany(input, actor),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: adminKeys.companies })
    },
  })
}

export function useUpdateCompany() {
  const qc = useQueryClient()
  const actor = useActor()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: CompanyInput }) =>
      updateCompany(id, input, actor),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: adminKeys.companies })
    },
  })
}

export function useSetCompanyActive() {
  const qc = useQueryClient()
  const actor = useActor()
  return useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      setCompanyActive(id, active, actor),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: adminKeys.companies })
    },
  })
}

// ---------- area mutations ------------------------------------------------

export function useCreateArea() {
  const qc = useQueryClient()
  const actor = useActor()
  return useMutation({
    mutationFn: (input: AreaInput) => createArea(input, actor),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: adminKeys.areas })
    },
  })
}

export function useUpdateArea() {
  const qc = useQueryClient()
  const actor = useActor()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: AreaInput }) =>
      updateArea(id, input, actor),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: adminKeys.areas })
    },
  })
}

export function useSetAreaActive() {
  const qc = useQueryClient()
  const actor = useActor()
  return useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      setAreaActive(id, active, actor),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: adminKeys.areas })
    },
  })
}

export function useUpdateAreaMapPosition() {
  const qc = useQueryClient()
  const actor = useActor()
  return useMutation({
    mutationFn: ({ id, mapPosition }: { id: string; mapPosition: MapPoint }) =>
      updateAreaMapPosition(id, mapPosition, actor),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: adminKeys.areas })
    },
  })
}

// ---------- rotation mutations --------------------------------------------

export function useCreateRotation() {
  const qc = useQueryClient()
  const actor = useActor()
  return useMutation({
    mutationFn: (input: RotationInput) => createRotation(input, actor),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: adminKeys.rotations })
    },
  })
}

export function useUpdateRotation() {
  const qc = useQueryClient()
  const actor = useActor()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: RotationInput }) =>
      updateRotation(id, input, actor),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: adminKeys.rotations })
    },
  })
}

export function useSetRotationActive() {
  const qc = useQueryClient()
  const actor = useActor()
  return useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      setRotationActive(id, active, actor),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: adminKeys.rotations })
    },
  })
}

// ---------- assignment mutations ------------------------------------------

export function useCreateAssignment() {
  const qc = useQueryClient()
  const actor = useActor()
  return useMutation({
    mutationFn: (input: AreaAuthorityAssignmentInput) => createAssignment(input, actor),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: adminKeys.assignments })
    },
  })
}

export function useUpdateAssignment() {
  const qc = useQueryClient()
  const actor = useActor()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: AreaAuthorityAssignmentInput }) =>
      updateAssignment(id, input, actor),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: adminKeys.assignments })
    },
  })
}

export function useSetAssignmentActive() {
  const qc = useQueryClient()
  const actor = useActor()
  return useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      setAssignmentActive(id, active, actor),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: adminKeys.assignments })
    },
  })
}