'use client'

type ErrorRetryProps = {
  message?: string
  onRetry: () => void
  className?: string
}

export function ErrorRetry({
  message = 'Не удалось загрузить данные.',
  onRetry,
  className = '',
}: ErrorRetryProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-center ${className}`}
    >
      <p className="text-sm text-white/90">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 rounded-xl bg-white/20 px-4 py-2 text-sm font-medium text-white hover:bg-white/30"
      >
        Повторить
      </button>
    </div>
  )
}
