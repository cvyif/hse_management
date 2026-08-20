import type { ReactNode, ThHTMLAttributes, TdHTMLAttributes } from 'react'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/cn'

/** Consistent admin table inside a Card with horizontal scroll on mobile. */
export function AdminTable({ children }: { children: ReactNode }) {
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">{children}</table>
      </div>
    </Card>
  )
}

export function THead({ children }: { children: ReactNode }) {
  return (
    <thead>
      <tr className="border-b border-slate-200 bg-slate-50 text-start text-xs font-medium uppercase tracking-wide text-slate-500">
        {children}
      </tr>
    </thead>
  )
}

export function Th({ className, children, ...rest }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th className={cn('px-4 py-2.5 text-start font-medium', className)} {...rest}>
      {children}
    </th>
  )
}

export function Td({ className, children, ...rest }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cn('px-4 py-3 align-middle', className)} {...rest}>
      {children}
    </td>
  )
}

export function TRow({ children }: { children: ReactNode }) {
  return (
    <tr className="border-b border-slate-100 last:border-0 hover:bg-slate-50">{children}</tr>
  )
}