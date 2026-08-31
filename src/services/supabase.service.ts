/**
 * Supabase Storage evidence upload (free plan, public bucket).
 *
 * Uses only browser-safe configuration (project URL + anon key). Uploads are
 * authenticated with the signed-in user's Firebase ID token — recognized by
 * Supabase via Third-Party Auth — so anonymous uploads are rejected by
 * Storage RLS. Firestore remains the authorization source of truth for which
 * user may attach evidence to which observation/corrective action.
 */

import { auth } from '@/config/firebase'
import { isSupabaseConfigured, supabaseEnv } from '@/config/env'

/** The single public evidence bucket. */
export const EVIDENCE_BUCKET = 'evidence'

/** Metadata returned for one uploaded file. */
export interface UploadedEvidence {
  publicId: string
  url: string
  format: string
}

/** True when the client-safe Supabase configuration is complete. */
export function isEvidenceUploadConfigured(): boolean {
  return isSupabaseConfigured()
}

/**
 * Deterministic object path mirroring the legacy Storage path convention so
 * retries upsert the same object instead of orphaning binaries.
 * `<prefix>/<observationId>/<fileId>` — fileId is a UUID.
 */
export function evidencePublicId(
  prefix: string,
  observationId: string,
  fileId: string,
): string {
  return `${prefix}/${observationId}/${fileId}`
}

/** Public delivery URL for an object in the public bucket. */
function publicObjectUrl(publicId: string): string {
  return `${supabaseEnv.url}/storage/v1/object/public/${EVIDENCE_BUCKET}/${publicId}`
}

async function currentFirebaseIdToken(): Promise<string> {
  const user = auth?.currentUser
  if (!user) throw new Error('You must be signed in to upload evidence.')
  return user.getIdToken()
}

/**
 * Upload one file to Supabase Storage. Throws on any failure so the caller
 * keeps its existing upload-before-commit / retry semantics.
 */
export async function uploadEvidenceFile(
  file: File,
  publicId: string,
): Promise<UploadedEvidence> {
  if (!isEvidenceUploadConfigured()) {
    throw new Error('Evidence storage is not configured.')
  }
  const idToken = await currentFirebaseIdToken()

  let response: Response
  try {
    response = await fetch(
      `${supabaseEnv.url}/storage/v1/object/${EVIDENCE_BUCKET}/${publicId}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${idToken}`,
          apikey: supabaseEnv.anonKey,
          'x-upsert': 'true',
          'Content-Type': file.type || 'application/octet-stream',
        },
        body: file,
      },
    )
  } catch {
    throw new Error('Evidence upload failed due to a network error.')
  }
  if (!response.ok) {
    throw new Error(`Evidence upload failed (${response.status}).`)
  }
  return { publicId, url: publicObjectUrl(publicId), format: '' }
}
