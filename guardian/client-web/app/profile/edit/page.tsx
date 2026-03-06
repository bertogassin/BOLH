'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useLocale } from '@/context/LocaleContext'
import { InputWithClear } from '@/components/InputWithClear'
import { FormField } from '@/components/FormField'
import { DARK_CLEAR_BUTTON_CLASS, DARK_FIELD_LABEL_CLASS, DARK_INPUT_CLASS } from '@/components/formStyles'
import { BOLHNav } from '@/components/BOLHNav'

const QUICK_RADIUS = [5, 10, 25, 50]
const SERVICES = [
  { id: 'all' },
  { id: 'security' },
  { id: 'guardian' },
  { id: 'patrol' },
] as const
const PLACE_TYPES = [
  { id: 'all' },
  { id: 'villa_house' },
  { id: 'residential' },
  { id: 'store_commercial' },
  { id: 'office_business' },
  { id: 'hotel' },
  { id: 'warehouse' },
] as const
export default function ProfileEditPage() {
  const { user } = useAuth()
  const { t } = useLocale()
  const router = useRouter()
  const [serviceRadiusKm, setServiceRadiusKm] = useState('')
  const [basePrice, setBasePrice] = useState('')
  const [hourlyRate, setHourlyRate] = useState('')
  const [availability, setAvailability] = useState('')
  const [searchMinPrice, setSearchMinPrice] = useState('')
  const [searchMaxPrice, setSearchMaxPrice] = useState('')
  const [preferredZone, setPreferredZone] = useState('')
  const [preferredService, setPreferredService] = useState<string>('all')
  const [preferredPlaceType, setPreferredPlaceType] = useState<string>('all')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const isDemoUser = user?.id === 'demo'
  const minPrice = Number(searchMinPrice || 0)
  const maxPrice = Number(searchMaxPrice || 0)
  const priceRangeInvalid = searchMinPrice !== '' && searchMaxPrice !== '' && minPrice > maxPrice

  useEffect(() => {
    if (user) {
      try {
        const detailsKey = `guardian_profile_details_${user.id}`
        const raw = window.localStorage.getItem(detailsKey)
        if (raw) {
          const parsed = JSON.parse(raw) as {
            serviceRadiusKm?: string
            basePrice?: string
            hourlyRate?: string
            availability?: string
            searchMinPrice?: string
            searchMaxPrice?: string
            preferredZone?: string
            preferredService?: string
            preferredPlaceType?: string
          }
          setServiceRadiusKm(parsed.serviceRadiusKm || '')
          setBasePrice(parsed.basePrice || '')
          setHourlyRate(parsed.hourlyRate || '')
          setAvailability(parsed.availability || '')
          setSearchMinPrice(parsed.searchMinPrice || '')
          setSearchMaxPrice(parsed.searchMaxPrice || '')
          setPreferredZone(parsed.preferredZone || '')
          setPreferredService(parsed.preferredService || 'all')
          setPreferredPlaceType(parsed.preferredPlaceType || 'all')
        }
      } catch {
        // ignore storage errors
      }
    }
  }, [user])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (priceRangeInvalid) {
      setError(t('profile_edit.error_price_range'))
      return
    }
    setLoading(true)
    try {
      if (user) {
        const detailsKey = `guardian_profile_details_${user.id}`
        const raw = window.localStorage.getItem(detailsKey)
        const base = raw ? (JSON.parse(raw) as Record<string, unknown>) : {}
        window.localStorage.setItem(
          detailsKey,
          JSON.stringify({
            ...base,
            serviceRadiusKm,
            basePrice,
            hourlyRate,
            availability,
            searchMinPrice,
            searchMaxPrice,
            preferredZone,
            preferredService,
            preferredPlaceType,
          })
        )
      }
      setSuccess(true)
      router.push('/profile')
    } catch (err) {
      setError(err instanceof Error ? err.message : t('profile.save_error'))
    } finally {
      setLoading(false)
    }
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
          <h1 className="text-lg font-semibold">{t('profile.edit_short')}</h1>
        </div>
      </header>
      <main className="mx-auto max-w-lg px-4 py-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          {success && (
            <div className="rounded-xl bg-emerald-500/20 border border-emerald-500/40 p-3 text-sm text-emerald-200">
              {t('profile.saved')}
            </div>
          )}
          {error && (
            <div className="rounded-xl bg-red-500/20 border border-red-500/40 p-3 text-sm text-red-200">{error}</div>
          )}
          <div className="rounded-xl border border-violet-400/60 bg-white/5 p-3 space-y-3">
            <p className="text-sm font-semibold text-white">{t('profile_edit.search_instruments')}</p>
            <div>
              <p className="block text-xs font-medium text-white/60 uppercase mb-2">{t('profile_edit.preferred_service')}</p>
              <div className="grid grid-cols-3 gap-2">
                {SERVICES.map((option) => {
                  const isAllSelected = preferredService === 'all'
                  const active = isAllSelected || preferredService === option.id
                  return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setPreferredService(option.id)}
                    className={`rounded-lg px-2.5 py-2.5 text-xs font-medium ${
                      active
                        ? 'bg-violet-600 text-white border border-violet-400'
                        : 'bg-transparent text-white/80 border border-violet-400 hover:bg-white/10'
                    }`}
                  >
                    {option.id === 'all' ? t('profile_edit.all_services') : t(`booking.service_${option.id}`)}
                  </button>
                  )
                })}
              </div>
            </div>
            <div>
              <p className="block text-xs font-medium text-white/60 uppercase mb-2">{t('profile_edit.preferred_place_type')}</p>
              <div className="grid grid-cols-2 gap-2">
                {PLACE_TYPES.map((option) => {
                  const isAllSelected = preferredPlaceType === 'all'
                  const active = isAllSelected || preferredPlaceType === option.id
                  return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setPreferredPlaceType(option.id)}
                    className={`rounded-lg px-2.5 py-2.5 text-xs font-medium ${
                      active
                        ? 'bg-violet-600 text-white border border-violet-400'
                        : 'bg-transparent text-white/80 border border-violet-400 hover:bg-white/10'
                    }`}
                  >
                    {option.id === 'all' ? t('profile_edit.all_places') : t(`booking.place_type_${option.id}`)}
                  </button>
                  )
                })}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <FormField
                label={t('profile_edit.radius_km')}
                labelClassName={DARK_FIELD_LABEL_CLASS}
              >
                <InputWithClear
                  value={serviceRadiusKm}
                  onChange={(v) => setServiceRadiusKm(v.replace(/[^\d]/g, '').slice(0, 3))}
                  placeholder={t('profile_edit.placeholder_radius')}
                  className={DARK_INPUT_CLASS}
                  clearButtonClassName={DARK_CLEAR_BUTTON_CLASS}
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  {QUICK_RADIUS.map((km) => (
                    <button
                      key={km}
                      type="button"
                      onClick={() => setServiceRadiusKm(String(km))}
                      className={`rounded-lg border px-2 py-1 text-xs ${
                        serviceRadiusKm === String(km)
                          ? 'bg-violet-600 border-violet-400 text-white'
                          : 'bg-white/10 border-white/20 text-white/80 hover:bg-white/15'
                      }`}
                    >
                      {km} km
                    </button>
                  ))}
                </div>
              </FormField>
              <FormField
                label={t('profile_edit.preferred_zone')}
                labelClassName={DARK_FIELD_LABEL_CLASS}
              >
                <InputWithClear
                  value={preferredZone}
                  onChange={setPreferredZone}
                  placeholder={t('profile_edit.placeholder_zone')}
                  className={DARK_INPUT_CLASS}
                  clearButtonClassName={DARK_CLEAR_BUTTON_CLASS}
                />
              </FormField>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <FormField
                label={t('profile_edit.min_price')}
                labelClassName={DARK_FIELD_LABEL_CLASS}
              >
                <InputWithClear
                  value={searchMinPrice}
                  onChange={(v) => setSearchMinPrice(v.replace(',', '.').replace(/[^\d.]/g, ''))}
                  placeholder={t('profile_edit.placeholder_min_price')}
                  className={DARK_INPUT_CLASS}
                  clearButtonClassName={DARK_CLEAR_BUTTON_CLASS}
                />
              </FormField>
              <FormField
                label={t('profile_edit.max_price')}
                labelClassName={DARK_FIELD_LABEL_CLASS}
              >
                <InputWithClear
                  value={searchMaxPrice}
                  onChange={(v) => setSearchMaxPrice(v.replace(',', '.').replace(/[^\d.]/g, ''))}
                  placeholder={t('profile_edit.placeholder_max_price')}
                  className={DARK_INPUT_CLASS}
                  clearButtonClassName={DARK_CLEAR_BUTTON_CLASS}
                />
              </FormField>
            </div>
            {priceRangeInvalid ? (
              <p className="text-xs text-amber-300">{t('profile_edit.error_price_range_inline')}</p>
            ) : null}
            {!isDemoUser ? (
              <FormField
                label={t('profile_edit.base_price')}
                labelClassName={DARK_FIELD_LABEL_CLASS}
              >
                <InputWithClear
                  value={basePrice}
                  onChange={(v) => setBasePrice(v.replace(',', '.').replace(/[^\d.]/g, ''))}
                  placeholder={t('profile_edit.placeholder_base_price')}
                  className={DARK_INPUT_CLASS}
                  clearButtonClassName={DARK_CLEAR_BUTTON_CLASS}
                />
              </FormField>
            ) : null}
          </div>
          <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
            {!isDemoUser ? (
              <FormField
                label={t('profile_edit.rate_per_hour')}
                labelClassName={DARK_FIELD_LABEL_CLASS}
              >
                <InputWithClear
                  value={hourlyRate}
                  onChange={(v) => setHourlyRate(v.replace(',', '.').replace(/[^\d.]/g, ''))}
                  placeholder={t('profile_edit.placeholder_rate')}
                  className={DARK_INPUT_CLASS}
                  clearButtonClassName={DARK_CLEAR_BUTTON_CLASS}
                />
              </FormField>
            ) : null}
            {!isDemoUser ? (
              <FormField
                label={t('profile_edit.availability')}
                labelClassName={DARK_FIELD_LABEL_CLASS}
              >
                <InputWithClear
                  value={availability}
                  onChange={setAvailability}
                  placeholder={t('profile_edit.placeholder_availability')}
                  className={DARK_INPUT_CLASS}
                  clearButtonClassName={DARK_CLEAR_BUTTON_CLASS}
                />
              </FormField>
            ) : null}
          </div>
          <button
            type="submit"
            disabled={loading || success}
            className="w-full rounded-xl bg-violet-600 hover:bg-violet-500 py-3.5 font-medium text-white min-h-[44px] disabled:opacity-50"
          >
            {loading ? t('profile.saving') : t('profile.save')}
          </button>
        </form>
      </main>
      <BOLHNav current="profile" />
    </div>
  )
}
