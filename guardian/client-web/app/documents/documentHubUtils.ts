import { BarChart3, FileCheck, FileText, FolderOpen, Receipt } from 'lucide-react'
import type { Document } from '@/lib/api'

export const CATEGORIES = [
  { id: 'all', label: 'Все', icon: FolderOpen, docType: '' },
  { id: 'personal', label: 'Личные', icon: FileText, docType: 'passport' },
  { id: 'contracts', label: 'Контракты', icon: FileCheck, docType: 'contract' },
  { id: 'financial', label: 'Финансы', icon: Receipt, docType: 'receipt' },
  { id: 'reports', label: 'Отчёты', icon: BarChart3, docType: 'daily_report' },
] as const

const DOC_TYPE_STYLE: Record<string, { icon: typeof FileText; bg: string; border: string; iconColor: string }> = {
  passport: { icon: FileText, bg: 'bg-blue-500/15', border: 'border-blue-400/30', iconColor: 'text-blue-400' },
  contract: { icon: FileCheck, bg: 'bg-emerald-500/15', border: 'border-emerald-400/30', iconColor: 'text-emerald-400' },
  receipt: { icon: Receipt, bg: 'bg-amber-500/15', border: 'border-amber-400/30', iconColor: 'text-amber-400' },
  invoice: { icon: Receipt, bg: 'bg-amber-500/15', border: 'border-amber-400/30', iconColor: 'text-amber-400' },
  daily_report: { icon: BarChart3, bg: 'bg-slate-500/15', border: 'border-slate-400/30', iconColor: 'text-slate-400' },
  incident_report: { icon: BarChart3, bg: 'bg-rose-500/15', border: 'border-rose-400/30', iconColor: 'text-rose-400' },
}
const DEFAULT_DOC_STYLE = { icon: FileText, bg: 'bg-white/10', border: 'border-white/20', iconColor: 'text-white/60' }

export function getDocStyle(docType: string) {
  return DOC_TYPE_STYLE[docType] ?? DEFAULT_DOC_STYLE
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function formatDate(s?: string, locale?: string): string {
  if (!s) return '—'
  try {
    const loc = locale === 'ru' ? 'ru-RU' : locale === 'fr' ? 'fr-FR' : 'en-US'
    return new Date(s).toLocaleDateString(loc, { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return s
  }
}

export function formatRelativeDate(s?: string, locale?: string): string {
  if (!s) return '—'
  const ts = new Date(s).getTime()
  if (!Number.isFinite(ts)) return '—'
  const diffMs = Date.now() - ts
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  if (diffHours < 1) return 'только что'
  if (diffHours < 24) return `${diffHours} ч назад`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays <= 7) return `${diffDays} д назад`
  return formatDate(s, locale)
}

export function getFileExt(name?: string): string {
  if (!name) return ''
  const dot = name.lastIndexOf('.')
  if (dot < 0 || dot === name.length - 1) return ''
  return name.slice(dot + 1).toUpperCase()
}

export function isExpiringSoon(d: Document): boolean {
  if (!d.expires_at) return false
  const exp = new Date(d.expires_at).getTime()
  const inWeek = Date.now() + 7 * 24 * 60 * 60 * 1000
  return exp <= inWeek && exp >= Date.now()
}

