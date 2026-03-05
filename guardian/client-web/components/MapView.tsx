'use client'

import { useEffect, useState, useRef, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useLocale } from '@/context/LocaleContext'
import type { Order } from '@/lib/api'
import type { Bid } from '@/lib/api'

const TILES_LIGHT = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
const TILES_DARK = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'

const defaultCenter: [number, number] = [48.8566, 2.3522] // Paris
const defaultZoom = 12

const createIcon = (color: string) =>
  L.divIcon({
    className: 'border-0 bg-transparent',
    html: `<div style="background:${color};width:26px;height:26px;border-radius:50%;border:3px solid #1a1b26;box-shadow:0 2px 8px rgba(0,0,0,0.5);"></div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  })

const guardIcon = createIcon('#8b5cf6')
const orderIcon = createIcon('#22c55e')
const myIcon = createIcon('#3b82f6')

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

function FitBounds({ orders, bids, userPos }: { orders: Array<{ latitude: number; longitude: number }>; bids: Array<{ latitude: number; longitude: number }>; userPos: [number, number] | null }) {
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
}

export default function MapView({ orders = [], bids = [], tileTheme = 'dark' }: MapViewProps) {
  const { t } = useLocale()
  const [userPos, setUserPos] = useState<[number, number] | null>(null)
  const [mounted, setMounted] = useState(false)
  const useDarkTiles = tileTheme === 'dark'

  const safeOrders = Array.isArray(orders) ? orders : []
  const safeBids = Array.isArray(bids) ? bids : []
  const tileUrl = useMemo(() => (useDarkTiles ? TILES_DARK : TILES_LIGHT), [useDarkTiles])

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted || !navigator.geolocation) return
    const opts: PositionOptions = { enableHighAccuracy: false, timeout: 12000, maximumAge: 15000 }
    const id = navigator.geolocation.watchPosition(
      (p) => setUserPos([p.coords.latitude, p.coords.longitude]),
      () => setUserPos(null),
      opts
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [mounted])

  if (!mounted) {
    return (
      <div className="h-full w-full min-h-[300px] flex items-center justify-center bg-[#1a1b26]">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-violet-400 border-t-transparent" />
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
        style={{ minHeight: 300, background: '#1a1b26' }}
        zoomControl={true}
        preferCanvas={true}
      >
        <InvalidateMapSize />
        <SetViewOnUser coords={userPos} />
        <FitBounds orders={safeOrders} bids={safeBids} userPos={userPos} />
        <TileLayer
          url={tileUrl}
          attribution={ATTRIBUTION + (useDarkTiles ? ' &copy; CARTO' : '')}
          detectRetina={true}
          updateWhenIdle={true}
          keepBuffer={4}
        />
        <LocationButton coords={userPos} ariaLabel={t('map.my_location_aria')} />
        {userPos && (
          <Marker position={userPos} icon={myIcon}>
            <Popup>{t('map.you_here')}</Popup>
          </Marker>
        )}
        {safeBids.map((b) => (
          <Marker key={b.id} position={[b.latitude, b.longitude]} icon={guardIcon}>
            <Popup>
              <strong>{t('map.guard')}</strong>
              <br />
              {b.title || t('map.available')}
            </Popup>
          </Marker>
        ))}
        {safeOrders.map((o) => (
          <Marker key={o.id} position={[o.latitude, o.longitude]} icon={orderIcon}>
            <Popup>
              <strong>{t('map.order')}</strong>
              <br />
              {o.title || t('map.reserve')}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}
