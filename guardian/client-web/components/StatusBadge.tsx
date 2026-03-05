'use client'

const STATUS_LABELS: Record<string, string> = {
  draft: 'Черновик',
  published: 'Опубликован',
  open: 'Открыт',
  searching: 'Ищет исполнителя',
  matched: 'Найден исполнитель',
  in_progress: 'В работе',
  completed: 'Завершён',
  cancelled: 'Отменён',
}

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  published: 'bg-amber-100 text-amber-800',
  open: 'bg-sky-100 text-sky-800',
  searching: 'bg-amber-100 text-amber-800',
  matched: 'bg-emerald-100 text-emerald-800',
  in_progress: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-gray-100 text-gray-500',
}

export function StatusBadge({ status }: { status: string }) {
  const label = STATUS_LABELS[status] || status
  const style = STATUS_STYLES[status] || 'bg-gray-100 text-gray-700'
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${style}`}>
      {label}
    </span>
  )
}

export function statusLabel(s: string): string {
  return STATUS_LABELS[s] || s
}
