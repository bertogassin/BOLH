'use client'

import Link from 'next/link'
import { CheckSquare, ChevronRight, Clock3, Download, ExternalLink, Link2, Square } from 'lucide-react'
import type { Document } from '@/lib/api'
import { formatDate, formatRelativeDate, formatSize, getDocStyle, getFileExt } from './documentHubUtils'

type Props = {
  loading: boolean
  visibleDocs: Document[]
  viewMode: 'list' | 'grid'
  selectedIds: string[]
  locale: string
  toggleSelectDoc: (id: string) => void
  downloadOne: (d: Document) => Promise<void>
  copyDocumentLink: (id: string) => Promise<void>
  clearFilters: () => void
}

export function DocumentList({
  loading,
  visibleDocs,
  viewMode,
  selectedIds,
  locale,
  toggleSelectDoc,
  downloadOne,
  copyDocumentLink,
  clearFilters,
}: Props) {
  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-16 rounded-xl bg-white/10" />
        ))}
      </div>
    )
  }

  return (
    <section>
      <h2 className="text-sm font-semibold text-white/70 mb-2">Документы</h2>
      {visibleDocs.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/60 space-y-3">
          <p>Нет документов по текущим фильтрам.</p>
          <div className="flex flex-wrap gap-2">
            <Link href="/documents/upload" className="rounded-lg bg-violet-600 px-3 py-1.5 text-white text-xs">
              Загрузить документ
            </Link>
            <button type="button" onClick={clearFilters} className="rounded-lg bg-white/10 px-3 py-1.5 text-xs">
              Сбросить фильтры
            </button>
          </div>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {visibleDocs.map((d) => {
            const style = getDocStyle(d.doc_type)
            const Icon = style.icon
            const selected = selectedIds.includes(d.id)
            return (
              <article key={d.id} className={`rounded-xl ${style.bg} border ${selected ? 'border-violet-400/70' : style.border} p-3`}>
                <div className="flex items-start gap-2">
                  <button type="button" onClick={() => toggleSelectDoc(d.id)} className="text-white/70 mt-0.5">
                    {selected ? <CheckSquare className="h-4.5 w-4.5 text-violet-300" /> : <Square className="h-4.5 w-4.5" />}
                  </button>
                  <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${style.iconColor}`}>
                    <Icon className="h-4.5 w-4.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link href={`/documents/${d.id}`} className="font-medium text-sm line-clamp-2 hover:underline">
                      {d.title}
                    </Link>
                    <p className="text-[11px] text-white/60 mt-0.5">
                      {d.doc_type} · {formatSize(d.file_size)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-3 text-[11px] text-white/60">
                  <span className="inline-flex items-center gap-1">
                    <Clock3 className="h-3 w-3" />
                    {formatRelativeDate(d.updated_at || d.created_at, locale)}
                  </span>
                  {getFileExt(d.file_name) ? <span className="rounded bg-white/10 px-1.5 py-0.5">{getFileExt(d.file_name)}</span> : null}
                </div>
                <div className="flex gap-1.5 mt-2">
                  <button type="button" onClick={() => downloadOne(d)} className="rounded bg-white/10 p-1.5" title="Скачать">
                    <Download className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => copyDocumentLink(d.id)} className="rounded bg-white/10 p-1.5" title="Копировать ссылку">
                    <Link2 className="h-3.5 w-3.5" />
                  </button>
                  <Link href={`/documents/${d.id}`} className="rounded bg-white/10 p-1.5" title="Открыть">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </article>
            )
          })}
        </div>
      ) : (
        <ul className="space-y-2">
          {visibleDocs.map((d) => {
            const style = getDocStyle(d.doc_type)
            const Icon = style.icon
            const selected = selectedIds.includes(d.id)
            return (
              <li key={d.id} className={`flex items-center gap-3 rounded-xl ${style.bg} border ${selected ? 'border-violet-400/70' : style.border} p-4 hover:opacity-90`}>
                <button
                  type="button"
                  onClick={() => toggleSelectDoc(d.id)}
                  className="shrink-0 text-white/70 hover:text-white"
                  aria-label={selected ? 'Снять выбор' : 'Выбрать'}
                >
                  {selected ? <CheckSquare className="h-5 w-5 text-violet-300" /> : <Square className="h-5 w-5" />}
                </button>
                <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${style.iconColor}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <Link href={`/documents/${d.id}`} className="min-w-0 flex-1">
                  <p className="font-medium truncate">{d.title}</p>
                  <p className="text-xs text-white/50">
                    {d.doc_type} · {formatSize(d.file_size)} · {formatDate(d.created_at, locale)} · {formatRelativeDate(d.updated_at || d.created_at, locale)}
                  </p>
                </Link>
                <button type="button" onClick={() => downloadOne(d)} className="rounded bg-white/10 p-1.5 text-white/80" title="Скачать">
                  <Download className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={() => copyDocumentLink(d.id)} className="rounded bg-white/10 p-1.5 text-white/80" title="Копировать ссылку">
                  <Link2 className="h-3.5 w-3.5" />
                </button>
                {getFileExt(d.file_name) ? <span className="rounded bg-white/10 text-[10px] px-1.5 py-0.5 shrink-0">{getFileExt(d.file_name)}</span> : null}
                {d.status === 'signed' && <span className="rounded bg-green-500/20 text-green-300 text-xs px-2 py-0.5 shrink-0">Подписан</span>}
                <Link href={`/documents/${d.id}`} className="shrink-0">
                  <ChevronRight className="h-5 w-5 text-white/40" />
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

