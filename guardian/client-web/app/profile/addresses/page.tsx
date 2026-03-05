'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, Plus, Star, Trash2 } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useLocale } from '@/context/LocaleContext'
import { BOLHNav } from '@/components/BOLHNav'
import { AddressAutocomplete, type AddressResult } from '@/components/AddressAutocomplete'

type SavedAddress = {
  id: string
  label: string
  latitude: number
  longitude: number
  isDefault: boolean
  createdAt: string
}

export default function ProfileAddressesPage() {
  const { user } = useAuth()
  const { t } = useLocale()
  const [addresses, setAddresses] = useState<SavedAddress[]>([])
  const [addressInput, setAddressInput] = useState('')
  const [selected, setSelected] = useState<AddressResult | null>(null)
  const [error, setError] = useState('')

  const storageKey = useMemo(() => `guardian_saved_addresses_${user?.id || 'guest'}`, [user?.id])

  useEffect(() => {
    if (!user) return
    try {
      const raw = localStorage.getItem(storageKey)
      const parsed = raw ? (JSON.parse(raw) as SavedAddress[]) : []
      setAddresses(Array.isArray(parsed) ? parsed : [])
    } catch {
      setAddresses([])
    }
  }, [user, storageKey])

  const persist = (next: SavedAddress[]) => {
    setAddresses(next)
    try {
      localStorage.setItem(storageKey, JSON.stringify(next))
    } catch {
      // ignore storage errors in UI
    }
  }

  const addAddress = () => {
    const label = addressInput.trim()
    if (!label) {
      setError(t('profile_addresses.enter_address'))
      return
    }
    const duplicate = addresses.some((a) => a.label.toLowerCase() === label.toLowerCase())
    if (duplicate) {
      setError(t('profile_addresses.address_exists'))
      return
    }
    const item: SavedAddress = {
      id: crypto.randomUUID(),
      label,
      latitude: selected?.latitude ?? 0,
      longitude: selected?.longitude ?? 0,
      isDefault: addresses.length === 0,
      createdAt: new Date().toISOString(),
    }
    persist([item, ...addresses])
    setAddressInput('')
    setSelected(null)
    setError('')
  }

  const removeAddress = (id: string) => {
    const next = addresses.filter((a) => a.id !== id)
    if (next.length > 0 && !next.some((a) => a.isDefault)) {
      next[0] = { ...next[0], isDefault: true }
    }
    persist(next)
  }

  const setDefault = (id: string) => {
    persist(addresses.map((a) => ({ ...a, isDefault: a.id === id })))
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#1a1b26] text-white flex items-center justify-center">
        <Link href="/login" className="text-violet-400 hover:underline">{t('auth.login_btn')}</Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#1a1b26] text-white pb-24">
      <header className="sticky top-0 z-10 border-b border-white/10 bg-[#1a1b26]/95 backdrop-blur">
        <div className="flex items-center gap-2 px-4 py-3">
          <Link href="/profile" className="p-2 rounded-lg hover:bg-white/10 min-h-[44px] min-w-[44px] flex items-center justify-center">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-lg font-semibold">{t('profile_addresses.title')}</h1>
        </div>
      </header>
      <main className="mx-auto max-w-lg px-4 py-6 space-y-4">
        <div className="rounded-2xl bg-white/10 border border-violet-400 p-3 space-y-3">
          <AddressAutocomplete
            value={addressInput}
            onChange={(v) => {
              setAddressInput(v)
              if (error) setError('')
            }}
            onSelect={(r) => {
              setSelected(r)
              setAddressInput(r.display)
              if (error) setError('')
            }}
            placeholder={t('profile_addresses.add_address_placeholder')}
          />
          <button
            type="button"
            onClick={addAddress}
            className="w-full rounded-xl bg-violet-600 hover:bg-violet-500 border border-violet-400 py-3 min-h-[44px] inline-flex items-center justify-center gap-2 font-medium"
          >
            <Plus className="h-4 w-4" />
            {t('profile_addresses.save_address')}
          </button>
          {error && <p className="text-sm text-red-300">{error}</p>}
        </div>

        {addresses.length === 0 ? (
          <p className="text-white/60 text-sm">{t('profile_addresses.empty')}</p>
        ) : (
          <div className="space-y-2">
            {addresses.map((item) => (
              <div key={item.id} className="rounded-xl bg-white/10 border border-violet-400 px-3 py-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm text-white/90 break-words">{item.label}</p>
                  <button
                    type="button"
                    onClick={() => removeAddress(item.id)}
                    className="p-2 rounded-lg hover:bg-red-500/20 text-red-300 min-h-[36px] min-w-[36px] flex items-center justify-center"
                    aria-label={t('profile_addresses.delete_address')}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setDefault(item.id)}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs border ${
                      item.isDefault
                        ? 'bg-violet-600 border-violet-400 text-white'
                        : 'bg-white/10 border-violet-400 text-white/80 hover:bg-white/15'
                    }`}
                  >
                    <Star className={`h-3.5 w-3.5 ${item.isDefault ? 'fill-current' : ''}`} />
                    {item.isDefault ? t('profile_addresses.default') : t('profile_addresses.make_default')}
                  </button>
                  {item.latitude !== 0 || item.longitude !== 0 ? (
                    <span className="text-[11px] text-white/60 tabular-nums">
                      {item.latitude.toFixed(4)}, {item.longitude.toFixed(4)}
                    </span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
      <BOLHNav current="profile" />
    </div>
  )
}
