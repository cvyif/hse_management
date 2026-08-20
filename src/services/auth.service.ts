import {
  createUserWithEmailAndPassword,
  setPersistence,
  browserLocalPersistence,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth'

import { auth } from '@/config/firebase'

export class AuthError extends Error {
  readonly code: string
  constructor(code: string, message: string) {
    super(message)
    this.name = 'AuthError'
    this.code = code
  }
}

function mapError(error: unknown): AuthError {
  if (error instanceof AuthError) return error
  if (error instanceof Error && 'code' in error) {
    const code = String((error as { code: string }).code)
    return new AuthError(code, error.message)
  }
  return new AuthError('unknown', 'An unknown authentication error occurred.')
}

/**
 * Persistent login: Firebase keeps the session in local storage so approved
 * users do not need to sign in again when reopening the application.
 */
export async function enablePersistentAuth(): Promise<void> {
  if (!auth) return
  await setPersistence(auth, browserLocalPersistence)
}

export async function login(email: string, password: string): Promise<User> {
  if (!auth) throw new AuthError('not-configured', 'Firebase is not configured.')
  try {
    const credential = await signInWithEmailAndPassword(auth, email.trim(), password)
    return credential.user
  } catch (error) {
    throw mapError(error)
  }
}

export async function registerAccount(email: string, password: string): Promise<User> {
  if (!auth) throw new AuthError('not-configured', 'Firebase is not configured.')
  try {
    const credential = await createUserWithEmailAndPassword(auth, email.trim(), password)
    return credential.user
  } catch (error) {
    throw mapError(error)
  }
}

export async function logout(): Promise<void> {
  if (!auth) return
  try {
    await signOut(auth)
  } catch (error) {
    throw mapError(error)
  }
}

/**
 * Subscribe to authentication state changes. The callback receives the
 * signed-in user or null. Firebase re-hydrates the session from local
 * storage, which implements the persistent-login requirement.
 */
export function watchAuthState(onChange: (user: User | null) => void): () => void {
  if (!auth) {
    onChange(null)
    return () => {}
  }
  return onAuthStateChanged(auth, onChange)
}

/** Translate a Firebase auth error code into an i18n key. */
export function authErrorKey(code: string): string {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return 'errors.invalidCredentials'
    case 'auth/email-already-in-use':
      return 'errors.emailInUse'
    case 'auth/weak-password':
      return 'errors.weakPassword'
    case 'auth/invalid-email':
      return 'errors.invalidEmail'
    case 'auth/network-request-failed':
      return 'errors.network'
    case 'not-configured':
      return 'errors.notConfigured'
    default:
      return 'errors.generic'
  }
}