'use client'

import { useLocale } from '@/context/LocaleContext'

const STATUS_FALLBACK_LABELS: Record<string, string> = {
  draft: 'Draft',
  published: 'Published',
  open: 'Open',
  searching: 'Searching',
  matched: 'Matched',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
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
  const { t } = useLocale()
  const translated = t(`status.${status}`)
  const label = translated === `status.${status}` ? STATUS_FALLBACK_LABELS[status] || status : translated
  const style = STATUS_STYLES[status] || 'bg-gray-100 text-gray-700'
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${style}`}>
      {label}
    </span>
  )
}

export function statusLabel(s: string, t?: (key: string) => string): string {
  if (t) {
    const translated = t(`status.${s}`)
    if (translated !== `status.${s}`) return translated
  }
  return STATUS_FALLBACK_LABELS[s] || s
}
