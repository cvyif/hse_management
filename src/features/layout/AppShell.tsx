import { Outlet } from 'react-router-dom'

import { useUiStore } from '@/stores/ui.store'
import { SidebarContent } from '@/features/layout/Sidebar'
import { Topbar } from '@/features/layout/Topbar'

/**
 * Responsive application shell. On desktop the sidebar is always visible;
 * on tablet/mobile it becomes a slide-in drawer. Layout uses logical
 * properties so it mirrors correctly in RTL mode.
 */
export function AppShell() {
  const sidebarOpen = useUiStore((s) => s.sidebarOpen)
  const setSidebarOpen = useUiStore((s) => s.setSidebarOpen)

  return (
    <div className="flex min-h-dvh bg-slate-50">
      <aside className="hidden w-64 shrink-0 flex-col border-e border-slate-200 bg-white lg:flex">
        <SidebarContent />
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-slate-900/50"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
          <aside className="absolute inset-y-0 start-0 w-64 bg-white shadow-xl">
            <SidebarContent />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}