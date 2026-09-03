'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { MapPin, Shield, User } from 'lucide-react'
import { useLocale } from '@/context/LocaleContext'
import { MobileNav } from '@/components/MobileNav'

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

  return <MobileNav items={[
    { href: '/booking', label: t('navigation.home'), icon: Shield, active: current === 'booking' },
    { href: '/map', label: t('navigation.map'), icon: MapPin, active: current === 'map' },
    { href: '/profile', label: t('navigation.profile'), icon: User, active: current === 'profile' },
  ]} />
}
