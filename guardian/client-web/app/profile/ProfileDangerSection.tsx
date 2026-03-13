'use client'

import Link from 'next/link'
import { Trash2 } from 'lucide-react'
import { useLocale } from '@/context/LocaleContext'

export function ProfileDangerSection() {
  const { t } = useLocale()

  return (
    <section>
      <p className="mb-2 px-1 text-[11px] font-medium uppercase tracking-wide text-red-200/80">
        {t('profile.delete_account')}
      </p>
      <Link href="/profile/delete" className="rounded-xl bg-red-500/20 border border-red-400/70 px-4 py-3.5 flex items-center justify-between text-red-200 hover:bg-red-500/30 transition-colors">
        <span className="flex items-center gap-3">
          <Trash2 className="h-5 w-5" />
          {t('profile.delete_account')}
        </span>
        <span className="text-red-100/80">›</span>
      </Link>
    </section>
  )
}
