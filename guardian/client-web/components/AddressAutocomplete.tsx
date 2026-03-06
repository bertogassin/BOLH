'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { MapPin, X, ChevronDown, ChevronUp } from 'lucide-react'
import { useLocale } from '@/context/LocaleContext'
import { useAuth } from '@/context/AuthContext'

const NOMINATIM = 'https://nominatim.openstreetmap.org/search'
const DEBOUNCE_MS = 400

type NominatimAddress = {
  road?: string
  house_number?: string
  postcode?: string
  city?: string
  town?: string
  village?: string
  municipality?: string
  suburb?: string
  neighbourhood?: string
  country?: string
  [key: string]: string | undefined
}

type NominatimResult = {
  place_id: number
  lat: string
  lon: string
  display_name: string
  address?: NominatimAddress
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

function shortAddress(addr?: NominatimAddress | null, fallback?: string): string {
  const fb = typeof fallback === 'string' ? fallback : ''
  if (!addr || typeof addr !== 'object') return fb
  const num = str(addr.house_number)
  const road = str(addr.road)
  const street = road || str(addr.suburb) || str(addr.neighbourhood)
  const postcode = str(addr.postcode)
  const city = str(addr.city || addr.town || addr.village || addr.municipality)
  const country = str(addr.country)
  const parts = [num, street, postcode, city, country].filter(Boolean)
  return parts.join(', ') || fb
}

export type AddressResult = {
  display: string
  latitude: number
  longitude: number
}

type RecentAddress = AddressResult & {
  usedAt: number
}

type SavedAddress = {
  id: string
  label: string
  latitude: number
  longitude: number
  isDefault: boolean
  createdAt: string
}

type AddressAutocompleteProps = {
  value: string
  onChange: (value: string) => void
  onSelect?: (result: AddressResult) => void
  placeholder?: string
  className?: string
  showHistoryPanel?: boolean
  hasError?: boolean
}

const RECENT_STORAGE_KEY = 'guardian_recent_addresses_v1'
const MAX_RECENT_ADDRESSES = 6

export function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = 'Address',
  className = '',
  showHistoryPanel = true,
  hasError = false,
}: AddressAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<AddressResult[]>([])
  const [recent, setRecent] = useState<RecentAddress[]>([])
  const [saved, setSaved] = useState<AddressResult[]>([])
  const [open, setOpen] = useState(false)
  const [showSavedHistory, setShowSavedHistory] = useState(false)
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const lastSelectedRef = useRef<string | null>(null)
  const { user } = useAuth()

  const fetchSuggestions = useCallback(async (q: string, skipOpenIfEqualTo?: string | null) => {
    const trimmed = q.trim()
    if (trimmed.length < 3) {
      setSuggestions([])
      return
    }
    if (skipOpenIfEqualTo && trimmed === skipOpenIfEqualTo.trim()) {
      setSuggestions([])
      setOpen(false)
      return
    }
    setLoading(true)
    try {
      const params = new URLSearchParams({
        q: trimmed,
        format: 'json',
        limit: '5',
        addressdetails: '1',
      })
      const res = await fetch(`${NOMINATIM}?${params}`, {
        headers: { Accept: 'application/json' },
      })
      const raw = await res.json()
      const data = Array.isArray(raw) ? raw : []
      const list: AddressResult[] = []
      for (const r of data) {
        if (!r || typeof r !== 'object') continue
        const lat = Number(r.lat)
        const lon = Number(r.lon)
        if (Number.isFinite(lat) && Number.isFinite(lon)) {
          const display = shortAddress(r.address, r.display_name) || str(r.display_name) || `${lat}, ${lon}`
          list.push({ display, latitude: lat, longitude: lon })
        }
      }
      setSuggestions(list)
      const alreadyChosen = skipOpenIfEqualTo && list.some((s) => s.display.trim() === skipOpenIfEqualTo.trim())
      setOpen(!alreadyChosen)
    } catch {
      setSuggestions([])
      setOpen(false)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (value.trim() !== lastSelectedRef.current?.trim()) lastSelectedRef.current = null
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchSuggestions(value, lastSelectedRef.current), DEBOUNCE_MS)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [value, fetchSuggestions])

  useEffect(() => {
    const storageKey = `guardian_saved_addresses_${user?.id || 'guest'}`
    try {
      const raw = window.localStorage.getItem(storageKey)
      if (!raw) {
        setSaved([])
        return
      }
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) {
        setSaved([])
        return
      }
      const list: AddressResult[] = []
      for (const item of parsed as SavedAddress[]) {
        const display = str(item?.label)
        const latitude = Number(item?.latitude)
        const longitude = Number(item?.longitude)
        if (!display || !Number.isFinite(latitude) || !Number.isFinite(longitude)) continue
        list.push({ display, latitude, longitude })
      }
      setSaved(list.slice(0, MAX_RECENT_ADDRESSES))
    } catch {
      setSaved([])
    }
  }, [user?.id])

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(RECENT_STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) return
      const list: RecentAddress[] = []
      for (const item of parsed) {
        if (!item || typeof item !== 'object') continue
        const display = str((item as { display?: unknown }).display)
        const latitude = Number((item as { latitude?: unknown }).latitude)
        const longitude = Number((item as { longitude?: unknown }).longitude)
        const usedAt = Number((item as { usedAt?: unknown }).usedAt)
        if (!display || !Number.isFinite(latitude) || !Number.isFinite(longitude)) continue
        list.push({
          display,
          latitude,
          longitude,
          usedAt: Number.isFinite(usedAt) ? usedAt : Date.now(),
        })
      }
      setRecent(list.slice(0, MAX_RECENT_ADDRESSES))
    } catch {
      setRecent([])
    }
  }, [])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const { t } = useLocale()
  const persistRecent = (list: RecentAddress[]) => {
    setRecent(list)
    try {
      window.localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(list))
    } catch {
      // Ignore storage write errors.
    }
  }

  const addToRecent = (result: AddressResult) => {
    const normalized = result.display.trim().toLowerCase()
    const next = [
      { ...result, usedAt: Date.now() },
      ...recent.filter((item) => item.display.trim().toLowerCase() !== normalized),
    ].slice(0, MAX_RECENT_ADDRESSES)
    persistRecent(next)
  }

  const removeRecent = (display: string) => {
    const normalized = display.trim().toLowerCase()
    const next = recent.filter((item) => item.display.trim().toLowerCase() !== normalized)
    persistRecent(next)
  }

  const handleSelect = (result: AddressResult) => {
    onChange(result.display)
    onSelect?.(result)
    addToRecent(result)
    lastSelectedRef.current = result.display
    setShowSavedHistory(false)
    setOpen(false)
    setSuggestions([])
  }

  const borderClass = hasError ? 'border-red-500/80' : 'border-violet-400'
  const inputRowClass = 'rounded-t-xl bg-black flex items-center gap-2.5 min-h-[56px] px-3 py-3.5'
  const totalHistoryCount = saved.length + recent.length

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <div className={`rounded-xl bg-black border ${borderClass} overflow-hidden`}>
        <div className={inputRowClass}>
          <MapPin className="h-5 w-5 text-white/60 shrink-0" />
          <div className="relative flex-1 min-w-0">
            <input
              type="text"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onFocus={() => {
                if (suggestions.length > 0 && value.trim() !== lastSelectedRef.current?.trim()) setOpen(true)
              }}
              placeholder={placeholder}
              className={`w-full bg-transparent text-white placeholder:text-white/50 outline-none ${value ? 'pr-9' : ''}`}
              autoComplete="off"
            />
            {value.length > 0 && !loading && (
              <button
                type="button"
                onClick={() => onChange('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-white/60 hover:text-white hover:bg-white/10 focus:outline-none"
                aria-label={t('clear_aria')}
              >
                <X className="h-4 w-4" />
              </button>
            )}
            {loading && (
              <div className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin rounded-full border-2 border-violet-400 border-t-transparent" />
            )}
          </div>
        </div>
        {showHistoryPanel && totalHistoryCount > 0 && (
          <>
            <button
              type="button"
              onClick={() => setShowSavedHistory((v) => !v)}
              className={`w-full border-t ${borderClass} px-3 py-1 text-[11px] text-white/70 flex items-center justify-between hover:bg-white/5`}
            >
              <span>{t('address_autocomplete.saved_recent')}</span>
              <span className="inline-flex items-center gap-1">
                {totalHistoryCount}
                {showSavedHistory ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </span>
            </button>
            {showSavedHistory && !open && (
              <div className={`border-t ${hasError ? 'border-red-500/60' : 'border-violet-400/60'} px-2 py-1.5 bg-black/40`}>
                {saved.length > 0 && (
                  <>
                    <p className="px-1 text-[11px] text-white/45">{t('address_autocomplete.saved')}</p>
                    <ul className="mt-1 space-y-1">
                      {saved.map((item) => (
                        <li key={`saved-${item.display}-${item.latitude}-${item.longitude}`}>
                          <button
                            type="button"
                            onClick={() => handleSelect(item)}
                            className="w-full rounded-md px-1 py-1 text-left text-xs text-white/75 hover:bg-white/5 hover:text-white truncate"
                            title={item.display}
                          >
                            {item.display}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                {recent.length > 0 && (
                  <>
                    <p className="mt-2 px-1 text-[11px] text-white/45">{t('address_autocomplete.recent')}</p>
                    <ul className="mt-1 space-y-1">
                      {recent.map((item) => (
                        <li key={`${item.display}-${item.latitude}-${item.longitude}`}>
                          <div className="group flex items-center gap-1 rounded-md px-1 py-1 hover:bg-white/5">
                            <button
                              type="button"
                              onClick={() => handleSelect(item)}
                              className="min-w-0 flex-1 truncate text-left text-xs text-white/75 hover:text-white"
                              title={item.display}
                            >
                              {item.display}
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                removeRecent(item.display)
                              }}
                              className="rounded p-1 text-white/35 hover:bg-white/10 hover:text-white/75"
                              aria-label={`${t('address_autocomplete.remove')} ${item.display}`}
                              title={t('address_autocomplete.remove_from_history')}
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
      {open && suggestions.length > 0 && !suggestions.some((s) => s.display.trim() === value.trim()) && (
        <ul
          className="absolute top-full left-0 right-0 mt-1 rounded-xl bg-black border border-violet-400 shadow-xl z-50 max-h-48 overflow-auto"
          role="listbox"
        >
          {suggestions.map((s, i) => (
            <li
              key={`${s.latitude}-${s.longitude}-${i}`}
              role="option"
              className="px-3 py-2 text-sm text-white/90 hover:bg-white/10 cursor-pointer min-h-[40px] flex items-center"
              onClick={() => handleSelect(s)}
            >
              {s.display}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
