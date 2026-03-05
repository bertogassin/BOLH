'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ChevronLeft, ShieldCheck, Upload, RefreshCw, CheckCircle2, Clock3, AlertTriangle } from 'lucide-react'
import { useLocale } from '@/context/LocaleContext'
import { BOLHNav } from '@/components/BOLHNav'
import { fetchVerificationStatus, submitVerification } from '@/lib/api'

export default function VerificationPage() {
  const { t } = useLocale()
  const [status, setStatus] = useState<Awaited<ReturnType<typeof fetchVerificationStatus>> | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [fileName, setFileName] = useState('')
  const [docBase64, setDocBase64] = useState('')

  const loadStatus = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await fetchVerificationStatus()
      setStatus(data)
    } catch (e) {
      setStatus(null)
      setError(e instanceof Error ? e.message : t('verification.load_failed'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStatus()
  }, [])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    setSuccess('')
    setFileName(file.name)
    if (file.size > 8 * 1024 * 1024) {
      setDocBase64('')
      setError(t('verification.file_too_large'))
      return
    }
    try {
      const asBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const result = typeof reader.result === 'string' ? reader.result : ''
          const commaIndex = result.indexOf(',')
          resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result)
        }
        reader.onerror = () => reject(new Error(t('verification.read_failed')))
        reader.readAsDataURL(file)
      })
      setDocBase64(asBase64)
    } catch (e) {
      setDocBase64('')
      setError(e instanceof Error ? e.message : t('verification.prepare_failed'))
    }
  }

  const handleSubmit = async () => {
    if (!docBase64) {
      setError(t('verification.select_document_first'))
      return
    }
    setSubmitting(true)
    setError('')
    setSuccess('')
    try {
      await submitVerification(docBase64)
      setSuccess(t('verification.submitted'))
      setDocBase64('')
      await loadStatus()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('verification.submit_failed'))
    } finally {
      setSubmitting(false)
    }
  }

  const badge = (() => {
    if (status?.verified) return { text: t('verification.badge_verified'), cls: 'bg-green-500/20 text-green-200 border-green-500/40', icon: CheckCircle2 }
    if (status?.requested && status?.status === 'pending') return { text: t('verification.badge_pending'), cls: 'bg-amber-500/20 text-amber-200 border-amber-500/40', icon: Clock3 }
    if (status?.requested && status?.status === 'rejected') return { text: t('verification.badge_rejected'), cls: 'bg-red-500/20 text-red-200 border-red-500/40', icon: AlertTriangle }
    return { text: t('verification.badge_not_started'), cls: 'bg-violet-500/20 text-violet-200 border-violet-500/40', icon: ShieldCheck }
  })()

  return (
    <div className="min-h-screen bg-[#1a1b26] text-white pb-24">
      <header className="sticky top-0 z-10 border-b border-white/10 bg-[#1a1b26]/95 backdrop-blur">
        <div className="flex items-center gap-2 px-4 py-3">
          <Link href="/profile" className="p-2 rounded-lg hover:bg-white/10 min-h-[44px] min-w-[44px] flex items-center justify-center">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-lg font-semibold">{t('verification.title')}</h1>
        </div>
      </header>
      <main className="mx-auto max-w-lg px-4 py-6">
        <div className="space-y-4">
          <div className="rounded-2xl bg-white/10 p-6 flex flex-col items-center gap-3 border border-violet-400">
            <ShieldCheck className={`h-12 w-12 ${status?.verified ? 'text-green-400' : 'text-violet-400'}`} />
            <div className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold ${badge.cls}`}>
              <badge.icon className="h-4 w-4" />
              {badge.text}
            </div>
            <p className="text-white/80 text-center">
              {status?.verified
                ? t('verification.state_verified')
                : status?.requested && status?.status === 'pending'
                  ? t('verification.state_pending')
                  : status?.requested && status?.status === 'rejected'
                    ? t('verification.state_rejected')
                    : t('verification.state_not_started')}
            </p>
            <button
              type="button"
              onClick={loadStatus}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/15 border border-violet-400 px-3 py-2 text-sm disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              {t('verification.refresh_status')}
            </button>
          </div>

          {!status?.verified && (
            <div className="rounded-2xl bg-white/10 p-4 border border-violet-400 space-y-3">
              <p className="text-sm text-white/80">{t('verification.upload_hint')}</p>
              <label className="flex items-center justify-center gap-2 rounded-xl border border-violet-400 bg-white/10 hover:bg-white/15 px-3 py-3 cursor-pointer min-h-[44px]">
                <Upload className="h-4 w-4" />
                <span className="text-sm font-medium">{fileName ? t('verification.document_selected') : t('verification.select_document')}</span>
                <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={handleFileChange} />
              </label>
              {fileName && <p className="text-xs text-white/70 truncate">{fileName}</p>}
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || !docBase64}
                className="w-full rounded-xl bg-violet-600 hover:bg-violet-500 border border-violet-400 py-3 font-medium text-white disabled:opacity-50 min-h-[44px]"
              >
                {submitting ? t('verification.sending') : t('verification.send_for_review')}
              </button>
            </div>
          )}

          {success && <div className="rounded-xl border border-green-500/40 bg-green-500/20 p-3 text-sm text-green-200">{success}</div>}
          {error && <div className="rounded-xl border border-red-500/40 bg-red-500/20 p-3 text-sm text-red-200">{error}</div>}
        </div>
      </main>
      <BOLHNav current="profile" />
    </div>
  )
}
