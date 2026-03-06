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
      <body style={{ margin: 0, background: '#1a1b26', color: '#fff', fontFamily: 'system-ui, sans-serif', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div style={{ maxWidth: 400, textAlign: 'center' }}>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 600 }}>{copy.title}</h1>
          <p style={{ marginTop: 8, fontSize: 14, opacity: 0.7 }}>{copy.subtitle}</p>
          <button
            type="button"
            onClick={reset}
            style={{ marginTop: 24, padding: '10px 16px', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, cursor: 'pointer' }}
          >
            {copy.refresh}
          </button>
        </div>
      </body>
    </html>
  )
}
