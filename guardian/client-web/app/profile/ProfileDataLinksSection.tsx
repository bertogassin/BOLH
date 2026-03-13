'use client'

import Link from 'next/link'
import { Briefcase, Pencil, ShieldCheck } from 'lucide-react'
import { useLocale } from '@/context/LocaleContext'

export function ProfileDataLinksSection() {
  const { t } = useLocale()
  return (
    <section>
      <h2 className="text-sm font-semibold text-white mb-3">{t('profile.my_data')}</h2>
      <div className="space-y-1">
        <Link href="/profile/personal" className="rounded-xl bg-white/10 border border-violet-400 px-4 py-3 flex items-center justify-between text-white hover:bg-white/15">
          <span className="flex items-center gap-3">
            <Pencil className="h-5 w-5 text-white/60" />
            {t('profile.my_data')}
          </span>
          <span className="text-white/40">›</span>
        </Link>
        <Link href="/profile/edit" className="rounded-xl bg-white/10 border border-violet-400 px-4 py-3 flex items-center justify-between text-white hover:bg-white/15">
          <span className="flex items-center gap-3">
            <Briefcase className="h-5 w-5 text-white/60" />
            {t('profile.edit_short')}
          </span>
          <span className="text-white/40">›</span>
        </Link>
        <Link href="/profile/verification" className="rounded-xl bg-white/10 border border-violet-400 px-4 py-3 flex items-center justify-between text-white hover:bg-white/15">
          <span className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-violet-400" />
            {t('profile.verification')}
          </span>
          <span className="text-white/40">›</span>
        </Link>
      </div>
    </section>
  )
}

