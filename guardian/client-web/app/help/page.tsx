'use client'

import Link from 'next/link'
import { ChevronLeft, HelpCircle } from 'lucide-react'
import { useLocale } from '@/context/LocaleContext'

export default function HelpPage() {
  const { t } = useLocale()

  return (
    <div className="min-h-screen bg-[#1a1b26] text-white pb-8">
      <header className="sticky top-0 z-10 border-b border-white/10 bg-[#1a1b26]/95 backdrop-blur">
        <div className="flex items-center gap-2 px-4 py-3">
          <Link href="/profile" className="p-2 rounded-lg hover:bg-white/10">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-lg font-semibold">{t('help.title')}</h1>
        </div>
      </header>
      <main className="mx-auto max-w-lg px-4 py-6 space-y-4">
        <div className="rounded-2xl bg-white/10 p-6 flex flex-col gap-3">
          <HelpCircle className="h-12 w-12 text-violet-400" />
          <p className="text-white/80">{t('help.subtitle')}</p>
          <ul className="list-disc list-inside text-white/70 text-sm space-y-1">
            <li>{t('help.faq_order')}</li>
            <li>{t('help.faq_contact_guard')}</li>
            <li>{t('help.faq_cancel')}</li>
          </ul>
          <p className="text-white/60 text-sm pt-2">{t('help.contact')}</p>
        </div>
      </main>
    </div>
  )
}
