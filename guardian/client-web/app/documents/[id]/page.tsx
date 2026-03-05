'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, FileText, Star, Trash2, PenLine, Download, Share2, Copy, ExternalLink, Mail, Printer, ClipboardList } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useLocale } from '@/context/LocaleContext'
import { fetchDocument, deleteDocument, signDocument, getDocumentFileUrl, type Document } from '@/lib/api'
import { BOLHNav } from '@/components/BOLHNav'

function formatDate(s?: string, locale?: string): string {
  if (!s) return '—'
  try {
    const loc = locale === 'ru' ? 'ru-RU' : locale === 'fr' ? 'fr-FR' : locale === 'de' ? 'de-DE' : 'en-US'
    return new Date(s).toLocaleString(loc)
  } catch {
    return s
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function DocumentDetailPage({ params }: { params: { id: string } }) {
  const { user } = useAuth()
  const { t, locale } = useLocale()
  const router = useRouter()
  const [doc, setDoc] = useState<Document | null>(null)
  const [loading, setLoading] = useState(true)
  const [signing, setSigning] = useState(false)
  const [signText, setSignText] = useState('')
  const [downloading, setDownloading] = useState(false)
  const [savedLocally, setSavedLocally] = useState(false)
  const [lastDownloadedAt, setLastDownloadedAt] = useState<string | null>(null)
  const [actionHint, setActionHint] = useState('')

  useEffect(() => {
    if (!user || !params.id) return
    fetchDocument(params.id)
      .then(setDoc)
      .catch(() => setDoc(null))
      .finally(() => setLoading(false))
  }, [user, params.id])

  useEffect(() => {
    if (!params.id || typeof window === 'undefined') return
    try {
      const raw = localStorage.getItem('dochub_saved_ids')
      const list = raw ? (JSON.parse(raw) as string[]) : []
      setSavedLocally(Array.isArray(list) && list.includes(params.id))
      const stamp = localStorage.getItem(`dochub_downloaded_${params.id}`)
      setLastDownloadedAt(stamp)
    } catch {
      // ignore
    }
  }, [params.id])

  const handleSign = async () => {
    if (!params.id || !signText.trim()) return
    setSigning(true)
    try {
      await signDocument(params.id, signText.trim())
      const updated = await fetchDocument(params.id)
      setDoc(updated)
      setSignText('')
    } catch {
      // ignore
    } finally {
      setSigning(false)
    }
  }

  const handleDelete = async () => {
    if (!params.id || !confirm(t('documents_detail.delete_confirm'))) return
    try {
      await deleteDocument(params.id)
      router.push('/documents')
      router.refresh()
    } catch {
      // ignore
    }
  }

  const handleDownload = useCallback(async () => {
    if (!params.id || !doc) return
    setDownloading(true)
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('guardian_token') : null
      const res = await fetch(getDocumentFileUrl(params.id), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) throw new Error('Download failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = doc.file_name || doc.title || 'document'
      a.click()
      URL.revokeObjectURL(url)
      const stamp = new Date().toISOString()
      setLastDownloadedAt(stamp)
      try {
        localStorage.setItem(`dochub_downloaded_${params.id}`, stamp)
      } catch {
        // ignore
      }
    } catch {
      // ignore
    } finally {
      setDownloading(false)
    }
  }, [params.id, doc])

  const handleToggleSaveLocal = () => {
    if (!params.id || typeof window === 'undefined') return
    try {
      const raw = localStorage.getItem('dochub_saved_ids')
      const list = raw ? (JSON.parse(raw) as string[]) : []
      let next: string[]
      if (list.includes(params.id)) {
        next = list.filter((x) => x !== params.id)
      } else {
        next = [...list, params.id]
      }
      localStorage.setItem('dochub_saved_ids', JSON.stringify(next.slice(-500)))
      setSavedLocally(next.includes(params.id))
      setActionHint(next.includes(params.id) ? t('documents_detail.saved_local') : t('documents_detail.removed_local'))
    } catch {
      // ignore
    }
  }

  const copyCurrentLink = useCallback(async () => {
    if (typeof window === 'undefined') return
    try {
      await navigator.clipboard.writeText(window.location.href)
      setActionHint(t('documents_hub.hint_link_copied'))
    } catch {
      // ignore
    }
  }, [t])

  const shareDocument = async () => {
    if (typeof window === 'undefined') return
    const payload = { title: doc?.title || t('documents_detail.document'), text: doc?.description || t('documents_detail.document_from_bolh'), url: window.location.href }
    try {
      if (navigator.share) {
        await navigator.share(payload)
        return
      }
      await navigator.clipboard.writeText(`${payload.title}\n${payload.url}`)
      setActionHint(t('documents_detail.share_copied'))
    } catch {
      // ignore
    }
  }

  const openInNewTab = async () => {
    if (!params.id) return
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('guardian_token') : null
      const res = await fetch(getDocumentFileUrl(params.id), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) return
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank', 'noopener,noreferrer')
      setTimeout(() => URL.revokeObjectURL(url), 15000)
      setActionHint(t('documents_detail.opened_new_tab'))
    } catch {
      // ignore
    }
  }

  const sendByEmail = async () => {
    if (typeof window === 'undefined') return
    const subject = encodeURIComponent(`${t('documents_detail.document')}: ${doc?.title || t('documents_detail.file')}`)
    const body = encodeURIComponent(`${t('documents_detail.document_link')}:\n${window.location.href}`)
    window.location.href = `mailto:?subject=${subject}&body=${body}`
  }

  const printPage = () => {
    if (typeof window === 'undefined') return
    window.print()
  }

  const copyMetadata = async () => {
    if (!doc) return
    const meta = {
      id: doc.id,
      title: doc.title,
      file_name: doc.file_name,
      doc_type: doc.doc_type,
      status: doc.status,
      size: doc.file_size,
      mime_type: doc.mime_type,
      created_at: doc.created_at,
      updated_at: doc.updated_at,
      expires_at: doc.expires_at || null,
      version: doc.version,
    }
    try {
      await navigator.clipboard.writeText(JSON.stringify(meta, null, 2))
      setActionHint(t('documents_detail.metadata_copied'))
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    if (!actionHint) return
    const timer = setTimeout(() => setActionHint(''), 1800)
    return () => clearTimeout(timer)
  }, [actionHint])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'd') {
        e.preventDefault()
        handleDownload()
      }
      if (e.key.toLowerCase() === 'c') {
        e.preventDefault()
        copyCurrentLink()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleDownload, copyCurrentLink])

  if (!user) {
    return (
      <div className="min-h-screen bg-[#1a1b26] text-white flex items-center justify-center">
        <Link href="/login" className="text-violet-400 hover:underline">{t('auth.login_btn')}</Link>
      </div>
    )
  }

  if (loading || !doc) {
    return (
      <div className="min-h-screen bg-[#1a1b26] text-white pb-24 flex items-center justify-center">
        {!loading && !doc ? (
          <div className="text-center">
            <p className="text-white/60">{t('documents_detail.not_found')}</p>
            <Link href="/documents" className="text-violet-400 mt-2 inline-block">{t('documents_detail.back_to_list')}</Link>
          </div>
        ) : (
          <div className="animate-pulse w-full max-w-lg px-4 space-y-4">
            <div className="h-48 rounded-xl bg-white/10" />
            <div className="h-6 rounded bg-white/10 w-3/4" />
            <div className="h-4 rounded bg-white/10 w-1/2" />
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#1a1b26] text-white pb-24">
      <header className="sticky top-0 z-10 border-b border-white/10 bg-[#1a1b26]/95 backdrop-blur">
        <div className="flex items-center gap-2 px-4 py-3">
          <Link href="/documents" className="p-2 rounded-lg hover:bg-white/10 min-h-[44px] min-w-[44px] flex items-center justify-center">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-lg font-semibold truncate flex-1">{doc.title}</h1>
        </div>
      </header>
      <main className="mx-auto max-w-lg px-4 py-6 space-y-6">
        <div className="rounded-2xl bg-white/10 p-6 flex flex-col items-center gap-3">
          <div className="h-16 w-16 rounded-xl bg-white/10 flex items-center justify-center">
            <FileText className="h-8 w-8 text-white/60" />
          </div>
          <p className="font-medium text-center">{doc.title}</p>
          <p className="text-sm text-white/50">{doc.doc_type} · {formatSize(doc.file_size)}</p>
          {doc.status === 'signed' && (
            <span className="rounded bg-green-500/20 text-green-300 text-sm px-3 py-1">
              {t('documents_hub.signed')}{doc.signed_by ? ` · ${formatDate(doc.signature_date, locale)}` : ''}
            </span>
          )}
          {savedLocally && (
            <span className="rounded bg-violet-500/20 text-violet-200 text-xs px-2.5 py-1">
              {t('documents_detail.saved_in_favorites')}
            </span>
          )}
          {actionHint ? (
            <span className="rounded bg-emerald-500/20 text-emerald-200 text-xs px-2.5 py-1">{actionHint}</span>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-white/5 p-3">
            <p className="text-xs text-white/50">{t('documents_detail.created')}</p>
            <p className="text-sm">{formatDate(doc.created_at, locale)}</p>
          </div>
          <div className="rounded-xl bg-white/5 p-3">
            <p className="text-xs text-white/50">{t('documents_detail.version')}</p>
            <p className="text-sm">{doc.version}</p>
          </div>
          <div className="rounded-xl bg-white/5 p-3">
            <p className="text-xs text-white/50">MIME</p>
            <p className="text-sm truncate">{doc.mime_type || 'unknown'}</p>
          </div>
          <div className="rounded-xl bg-white/5 p-3">
            <p className="text-xs text-white/50">{t('documents_detail.last_updated')}</p>
            <p className="text-sm">{formatDate(doc.updated_at, locale)}</p>
          </div>
        </div>

        {doc.description && (
          <div>
            <p className="text-xs font-medium text-white/50 uppercase mb-1">{t('order_detail.description')}</p>
            <p className="text-sm text-white/80">{doc.description}</p>
          </div>
        )}

        {doc.status !== 'signed' && (
          <div className="rounded-xl bg-white/10 p-4 space-y-2">
            <p className="text-sm font-medium">{t('documents_detail.e_signature')}</p>
            <input
              type="text"
              value={signText}
              onChange={(e) => setSignText(e.target.value)}
              placeholder={t('documents_detail.enter_signature')}
              className="w-full rounded-lg bg-white/10 px-3 py-2 text-white placeholder:text-white/40 text-sm"
            />
            <button
              type="button"
              onClick={handleSign}
              disabled={signing || !signText.trim()}
              className="flex items-center gap-2 rounded-lg bg-violet-600 py-2 px-4 text-sm text-white disabled:opacity-50"
            >
              <PenLine className="h-4 w-4" />
              {t('documents_detail.sign')}
            </button>
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-white/10 py-3 text-white/80 text-sm disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            {downloading ? t('documents_hub.downloading') : t('documents_hub.download')}
          </button>
          <button
            type="button"
            onClick={openInNewTab}
            className="flex items-center justify-center gap-2 rounded-xl bg-white/10 py-3 px-3 text-white/80 text-sm"
            title={t('documents_detail.open_new_tab')}
          >
            <ExternalLink className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={shareDocument}
            className="flex items-center justify-center gap-2 rounded-xl bg-white/10 py-3 px-3 text-white/80 text-sm"
            title={t('documents_detail.send')}
          >
            <Share2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={copyCurrentLink}
            className="flex items-center justify-center gap-2 rounded-xl bg-white/10 py-3 px-3 text-white/80 text-sm"
            title={t('documents_hub.copy_link')}
          >
            <Copy className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleToggleSaveLocal}
            className={`flex items-center justify-center gap-2 rounded-xl py-3 px-3 text-sm ${savedLocally ? 'bg-violet-600/70 text-white' : 'bg-white/10 text-white/80'}`}
            title={t('documents_detail.save_local')}
          >
            <Star className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={printPage}
            className="flex items-center justify-center gap-2 rounded-xl bg-white/10 py-3 px-3 text-white/80 text-sm"
            title={t('documents_detail.print')}
          >
            <Printer className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={copyMetadata}
            className="flex items-center justify-center gap-2 rounded-xl bg-white/10 py-3 px-3 text-white/80 text-sm"
            title={t('documents_detail.copy_metadata')}
          >
            <ClipboardList className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="flex items-center justify-center gap-2 rounded-xl bg-red-500/20 text-red-300 py-3 px-4 text-sm"
          >
            <Trash2 className="h-4 w-4" />
            {t('plugin_detail.delete')}
          </button>
        </div>

        <div className="rounded-xl bg-white/5 border border-white/10 p-3 text-xs text-white/70 space-y-2">
          <p>{t('documents_detail.quick_actions')}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={sendByEmail} className="rounded-lg bg-white/10 px-3 py-1.5 flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5" />
              {t('documents_detail.send_by_email')}
            </button>
            {lastDownloadedAt && <span className="rounded-lg bg-white/10 px-3 py-1.5">{t('documents_detail.last_download')}: {formatDate(lastDownloadedAt, locale)}</span>}
            <span className="rounded-lg bg-white/10 px-3 py-1.5">ID: {doc.id.slice(0, 8)}...</span>
            <span className="rounded-lg bg-white/10 px-3 py-1.5">MIME: {doc.mime_type || 'unknown'}</span>
            {doc.expires_at ? <span className="rounded-lg bg-white/10 px-3 py-1.5">{t('documents_detail.expires')}: {formatDate(doc.expires_at, locale)}</span> : null}
            <span className="rounded-lg bg-white/10 px-3 py-1.5">{t('documents_detail.hotkeys')}</span>
          </div>
        </div>
      </main>
      <BOLHNav current="profile" />
    </div>
  )
}
