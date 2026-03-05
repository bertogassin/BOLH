'use client'

import { forwardRef } from 'react'
import { X } from 'lucide-react'
import { useLocale } from '@/context/LocaleContext'

type InputWithClearProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange'
> & {
  value: string
  onChange: (value: string) => void
  wrapperClassName?: string
  clearable?: boolean
  clearButtonClassName?: string
}

export const InputWithClear = forwardRef<HTMLInputElement, InputWithClearProps>(function InputWithClear({
  value,
  onChange,
  wrapperClassName = '',
  clearable = true,
  clearButtonClassName = 'text-gray-400 hover:text-gray-600',
  className = '',
  type = 'text',
  ...rest
}, ref) {
  const { t } = useLocale()
  const showClear = clearable && type !== 'password' && value.length > 0

  return (
    <div className={`relative ${wrapperClassName}`.trim()}>
      <input
        ref={ref}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={showClear ? `${className} pr-10`.trim() : className}
        {...rest}
      />
      {showClear && (
        <button
          type="button"
          onClick={() => onChange('')}
          className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-black/5 focus:outline-none focus:ring-1 focus:ring-inset focus:ring-gray-300 ${clearButtonClassName}`}
          aria-label={t('clear_aria')}
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
})
