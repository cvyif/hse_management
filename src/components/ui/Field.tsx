import type { InputHTMLAttributes, ReactElement, ReactNode } from 'react'
import { Children, cloneElement, isValidElement, useId } from 'react'
import { cn } from '@/lib/cn'

export interface FieldProps {
  label: string
  hint?: string
  error?: string
  children: ReactNode
  required?: boolean
  className?: string
}

/**
 * Form field wrapper that associates a label with its control. The control
 * (e.g. <Input />) receives the generated id automatically.
 */
export function Field({ label, hint, error, required, children, className }: FieldProps) {
  const id = useId()

  const control = Children.map(children, (child) => {
    if (isValidElement(child)) {
      return cloneElement(child as ReactElement<{ id?: string }>, { id })
    }
    return child
  })

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-sm font-medium text-slate-700">
        {label}
        {required && <span className="ms-1 text-red-600">*</span>}
      </label>
      {control}
      {hint && !error && <p className="text-xs text-slate-500">{hint}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean
}

export function Input({ invalid = false, className, ...rest }: InputProps) {
  return (
    <input
      className={cn(
        'h-10 w-full rounded-md border bg-white px-3 text-sm text-slate-900 shadow-sm',
        'placeholder:text-slate-400',
        'focus:outline-none focus:ring-2',
        invalid
          ? 'border-red-400 focus:border-red-500 focus:ring-red-100'
          : 'border-slate-300 focus:border-sky-500 focus:ring-sky-100',
        'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500',
        className,
      )}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  )
}