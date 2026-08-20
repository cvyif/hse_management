import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import en from '@/i18n/locales/en'
import ar from '@/i18n/locales/ar'

export const SUPPORTED_LANGUAGES = ['en', 'ar'] as const
export type Language = (typeof SUPPORTED_LANGUAGES)[number]

const DEFAULT_LANGUAGE: Language = 'en'

/** Apply the language and text direction to the document root. */
export function applyDocumentDirection(language: Language): void {
  document.documentElement.lang = language
  document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr'
}

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ar: { translation: ar },
  },
  lng: DEFAULT_LANGUAGE,
  fallbackLng: DEFAULT_LANGUAGE,
  supportedLngs: [...SUPPORTED_LANGUAGES],
  interpolation: {
    escapeValue: false,
  },
})

applyDocumentDirection(i18n.language as Language)

export function isSupportedLanguage(value: string | null): value is Language {
  return value != null && (SUPPORTED_LANGUAGES as readonly string[]).includes(value)
}

export default i18n