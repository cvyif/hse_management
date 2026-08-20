import { useTranslation } from 'react-i18next'

import { useEvidenceUrls } from '@/features/observations/useEvidenceUrls'
import type { EvidenceItem } from '@/types/observation'

/** Read-only gallery of evidence files (images inline, docs as icons). */
export function EvidenceGallery({ items }: { items: EvidenceItem[] | undefined }) {
  const { t } = useTranslation()
  const { urls, failed } = useEvidenceUrls(items)

  if (!items || items.length === 0) {
    return <p className="text-sm text-slate-500">{t('observation.detail.noEvidence')}</p>
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((item) => {
          const url = urls[item.id]
          const isImage = item.contentType.startsWith('image/')
          return (
            <li key={item.id} className="overflow-hidden rounded-md border border-slate-200">
              <a
                href={url ?? '#'}
                target="_blank"
                rel="noreferrer"
                className="flex h-32 items-center justify-center bg-slate-100"
              >
                {url && isImage ? (
                  <img src={url} alt={item.name} className="h-full w-full object-cover" />
                ) : (
                  <svg
                    viewBox="0 0 24 24"
                    className="h-8 w-8 text-slate-400"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"
                    />
                    <path strokeLinecap="round" d="M14 3v5h5" />
                  </svg>
                )}
              </a>
              <p className="truncate px-2 py-1.5 text-xs font-medium text-slate-700">{item.name}</p>
            </li>
          )
        })}
      </ul>
      {failed.length > 0 && (
        <p className="text-sm text-red-600">
          {t('observation.detail.evidenceUnavailable')}: {failed.join(', ')}
        </p>
      )}
    </div>
  )
}