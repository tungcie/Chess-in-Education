import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react'

const CONTROL =
  'block w-full rounded-lg border border-line bg-surface px-3 text-[15px] text-ink placeholder:text-muted/70 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:bg-page disabled:text-muted aria-invalid:border-danger-600'

interface FieldProps {
  label: string
  error?: string
  hint?: ReactNode
  children: (id: string, describedBy: string | undefined) => ReactNode
}

/** Nhãn + ô nhập + lỗi / gợi ý. */
export function Field({ label, error, hint, children }: FieldProps) {
  const id = useId()
  const describedBy = error || hint ? `${id}-desc` : undefined
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
      </label>
      {children(id, describedBy)}
      {error ? (
        <p id={describedBy} className="text-sm text-danger-600">
          {error}
        </p>
      ) : hint ? (
        <p id={describedBy} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className = '', ...rest },
  ref,
) {
  return <input ref={ref} className={`${CONTROL} h-10 ${className}`} {...rest} />
})

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className = '', children, ...rest },
  ref,
) {
  return (
    <select ref={ref} className={`${CONTROL} h-10 ${className}`} {...rest}>
      {children}
    </select>
  )
})
