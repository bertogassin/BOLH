'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useLocale } from '@/context/LocaleContext'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const { t } = useLocale()

  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="theme-page flex min-h-screen flex-col items-center justify-center p-4 text-white">
      <div className="theme-surface max-w-md rounded-2xl border border-white/10 p-8 text-center">
        <h1 className="text-xl font-semibold">{t('errors.boundary_title')}</h1>
        <p className="theme-text-muted mt-2 text-sm">
          {t('errors.boundary_subtitle')}
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={reset}
            className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-violet-500"
          >
            {t('errors.retry')}
          </button>
          <Link
            href="/booking"
            className="rounded-xl border border-white/20 px-4 py-2.5 text-sm font-medium text-white theme-hover"
          >
            {t('navigation.home')}
          </Link>
        </div>
      </div>
    </div>
  )
}
