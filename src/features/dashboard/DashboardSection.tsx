import type { ReactNode } from 'react'

/**
 * Task 7.1 reusable dashboard section container: a titled block with an
 * optional description, action and children. Future analytics tasks (7.2+)
 * mount their panels inside these sections.
 */
export interface DashboardSectionProps {
  title: string
  description?: string
  action?: ReactNode
  children: ReactNode
}

export function DashboardSection({ title, description, action, children }: DashboardSectionProps) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-medium text-slate-900">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}