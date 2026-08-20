import { initializeApp, getApps, type FirebaseApp } from 'firebase/app'
import { getAuth, connectAuthEmulator } from 'firebase/auth'
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore'
import { getStorage, connectStorageEmulator } from 'firebase/storage'

import { emulatorEnv, firebaseEnv, isFirebaseConfigured, useEmulators } from '@/config/env'

/**
 * Firebase client. Initialized lazily so the application can still boot
 * (and show a configuration notice) when the `.env` file is not filled in.
 */
export const app: FirebaseApp | null = isFirebaseConfigured()
  ? getApps()[0] ?? initializeApp(firebaseEnv)
  : null

if (useEmulators && app) {
  const auth = getAuth(app)
  const firestore = getFirestore(app)
  const storage = getStorage(app)

  if (emulatorEnv.auth) connectAuthEmulator(auth, emulatorEnv.auth)
  if (emulatorEnv.firestore) {
    const { host, port } = parseEmulatorUrl(emulatorEnv.firestore)
    connectFirestoreEmulator(firestore, host, port)
  }
  if (emulatorEnv.storage) {
    const { host, port } = parseEmulatorUrl(emulatorEnv.storage)
    connectStorageEmulator(storage, host, port)
  }
}

/** Split an emulator URL (e.g. http://127.0.0.1:8080) into host and port. */
function parseEmulatorUrl(url: string): { host: string; port: number } {
  const parsed = new URL(url)
  const port = parsed.port ? Number(parsed.port) : parsed.protocol === 'https:' ? 443 : 80
  return { host: parsed.hostname, port }
}

/** Firestore database instance, or null when Firebase is not configured. */
export const db = app ? getFirestore(app) : null

/** Firebase Storage instance, or null when Firebase is not configured. */
export const storage = app ? getStorage(app) : null

/** Firebase Auth instance, or null when Firebase is not configured. */
export const auth = app ? getAuth(app) : null