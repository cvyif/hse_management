import { collection, getDocs, orderBy, query } from 'firebase/firestore'

import { db } from '@/config/firebase'
import type { ObservationType } from '@/types/observationType'

const OBSERVATION_TYPES_COLLECTION = 'observationTypes'

/**
 * All observation types ordered for display (readable by approved users).
 * The list is database-driven — the UI is never hard-coded.
 */
export async function listObservationTypes(): Promise<ObservationType[]> {
  if (!db) throw new Error('Firebase is not configured.')
  const snapshot = await getDocs(
    query(collection(db, OBSERVATION_TYPES_COLLECTION), orderBy('sortOrder')),
  )
  return snapshot.docs.map((d) => d.data() as ObservationType)
}