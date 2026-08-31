import { useMemo } from 'react'

import type { EvidenceItem } from '@/types/observation'

/**
 * Resolve display URLs for evidence items. Supabase items carry their
 * delivered secure URL in metadata; items without a URL (legacy shapes) are
 * reported as failed so the gallery shows the existing unavailable state.
 */
export function useEvidenceUrls(items: EvidenceItem[] | undefined) {
  const urls = useMemo(() => {
    const map: Record<string, string> = {}
    for (const item of items ?? []) {
      if (item.url) map[item.id] = item.url
    }
    return map
  }, [items])

  const failed = useMemo(
    () => (items ?? []).filter((item) => !item.url).map((item) => item.name),
    [items],
  )

  return { urls, failed }
}
