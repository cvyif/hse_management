import { useEffect, useState } from 'react'
import { getDownloadURL, ref } from 'firebase/storage'

import { storage } from '@/config/firebase'
import type { EvidenceItem } from '@/types/observation'

/** Resolve signed download URLs for the evidence items. */
export function useEvidenceUrls(items: EvidenceItem[] | undefined) {
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [failed, setFailed] = useState<string[]>([])

  useEffect(() => {
    let active = true
    setUrls({})
    setFailed([])
    if (!storage || !items || items.length === 0) return
    for (const item of items) {
      getDownloadURL(ref(storage, item.storagePath))
        .then((url) => {
          if (active) setUrls((prev) => ({ ...prev, [item.id]: url }))
        })
        .catch(() => {
          if (active) setFailed((prev) => [...prev, item.name])
        })
    }
    return () => {
      active = false
    }
  }, [items])

  return { urls, failed }
}