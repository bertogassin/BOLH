'use client'

type FormErrorSummaryProps = {
  message: string
  className?: string
}

type FieldErrorProps = {
  message: string
  className?: string
}

const DEFAULT_SUMMARY_CLASS =
  'rounded-xl bg-red-50 p-3 text-sm text-red-700 border border-red-100'
const DEFAULT_FIELD_CLASS = 'mt-1 text-xs text-red-600'

export function FormErrorSummary({ message, className }: FormErrorSummaryProps) {
  return (
    <div role="alert" className={className || DEFAULT_SUMMARY_CLASS}>
      {message}
    </div>
  )
}

export function FieldError({ message, className }: FieldErrorProps) {
  return <p className={className || DEFAULT_FIELD_CLASS}>{message}</p>
}
