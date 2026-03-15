'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import { fetchOrders, fetchBids } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
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
  const [orders, setOrders] = useState<Awaited<ReturnType<typeof fetchOrders>>>([])
  const [bids, setBids] = useState<Awaited<ReturnType<typeof fetchBids>>>([])
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

  return (
    <div
      className="theme-page relative w-full overflow-hidden text-white"
      style={{ height: viewportHeight ? `${Math.max(320, viewportHeight)}px` : '100vh' }}
    >
      <div className="absolute inset-0 z-0">
        <MapView orders={orders} bids={bids} tileTheme="light" />
      </div>

      <BOLHNav current="map" />
    </div>
  )
}
