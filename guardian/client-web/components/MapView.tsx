'use client'

import { useEffect, useState, useRef, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import type { ReactNode } from 'react'
import 'leaflet/dist/leaflet.css'
import { useLocale } from '@/context/LocaleContext'
import type { Order } from '@/lib/api'
import type { Bid } from '@/lib/api'

const CARTO_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; CARTO'
const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
const ACTIVE_ORDER_STATUSES = new Set(['published', 'open', 'searching', 'matched', 'in_progress'])
const MOVEMENT_ANIMATION_MS = 900

const defaultCenter: [number, number] = [48.8566, 2.3522] // Paris
const defaultZoom = 12

const createIcon = (color: string) =>
  L.divIcon({
    className: 'bolh-map-marker-shell',
    html: `<span class="bolh-map-marker-pulse" style="--marker-color:${color}"></span><span class="bolh-map-marker" style="--marker-color:${color}"></span>`,
    iconSize: [34, 42],
    iconAnchor: [17, 38],
    popupAnchor: [0, -35],
  })

const guardIcon = createIcon('#8b5cf6')
const orderIcon = createIcon('#22c55e')
const activeOrderIcon = createIcon('#f59e0b')
const myIcon = createIcon('#3b82f6')

const LIGHT_TILE_PROVIDERS = [
  {
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution: CARTO_ATTRIBUTION,
  },
  {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: OSM_ATTRIBUTION,
  },
] as const

const DARK_TILE_PROVIDERS = [
  {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: CARTO_ATTRIBUTION,
  },
  {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: OSM_ATTRIBUTION,
  },
] as const

type MapPoint = {
  id: string
  latitude: number
  longitude: number
}

function isValidLatitude(value: number): boolean {
  return Number.isFinite(value) && value >= -90 && value <= 90
}

function isValidLongitude(value: number): boolean {
  return Number.isFinite(value) && value >= -180 && value <= 180
}

function AnimatedMarker({ position, icon, children, durationMs = MOVEMENT_ANIMATION_MS }: { position: [number, number]; icon: L.DivIcon; children?: ReactNode; durationMs?: number }) {
  const markerRef = useRef<L.Marker | null>(null)
  const previousPositionRef = useRef<[number, number] | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const [latitude, longitude] = position

  useEffect(() => {
    const marker = markerRef.current
    if (!marker) return

    const previousPosition = previousPositionRef.current
    const nextPosition: [number, number] = [latitude, longitude]

    if (!previousPosition) {
      marker.setLatLng(nextPosition)
      previousPositionRef.current = nextPosition
      return
    }

    if (previousPosition[0] === nextPosition[0] && previousPosition[1] === nextPosition[1]) {
      return
    }

    if (animationFrameRef.current != null) {
      window.cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }

    const [fromLat, fromLon] = previousPosition
    const [toLat, toLon] = nextPosition
    const startAt = performance.now()

    const animate = (now: number) => {
      const rawProgress = Math.min(1, (now - startAt) / durationMs)
      const eased = 1 - Math.pow(1 - rawProgress, 3)
      const currentLat = fromLat + (toLat - fromLat) * eased
      const currentLon = fromLon + (toLon - fromLon) * eased

      marker.setLatLng([currentLat, currentLon])

      if (rawProgress < 1) {
        animationFrameRef.current = window.requestAnimationFrame(animate)
      } else {
        previousPositionRef.current = nextPosition
        animationFrameRef.current = null
      }
    }

    animationFrameRef.current = window.requestAnimationFrame(animate)

    return () => {
      if (animationFrameRef.current != null) {
        window.cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
    }
  }, [latitude, longitude, durationMs])

  return (
    <Marker ref={(instance) => { markerRef.current = instance }} position={position} icon={icon}>
      {children}
    </Marker>
  )
}

function SetViewOnUser({ coords }: { coords: [number, number] | null }) {
  const map = useMap()
  const centeredOnce = useRef(false)
  useEffect(() => {
    if (coords && !centeredOnce.current) {
      centeredOnce.current = true
      map.setView(coords, 15)
    }
  }, [coords, map])
  return null
}

function LocationButton({ coords, ariaLabel }: { coords: [number, number] | null; ariaLabel: string }) {
  const map = useMap()
  if (!coords) return null
  return (
    <button
      type="button"
      onClick={() => map.flyTo(coords, 16, { duration: 0.8 })}
      className="absolute bottom-20 right-4 z-[1000] flex h-12 w-12 items-center justify-center rounded-xl bg-[#1a1b26] border border-white/20 text-white shadow-lg hover:bg-[#252530]"
      aria-label={ariaLabel}
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2a8 8 0 0 1 8 8c0 5-8 12-8 12s-8-7-8-12a8 8 0 0 1 8-8z" />
        <circle cx="12" cy="10" r="3" />
      </svg>
    </button>
  )
}

function FitBounds({ orders, bids, userPos }: { orders: MapPoint[]; bids: MapPoint[]; userPos: [number, number] | null }) {
  const map = useMap()
  const done = useRef(false)
  useEffect(() => {
    if (done.current) return
    const points: [number, number][] = userPos ? [userPos] : []
    orders.forEach((o) => points.push([o.latitude, o.longitude]))
    bids.forEach((b) => points.push([b.latitude, b.longitude]))
    if (points.length < 2) return
    done.current = true
    const bounds = L.latLngBounds(points)
    map.fitBounds(bounds.pad(0.15), { maxZoom: 14 })
  }, [map, orders, bids, userPos])
  return null
}

function InvalidateMapSize() {
  const map = useMap()
  useEffect(() => {
    const refresh = () => map.invalidateSize(false)
    const t1 = window.setTimeout(refresh, 60)
    const t2 = window.setTimeout(refresh, 240)
    window.addEventListener('resize', refresh)
    window.addEventListener('orientationchange', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
      window.removeEventListener('resize', refresh)
      window.removeEventListener('orientationchange', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [map])
  return null
}

export type MapViewProps = {
  orders?: Order[]
  bids?: Bid[]
  tileTheme?: 'dark' | 'light'
  trackingMode?: boolean
}

export default function MapView({ orders = [], bids = [], tileTheme = 'dark', trackingMode = false }: MapViewProps) {
  const { t } = useLocale()
  const [userPos, setUserPos] = useState<[number, number] | null>(null)
  const [mounted, setMounted] = useState(false)
  const [tileProviderIndex, setTileProviderIndex] = useState(0)
  const useDarkTiles = tileTheme === 'dark'

  const tileProviders = useMemo(
    () => (useDarkTiles ? DARK_TILE_PROVIDERS : LIGHT_TILE_PROVIDERS),
    [useDarkTiles]
  )
  const tileProvider = tileProviders[Math.min(tileProviderIndex, tileProviders.length - 1)]
  const hasTileFallback = tileProviderIndex < tileProviders.length - 1
  const mapOrders = useMemo(
    () =>
      (Array.isArray(orders) ? orders : [])
        .filter((order) => isValidLatitude(order.latitude) && isValidLongitude(order.longitude))
        .map((order) => ({
          id: order.id,
          latitude: order.latitude,
          longitude: order.longitude,
          status: String(order.status || '').toLowerCase(),
          title: order.title,
        })),
    [orders]
  )
  const mapBids = useMemo(
    () =>
      (Array.isArray(bids) ? bids : [])
        .filter((bid) => isValidLatitude(bid.latitude) && isValidLongitude(bid.longitude))
        .map((bid) => ({
          id: bid.id,
          latitude: bid.latitude,
          longitude: bid.longitude,
          title: bid.title,
        })),
    [bids]
  )

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    setTileProviderIndex(0)
  }, [useDarkTiles])

  useEffect(() => {
    if (!mounted || !navigator.geolocation) return
    const opts: PositionOptions = trackingMode
      ? { enableHighAccuracy: true, timeout: 12000, maximumAge: 4000 }
      : { enableHighAccuracy: false, timeout: 12000, maximumAge: 15000 }
    const id = navigator.geolocation.watchPosition(
      (p) => setUserPos([p.coords.latitude, p.coords.longitude]),
      () => setUserPos(null),
      opts
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [mounted, trackingMode])

  if (!mounted) {
    return (
      <div
        className="h-full w-full min-h-[300px] flex items-center justify-center"
        style={{ background: useDarkTiles ? '#1a1b26' : '#e5e7eb' }}
      >
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
      </div>
    )
  }

  const center = userPos || defaultCenter

  return (
    <div className="h-full w-full min-h-[300px]" style={{ zIndex: 0 }}>
      <MapContainer
        center={center}
        zoom={defaultZoom}
        className="h-full w-full rounded-xl"
        style={{ minHeight: 300, background: useDarkTiles ? '#1a1b26' : '#e5e7eb' }}
        zoomControl={true}
        preferCanvas={true}
      >
        <InvalidateMapSize />
        <SetViewOnUser coords={userPos} />
        <FitBounds orders={mapOrders} bids={mapBids} userPos={userPos} />
        <TileLayer
          key={tileProvider.url}
          url={tileProvider.url}
          attribution={tileProvider.attribution}
          detectRetina={true}
          maxZoom={20}
          updateWhenIdle={false}
          updateWhenZooming={false}
          keepBuffer={8}
          eventHandlers={{
            tileerror: () => {
              if (!hasTileFallback) return
              setTileProviderIndex((prev) => Math.min(prev + 1, tileProviders.length - 1))
            },
          }}
        />
        <LocationButton coords={userPos} ariaLabel={t('map.my_location_aria')} />
        {userPos && (
          <AnimatedMarker position={userPos} icon={myIcon}>
            <Popup>{t('map.you_here')}</Popup>
          </AnimatedMarker>
        )}
        {mapBids.map((bid) => (
          <AnimatedMarker key={bid.id} position={[bid.latitude, bid.longitude]} icon={guardIcon}>
            <Popup>
              <strong>{t('map.guard')}</strong>
              <br />
              {bid.title || t('map.available')}
            </Popup>
          </AnimatedMarker>
        ))}
        {mapOrders.map((order) => (
          <AnimatedMarker
            key={order.id}
            position={[order.latitude, order.longitude]}
            icon={ACTIVE_ORDER_STATUSES.has(order.status) ? activeOrderIcon : orderIcon}
          >
            <Popup>
              <strong>{t('map.order')}</strong>
              <br />
              {order.title || t('map.reserve')}
            </Popup>
          </AnimatedMarker>
        ))}
      </MapContainer>
    </div>
  )
}
