'use client'

import Link from 'next/link'
import { LogOut } from 'lucide-react'

type Props = {
  showLogoutConfirm: boolean
  setShowLogoutConfirm: (value: boolean) => void
  handleLogout: () => void
}

export function ProfileLogoutSection({ showLogoutConfirm, setShowLogoutConfirm, handleLogout }: Props) {
  return (
    <>
      {showLogoutConfirm ? (
        <div className="rounded-xl bg-white/10 border border-violet-400 p-4 space-y-3">
          <p className="text-white/90 text-center">Sign out?</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setShowLogoutConfirm(false)} className="flex-1 rounded-xl bg-white/10 border border-violet-400 py-3 text-white">
              Cancel
            </button>
            <button type="button" onClick={handleLogout} className="flex-1 rounded-xl bg-red-500/30 py-3 text-red-300 font-medium">
              Sign out
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleLogout}
          className="w-full rounded-xl bg-red-500/20 border border-red-400/50 py-3.5 text-red-300 hover:bg-red-500/30 flex items-center justify-center gap-2 font-medium min-h-[44px]"
        >
          <LogOut className="h-5 w-5" />
          Sign out
        </button>
      )}

      <Link href="/profile/about" className="block text-center text-xs text-white/40 hover:text-white/60">
        BOLH v2.1.0
      </Link>
    </>
  )
}

