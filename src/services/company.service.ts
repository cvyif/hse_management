import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  writeBatch,
} from 'firebase/firestore'

import { db } from '@/config/firebase'
import { now } from '@/lib/utils'
import { createAuditEntry } from '@/services/audit.service'
import type { Company, CompanyInput } from '@/types/company'
import type { Role } from '@/types/roles'

const COMPANIES_COLLECTION = 'companies'

export interface Actor {
  uid: string
  role?: Role
}

function companyDocRef(id: string) {
  if (!db) throw new Error('Firebase is not configured.')
  return doc(db, COMPANIES_COLLECTION, id)
}

/** All companies, active first then by name (admin only). */
export async function listCompanies(): Promise<Company[]> {
  if (!db) throw new Error('Firebase is not configured.')
  const snapshot = await getDocs(query(collection(db, COMPANIES_COLLECTION), orderBy('name')))
  return snapshot.docs.map((d) => d.data() as Company)
}

export async function createCompany(input: CompanyInput, actor: Actor): Promise<Company> {
  if (!db) throw new Error('Firebase is not configured.')
  const timestamp = now()
  const id = doc(collection(db, COMPANIES_COLLECTION)).id
  const company: Company = {
    id,
    name: input.name.trim(),
    code: input.code?.trim() || undefined,
    nameAr: input.nameAr?.trim() || undefined,
    active: input.active ?? true,
    createdAt: timestamp,
    updatedAt: timestamp,
    createdBy: actor.uid,
    updatedBy: actor.uid,
  }
  const audit = createAuditEntry({
    actorId: actor.uid,
    actorRole: actor.role,
    action: 'company.created',
    entityType: 'company',
    entityId: id,
    changes: { name: company.name },
  })
  const batch = writeBatch(db)
  batch.set(companyDocRef(id), company)
  batch.set(audit.ref, audit.log)
  await batch.commit()
  return company
}

export async function updateCompany(id: string, input: CompanyInput, actor: Actor): Promise<void> {
  if (!db) throw new Error('Firebase is not configured.')
  const timestamp = now()
  const fields = {
    name: input.name.trim(),
    code: input.code?.trim() || null,
    nameAr: input.nameAr?.trim() || null,
    updatedAt: timestamp,
    updatedBy: actor.uid,
  }
  const audit = createAuditEntry({
    actorId: actor.uid,
    actorRole: actor.role,
    action: 'company.updated',
    entityType: 'company',
    entityId: id,
    changes: fields,
  })
  const batch = writeBatch(db)
  batch.update(companyDocRef(id), fields)
  batch.set(audit.ref, audit.log)
  await batch.commit()
}

export async function setCompanyActive(
  id: string,
  active: boolean,
  actor: Actor,
): Promise<void> {
  if (!db) throw new Error('Firebase is not configured.')
  const timestamp = now()
  const audit = createAuditEntry({
    actorId: actor.uid,
    actorRole: actor.role,
    action: active ? 'company.activated' : 'company.deactivated',
    entityType: 'company',
    entityId: id,
    changes: { active },
  })
  const batch = writeBatch(db)
  batch.update(companyDocRef(id), { active, updatedAt: timestamp, updatedBy: actor.uid })
  batch.set(audit.ref, audit.log)
  await batch.commit()
}