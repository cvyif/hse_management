import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
}

export function Card({ className, children, ...rest }: CardProps) {
  return (
    <div
      className={cn('rounded-lg border border-slate-200 bg-white shadow-sm', className)}
      {...rest}
    >
      {children}
    </div>
  )
}

export function CardHeader({ className, children, ...rest }: CardProps) {
  return (
    <div className={cn('border-b border-slate-200 px-4 py-3 sm:px-6', className)} {...rest}>
      {children}
    </div>
  )
}

export function CardBody({ className, children, ...rest }: CardProps) {
  return (
    <div className={cn('px-4 py-4 sm:px-6', className)} {...rest}>
      {children}
    </div>
  )
}