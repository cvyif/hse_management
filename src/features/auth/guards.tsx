import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'

import { Spinner } from '@/components/ui/Button'
import { hasPermission, type Permission } from '@/lib/permissions'
import { useAuthStore } from '@/stores/auth.store'

/** Full-screen loading used while the auth session is being restored. */
function FullScreenLoader() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-50">
      <Spinner size="lg" className="text-sky-600" />
    </div>
  )
}

/** Requires an authenticated session. Redirects to /login otherwise. */
export function AuthGuard({ children }: { children: ReactNode }) {
  const status = useAuthStore((s) => s.status)

  if (status === 'initializing') return <FullScreenLoader />
  if (status === 'signedOut') return <Navigate to="/login" replace />
  return children
}

/** Requires NO authenticated session (login/register pages). */
export function GuestGuard({ children }: { children: ReactNode }) {
  const status = useAuthStore((s) => s.status)

  if (status === 'initializing') return <FullScreenLoader />
  if (status === 'signedIn') return <Navigate to="/dashboard" replace />
  return children
}

/**
 * Requires an APPROVED profile. PENDING users see the pending screen;
 * REJECTED or deactivated users see the rejected/deactivated screen.
 */
export function ApprovedGuard({ children }: { children: ReactNode }) {
  const status = useAuthStore((s) => s.status)
  const profile = useAuthStore((s) => s.profile)

  if (status === 'initializing') return <FullScreenLoader />
  if (status === 'signedOut') return <Navigate to="/login" replace />
  if (!profile) return <Navigate to="/rejected" replace />
  if (profile.status === 'PENDING') return <Navigate to="/register-pending" replace />
  if (profile.status === 'REJECTED' || profile.active === false) {
    return <Navigate to="/rejected" replace />
  }
  return children
}

/**
 * Requires a specific permission. Users without it are sent to /403.
 * Combine with ApprovedGuard (or AuthGuard) for full protection.
 */
export function RequirePermission({
  permission,
  children,
}: {
  permission: Permission
  children: ReactNode
}) {
  const profile = useAuthStore((s) => s.profile)

  if (!profile || !hasPermission(profile.role, permission)) {
    return <Navigate to="/403" replace />
  }
  return children
}