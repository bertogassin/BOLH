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
  draft: 'border border-slate-400/20 bg-slate-400/10 text-slate-300',
  published: 'border border-amber-400/25 bg-amber-400/10 text-amber-300',
  open: 'border border-sky-400/25 bg-sky-400/10 text-sky-300',
  searching: 'border border-amber-400/25 bg-amber-400/10 text-amber-300',
  matched: 'border border-emerald-400/25 bg-emerald-400/10 text-emerald-300',
  in_progress: 'border border-blue-400/25 bg-blue-400/10 text-blue-300',
  completed: 'border border-green-400/25 bg-green-400/10 text-green-300',
  cancelled: 'border border-slate-400/20 bg-slate-400/10 text-slate-400',
}

export function StatusBadge({ status }: { status: string }) {
  const { t } = useLocale()
  const translated = t(`status.${status}`)
  const label = translated === `status.${status}` ? STATUS_FALLBACK_LABELS[status] || status : translated
  const style = STATUS_STYLES[status] || 'border border-slate-400/20 bg-slate-400/10 text-slate-300'
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
