import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { MAX_EVIDENCE_FILES } from '@/types/observation'
import { ALLOWED_EVIDENCE_EXTENSIONS, validateEvidence, type PendingEvidenceFile } from '@/services/observation.service'

const ACCEPT = [
  ...ALLOWED_EVIDENCE_EXTENSIONS,
  'image/*',
].join(',')

function newFileId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export interface EvidencePickerProps {
  files: readonly PendingEvidenceFile[]
  onChange: (files: PendingEvidenceFile[]) => void
  disabled?: boolean
}

/**
 * Multi-file evidence picker with camera support (mobile), previews and
 * client-side validation. Limits are re-checked by the service layer and the
 * Storage/Firestore rules.
 */
export function EvidencePicker({ files, onChange, disabled }: EvidencePickerProps) {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const [localErrors, setLocalErrors] = useState<string[]>([])

  const previews = useMemo(
    () =>
      files.map((item) => ({
        id: item.id,
        url: item.file.type.startsWith('image/') ? URL.createObjectURL(item.file) : undefined,
        name: item.file.name,
        sizeBytes: item.file.size,
      })),
    [files],
  )

  useEffect(() => {
    return () => {
      for (const preview of previews) {
        if (preview.url) URL.revokeObjectURL(preview.url)
      }
    }
  }, [previews])

  function addFiles(selected: FileList | null) {
    if (!selected || selected.length === 0) return
    const incoming = Array.from(selected)
    const remaining = MAX_EVIDENCE_FILES - files.length
    if (incoming.length > remaining) {
      setLocalErrors([t('observation.evidence.tooManyFiles', { max: MAX_EVIDENCE_FILES })])
      return
    }
    const errors = validateEvidence(incoming)
    if (errors.length > 0) {
      setLocalErrors(errors)
      return
    }
    setLocalErrors([])
    onChange([
      ...files,
      ...incoming.map((file) => ({ id: newFileId(), file })),
    ])
    if (inputRef.current) inputRef.current.value = ''
    if (cameraRef.current) cameraRef.current.value = ''
  }

  function removeFile(id: string) {
    onChange(files.filter((item) => item.id !== id))
  }

  return (
    <Card>
      <CardBody className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => addFiles(e.target.files)}
            disabled={disabled}
          />
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => addFiles(e.target.files)}
            disabled={disabled}
          />
          <Button
            variant="secondary"
            onClick={() => inputRef.current?.click()}
            disabled={disabled}
          >
            {t('observation.evidence.addFiles')}
          </Button>
          <Button
            variant="secondary"
            onClick={() => cameraRef.current?.click()}
            disabled={disabled}
          >
            {t('observation.evidence.takePhoto')}
          </Button>
        </div>

        <p className="text-xs text-slate-500">
          {t('observation.evidence.hint', { max: MAX_EVIDENCE_FILES, size: '10 MB' })}
        </p>

        {localErrors.length > 0 && (
          <ul role="alert" className="flex flex-col gap-1">
            {localErrors.map((error) => (
              <li key={error} className="text-sm text-red-600">
                {error}
              </li>
            ))}
          </ul>
        )}

        {previews.length === 0 ? (
          <p className="text-sm text-slate-500">{t('observation.evidence.noFiles')}</p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {previews.map((preview) => (
              <li
                key={preview.id}
                className="flex flex-col overflow-hidden rounded-md border border-slate-200"
              >
                <div className="flex h-28 items-center justify-center bg-slate-100">
                  {preview.url ? (
                    <img
                      src={preview.url}
                      alt={preview.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-2xl text-slate-400" aria-hidden="true">
                      <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
                        <path strokeLinecap="round" d="M14 3v5h5" />
                      </svg>
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2 px-2 py-1.5">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-slate-700">{preview.name}</p>
                    <p className="text-xs text-slate-500">{formatBytes(preview.sizeBytes)}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => removeFile(preview.id)}
                    disabled={disabled}
                  >
                    {t('observation.evidence.remove')}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  )
}