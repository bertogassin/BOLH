'use client'

import Link from 'next/link'
import { ReactNode } from 'react'

type EmptyStateProps = {
  icon?: ReactNode
  title: string
  description?: string
  actionLabel?: string
  actionHref?: string
  onAction?: () => void
  className?: string
  variant?: 'dark' | 'light'
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
  className = '',
  variant = 'dark',
}: EmptyStateProps) {
  const isLight = variant === 'light'
  const wrap = isLight ? 'bg-white border border-gray-200' : 'bg-white/10'
  const titleCls = isLight ? 'text-gray-900' : 'text-white'
  const descCls = isLight ? 'text-gray-500' : 'text-white/60'
  const iconWrapCls = isLight ? 'bg-gray-100 text-gray-600' : 'bg-white/10 text-white/70'
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-2xl ${wrap} p-8 text-center ${className}`}
    >
      {icon && (
        <span className={`mb-4 flex h-16 w-16 items-center justify-center rounded-2xl ${iconWrapCls}`}>
          {icon}
        </span>
      )}
      <h2 className={`text-lg font-semibold ${titleCls}`}>{title}</h2>
      {description && <p className={`mt-2 max-w-sm text-sm ${descCls}`}>{description}</p>}
      {(actionLabel && (actionHref || onAction)) && (
        <div className="mt-6">
          {actionHref ? (
            <Link
              href={actionHref}
              className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-violet-500"
            >
              {actionLabel}
            </Link>
          ) : (
            <button
              type="button"
              onClick={onAction}
              className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-violet-500"
            >
              {actionLabel}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
