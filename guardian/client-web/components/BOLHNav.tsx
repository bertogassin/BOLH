'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { MapPin, Shield, User } from 'lucide-react'

type Tab = 'booking' | 'map' | 'profile'

export function BOLHNav({ current }: { current: Tab }) {
  const router = useRouter()

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
          className={`flex flex-col items-center gap-1 min-w-[44px] min-h-[44px] justify-center ${current === 'booking' ? 'text-violet-400 border-b-2 border-violet-400 pb-0.5' : 'text-white/50 hover:text-white'}`}
        >
          <Shield className="h-5 w-5" />
          <span className="text-xs font-medium">Home</span>
        </Link>
        <Link
          href="/map"
          className={`flex flex-col items-center gap-1 min-w-[44px] min-h-[44px] justify-center ${current === 'map' ? 'text-violet-400 border-b-2 border-violet-400 pb-0.5' : 'text-white/50 hover:text-white'}`}
        >
          <MapPin className="h-5 w-5" />
          <span className="text-xs font-medium">Map</span>
        </Link>
        <Link
          href="/profile"
          className={`flex flex-col items-center gap-1 min-w-[44px] min-h-[44px] justify-center ${current === 'profile' ? 'text-violet-400 border-b-2 border-violet-400 pb-0.5' : 'text-white/50 hover:text-white'}`}
        >
          <User className="h-5 w-5" />
          <span className="text-xs font-medium">Profile</span>
        </Link>
      </div>
    </nav>
  )
}
