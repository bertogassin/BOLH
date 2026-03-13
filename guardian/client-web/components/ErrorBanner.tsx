'use client'

import { useLocale } from '@/context/LocaleContext'

type ErrorBannerProps = {
  message: string
  onRetry?: () => void
  onDismiss?: () => void
  className?: string
}

export function ErrorBanner({ message, onRetry, onDismiss, className = '' }: ErrorBannerProps) {
  const { t } = useLocale()

  return (
    <div
      role="alert"
      className={`rounded-xl border border-red-400/40 bg-red-500/20 px-3 py-3 text-sm text-red-100 ${className}`}
    >
      <p>{message}</p>
      {(onRetry || onDismiss) && (
        <div className="mt-2 flex items-center gap-2">
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="rounded-lg border border-red-300/60 px-3 py-1.5 text-xs hover:bg-red-500/25"
            >
              {t('errors.retry')}
            </button>
          )}
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="rounded-lg border border-red-300/40 px-3 py-1.5 text-xs hover:bg-red-500/20"
            >
              {t('booking.close')}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
