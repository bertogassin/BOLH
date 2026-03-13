'use client'

import Link from 'next/link'
import { LogOut } from 'lucide-react'
import { useLocale } from '@/context/LocaleContext'

type Props = {
  showLogoutConfirm: boolean
  setShowLogoutConfirm: (value: boolean) => void
  handleLogout: () => void
}

export function ProfileLogoutSection({ showLogoutConfirm, setShowLogoutConfirm, handleLogout }: Props) {
  const { t } = useLocale()

  return (
    <>
      {showLogoutConfirm ? (
        <div className="rounded-xl bg-amber-500/10 border border-amber-300/40 p-4 space-y-3">
          <p className="text-white/90 text-center">{t('profile_logout.confirm_title')}</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setShowLogoutConfirm(false)} className="flex-1 rounded-xl bg-white/10 border border-violet-400 py-3 text-white">
              {t('actions.cancel')}
            </button>
            <button type="button" onClick={handleLogout} className="flex-1 rounded-xl bg-amber-500/25 border border-amber-300/40 py-3 text-amber-200 font-medium hover:bg-amber-500/35 transition-colors">
              {t('profile_logout.sign_out')}
            </button>
          </div>
        </div>
      ) : (
        <section>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full rounded-xl bg-amber-500/12 border border-amber-300/35 py-3.5 text-amber-100 hover:bg-amber-500/20 transition-colors flex items-center justify-center gap-2 font-medium min-h-[44px]"
          >
            <LogOut className="h-5 w-5" />
            {t('profile_logout.sign_out')}
          </button>
        </section>
      )}

      <Link href="/profile/about" className="mt-2 block text-center text-xs text-white/40 hover:text-white/60">
        BOLH v2.1.0
      </Link>
    </>
  )
}

