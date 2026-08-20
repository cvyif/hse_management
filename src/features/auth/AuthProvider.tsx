import { useEffect, type ReactNode } from 'react'

import { isFirebaseConfigured } from '@/config/env'
import { enablePersistentAuth, watchAuthState } from '@/services/auth.service'
import { getUserProfile } from '@/services/user.service'
import { useAuthStore } from '@/stores/auth.store'

/**
 * Keeps the auth store in sync with Firebase Auth and the Firestore user
 * profile. Persistent login is handled by Firebase local persistence.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const setAuthUser = useAuthStore((s) => s.setAuthUser)
  const setProfile = useAuthStore((s) => s.setProfile)
  const setStatus = useAuthStore((s) => s.setStatus)
  const setError = useAuthStore((s) => s.setError)

  useEffect(() => {
    let active = true

    if (!isFirebaseConfigured()) {
      setAuthUser(null)
      setProfile(null)
      setStatus('signedOut')
      setError('not-configured')
      return
    }

    async function bootstrap() {
      await enablePersistentAuth()
      const unsubscribe = watchAuthState(async (user) => {
        if (!active) return
        setAuthUser(user)
        setError(null)
        if (user) {
          try {
            const profile = await getUserProfile(user.uid)
            if (!active) return
            setProfile(profile)
          } catch {
            if (!active) return
            setProfile(null)
          }
          setStatus('signedIn')
        } else {
          setProfile(null)
          setStatus('signedOut')
        }
      })
      return unsubscribe
    }

    let unsubscribe: (() => void) | undefined
    void bootstrap().then((fn) => {
      unsubscribe = fn
    })

    return () => {
      active = false
      unsubscribe?.()
    }
  }, [setAuthUser, setProfile, setStatus, setError])

  return children
}