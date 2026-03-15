'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Upload, FileText } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useLocale } from '@/context/LocaleContext'
import { uploadDocument } from '@/lib/api'
import { BOLHNav } from '@/components/BOLHNav'

const DOC_TYPES = [
  { value: 'document', labelKey: 'documents_upload.type_document' },
  { value: 'passport', labelKey: 'documents_upload.type_passport' },
  { value: 'contract', labelKey: 'documents_upload.type_contract' },
  { value: 'receipt', labelKey: 'documents_upload.type_receipt' },
  { value: 'invoice', labelKey: 'documents_upload.type_invoice' },
  { value: 'daily_report', labelKey: 'documents_upload.type_daily_report' },
  { value: 'incident_report', labelKey: 'documents_upload.type_incident_report' },
]

export default function DocumentUploadPage() {
  const { user } = useAuth()
  const { t } = useLocale()
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [docType, setDocType] = useState('document')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!file) {
      setError(t('documents_upload.select_file_error'))
      return
    }
    setLoading(true)
    try {
      await uploadDocument(file, docType)
      router.push('/documents')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('documents_upload.upload_error'))
    } finally {
      setLoading(false)
    }
  }

  if (!user) {
    return (
      <div className="theme-page min-h-screen text-white flex items-center justify-center">
        <Link href="/login" className="text-violet-400 hover:underline">{t('auth.login_btn')}</Link>
      </div>
    )
  }

  return (
    <div className="theme-page min-h-screen text-white pb-24">
      <header className="theme-header sticky top-0 z-10 border-b border-white/10 backdrop-blur">
        <div className="flex items-center gap-2 px-4 py-3">
          <Link href="/documents" className="p-2 rounded-lg hover:bg-white/10 min-h-[44px] min-w-[44px] flex items-center justify-center">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-lg font-semibold">{t('documents_upload.title')}</h1>
        </div>
      </header>
      <main className="mx-auto max-w-lg px-4 py-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-xl bg-red-500/20 border border-red-500/40 p-3 text-sm text-red-200">{error}</div>
          )}
          <div>
            <label className="block text-xs font-medium text-white/60 uppercase mb-1">{t('documents_upload.document_type')}</label>
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              className="w-full rounded-xl bg-white/10 px-4 py-3 text-white outline-none border border-white/10 focus:border-violet-400 min-h-[44px]"
            >
              {DOC_TYPES.map((item) => (
                <option key={item.value} value={item.value}>
                  {t(item.labelKey)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-white/60 uppercase mb-1">{t('documents_upload.file')}</label>
            <label className="flex flex-col items-center justify-center w-full rounded-xl border-2 border-dashed border-white/20 bg-white/5 py-8 hover:bg-white/10 cursor-pointer">
              <Upload className="h-10 w-10 text-white/50 mb-2" />
              <span className="text-sm text-white/70">
                {file ? file.name : t('documents_upload.click_or_drop')}
              </span>
              <span className="text-xs text-white/40 mt-1">{t('documents_upload.file_types_hint')}</span>
              <input
                type="file"
                className="hidden"
                accept=".pdf,.jpg,.jpeg,.png,.gif,.doc,.docx"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>
          <button
            type="submit"
            disabled={loading || !file}
            className="w-full rounded-xl bg-violet-600 hover:bg-violet-500 py-3.5 font-medium text-white min-h-[44px] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <FileText className="h-5 w-5" />
            {loading ? t('documents_upload.uploading') : t('documents_upload.upload')}
          </button>
        </form>
      </main>
      <BOLHNav current="profile" />
    </div>
  )
}
