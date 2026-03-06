'use client'

import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { useLocale } from '@/context/LocaleContext'

export default function PrivacyPage() {
  const { t } = useLocale()

  return (
    <div className="min-h-screen bg-[#1a1b26] text-white pb-8">
      <header className="sticky top-0 z-10 border-b border-white/10 bg-[#1a1b26]/95 backdrop-blur">
        <div className="flex items-center gap-2 px-4 py-3">
          <Link href="/booking" className="p-2 rounded-lg hover:bg-white/10 min-h-[44px] min-w-[44px] flex items-center justify-center">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-lg font-semibold">{t('legal.privacy_title')}</h1>
        </div>
      </header>
      <main className="mx-auto max-w-lg px-4 py-6 space-y-4 text-sm">
        <p className="text-white/60">{t('legal.last_updated')}</p>
        <section className="rounded-xl border border-white/10 bg-white/5 p-4">
          <h2 className="text-base font-semibold mb-2">{t('legal.privacy_collect_title')}</h2>
          <p className="text-white/80">
            {t('legal.privacy_collect_text')}
          </p>
        </section>
        <section className="rounded-xl border border-white/10 bg-white/5 p-4">
          <h2 className="text-base font-semibold mb-2">{t('legal.privacy_use_title')}</h2>
          <p className="text-white/80">
            {t('legal.privacy_use_text')}
          </p>
        </section>
        <section className="rounded-xl border border-white/10 bg-white/5 p-4">
          <h2 className="text-base font-semibold mb-2">{t('legal.privacy_security_title')}</h2>
          <p className="text-white/80">
            {t('legal.privacy_security_text')}
          </p>
        </section>
        <section className="rounded-xl border border-white/10 bg-white/5 p-4">
          <h2 className="text-base font-semibold mb-2">{t('legal.privacy_delete_title')}</h2>
          <p className="text-white/80">
            {t('legal.privacy_delete_text')}
          </p>
        </section>
        <p className="text-white/60">
          {t('legal.contact')}
        </p>
      </main>
    </div>
  )
}
