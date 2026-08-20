import { useEffect, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { AuthProvider } from '@/features/auth/AuthProvider'
import { applyDocumentDirection, type Language } from '@/i18n'
import i18n from '@/i18n'
import { useUiStore } from '@/stores/ui.store'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
    },
  },
})

/**
 * Re-applies the persisted UI language to i18n and the document direction
 * on first mount (the persisted preference wins over the default).
 */
function LanguageProvider({ children }: { children: ReactNode }) {
  const language = useUiStore((s) => s.language)

  useEffect(() => {
    void i18n.changeLanguage(language as Language)
    applyDocumentDirection(language)
  }, [language])

  return children
}

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <LanguageProvider>{children}</LanguageProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}