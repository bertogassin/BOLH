'use client'

import { useEffect, useState } from 'react'

type ErrorLocale = 'en' | 'ru'

const COPY: Record<ErrorLocale, { title: string; subtitle: string; refresh: string }> = {
  en: {
    title: 'Something went wrong',
    subtitle: 'Application error. Try refreshing the page.',
    refresh: 'Refresh',
  },
  ru: {
    title: 'Что-то пошло не так',
    subtitle: 'Ошибка приложения. Попробуйте обновить страницу.',
    refresh: 'Обновить',
  },
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const [copy, setCopy] = useState(COPY.en)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const locale = (window.localStorage.getItem('guardian_locale') || 'en').toLowerCase()
    setCopy(locale === 'ru' ? COPY.ru : COPY.en)
  }, [])

  return (
    <html lang="en">
      <body className="theme-page" style={{ margin: 0, fontFamily: 'system-ui, sans-serif' }}>
        <main className="min-h-screen flex items-center justify-center p-4">
          <div className="theme-surface w-full max-w-[400px] rounded-2xl border border-white/10 p-6 text-center">
            <h1 className="text-xl font-semibold">{copy.title}</h1>
            <p className="theme-text-muted mt-2 text-sm">{copy.subtitle}</p>
          <button
            type="button"
            onClick={reset}
            className="mt-6 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-violet-500"
          >
            {copy.refresh}
          </button>
        </div>
        </main>
      </body>
    </html>
  )
}
