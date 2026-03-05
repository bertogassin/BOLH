'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#1a1b26] p-4 text-white">
      <div className="max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
        <h1 className="text-xl font-semibold">Что-то пошло не так</h1>
        <p className="mt-2 text-sm text-white/60">
          Ошибка при загрузке страницы. Попробуйте обновить или вернуться на главную.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={reset}
            className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-violet-500"
          >
            Попробовать снова
          </button>
          <Link
            href="/booking"
            className="rounded-xl border border-white/20 px-4 py-2.5 text-sm font-medium text-white hover:bg-white/10"
          >
            На главную
          </Link>
        </div>
      </div>
    </div>
  )
}
