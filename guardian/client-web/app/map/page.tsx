'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import { Sparkles, Sun, Moon } from 'lucide-react'
import { fetchOrders, fetchBids } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { useLocale } from '@/context/LocaleContext'
import { useAIChat } from '@/context/AIChatContext'
import { BOLHNav } from '@/components/BOLHNav'

const MapView = dynamic(() => import('@/components/MapView'), {
  ssr: false,
  loading: () => (
    <div className="theme-page h-full min-h-[50vh] flex items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-violet-400 border-t-transparent" />
    </div>
  ),
})

const POLL_INTERVAL_MS = 25000
const MAP_CACHE_TTL_MS = 15000

type MapCacheSnapshot = {
  userId: string
  at: number
  orders: Awaited<ReturnType<typeof fetchOrders>>
  bids: Awaited<ReturnType<typeof fetchBids>>
}

let mapCache: MapCacheSnapshot | null = null

export default function MapPage() {
  const { user } = useAuth()
  const { t } = useLocale()
  const { openChat } = useAIChat()
  const [orders, setOrders] = useState<Awaited<ReturnType<typeof fetchOrders>>>([])
  const [bids, setBids] = useState<Awaited<ReturnType<typeof fetchBids>>>([])
  const [mapTileTheme, setMapTileTheme] = useState<'dark' | 'light'>('dark')
  const [viewportHeight, setViewportHeight] = useState<number | null>(null)
  const inFlightRef = useRef(false)

  const load = useCallback((opts?: { force?: boolean }) => {
    if (!user) {
      setOrders([])
      setBids([])
      mapCache = null
      return
    }
    const force = Boolean(opts?.force)
    const now = Date.now()
    const userId = user.id
    const hasSameUserCache = mapCache?.userId === userId
    const cacheIsFresh = Boolean(hasSameUserCache && mapCache && now - mapCache.at < MAP_CACHE_TTL_MS)

    if (hasSameUserCache && mapCache) {
      // Instant paint from memory cache for fast screen transitions.
      setOrders(mapCache.orders)
      setBids(mapCache.bids)
      if (cacheIsFresh && !force) return
    }
    if (inFlightRef.current) return
    inFlightRef.current = true

    Promise.all([fetchOrders(), fetchBids()])
      .then(([o, b]) => {
        const safeOrders = Array.isArray(o) ? o : []
        const safeBids = Array.isArray(b) ? b : []
        setOrders(safeOrders)
        setBids(safeBids)
        mapCache = { userId, at: Date.now(), orders: safeOrders, bids: safeBids }
      })
      .catch(() => {})
      .finally(() => {
        inFlightRef.current = false
      })
  }, [user])

  useEffect(() => {
    if (!user || typeof document === 'undefined') return
    let intervalId: ReturnType<typeof setInterval> | null = null

    const startPolling = () => {
      if (intervalId) return
      intervalId = setInterval(() => {
        if (!document.hidden) load({ force: true })
      }, POLL_INTERVAL_MS)
    }

    const stopPolling = () => {
      if (!intervalId) return
      clearInterval(intervalId)
      intervalId = null
    }

    const handleVisibility = () => {
      if (document.hidden) {
        stopPolling()
      } else {
        load({ force: true })
        startPolling()
      }
    }

    load()
    startPolling()
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      stopPolling()
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [user, load])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const saved = window.localStorage.getItem('bolh-map-tiles')
    const mode: 'dark' | 'light' = saved === 'light' ? 'light' : 'dark'
    setMapTileTheme(mode)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    let rafId: number | null = null
    const updateViewport = () => {
      const next = window.innerHeight
      setViewportHeight((prev) => (prev === next ? prev : next))
    }
    const scheduleViewportUpdate = () => {
      if (rafId != null) return
      rafId = window.requestAnimationFrame(() => {
        rafId = null
        updateViewport()
      })
    }
    updateViewport()
    window.addEventListener('resize', scheduleViewportUpdate)
    window.addEventListener('orientationchange', scheduleViewportUpdate)
    window.visualViewport?.addEventListener('resize', scheduleViewportUpdate)
    return () => {
      if (rafId != null) {
        window.cancelAnimationFrame(rafId)
      }
      window.removeEventListener('resize', scheduleViewportUpdate)
      window.removeEventListener('orientationchange', scheduleViewportUpdate)
      window.visualViewport?.removeEventListener('resize', scheduleViewportUpdate)
    }
  }, [])

  const toggleMapTheme = () => {
    const next: 'dark' | 'light' = mapTileTheme === 'dark' ? 'light' : 'dark'
    setMapTileTheme(next)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('bolh-map-tiles', next)
    }
  }

  return (
    <div
      className="theme-page relative w-full overflow-hidden text-white"
      style={{ height: viewportHeight ? `${Math.max(320, viewportHeight)}px` : '100vh' }}
    >
      <div className="absolute inset-0 z-0">
        <MapView orders={orders} bids={bids} tileTheme={mapTileTheme} />
      </div>

      <div className="absolute left-4 right-4 top-3 z-[1001]">
        <div className="theme-header flex items-center justify-between rounded-xl border border-white/10 px-3 py-2 backdrop-blur">
          <span className="text-sm font-bold uppercase tracking-wide">
            <span className="text-orange-300 font-extrabold">BOLH</span>{' '}
            <span className="text-white font-medium">{t('security')}</span>
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleMapTheme}
              className="theme-surface-soft px-3 py-2 rounded-lg border border-violet-400 theme-hover min-h-[44px] text-xs font-medium inline-flex items-center gap-1.5"
              aria-label={t('map.toggle_tiles')}
            >
              {mapTileTheme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              {mapTileTheme === 'dark' ? t('map.light_map') : t('map.dark_map')}
            </button>
            <button
              type="button"
              onClick={openChat}
              className="p-2 rounded-lg theme-hover min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label={t('ai_chat.aria_chat')}
            >
              <Sparkles className="h-5 w-5 text-white/80" />
            </button>
          </div>
        </div>
      </div>

      <div className="theme-header absolute bottom-24 left-4 right-4 z-[1000] rounded-xl border border-white/10 px-4 py-3 backdrop-blur">
        <p className="text-xs text-white/60 uppercase">{t('map.near_you')}</p>
        <p className="text-sm font-medium text-white mt-0.5">{t('map.legend')}</p>
      </div>

      <BOLHNav current="map" />
    </div>
  )
}
