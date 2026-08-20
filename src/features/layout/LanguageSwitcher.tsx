import { useTranslation } from 'react-i18next'

import { applyDocumentDirection, type Language } from '@/i18n'
import { useUiStore } from '@/stores/ui.store'

/**
 * Language toggle (English / العربية). Switching updates i18n, the persisted
 * preference and the document LTR/RTL direction.
 */
export function LanguageSwitcher() {
  const { i18n } = useTranslation()
  const language = useUiStore((s) => s.language)
  const setLanguage = useUiStore((s) => s.setLanguage)

  function switchLanguage(next: Language) {
    void i18n.changeLanguage(next)
    applyDocumentDirection(next)
    setLanguage(next)
  }

  return (
    <div className="inline-flex items-center rounded-md bg-slate-100 p-0.5 text-sm">
      <button
        type="button"
        onClick={() => switchLanguage('en')}
        className={language === 'en' ? 'selected' : ''}
        aria-pressed={language === 'en'}
        aria-label="English"
      >
        <span
          className={
            language === 'en'
              ? 'rounded bg-white px-2 py-1 shadow-sm'
              : 'px-2 py-1 text-slate-600'
          }
        >
          EN
        </span>
      </button>
      <button
        type="button"
        onClick={() => switchLanguage('ar')}
        aria-pressed={language === 'ar'}
        aria-label="العربية"
      >
        <span
          className={
            language === 'ar'
              ? 'rounded bg-white px-2 py-1 shadow-sm'
              : 'px-2 py-1 text-slate-600'
          }
        >
          AR
        </span>
      </button>
    </div>
  )
}