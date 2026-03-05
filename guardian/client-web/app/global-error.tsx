'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="ru">
      <body style={{ margin: 0, background: '#1a1b26', color: '#fff', fontFamily: 'system-ui, sans-serif', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div style={{ maxWidth: 400, textAlign: 'center' }}>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Что-то пошло не так</h1>
          <p style={{ marginTop: 8, fontSize: 14, opacity: 0.7 }}>Ошибка приложения. Попробуйте обновить страницу.</p>
          <button
            type="button"
            onClick={reset}
            style={{ marginTop: 24, padding: '10px 16px', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, cursor: 'pointer' }}
          >
            Обновить
          </button>
        </div>
      </body>
    </html>
  )
}
