'use client'

import { type ReactNode } from 'react'
import { FieldError } from '@/components/FormErrors'

type FormFieldProps = {
  label: string
  htmlFor?: string
  error?: string
  children: ReactNode
  wrapperClassName?: string
  labelClassName?: string
  errorClassName?: string
}

export function FormField({
  label,
  htmlFor,
  error,
  children,
  wrapperClassName,
  labelClassName,
  errorClassName,
}: FormFieldProps) {
  return (
    <div className={wrapperClassName}>
      <label className={labelClassName || 'mb-1.5 block text-sm font-medium text-gray-700'} htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {error ? <FieldError message={error} className={errorClassName} /> : null}
    </div>
  )
}
