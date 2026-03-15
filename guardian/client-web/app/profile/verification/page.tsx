'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ChevronLeft, ShieldCheck, Upload, RefreshCw, CheckCircle2, Clock3, AlertTriangle } from 'lucide-react'
import { useLocale } from '@/context/LocaleContext'
import { useAuth } from '@/context/AuthContext'
import { BOLHNav } from '@/components/BOLHNav'
import { fetchVerificationStatus, submitVerification } from '@/lib/api'

const MAX_VERIFY_FILE_BYTES = 8 * 1024 * 1024
const ALLOWED_VERIFY_EXTENSIONS = new Set(['pdf', 'jpg', 'jpeg', 'png', 'webp'])

type GuardDocumentsForm = {
  proCardNumber: string
  licenseNumber: string
  idDocumentNumber: string
  proCardExpiry: string
  certifications: string
  notes: string
  proCardFileName: string
}

function getFileExtension(name: string): string {
  const idx = name.lastIndexOf('.')
  if (idx < 0) return ''
  return name.slice(idx + 1).toLowerCase()
}

export default function VerificationPage() {
  const { t } = useLocale()
  const { user } = useAuth()
  const [status, setStatus] = useState<Awaited<ReturnType<typeof fetchVerificationStatus>> | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [fileName, setFileName] = useState('')
  const [docBase64, setDocBase64] = useState('')
  const [proDocBase64, setProDocBase64] = useState('')
  const [guardDocs, setGuardDocs] = useState<GuardDocumentsForm>({
    proCardNumber: '',
    licenseNumber: '',
    idDocumentNumber: '',
    proCardExpiry: '',
    certifications: '',
    notes: '',
    proCardFileName: '',
  })
  const [guardDocsError, setGuardDocsError] = useState('')
  const [guardDocsSaved, setGuardDocsSaved] = useState(false)

  const guardDocsStorageKey = `guardian_guard_docs_${user?.id || 'guest'}`

  const loadStatus = useCallback(async () => {
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
  }, [t])

  useEffect(() => {
    loadStatus()
  }, [loadStatus])

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(guardDocsStorageKey)
      if (!raw) return
      const parsed = JSON.parse(raw) as Partial<GuardDocumentsForm>
      setGuardDocs((prev) => ({
        ...prev,
        proCardNumber: String(parsed.proCardNumber || ''),
        licenseNumber: String(parsed.licenseNumber || ''),
        idDocumentNumber: String(parsed.idDocumentNumber || ''),
        proCardExpiry: String(parsed.proCardExpiry || ''),
        certifications: String(parsed.certifications || ''),
        notes: String(parsed.notes || ''),
        proCardFileName: String(parsed.proCardFileName || ''),
      }))
    } catch {
      // ignore localStorage parse errors
    }
  }, [guardDocsStorageKey])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    setSuccess('')
    setFileName(file.name)
    const ext = getFileExtension(file.name)
    if (!ALLOWED_VERIFY_EXTENSIONS.has(ext)) {
      setDocBase64('')
      setError('Unsupported document format. Allowed: PDF, JPG, PNG, WEBP.')
      return
    }
    if (file.size <= 0 || file.size > MAX_VERIFY_FILE_BYTES) {
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

  const handleProCardFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setGuardDocsError('')
    setGuardDocsSaved(false)
    const ext = getFileExtension(file.name)
    if (!ALLOWED_VERIFY_EXTENSIONS.has(ext)) {
      setProDocBase64('')
      setGuardDocsError('Unsupported document format. Allowed: PDF, JPG, PNG, WEBP.')
      return
    }
    if (file.size <= 0 || file.size > MAX_VERIFY_FILE_BYTES) {
      setProDocBase64('')
      setGuardDocsError(t('verification.file_too_large'))
      return
    }
    setGuardDocs((prev) => ({ ...prev, proCardFileName: file.name }))
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
      setProDocBase64(asBase64)
    } catch (e) {
      setProDocBase64('')
      setGuardDocsError(e instanceof Error ? e.message : t('verification.prepare_failed'))
    }
  }

  const handleSaveGuardDocs = () => {
    setGuardDocsError('')
    setGuardDocsSaved(false)
    if (guardDocs.proCardNumber.trim().length < 4) {
      setGuardDocsError(t('verification.pro_card_required'))
      return
    }
    try {
      window.localStorage.setItem(guardDocsStorageKey, JSON.stringify(guardDocs))
      setGuardDocsSaved(true)
    } catch {
      setGuardDocsError(t('verification.prepare_failed'))
    }
  }

  const handleSubmit = async () => {
    const verificationPayload = docBase64 || proDocBase64
    if (!verificationPayload) {
      setError(t('verification.select_document_first'))
      return
    }
    setSubmitting(true)
    setError('')
    setSuccess('')
    try {
      await submitVerification(verificationPayload)
      setSuccess(t('verification.submitted'))
      setDocBase64('')
      setProDocBase64('')
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
              <div className="rounded-xl border border-violet-400/60 bg-white/5 p-3 space-y-3">
                <h2 className="text-sm font-semibold text-white">{t('verification.guard_docs_title')}</h2>
                <p className="text-xs text-white/70">{t('verification.guard_docs_hint')}</p>
                <div className="grid grid-cols-1 gap-2">
                  <input
                    value={guardDocs.proCardNumber}
                    onChange={(e) => {
                      setGuardDocsSaved(false)
                      setGuardDocs((prev) => ({ ...prev, proCardNumber: e.target.value.toUpperCase() }))
                    }}
                    placeholder={t('verification.pro_card_number')}
                    className="theme-input w-full rounded-xl border border-violet-400 px-3 py-3 text-sm text-white placeholder:text-white/40 outline-none min-h-[44px]"
                  />
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <input
                      value={guardDocs.licenseNumber}
                      onChange={(e) => {
                        setGuardDocsSaved(false)
                        setGuardDocs((prev) => ({ ...prev, licenseNumber: e.target.value.toUpperCase() }))
                      }}
                      placeholder={t('verification.license_number')}
                      className="theme-input w-full rounded-xl border border-violet-400 px-3 py-3 text-sm text-white placeholder:text-white/40 outline-none min-h-[44px]"
                    />
                    <input
                      value={guardDocs.idDocumentNumber}
                      onChange={(e) => {
                        setGuardDocsSaved(false)
                        setGuardDocs((prev) => ({ ...prev, idDocumentNumber: e.target.value.toUpperCase() }))
                      }}
                      placeholder={t('verification.id_document_number')}
                      className="theme-input w-full rounded-xl border border-violet-400 px-3 py-3 text-sm text-white placeholder:text-white/40 outline-none min-h-[44px]"
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <input
                      value={guardDocs.proCardExpiry}
                      onChange={(e) => {
                        setGuardDocsSaved(false)
                        setGuardDocs((prev) => ({ ...prev, proCardExpiry: e.target.value }))
                      }}
                      placeholder={t('verification.pro_card_expiry')}
                      className="theme-input w-full rounded-xl border border-violet-400 px-3 py-3 text-sm text-white placeholder:text-white/40 outline-none min-h-[44px]"
                    />
                    <input
                      value={guardDocs.certifications}
                      onChange={(e) => {
                        setGuardDocsSaved(false)
                        setGuardDocs((prev) => ({ ...prev, certifications: e.target.value }))
                      }}
                      placeholder={t('verification.certifications')}
                      className="theme-input w-full rounded-xl border border-violet-400 px-3 py-3 text-sm text-white placeholder:text-white/40 outline-none min-h-[44px]"
                    />
                  </div>
                  <textarea
                    value={guardDocs.notes}
                    onChange={(e) => {
                      setGuardDocsSaved(false)
                      setGuardDocs((prev) => ({ ...prev, notes: e.target.value }))
                    }}
                    placeholder={t('verification.notes')}
                    rows={2}
                    className="theme-input w-full rounded-xl border border-violet-400 px-3 py-3 text-sm text-white placeholder:text-white/40 outline-none resize-none"
                  />
                </div>

                <label className="flex items-center justify-center gap-2 rounded-xl border border-violet-400 bg-white/10 hover:bg-white/15 px-3 py-3 cursor-pointer min-h-[44px]">
                  <Upload className="h-4 w-4" />
                  <span className="text-sm font-medium">
                    {guardDocs.proCardFileName ? t('verification.pro_card_selected') : t('verification.pro_card_upload')}
                  </span>
                  <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={handleProCardFileChange} />
                </label>
                {guardDocs.proCardFileName ? <p className="text-xs text-white/70 truncate">{guardDocs.proCardFileName}</p> : null}

                <button
                  type="button"
                  onClick={handleSaveGuardDocs}
                  className="w-full rounded-xl bg-white/10 hover:bg-white/15 border border-violet-400 py-3 font-medium text-white min-h-[44px]"
                >
                  {t('verification.save_guard_docs')}
                </button>

                {guardDocsSaved ? <p className="text-xs text-green-300">{t('verification.guard_docs_saved')}</p> : null}
                {guardDocsError ? <p className="text-xs text-red-300">{guardDocsError}</p> : null}
              </div>

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
