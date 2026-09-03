'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import { fetchOrders, fetchBids } from '@/lib/api'
import { subscribeOrderSync } from '@/lib/order_sync'
import { useAuth } from '@/context/AuthContext'
import { BOLHNav } from '@/components/BOLHNav'
import { useLocale } from '@/context/LocaleContext'
import { RefreshCw, Shield } from 'lucide-react'

const MapView = dynamic(() => import('@/components/MapView'), {
  ssr: false,
  loading: () => (
    <div className="h-full min-h-[50vh] flex items-center justify-center bg-slate-100 text-slate-700">
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
        <span className="text-sm font-medium">Loading map…</span>
      </div>
    </div>
  ),
})

const POLL_INTERVAL_MS = 25000
const ACTIVE_ORDER_POLL_INTERVAL_MS = 7000
const MAP_CACHE_TTL_MS = 15000
const ACTIVE_ORDER_STATUSES = new Set(['published', 'open', 'searching', 'matched', 'in_progress'])

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
  const [orders, setOrders] = useState<Awaited<ReturnType<typeof fetchOrders>>>([])
  const [bids, setBids] = useState<Awaited<ReturnType<typeof fetchBids>>>([])
  const [viewportHeight, setViewportHeight] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const inFlightRef = useRef(false)
  const hasActiveOrder = orders.some((order) => ACTIVE_ORDER_STATUSES.has(String(order.status || '').toLowerCase()))
  const pollIntervalMs = hasActiveOrder ? ACTIVE_ORDER_POLL_INTERVAL_MS : POLL_INTERVAL_MS

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
    if (!mapCache) setLoading(true)

    Promise.all([fetchOrders(), fetchBids()])
      .then(([o, b]) => {
        const safeOrders = Array.isArray(o) ? o : []
        const safeBids = Array.isArray(b) ? b : []
        setOrders(safeOrders)
        setBids(safeBids)
        setLoadError(false)
        mapCache = { userId, at: Date.now(), orders: safeOrders, bids: safeBids }
      })
      .catch(() => setLoadError(true))
      .finally(() => {
        inFlightRef.current = false
        setLoading(false)
      })
  }, [user])

  useEffect(() => {
    if (!user || typeof document === 'undefined') return
    let intervalId: ReturnType<typeof setInterval> | null = null

    const startPolling = () => {
      if (intervalId) return
      intervalId = setInterval(() => {
        if (!document.hidden) load({ force: true })
      }, pollIntervalMs)
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
    const unsubscribe = subscribeOrderSync(() => {
      if (!document.hidden) load({ force: true })
    })

    return () => {
      stopPolling()
      document.removeEventListener('visibilitychange', handleVisibility)
      unsubscribe()
    }
  }, [user, load, pollIntervalMs])

  useEffect(() => {
    if (typeof window === 'undefined') return
    let rafId: number | null = null
    const visualViewport = window.visualViewport
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
    if (visualViewport && typeof visualViewport.addEventListener === 'function') {
      visualViewport.addEventListener('resize', scheduleViewportUpdate)
    }
    return () => {
      if (rafId != null) {
        window.cancelAnimationFrame(rafId)
      }
      window.removeEventListener('resize', scheduleViewportUpdate)
      window.removeEventListener('orientationchange', scheduleViewportUpdate)
      if (visualViewport && typeof visualViewport.removeEventListener === 'function') {
        visualViewport.removeEventListener('resize', scheduleViewportUpdate)
      }
    }
  }, [])

  return (
    <div
      className="theme-page relative w-full overflow-hidden text-white"
      style={{ height: viewportHeight ? `${Math.max(320, viewportHeight)}px` : '100vh' }}
    >
      <div className="absolute inset-0 z-0">
        <MapView orders={orders} bids={bids} tileTheme="light" trackingMode={hasActiveOrder} />
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 z-[500] px-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="pointer-events-auto flex items-center justify-between rounded-2xl border border-white/12 bg-[#090d17]/88 px-3 py-3 text-white shadow-[0_18px_50px_rgba(0,0,0,.42)] backdrop-blur-2xl">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-violet-600 to-blue-600 shadow-lg"><Shield className="h-5 w-5" /></div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">BOLH Live</p>
              <div className="mt-0.5 flex items-center gap-3 text-[11px] text-white/60">
                <span className="inline-flex items-center gap-1"><i className="h-1.5 w-1.5 rounded-full bg-violet-400" />{bids.length} {t('map.guard')}</span>
                <span className="inline-flex items-center gap-1"><i className="h-1.5 w-1.5 rounded-full bg-amber-400" />{orders.length} {t('map.order')}</span>
              </div>
            </div>
          </div>
          <button type="button" onClick={() => load({ force: true })} disabled={loading} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[.055] text-white/75 transition hover:bg-white/10 disabled:opacity-50" aria-label="Refresh map">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        {loadError && <button type="button" onClick={() => load({ force: true })} className="pointer-events-auto mt-2 w-full rounded-xl border border-red-400/25 bg-red-950/80 px-3 py-2 text-xs text-red-200 backdrop-blur">Connection lost · tap to retry</button>}
      </div>

      <BOLHNav current="map" />
    </div>
  )
}
