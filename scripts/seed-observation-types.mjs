#!/usr/bin/env node
/**
 * Seed Observation Types + the Observation ID counter (Phase 3).
 *
 * Creates the database-driven `observationTypes` collection with the
 * fourteen initial types and the `counters/observationIds` document used for
 * the OBS-YYYY-NNNNN sequence. Requires a service-account key, same as the
 * Super Admin bootstrap.
 *
 * Usage (from the project root):
 *
 *   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json \
 *     node scripts/seed-observation-types.mjs
 *
 *   # or:
 *   node scripts/seed-observation-types.mjs --service-account ./service-account.json
 *
 * Idempotent: existing types/counter are kept untouched.
 */

import { readFileSync } from 'node:fs'
import process from 'node:process'

import admin from 'firebase-admin'

const SEED_OBSERVATION_TYPES = [
  { key: 'UNSAFE_ACT', label: 'Unsafe Act', labelAr: 'سلوك غير آمن' },
  { key: 'UNSAFE_CONDITION', label: 'Unsafe Condition', labelAr: 'حالة غير آمنة' },
  { key: 'NEAR_MISS', label: 'Near Miss', labelAr: 'حادثة وشيكة' },
  { key: 'POSITIVE_OBSERVATION', label: 'Positive Observation', labelAr: 'ملاحظة إيجابية' },
  { key: 'ENVIRONMENTAL', label: 'Environmental Observation', labelAr: 'ملاحظة بيئية' },
  { key: 'PPE_VIOLATION', label: 'PPE Violation', labelAr: 'مخالفة معدات الوقاية الشخصية' },
  { key: 'FIRE_SAFETY', label: 'Fire & Safety', labelAr: 'السلامة من الحرائق' },
  { key: 'WORK_AT_HEIGHT', label: 'Work at Height', labelAr: 'العمل على الارتفاعات' },
  { key: 'LIFTING', label: 'Lifting', labelAr: 'عمليات الرفع' },
  { key: 'ELECTRICAL', label: 'Electrical', labelAr: 'أعمال كهربائية' },
  { key: 'CONFINED_SPACE', label: 'Confined Space', labelAr: 'الأماكن المغلقة' },
  { key: 'PTW_VIOLATION', label: 'PTW Violation', labelAr: 'مخالفة تصريح العمل' },
  { key: 'HOUSEKEEPING', label: 'Housekeeping', labelAr: 'النظافة والترتيب' },
  { key: 'OTHER', label: 'Other', labelAr: 'أخرى' },
]

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
  const serviceAccountPath = resolveServiceAccount(args)
  const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'))

  if (admin.apps.length === 0) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) })
  }

  const firestore = admin.firestore()
  const now = Date.now()

  const types = firestore.collection('observationTypes')
  let created = 0
  for (let index = 0; index < SEED_OBSERVATION_TYPES.length; index += 1) {
    const entry = SEED_OBSERVATION_TYPES[index]
    const ref = types.doc(entry.key)
    const existing = await ref.get()
    if (existing.exists) {
      console.log(`[skip] observationTypes/${entry.key}`)
      continue
    }
    await ref.set({
      id: entry.key,
      key: entry.key,
      label: entry.label,
      labelAr: entry.labelAr,
      sortOrder: index,
      active: true,
      createdAt: now,
      updatedAt: now,
    })
    created += 1
    console.log(`[create] observationTypes/${entry.key}`)
  }

  const counterRef = firestore.collection('counters').doc('observationIds')
  const counter = await counterRef.get()
  if (!counter.exists) {
    await counterRef.set({ year: new Date().getFullYear(), sequence: 0 })
    console.log('[create] counters/observationIds')
  } else {
    console.log('[skip] counters/observationIds (already exists)')
  }

  console.log(
    `\nSeed complete. ${created} observation type(s) created, ${SEED_OBSERVATION_TYPES.length - created} already present.`,
  )
}

main().catch((error) => {
  console.error(`Seed failed: ${error.message}`)
  process.exitCode = 1
})