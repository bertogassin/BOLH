'use client'

import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useLocale } from '@/context/LocaleContext'
import { BOLHNav } from '@/components/BOLHNav'

export default function ProfileAboutPage() {
  const { user } = useAuth()
  const { t } = useLocale()

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
          <Link href="/profile" className="p-2 rounded-lg hover:bg-white/10 min-h-[44px] min-w-[44px] flex items-center justify-center">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-lg font-semibold">{t('profile_about.title')}</h1>
        </div>
      </header>
      <main className="mx-auto max-w-lg px-4 py-6 space-y-4">
        <p className="text-white/80">BOLH SECURITY v2.1.0</p>
        <p className="text-white/60 text-sm">{t('profile_about.subtitle')}</p>
      </main>
      <BOLHNav current="profile" />
    </div>
  )
}
