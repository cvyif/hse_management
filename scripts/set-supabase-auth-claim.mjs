#!/usr/bin/env node
/**
 * BUG-A1.1 — Add the Supabase `authenticated` role claim to one Firebase user.
 *
 * Supabase Third-Party Auth validates the Firebase ID token (confirmed by the
 * live E2E test) but only maps the JWT to the Postgres `authenticated` role
 * when the token carries the custom claim `role: "authenticated"`. This script
 * adds that claim to a single, explicit user — preserving any existing custom
 * claims — using the same Admin SDK + service-account mechanism used by the
 * Super Admin bootstrap.
 *
 * Runs locally only. Uses the service-account key the same way as
 * scripts/bootstrap-super-admin.mjs and scripts/seed-observation-types.mjs.
 * Never place the service-account key in `src/`, VITE_ variables, or Vercel.
 *
 * Usage (from the project root):
 *
 *   node scripts/set-supabase-auth-claim.mjs \
 *     --uid HQ9sT8ymYYWiafLwYW20emkGSO43 \
 *     --service-account ./service-account.json
 *
 *   # or via environment:
 *   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json \
 *     node scripts/set-supabase-auth-claim.mjs --uid <uid>
 *
 * The script never prints credentials, private keys, or ID tokens.
 */

import { readFileSync } from 'node:fs'
import process from 'node:process'

import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'

/** The Supabase Third-Party Auth Postgres role that must be present. */
const SUPABASE_AUTHENTICATED_ROLE = 'authenticated'

function parseArgs(argv) {
  const args = {}
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg.startsWith('--')) {
      const key = arg.slice(2)
      const value = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : 'true'
      args[key] = value
      if (value !== 'true') i += 1
    }
  }
  return args
}

function resolveServiceAccount(args) {
  if (args['service-account']) return args['service-account']
  const env = process.env.GOOGLE_APPLICATION_CREDENTIALS
  if (!env) {
    throw new Error(
      'No service account provided. Pass --service-account <path> or set ' +
        'GOOGLE_APPLICATION_CREDENTIALS.',
    )
  }
  return env
}

/** Strip anything that could be a sensitive value from a claim set before logging. */
function sanitizeClaims(claims) {
  if (!claims || typeof claims !== 'object') return {}
  const summary = {}
  for (const [key, value] of Object.entries(claims)) {
    if (
      typeof value === 'string' &&
      /(key|secret|token|credential|password|private)/i.test(key)
    ) {
      summary[key] = '[redacted]'
    } else {
      summary[key] = value
    }
  }
  return summary
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const uid = args['uid']

  if (!uid) {
    throw new Error(
      'Missing required --uid argument. Target ONLY the specified UID.',
    )
  }

  const serviceAccountPath = resolveServiceAccount(args)
  const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'))

  if (getApps().length === 0) {
    initializeApp({ credential: cert(serviceAccount) })
  }

  const auth = getAuth()

  const existingRecord = await auth.getUser(uid)
  const existingClaims = existingRecord.customClaims || {}

  const mergedClaims = {
    ...existingClaims,
    role: SUPABASE_AUTHENTICATED_ROLE,
  }

  await auth.setCustomUserClaims(uid, mergedClaims)

  console.log(`[1/1] Custom claims set for: ${existingRecord.email ?? uid}`)
  console.log(`Current claims (sanitized): ${JSON.stringify(sanitizeClaims(mergedClaims))}`)
  console.log('No credentials, private keys, or tokens were printed.')
}

main().catch((error) => {
  console.error(`set-supabase-auth-claim failed: ${error.message}`)
  process.exitCode = 1
})