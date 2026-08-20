import { create } from 'zustand'
import type { User } from 'firebase/auth'

import type { UserProfile } from '@/types/user'

export type AuthStatus = 'initializing' | 'signedIn' | 'signedOut'

interface AuthState {
  /** Firebase Auth user (exists even when the profile is not approved). */
  authUser: User | null
  /** Firestore profile; null until loaded. */
  profile: UserProfile | null
  status: AuthStatus
  error: string | null
  busy: boolean
  setAuthUser: (user: User | null) => void
  setProfile: (profile: UserProfile | null) => void
  setStatus: (status: AuthStatus) => void
  setError: (error: string | null) => void
  setBusy: (busy: boolean) => void
  reset: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  authUser: null,
  profile: null,
  status: 'initializing',
  error: null,
  busy: false,
  setAuthUser: (authUser) => set({ authUser }),
  setProfile: (profile) => set({ profile }),
  setStatus: (status) => set({ status }),
  setError: (error) => set({ error }),
  setBusy: (busy) => set({ busy }),
  reset: () =>
    set({
      authUser: null,
      profile: null,
      status: 'signedOut',
      error: null,
      busy: false,
    }),
}))