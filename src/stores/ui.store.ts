import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import type { Language } from '@/i18n'

export type Theme = 'light' | 'dark' | 'system'

interface UiState {
  language: Language
  theme: Theme
  /** Sidebar open state for desktop; drawer open state on mobile. */
  sidebarOpen: boolean
  setLanguage: (language: Language) => void
  setTheme: (theme: Theme) => void
  setSidebarOpen: (open: boolean) => void
  toggleSidebar: () => void
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      language: 'en',
      theme: 'system',
      sidebarOpen: true,
      setLanguage: (language) => set({ language }),
      setTheme: (theme) => set({ theme }),
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
    }),
    {
      name: 'hse-ui-prefs',
      partialize: (state) => ({
        language: state.language,
        theme: state.theme,
        sidebarOpen: state.sidebarOpen,
      }),
    },
  ),
)