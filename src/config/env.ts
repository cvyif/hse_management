/**
 * Environment configuration.
 *
 * All Firebase connection settings come from environment variables
 * (see `.env.example`). Vite exposes `VITE_` prefixed variables.
 */

export interface FirebaseEnv {
  apiKey: string
  authDomain: string
  projectId: string
  storageBucket: string
  messagingSenderId: string
  appId: string
}

export interface EmulatorEnv {
  auth: string | null
  firestore: string | null
  storage: string | null
}

export interface SupabaseEnv {
  /** Project URL, e.g. https://<ref>.supabase.co (browser-safe). */
  url: string
  /** Publishable anon key (browser-safe; NEVER the service-role key). */
  anonKey: string
}

function read(name: string): string {
  const value = import.meta.env[name] as string | undefined
  return value?.trim() ?? ''
}

export const firebaseEnv: FirebaseEnv = {
  apiKey: read('VITE_FIREBASE_API_KEY'),
  authDomain: read('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: read('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: read('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: read('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: read('VITE_FIREBASE_APP_ID'),
}

export const useEmulators = read('VITE_USE_FIREBASE_EMULATORS') === 'true'

export const supabaseEnv: SupabaseEnv = {
  url: read('VITE_SUPABASE_URL').replace(/\/+$/, ''),
  anonKey: read('VITE_SUPABASE_ANON_KEY'),
}

export const emulatorEnv: EmulatorEnv = {
  auth: read('VITE_FIREBASE_AUTH_EMULATOR_URL') || null,
  firestore: read('VITE_FIREBASE_FIRESTORE_EMULATOR_URL') || null,
  storage: read('VITE_FIREBASE_STORAGE_EMULATOR_URL') || null,
}

/** True when every required Firebase field has been provided. */
export function isFirebaseConfigured(): boolean {
  return Object.values(firebaseEnv).every((value) => value.length > 0)
}

/** True when the Supabase evidence-storage configuration is complete. */
export function isSupabaseConfigured(): boolean {
  return supabaseEnv.url.length > 0 && supabaseEnv.anonKey.length > 0
}

export const isDev = import.meta.env.DEV