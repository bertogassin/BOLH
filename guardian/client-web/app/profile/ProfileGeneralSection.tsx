'use client'

import Link from 'next/link'
import { Bell, FileText, HelpCircle, Settings } from 'lucide-react'

type Props = {
  t: (key: string) => string
}

export function ProfileGeneralSection({ t }: Props) {
  return (
    <section>
      <h2 className="text-sm font-semibold text-white mb-3">{t('profile.general')}</h2>
      <div className="space-y-1">
        <Link href="/documents" className="rounded-xl bg-white/10 border border-violet-400 px-4 py-3 flex items-center justify-between text-white hover:bg-white/15">
          <span className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-white/60" />
            {t('documents_hub.title')}
          </span>
          <span className="text-white/40">›</span>
        </Link>
        <Link href="/notifications" className="rounded-xl bg-white/10 border border-violet-400 px-4 py-3 flex items-center justify-between text-white hover:bg-white/15">
          <span className="flex items-center gap-3">
            <Bell className="h-5 w-5 text-white/60" />
            {t('notifications.title')}
          </span>
          <span className="text-white/40">›</span>
        </Link>
        <Link href="/help" className="rounded-xl bg-white/10 border border-violet-400 px-4 py-3 flex items-center justify-between text-white hover:bg-white/15">
          <span className="flex items-center gap-3">
            <HelpCircle className="h-5 w-5 text-white/60" />
            {t('help.title')}
          </span>
          <span className="text-white/40">›</span>
        </Link>
        <Link href="/settings" className="rounded-xl bg-white/10 border border-violet-400 px-4 py-3 flex items-center justify-between text-white hover:bg-white/15">
          <span className="flex items-center gap-3">
            <Settings className="h-5 w-5 text-white/60" />
            {t('profile.settings')}
          </span>
          <span className="text-white/40">›</span>
        </Link>
      </div>
    </section>
  )
}

