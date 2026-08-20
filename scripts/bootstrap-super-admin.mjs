#!/usr/bin/env node
/**
 * Super Admin bootstrap script (Phase 2).
 *
 * Establishes the FIRST Super Admin through a secure, out-of-band process
 * using the Firebase Admin SDK. This is the ONLY supported way to create a
 * SUPER_ADMIN account:
 *
 *   - The Firestore rules forbid client-side writes that set role to
 *     SUPER_ADMIN, and forbid users from changing their own role/status.
 *   - This script uses the Admin SDK, which bypasses client security rules,
 *     so it REQUIRES a service-account private key.
 *
 * Never put the service-account key into Vercel client-side environment
 * variables. Run this locally (or in a trusted CI job) once.
 *
 * Usage (from the project root):
 *
 *   # Service account via environment (recommended):
 *   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json \
 *     node scripts/bootstrap-super-admin.mjs --email admin@example.com
 *
 *   # Or explicit path:
 *   node scripts/bootstrap-super-admin.mjs \
 *     --email admin@example.com \
 *     --service-account ./service-account.json
 *
 *   # If the auth user does not exist yet, create it by also passing a
 *   # password (the account/profile then starts as SUPER_ADMIN directly):
 *   node scripts/bootstrap-super-admin.mjs \
 *     --email admin@example.com \
 *     --password "a-strong-temporary-password" \
 *     --service-account ./service-account.json
 *
 * The script never prints secrets.
 */

import { readFileSync } from 'node:fs'
import process from 'node:process'

import admin from 'firebase-admin'

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

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const email = args['email']
  const password = args['password'] ?? undefined

  if (!email) {
    throw new Error('Missing required --email argument.')
  }

  const serviceAccountPath = resolveServiceAccount(args)
  const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'))

  if (admin.apps.length === 0) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    })
  }

  const auth = admin.auth()
  const firestore = admin.firestore()
  const now = Date.now()

  let uid
  try {
    const record = await auth.getUserByEmail(email)
    uid = record.uid
    console.log(`[1/3] Auth user found: ${email}`)
  } catch {
    if (!password) {
      throw new Error(
        `Auth user ${email} does not exist. Pass --password to create it.`,
      )
    }
    const record = await auth.createUser({
      email,
      password,
      emailVerified: false,
      displayName: email.split('@')[0] ?? email,
    })
    uid = record.uid
    console.log(`[1/3] Auth user created: ${email}`)
  }

  const profileRef = firestore.collection('users').doc(uid)
  const existing = await profileRef.get()

  const profile = {
    uid,
    email,
    displayName: existing.exists ? existing.data().displayName ?? email : email,
    status: 'APPROVED',
    role: 'SUPER_ADMIN',
    active: true,
    assignedAreaIds: [],
    language: existing.exists ? existing.data().language ?? 'en' : 'en',
    approvedBy: 'bootstrap',
    approvedAt: now,
    updatedAt: now,
    createdAt: existing.exists ? existing.data().createdAt ?? now : now,
  }

  await profileRef.set(profile, { merge: true })
  console.log(`[2/3] Profile approved with role SUPER_ADMIN: ${email}`)

  await firestore.collection('auditLogs').add({
    actorId: 'bootstrap',
    actorRole: 'SUPER_ADMIN',
    action: 'user.approved',
    entityType: 'user',
    entityId: uid,
    changes: { role: 'SUPER_ADMIN', source: 'bootstrap' },
    createdAt: now,
  })
  console.log('[3/3] Audit trail entry written.')

  console.log('\nBootstrap complete. The account can now sign in and access /admin.')
  console.log('Revoke or rotate the service account if it is no longer needed.')
}

main().catch((error) => {
  console.error(`Bootstrap failed: ${error.message}`)
  process.exitCode = 1
})