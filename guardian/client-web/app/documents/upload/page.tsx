'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Upload, FileText } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { uploadDocument } from '@/lib/api'
import { BOLHNav } from '@/components/BOLHNav'

const DOC_TYPES = [
  { value: 'document', label: 'Документ' },
  { value: 'passport', label: 'Паспорт' },
  { value: 'contract', label: 'Договор' },
  { value: 'receipt', label: 'Чек' },
  { value: 'invoice', label: 'Счёт' },
  { value: 'daily_report', label: 'Ежедневный отчёт' },
  { value: 'incident_report', label: 'Отчёт о происшествии' },
]

export default function DocumentUploadPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [docType, setDocType] = useState('document')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!file) {
      setError('Выберите файл')
      return
    }
    setLoading(true)
    try {
      await uploadDocument(file, docType)
      router.push('/documents')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки')
    } finally {
      setLoading(false)
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#1a1b26] text-white flex items-center justify-center">
        <Link href="/login" className="text-violet-400 hover:underline">Войти</Link>
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
          <h1 className="text-lg font-semibold">Загрузить документ</h1>
        </div>
      </header>
      <main className="mx-auto max-w-lg px-4 py-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-xl bg-red-500/20 border border-red-500/40 p-3 text-sm text-red-200">{error}</div>
          )}
          <div>
            <label className="block text-xs font-medium text-white/60 uppercase mb-1">Тип документа</label>
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              className="w-full rounded-xl bg-white/10 px-4 py-3 text-white outline-none border border-white/10 focus:border-violet-400 min-h-[44px]"
            >
              {DOC_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-white/60 uppercase mb-1">Файл</label>
            <label className="flex flex-col items-center justify-center w-full rounded-xl border-2 border-dashed border-white/20 bg-white/5 py-8 hover:bg-white/10 cursor-pointer">
              <Upload className="h-10 w-10 text-white/50 mb-2" />
              <span className="text-sm text-white/70">
                {file ? file.name : 'Нажмите или перетащите файл'}
              </span>
              <span className="text-xs text-white/40 mt-1">PDF, изображения, Word</span>
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
            {loading ? 'Загрузка...' : 'Загрузить'}
          </button>
        </form>
      </main>
      <BOLHNav current="profile" />
    </div>
  )
}
