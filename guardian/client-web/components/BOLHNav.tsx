'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { MapPin, Shield, User } from 'lucide-react'
import { useLocale } from '@/context/LocaleContext'

type Tab = 'booking' | 'map' | 'profile'

export function BOLHNav({ current }: { current: Tab }) {
  const router = useRouter()
  const { t } = useLocale()

  useEffect(() => {
    const run = () => {
      router.prefetch('/booking')
      router.prefetch('/map')
      router.prefetch('/profile')
      // Warm up the heaviest route chunk for faster map screen entry.
      void import('@/components/MapView')
    }
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void) => number
      cancelIdleCallback?: (id: number) => void
    }
    const idle = w.requestIdleCallback
    if (idle) {
      const id = idle(run)
      return () => w.cancelIdleCallback?.(id)
    }
    const t = window.setTimeout(run, 180)
    return () => window.clearTimeout(t)
  }, [router])

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-20 border-t border-white/10 bg-[#1a1b26]/95 backdrop-blur safe-area-pb">
      <div className="flex justify-around py-3">
        <Link
          href="/booking"
          className={`group flex flex-col items-center gap-1 min-w-[44px] min-h-[44px] justify-center rounded-xl px-3 py-1.5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 ${
            current === 'booking'
              ? 'text-violet-200 bg-violet-500/25 border border-violet-400/70'
              : 'text-white/70 hover:text-white hover:bg-white/10 border border-transparent'
          }`}
        >
          <Shield className={`h-5 w-5 ${current === 'booking' ? 'text-violet-300' : 'text-white/80 group-hover:text-white'}`} />
          <span className="text-xs font-medium">{t('navigation.home')}</span>
        </Link>
        <Link
          href="/map"
          className={`group flex flex-col items-center gap-1 min-w-[44px] min-h-[44px] justify-center rounded-xl px-3 py-1.5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 ${
            current === 'map'
              ? 'text-violet-200 bg-violet-500/25 border border-violet-400/70'
              : 'text-white/70 hover:text-white hover:bg-white/10 border border-transparent'
          }`}
        >
          <MapPin className={`h-5 w-5 ${current === 'map' ? 'text-violet-300' : 'text-white/80 group-hover:text-white'}`} />
          <span className="text-xs font-medium">{t('navigation.map')}</span>
        </Link>
        <Link
          href="/profile"
          className={`group flex flex-col items-center gap-1 min-w-[44px] min-h-[44px] justify-center rounded-xl px-3 py-1.5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 ${
            current === 'profile'
              ? 'text-violet-200 bg-violet-500/25 border border-violet-400/70'
              : 'text-white/70 hover:text-white hover:bg-white/10 border border-transparent'
          }`}
        >
          <User className={`h-5 w-5 ${current === 'profile' ? 'text-violet-300' : 'text-white/80 group-hover:text-white'}`} />
          <span className="text-xs font-medium">{t('navigation.profile')}</span>
        </Link>
      </div>
    </nav>
  )
}
