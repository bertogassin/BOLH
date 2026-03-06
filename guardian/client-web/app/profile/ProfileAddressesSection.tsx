'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronDown, MapPin, Plus } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useLocale } from '@/context/LocaleContext'

type SavedAddress = {
  id: string
  label: string
  latitude: number
  longitude: number
  isDefault: boolean
}

export function ProfileAddressesSection() {
  const { user } = useAuth()
  const { t } = useLocale()
  const [isExpanded, setIsExpanded] = useState(false)
  const [addresses, setAddresses] = useState<SavedAddress[]>([])
  const storageKey = useMemo(() => `guardian_saved_addresses_${user?.id || 'guest'}`, [user?.id])

  useEffect(() => {
    if (!user) {
      setAddresses([])
      return
    }

    try {
      const raw = localStorage.getItem(storageKey)
      const parsed = raw ? (JSON.parse(raw) as SavedAddress[]) : []
      setAddresses(Array.isArray(parsed) ? parsed : [])
    } catch {
      setAddresses([])
    }
  }, [user, storageKey])

  return (
    <section>
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        className="w-full rounded-xl bg-white/10 border border-violet-400 hover:bg-white/15 px-3 py-3 text-white font-medium min-h-[44px] flex items-center justify-between"
      >
        <span className="inline-flex items-center gap-2">
          <MapPin className="h-4.5 w-4.5 text-white/80" />
          {t('profile_addresses.title')}
        </span>
        <span className="inline-flex items-center gap-2 text-sm text-white/80">
          {addresses.length}
          <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
        </span>
      </button>

      <div className={`overflow-hidden transition-all duration-200 ${isExpanded ? 'max-h-96 mt-2 opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="rounded-xl border border-violet-400/70 bg-white/5 p-3">
          <Link
            href="/profile/addresses"
            className="mb-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-violet-400 bg-white/10 py-2.5 text-sm font-medium text-white hover:bg-white/15"
          >
            <MapPin className="h-4 w-4 text-white/80" />
            <Plus className="h-4 w-4 text-violet-300" />
            {t('profile_addresses.manage')}
          </Link>
          <div className="max-h-56 space-y-2 overflow-y-auto">
            {addresses.length > 0 ? (
              addresses.map((item) => (
                <div key={item.id} className="rounded-lg border border-violet-400 bg-white/5 px-3 py-2">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm text-white/90 break-words">{item.label}</span>
                    {item.isDefault ? (
                      <span className="shrink-0 rounded-md border border-violet-400 bg-violet-600/80 px-2 py-0.5 text-[10px] text-white">
                        {t('profile_addresses.default')}
                      </span>
                    ) : null}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-white/60">{t('profile_addresses.empty')}</p>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

