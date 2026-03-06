'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { MapPin, Map, Shield, UserCheck, CreditCard, Sparkles, ChevronDown, ChevronUp, Wifi, WifiOff } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useLocale } from '@/context/LocaleContext'
import { useAIChat } from '@/context/AIChatContext'
import { createOrder, fetchCards, fetchOrders, type PaymentCard, type Order } from '@/lib/api'
import { subscribeOrderSync } from '@/lib/order_sync'
import { AddressAutocomplete } from '@/components/AddressAutocomplete'
import { InputWithClear } from '@/components/InputWithClear'
import { FieldError, FormErrorSummary } from '@/components/FormErrors'
import { BOLHNav } from '@/components/BOLHNav'
import { statusLabel } from '@/components/StatusBadge'
import { DARK_COMPACT_INPUT_BASE_CLASS, DARK_INLINE_INPUT_CLASS } from '@/components/formStyles'
import { getDaysInMonth } from '@/lib/datetime/timeUtils'
import { detectPlaceType, missionHintsByPlaceType } from '@/lib/booking/missionHints'
import { isExpiryValid, isValidLuhn } from '@/lib/payment/cardUtils'
import { Selector } from '@/components/booking/Selector'
import { TimeSelector } from '@/components/booking/TimeSelector'

const MONTHS = ['Jan', 'Fev', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aout', 'Sep', 'Oct', 'Nov', 'Dec']
const SERVICES = [
  { id: 'security', label: 'Security' },
  { id: 'guardian', label: 'Guardian' },
  { id: 'patrol', label: 'Patrol' },
]
const PANEL_CLASS = 'rounded-xl bg-black border border-violet-400 flex items-center justify-between min-h-[62px] px-4 py-2.5'
const DRAFT_WRITE_DEBOUNCE_MS = 250

export default function BookingPage() {
  const { user } = useAuth()
  const { t } = useLocale()
  const { openChat } = useAIChat()
  const router = useRouter()
  const now = new Date()
  const currentMonth = now.getMonth()
  const currentDay = now.getDate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const [day, setDay] = useState(now.getDate())
  const [month, setMonth] = useState(now.getMonth())
  const [fromTime, setFromTime] = useState('22:00')
  const [toTime, setToTime] = useState('00:00')
  const [service, setService] = useState('security')
  const [address, setAddress] = useState('')
  const [lat, setLat] = useState(48.8566)
  const [lon, setLon] = useState(2.3522)
  const [price, setPrice] = useState('')
  const [missionDescription, setMissionDescription] = useState('')
  const [missionTouched, setMissionTouched] = useState(false)
  const [showMissionSheet, setShowMissionSheet] = useState(false)
  const [hasMissionDraft, setHasMissionDraft] = useState(false)
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [savedCards, setSavedCards] = useState<PaymentCard[]>([])
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null)
  const [oneTimeCard, setOneTimeCard] = useState<{ last_four: string; brand: string } | null>(null)
  const [showPaymentSheet, setShowPaymentSheet] = useState(false)
  const [showOneTimeCardSheet, setShowOneTimeCardSheet] = useState(false)
  const [oneTimeCardNumber, setOneTimeCardNumber] = useState('')
  const [oneTimeCardExpiry, setOneTimeCardExpiry] = useState('')
  const [oneTimeCardCvc, setOneTimeCardCvc] = useState('')
  const [oneTimeCardHolder, setOneTimeCardHolder] = useState('')
  const [isOnline, setIsOnline] = useState(false)
  const [orderCreatedLocal, setOrderCreatedLocal] = useState(false)
  const [keyboardInset, setKeyboardInset] = useState(0)
  const [hasLastOrderTemplate, setHasLastOrderTemplate] = useState(false)
  const [draftHydrated, setDraftHydrated] = useState(false)
  const [activeOrder, setActiveOrder] = useState<Order | null>(null)
  const errorRef = useRef<HTMLDivElement>(null)

  const maxDay = getDaysInMonth(now.getFullYear(), month)
  const safeDay = Math.min(day, maxDay)
  const isCurrentMonth = month === currentMonth
  const minDay = isCurrentMonth ? currentDay : 1
  const cardDigits = oneTimeCardNumber.replace(/\D/g, '')
  const cardLastFour = cardDigits.slice(-4)
  const selectedServiceLabel = useMemo(
    () => SERVICES.find((s) => s.id === service)?.label || 'Security',
    [service]
  )
  const missionDraftKey = `guardian_booking_mission_draft_${user?.id || 'guest'}`
  const bookingDraftKey = `guardian_booking_form_draft_${user?.id || 'guest'}`
  const lastOrderTemplateKey = `guardian_booking_last_order_${user?.id || 'guest'}`
  const missionDateLabel = useMemo(
    () => `${String(safeDay).padStart(2, '0')} ${MONTHS[month]}`,
    [safeDay, month]
  )
  const placeTypeId = useMemo(() => detectPlaceType(address), [address])
  const missionHints = useMemo(() => missionHintsByPlaceType(placeTypeId), [placeTypeId])
  const autoMissionDescription = useMemo(
    () => {
      if (!address.trim() || !missionHints) return ''
      return [
        `${selectedServiceLabel}.`,
        `${missionHints.objectLabel}.`,
        `${address.trim()}.`,
        `${missionDateLabel} ${fromTime}-${toTime}.`,
        `Tasks: ${missionHints.tasks.join(', ')}.`,
      ].join(' ')
    },
    [selectedServiceLabel, address, missionDateLabel, fromTime, toTime, missionHints]
  )
  const canUseOneTimeCard =
    isValidLuhn(cardDigits) &&
    isExpiryValid(oneTimeCardExpiry) &&
    /^\d{3,4}$/.test(oneTimeCardCvc) &&
    oneTimeCardHolder.trim().length >= 2
  const selectedSavedCard = selectedCardId ? savedCards.find((card) => card.id === selectedCardId) : null
  const hasSelectedPaymentMethod = Boolean(selectedSavedCard || oneTimeCard)
  const paymentValidationError = submitAttempted && !hasSelectedPaymentMethod
  const paymentPreview = useMemo(() => {
    if (selectedSavedCard) return `•••• ${selectedSavedCard.last_four}`
    if (oneTimeCard) return `•••• ${oneTimeCard.last_four}`
    return '—'
  }, [selectedSavedCard, oneTimeCard])
  const paymentSheetIsFloating = keyboardInset > 0
  const isAnyDrawerOpen = showMissionSheet || showPaymentSheet || showOneTimeCardSheet
  const shouldHideBottomNav = showMissionSheet || showPaymentSheet || showOneTimeCardSheet || keyboardInset > 0
  const addressError = submitAttempted && !address.trim()
  const termsError = submitAttempted && !acceptTerms
  const onlineError = submitAttempted && !isOnline
  const priceError = submitAttempted && !price.trim()

  useEffect(() => {
    if (day > maxDay) setDay(maxDay)
  }, [day, maxDay])

  useEffect(() => {
    if (!user || typeof document === 'undefined') {
      setActiveOrder(null)
      return
    }
    let timerId: ReturnType<typeof setInterval> | null = null
    let inFlight = false
    const ACTIVE_STATUSES = ['published', 'open', 'searching', 'matched', 'in_progress']

    const loadActiveOrder = () => {
      if (inFlight) return
      inFlight = true
      fetchOrders()
        .then((ordersList) => {
          const list = Array.isArray(ordersList) ? ordersList : []
          const next = list.find((o) => ACTIVE_STATUSES.includes(o.status)) || null
          setActiveOrder(next)
        })
        .catch(() => setActiveOrder(null))
        .finally(() => {
          inFlight = false
        })
    }

    const handleVisibility = () => {
      if (document.hidden) return
      loadActiveOrder()
    }

    loadActiveOrder()
    timerId = setInterval(() => {
      if (!document.hidden) loadActiveOrder()
    }, 10000)
    document.addEventListener('visibilitychange', handleVisibility)
    const unsubscribe = subscribeOrderSync(() => {
      if (!document.hidden) loadActiveOrder()
    })
    return () => {
      if (timerId) clearInterval(timerId)
      document.removeEventListener('visibilitychange', handleVisibility)
      unsubscribe()
    }
  }, [user])

  useEffect(() => {
    if (day < minDay) setDay(minDay)
  }, [day, minDay])

  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [error])

  useEffect(() => {
    if (!missionTouched) {
      setMissionDescription(autoMissionDescription)
    }
  }, [autoMissionDescription, missionTouched])

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(missionDraftKey)
      if (!raw) {
        setHasMissionDraft(false)
        return
      }
      const draft = raw.trim()
      if (!draft) {
        setHasMissionDraft(false)
        return
      }
      setMissionDescription(draft)
      setMissionTouched(true)
      setHasMissionDraft(true)
    } catch {
      setHasMissionDraft(false)
    }
  }, [missionDraftKey])

  useEffect(() => {
    if (!missionDescription.trim()) return
    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(missionDraftKey, missionDescription)
        setHasMissionDraft(true)
      } catch {
        // Ignore local storage write errors in UI.
      }
    }, DRAFT_WRITE_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [missionDescription, missionDraftKey])

  useEffect(() => {
    if (!user) return
    fetchCards()
      .then(setSavedCards)
      .catch(() => setSavedCards([]))
  }, [user])

  useEffect(() => {
    if (!user) {
      setDraftHydrated(false)
      setHasLastOrderTemplate(false)
      return
    }
    try {
      const rawDraft = window.localStorage.getItem(bookingDraftKey)
      if (rawDraft) {
        const parsed = JSON.parse(rawDraft) as {
          day?: number
          month?: number
          fromTime?: string
          toTime?: string
          service?: string
          address?: string
          lat?: number
          lon?: number
          price?: string
          missionDescription?: string
          missionTouched?: boolean
          acceptTerms?: boolean
          selectedCardId?: string | null
        }
        if (typeof parsed.day === 'number') setDay(parsed.day)
        if (typeof parsed.month === 'number') setMonth(Math.max(currentMonth, Math.min(11, parsed.month)))
        if (typeof parsed.fromTime === 'string') setFromTime(parsed.fromTime)
        if (typeof parsed.toTime === 'string') setToTime(parsed.toTime)
        if (typeof parsed.service === 'string') setService(parsed.service)
        if (typeof parsed.address === 'string') setAddress(parsed.address)
        if (typeof parsed.lat === 'number') setLat(parsed.lat)
        if (typeof parsed.lon === 'number') setLon(parsed.lon)
        if (typeof parsed.price === 'string') setPrice(parsed.price)
        if (typeof parsed.missionDescription === 'string') setMissionDescription(parsed.missionDescription)
        if (typeof parsed.missionTouched === 'boolean') setMissionTouched(parsed.missionTouched)
        if (typeof parsed.acceptTerms === 'boolean') setAcceptTerms(parsed.acceptTerms)
        if (typeof parsed.selectedCardId === 'string' || parsed.selectedCardId === null) {
          setSelectedCardId(parsed.selectedCardId)
        }
      }
      const rawTemplate = window.localStorage.getItem(lastOrderTemplateKey)
      setHasLastOrderTemplate(Boolean(rawTemplate))
    } catch {
      setHasLastOrderTemplate(false)
    } finally {
      setDraftHydrated(true)
    }
  }, [user, bookingDraftKey, lastOrderTemplateKey, currentMonth])

  useEffect(() => {
    if (!user || !draftHydrated) return
    const payload = {
      day,
      month,
      fromTime,
      toTime,
      service,
      address,
      lat,
      lon,
      price,
      missionDescription,
      missionTouched,
      acceptTerms,
      selectedCardId,
    }
    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(bookingDraftKey, JSON.stringify(payload))
      } catch {
        // Ignore local storage write errors in UI.
      }
    }, DRAFT_WRITE_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [
    user,
    draftHydrated,
    day,
    month,
    fromTime,
    toTime,
    service,
    address,
    lat,
    lon,
    price,
    missionDescription,
    missionTouched,
    acceptTerms,
    selectedCardId,
    bookingDraftKey,
  ])

  useEffect(() => {
    if (!selectedCardId) return
    if (!savedCards.some((card) => card.id === selectedCardId)) {
      setSelectedCardId(null)
    }
  }, [savedCards, selectedCardId])

  useEffect(() => {
    if (typeof window === 'undefined') return
    setOrderCreatedLocal(window.sessionStorage.getItem('order_created') === '1')
  }, [])

  useEffect(() => {
    // Always open booking on the main screen state.
    setShowMissionSheet(false)
    setShowPaymentSheet(false)
    setShowOneTimeCardSheet(false)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return
    const vv = window.visualViewport
    const updateKeyboardInset = () => {
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
      setKeyboardInset(inset > 40 ? inset : 0)
    }
    updateKeyboardInset()
    vv.addEventListener('resize', updateKeyboardInset)
    vv.addEventListener('scroll', updateKeyboardInset)
    return () => {
      vv.removeEventListener('resize', updateKeyboardInset)
      vv.removeEventListener('scroll', updateKeyboardInset)
    }
  }, [])


  useEffect(() => {
    if (!user) {
      setIsOnline(false)
      return
    }
    const detailsStorageKey = `guardian_profile_details_${user.id}`
    try {
      const raw = window.localStorage.getItem(detailsStorageKey)
      if (!raw) {
        setIsOnline(false)
        return
      }
      const parsed = JSON.parse(raw) as { online?: boolean }
      setIsOnline(Boolean(parsed.online))
    } catch {
      setIsOnline(false)
    }
  }, [user])

  const toggleOnlineStatus = () => {
    if (!user) return
    const detailsStorageKey = `guardian_profile_details_${user.id}`
    setIsOnline((prev) => {
      if (!prev) {
        try {
          const raw = window.localStorage.getItem(detailsStorageKey)
          const parsed = raw ? (JSON.parse(raw) as { rib?: string }) : {}
          const rib = String(parsed.rib || '').trim()
          if (!rib) {
            setError('Add your RIB in Settings before switching to Online mode.')
            return prev
          }
        } catch {
          setError('Add your RIB in Settings before switching to Online mode.')
          return prev
        }
      }
      const next = !prev
      try {
        const raw = window.localStorage.getItem(detailsStorageKey)
        const parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {}
        window.localStorage.setItem(detailsStorageKey, JSON.stringify({ ...parsed, online: next }))
      } catch {
        // Ignore local storage write errors in UI.
      }
      if (next) setError('')
      return next
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitAttempted(true)
    setError('')
    if (!user) {
      router.push('/login')
      router.refresh()
      return
    }
    if (!address.trim()) {
      setError('Please enter an address.')
      return
    }
    if (!acceptTerms) {
      setError('Please accept terms and privacy policy.')
      return
    }
    if (!isOnline) {
      setError('Switch to Online mode before creating an order.')
      return
    }
    if (!hasSelectedPaymentMethod) {
      setError('Please select a payment method.')
      return
    }
    const p = parseFloat(price) || 0
    if (!price.trim()) {
      setError('Please enter your price per hour.')
      return
    }
    if (p < 0) {
      setError('Price cannot be negative.')
      return
    }
    setLoading(true)
    try {
      const y = now.getFullYear()
      const m = month
      const d = safeDay
      const start = new Date(y, m, d, parseInt(fromTime.slice(0, 2), 10), parseInt(fromTime.slice(3), 10))
      let end = new Date(y, m, d, parseInt(toTime.slice(0, 2), 10), parseInt(toTime.slice(3), 10))
      if (start <= new Date()) {
        setError('Start time must be in the future.')
        return
      }
      if (end <= start) end = new Date(end.getTime() + 24 * 60 * 60 * 1000)
      await createOrder({
        title: `${SERVICES.find(s => s.id === service)?.label || 'Guardian'} · ${address.slice(0, 30)}`,
        description: missionDescription.trim() || autoMissionDescription,
        budget_min: p,
        budget_max: p,
        latitude: lat,
        longitude: lon,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        guard_count: 1,
      })
      try {
        window.localStorage.setItem(
          lastOrderTemplateKey,
          JSON.stringify({
            day: safeDay,
            month,
            fromTime,
            toTime,
            service,
            address,
            lat,
            lon,
            price,
            missionDescription: missionDescription.trim() || autoMissionDescription,
          })
        )
        window.localStorage.removeItem(bookingDraftKey)
        setHasLastOrderTemplate(true)
      } catch {
        // Ignore local storage write errors in UI.
      }
      if (typeof window !== 'undefined') window.sessionStorage.setItem('order_created', '1')
      setOrderCreatedLocal(true)
      setSubmitAttempted(false)
      router.push('/orders')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  const restoreMissionDraft = () => {
    try {
      const raw = window.localStorage.getItem(missionDraftKey)
      if (!raw?.trim()) return
      setMissionDescription(raw)
      setMissionTouched(true)
      setShowMissionSheet(true)
    } catch {
      // Ignore restore errors in UI.
    }
  }

  const clearMissionText = () => {
    setMissionTouched(true)
    setMissionDescription('')
  }

  const applyLastOrderTemplate = () => {
    if (!user) return
    try {
      const raw = window.localStorage.getItem(lastOrderTemplateKey)
      if (!raw) return
      const parsed = JSON.parse(raw) as {
        day?: number
        month?: number
        fromTime?: string
        toTime?: string
        service?: string
        address?: string
        lat?: number
        lon?: number
        price?: string
        missionDescription?: string
      }
      if (typeof parsed.day === 'number') setDay(parsed.day)
      if (typeof parsed.month === 'number') setMonth(Math.max(currentMonth, Math.min(11, parsed.month)))
      if (typeof parsed.fromTime === 'string') setFromTime(parsed.fromTime)
      if (typeof parsed.toTime === 'string') setToTime(parsed.toTime)
      if (typeof parsed.service === 'string') setService(parsed.service)
      if (typeof parsed.address === 'string') setAddress(parsed.address)
      if (typeof parsed.lat === 'number') setLat(parsed.lat)
      if (typeof parsed.lon === 'number') setLon(parsed.lon)
      if (typeof parsed.price === 'string') setPrice(parsed.price)
      if (typeof parsed.missionDescription === 'string') {
        setMissionDescription(parsed.missionDescription)
        setMissionTouched(true)
      }
      setSubmitAttempted(false)
      setError('')
    } catch {
      // Ignore parsing errors in UI.
    }
  }

  if (!user) {
    return (
      <div className="min-h-dvh bg-black p-4 flex flex-col items-center justify-center gap-4 pb-32">
        <p className="text-white/75 text-center">Log in to create a security order.</p>
        <Link href="/login" className="rounded-xl bg-violet-600 hover:bg-violet-500 px-6 py-3.5 font-medium text-white min-h-[44px] flex items-center justify-center">
          Log in
        </Link>
        <Link href="/register" className="text-sm text-white/70 hover:text-white">Create account</Link>
      </div>
    )
  }
  return (
    <div className="min-h-dvh bg-black text-white flex flex-col">
      <header className="sticky top-0 z-20 border-b border-violet-400 bg-black/95 backdrop-blur">
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-lg font-bold uppercase tracking-wide">
            <span className="text-orange-300 font-extrabold">BOLH</span>{' '}
            <span className="text-white font-medium">SECURITY</span>
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleOnlineStatus}
              className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs border transition ${
                submitAttempted && !isOnline
                  ? 'bg-red-500/20 border-red-400/60 text-red-200 hover:bg-red-500/30'
                  : isOnline
                  ? 'bg-green-500/20 border-green-400/40 text-green-200 hover:bg-green-500/30'
                  : 'bg-white/10 border-violet-400 text-white/80 hover:bg-white/15'
              }`}
            >
              <span
                className={`inline-block h-2 w-2 rounded-full ${
                  submitAttempted && !isOnline
                    ? 'bg-red-300'
                    : isOnline
                      ? 'bg-green-300 animate-pulse'
                      : 'bg-white/70'
                }`}
              />
              {isOnline ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
              {isOnline ? 'Online' : 'Offline'}
            </button>
            <button type="button" onClick={openChat} className="p-2 rounded-lg hover:bg-white/10 min-h-[44px] min-w-[44px] flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400" aria-label="BOLH AI chat">
              <Sparkles className="h-5 w-5 text-white/80" />
            </button>
          </div>
        </div>
      </header>

      <main className="w-full flex-1 overflow-y-auto overflow-x-hidden px-4 pt-5 pb-[70px] text-[17px]">
        <div className="relative mx-auto w-[94%] origin-top scale-[1.06]">
        {isAnyDrawerOpen && (
          <div
            className="absolute inset-0 z-40 bg-black/28 backdrop-blur-[2px] pointer-events-auto"
            aria-hidden="true"
          />
        )}
        <form onSubmit={handleSubmit} className="space-y-6">
          {hasLastOrderTemplate && (
            <button
              type="button"
              onClick={applyLastOrderTemplate}
              className="w-full rounded-lg border border-violet-400 bg-black px-3 py-2 text-sm text-white/85 hover:bg-white/5"
            >
              Repeat last order
            </button>
          )}
          {error && (
            <div ref={errorRef} className="flex items-center justify-between gap-2 rounded-xl bg-red-500/20 border border-red-500/40 p-3">
              <FormErrorSummary
                message={error}
                className="border-0 bg-transparent p-0 text-sm text-red-200"
              />
              <button type="button" onClick={() => setError('')} className="shrink-0 p-1 rounded hover:bg-red-500/20 text-red-200" aria-label="Close">×</button>
            </div>
          )}
          {activeOrder && (
            <div className="rounded-xl border border-violet-400 bg-black px-3 py-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-white/75 uppercase tracking-wide">Active order</span>
                <span className="rounded-full border border-violet-400/80 bg-white/5 px-2 py-0.5 text-[11px] text-white/85">
                  {statusLabel(activeOrder.status, t)}
                </span>
              </div>
              <p className="mt-1 truncate text-sm text-white/90">{activeOrder.title}</p>
              <div className="mt-2 flex items-center gap-2">
                <Link
                  href={`/orders/${activeOrder.id}`}
                  className="inline-flex min-h-[38px] items-center rounded-md border border-violet-400/70 px-2.5 py-1 text-xs text-white/85 hover:bg-white/10"
                >
                  Details
                </Link>
                <Link
                  href={`/orders/${activeOrder.id}/chat`}
                  className="inline-flex min-h-[38px] items-center rounded-md border border-violet-400/70 px-2.5 py-1 text-xs text-white/85 hover:bg-white/10"
                >
                  Chat
                </Link>
                <Link
                  href="/map"
                  className="inline-flex min-h-[38px] items-center rounded-md border border-violet-400/70 px-2.5 py-1 text-xs text-white/85 hover:bg-white/10"
                >
                  Map
                </Link>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {SERVICES.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setService(option.id)}
                  className={`rounded-lg px-2.5 py-3 text-[17px] font-medium transition ${
                    service === option.id
                      ? 'bg-violet-600 text-white border border-violet-400'
                      : 'bg-transparent text-white/80 border border-violet-400 hover:bg-white/10'
                  }`}
                >
                  <span className="inline-flex items-center justify-center gap-1.5">
                    {option.id === 'security' ? (
                      <Shield className="h-3.5 w-3.5" />
                    ) : option.id === 'guardian' ? (
                      <UserCheck className="h-3.5 w-3.5" />
                    ) : (
                      <Map className="h-3.5 w-3.5" />
                    )}
                    {option.label}
                  </span>
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Selector
                label={t('booking.day')}
                value={String(safeDay).padStart(2, '0')}
                onPrev={() => setDay((d) => Math.max(minDay, d - 1))}
                onNext={() => setDay((d) => Math.min(maxDay, d + 1))}
                disablePrev={safeDay <= minDay}
                disableNext={safeDay >= maxDay}
                ariaLabelPrev="Previous day"
                ariaLabelNext="Next day"
                panelClass={PANEL_CLASS}
              />
              <Selector
                label={t('booking.month')}
                value={MONTHS[month]}
                onPrev={() => setMonth((m) => Math.max(currentMonth, m - 1))}
                onNext={() => setMonth((m) => Math.min(11, m + 1))}
                disablePrev={month <= currentMonth}
                disableNext={month >= 11}
                ariaLabelPrev="Previous month"
                ariaLabelNext="Next month"
                panelClass={PANEL_CLASS}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <TimeSelector label={t('booking.from')} value={fromTime} onChange={setFromTime} panelClass={PANEL_CLASS} />
              <TimeSelector label={t('booking.to')} value={toTime} onChange={setToTime} panelClass={PANEL_CLASS} />
            </div>
          </div>

          <AddressAutocomplete
            value={address}
            onChange={(v) => {
              setAddress(v)
              // Keep mission in live auto mode while user edits address.
              setMissionTouched(false)
              if (error) setError('')
            }}
            onSelect={(r) => {
              setLat(r.latitude)
              setLon(r.longitude)
              setAddress(r.display)
              setMissionTouched(false)
              if (error) setError('')
            }}
            placeholder={t('booking.address')}
            hasError={submitAttempted && !address.trim()}
          />
          {address.trim() && missionHints && (
            <div className="rounded-xl border border-violet-400 bg-black px-3 py-2.5">
              <p className="text-[11px] text-white/75">Detected object</p>
              <p className="mt-0.5 text-xs text-white/90">{missionHints.objectLabel}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {missionHints.tasks.map((task) => (
                  <span key={task} className="rounded-full border border-violet-400/70 bg-white/5 px-2 py-0.5 text-[10px] text-white/80">
                    {task}
                  </span>
                ))}
              </div>
            </div>
          )}
          {addressError ? <FieldError message="Address is required." className="mt-1 text-xs text-red-300" /> : null}
          <div className={`relative ${showMissionSheet ? 'z-50' : ''} rounded-xl bg-black border ${submitAttempted && !price.trim() ? 'border-red-500/80' : 'border-violet-400'}`}>
            <div className="min-h-[56px] px-3 py-3.5 border-b border-violet-400 flex items-center justify-between text-[11px] text-white/85">
              <span className="inline-flex items-center gap-1.5 text-left text-white/85">
                <Shield className="h-3.5 w-3.5" />
                Mission
              </span>
              <span className="text-[10px] text-white/65">{missionDescription.length}/2500</span>
            </div>
            <button
              type="button"
              onClick={() => setShowMissionSheet((v) => !v)}
              className={`w-full border-t ${submitAttempted && !price.trim() ? 'border-red-500/80' : 'border-violet-400'} px-3 py-1.5 text-[11px] text-white/85 flex items-center justify-between hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/80`}
            >
              <span className="truncate">{missionDescription ? t('booking.mission_description') : t('booking.mission_add_description')}</span>
              <span className="inline-flex items-center gap-1">
                {missionDescription.length}
                {showMissionSheet ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </span>
            </button>
            {showMissionSheet && (
              <div
                className={`${
                  paymentSheetIsFloating
                    ? 'fixed left-2 right-2 z-50 mx-auto w-auto max-w-lg max-h-[56dvh] overflow-y-auto overscroll-contain rounded-xl'
                    : 'absolute left-0 right-0 top-[calc(100%+6px)] z-50 rounded-xl'
                } border px-2 py-1.5 shadow-2xl ${
                  submitAttempted && !price.trim()
                    ? 'border-red-500/80 bg-[#0b0b0f]/95 ring-1 ring-red-500/20'
                    : 'border-violet-300/80 bg-[#0b0b0f]/95 ring-1 ring-white/10'
                }`}
                style={paymentSheetIsFloating ? { bottom: `${keyboardInset + 112}px` } : { transform: 'translateY(-112px)' }}
              >
                <div className="mb-1 flex items-center justify-end rounded-md border border-white/10 bg-white/5 px-2 py-1">
                  <button
                    type="button"
                    onClick={() => setShowMissionSheet(false)}
                    className="inline-flex items-center gap-1 rounded border border-violet-400/60 px-1.5 py-0.5 text-[11px] text-white/85 hover:bg-white/10"
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                    Collapse
                  </button>
                </div>
                <div className="mb-1 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setMissionTouched(false)
                      setMissionDescription(autoMissionDescription)
                    }}
                    className="rounded px-2 py-0.5 text-xs border border-violet-400/60 text-white/70 hover:bg-white/10"
                  >
                    Auto
                  </button>
                  <button
                    type="button"
                    onClick={restoreMissionDraft}
                    disabled={!hasMissionDraft}
                    className="rounded px-2 py-0.5 text-xs border border-violet-400/60 text-white/70 hover:bg-white/10 disabled:opacity-40"
                  >
                    Restore
                  </button>
                  <button
                    type="button"
                    onClick={clearMissionText}
                    className="rounded px-2 py-0.5 text-xs border border-violet-400/60 text-white/70 hover:bg-white/10"
                  >
                    Clear
                  </button>
                </div>
              <textarea
                value={missionDescription}
                onChange={(e) => {
                  setMissionTouched(true)
                  setMissionDescription(e.target.value)
                }}
                maxLength={2500}
                rows={4}
                placeholder={t('booking.mission_placeholder')}
                className="w-full resize-y rounded-lg bg-black border border-violet-400 px-2 py-1.5 text-xs text-white placeholder:text-white/40 outline-none focus:border-violet-300"
              />
              <div className="mt-1 flex items-center justify-between text-[10px] text-white/65">
                <span>You can keep this text or add details. Draft is saved automatically.</span>
                <span>{missionDescription.length}/2500</span>
              </div>
            </div>
            )}
          </div>
          <div className={`relative rounded-xl bg-black border ${paymentValidationError ? 'border-red-500/80' : 'border-violet-400'}`}>
            <div className="rounded-t-xl bg-black flex items-center gap-2.5 min-h-[56px] px-3 py-3.5">
              <span className="text-white/60 shrink-0 w-4 text-center text-sm" aria-hidden="true">€</span>
              <InputWithClear
                value={price}
                onChange={(v) => setPrice(v.replace(',', '.'))}
                placeholder={t('booking.your_price')}
                wrapperClassName="flex-1 min-w-0"
                className={DARK_INLINE_INPUT_CLASS}
                clearButtonClassName="text-white/60 hover:text-white hover:bg-white/10"
                inputMode="decimal"
                aria-label={t('booking.your_price')}
              />
              <span className="text-white/60 text-[11px] shrink-0">/ hour</span>
            </div>
            <div className={`px-3 py-1.5 border-t ${paymentValidationError ? 'border-red-500/80' : 'border-violet-400'} flex items-center justify-between text-[11px] text-white/85`}>
              <button
                type="button"
                onClick={() => {
                  setShowOneTimeCardSheet((v) => !v)
                  setShowPaymentSheet(false)
                }}
                className="inline-flex items-center gap-1.5 text-white/85 hover:text-white"
              >
                <CreditCard className="h-3 w-3" />
                Payment card
              </button>
              <div className="inline-flex items-center gap-1.5">
                <span className="tabular-nums text-white/85">{paymentPreview}</span>
                <button
                  type="button"
                  onClick={() => {
                    setShowPaymentSheet((v) => !v)
                    setShowOneTimeCardSheet(false)
                  }}
                  className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] text-white/90 hover:bg-white/10 ${
                    paymentValidationError ? 'border-red-500/80' : 'border-violet-400/70'
                  }`}
                  aria-label={t('booking.select_saved_card_aria')}
                >
                  {showPaymentSheet ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
            {showPaymentSheet && (
              <div
                className={`${
                  paymentSheetIsFloating
                    ? 'fixed left-2 right-2 z-50 mx-auto w-auto max-w-lg max-h-[52dvh] overflow-y-auto overscroll-contain rounded-xl'
                    : 'absolute left-0 right-0 top-[calc(100%+6px)] z-50 rounded-xl'
                } border px-2 py-1.5 shadow-2xl ${paymentValidationError ? 'border-red-500/80 bg-[#0b0b0f]/95 ring-1 ring-red-500/20' : 'border-violet-300/80 bg-[#0b0b0f]/95 ring-1 ring-white/10'}`}
                style={paymentSheetIsFloating ? { bottom: `${keyboardInset + 8}px` } : undefined}
              >
                <div className="mb-1 flex items-center justify-between rounded-md border border-white/10 bg-white/5 px-2 py-1">
                  <span className="text-[11px] text-white/70">Saved cards</span>
                  <button
                    type="button"
                    onClick={() => setShowPaymentSheet(false)}
                    className="inline-flex items-center gap-1 rounded border border-violet-400/60 px-1.5 py-0.5 text-[11px] text-white/85 hover:bg-white/10"
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                    Collapse
                  </button>
                </div>
                {savedCards.length === 0 ? (
                  <p className="mt-1 text-[11px] text-white/50">No saved cards</p>
                ) : (
                  <div className="mt-1 flex gap-1.5 overflow-x-auto pb-0.5">
                    {savedCards.map((card) => (
                      <button
                        key={card.id}
                        type="button"
                        onClick={() => { setSelectedCardId(card.id); setOneTimeCard(null); setShowPaymentSheet(false) }}
                        className={`shrink-0 rounded-lg border px-2 py-1 text-xs transition-colors ${
                          selectedCardId === card.id
                            ? paymentValidationError
                              ? 'bg-red-500/20 border-red-500/80 text-white'
                              : 'bg-violet-500/30 border-violet-400 text-white'
                            : paymentValidationError
                              ? 'bg-black border-red-500/80 text-white/90 hover:bg-black'
                              : 'bg-black border-violet-400 text-white/90 hover:bg-black'
                        }`}
                      >
                        <span className="tabular-nums">•••• {card.last_four}</span>
                        <span className="ml-1 text-[9px] text-white/60 uppercase">{card.brand}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {showOneTimeCardSheet && (
              <div
                className={`${
                  paymentSheetIsFloating
                    ? 'fixed left-2 right-2 z-50 mx-auto w-auto max-w-lg max-h-[56dvh] overflow-y-auto overscroll-contain rounded-xl'
                    : 'absolute left-0 right-0 top-[calc(100%+6px)] z-50 rounded-xl'
                } border px-2 py-1.5 shadow-2xl ${paymentValidationError ? 'border-red-500/80 bg-[#0b0b0f]/95 ring-1 ring-red-500/20' : 'border-violet-300/80 bg-[#0b0b0f]/95 ring-1 ring-white/10'}`}
                style={paymentSheetIsFloating ? { bottom: `${keyboardInset + 112}px` } : { transform: 'translateY(-112px)' }}
              >
                <div className="mb-1 flex items-center justify-end rounded-md border border-white/10 bg-white/5 px-2 py-1">
                  <button
                    type="button"
                    onClick={() => setShowOneTimeCardSheet(false)}
                    className="inline-flex items-center gap-1 rounded border border-violet-400/60 px-1.5 py-0.5 text-[11px] text-white/85 hover:bg-white/10"
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                    Collapse
                  </button>
                </div>
                <div className="mt-1 grid grid-cols-1 gap-1.5">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={19}
                    value={oneTimeCardNumber}
                    onChange={e => {
                      const digits = e.target.value.replace(/\D/g, '').slice(0, 16)
                      const grouped = digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim()
                      setOneTimeCardNumber(grouped)
                      setOneTimeCard(null)
                    }}
                    placeholder={t('booking.card_number')}
                    className={`${DARK_COMPACT_INPUT_BASE_CLASS} ${
                      submitAttempted && oneTimeCardNumber.trim().length > 0 && !isValidLuhn(cardDigits)
                        ? 'border-red-500/80 focus:border-red-500/80'
                        : 'border-violet-400 focus:border-violet-400'
                    }`}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={5}
                      value={oneTimeCardExpiry}
                      onChange={e => {
                        const digits = e.target.value.replace(/\D/g, '').slice(0, 4)
                        const formatted = digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits
                        setOneTimeCardExpiry(formatted)
                        setOneTimeCard(null)
                      }}
                      placeholder="MM/YY"
                      className={`${DARK_COMPACT_INPUT_BASE_CLASS} ${
                        submitAttempted && oneTimeCardExpiry.trim().length > 0 && !isExpiryValid(oneTimeCardExpiry)
                          ? 'border-red-500/80 focus:border-red-500/80'
                          : 'border-violet-400 focus:border-violet-400'
                      }`}
                    />
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={4}
                      value={oneTimeCardCvc}
                      onChange={e => {
                        setOneTimeCardCvc(e.target.value.replace(/\D/g, '').slice(0, 4))
                        setOneTimeCard(null)
                      }}
                      placeholder="CVC"
                      className={`${DARK_COMPACT_INPUT_BASE_CLASS} ${
                        submitAttempted && oneTimeCardCvc.trim().length > 0 && !/^\d{3,4}$/.test(oneTimeCardCvc)
                          ? 'border-red-500/80 focus:border-red-500/80'
                          : 'border-violet-400 focus:border-violet-400'
                      }`}
                    />
                  </div>
                  <input
                    type="text"
                    value={oneTimeCardHolder}
                    onChange={e => {
                      setOneTimeCardHolder(e.target.value)
                      setOneTimeCard(null)
                    }}
                    placeholder="Cardholder name"
                    className={`${DARK_COMPACT_INPUT_BASE_CLASS} ${
                      submitAttempted && oneTimeCardHolder.trim().length > 0 && oneTimeCardHolder.trim().length < 2
                        ? 'border-red-500/80 focus:border-red-500/80'
                        : 'border-violet-400 focus:border-violet-400'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (canUseOneTimeCard && cardLastFour.length === 4) {
                        setOneTimeCard({ last_four: cardLastFour, brand: 'card' })
                        setSelectedCardId(null)
                        setShowOneTimeCardSheet(false)
                      }
                    }}
                    disabled={!canUseOneTimeCard}
                    className="w-full rounded-lg bg-violet-600 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
                  >
                    Use this card
                  </button>
                </div>
              </div>
            )}
          </div>
          {priceError ? <FieldError message="Price is required." className="mt-1 text-xs text-red-300" /> : null}
          {paymentValidationError ? <FieldError message="Please choose at least one payment method." className="mt-1 text-xs text-red-300" /> : null}
          {onlineError ? <FieldError message="You need to be online to publish an order." className="mt-1 text-xs text-red-300" /> : null}

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={acceptTerms}
              onChange={e => { setAcceptTerms(e.target.checked); if (error) setError('') }}
              className={`mt-1 rounded bg-white/10 text-violet-500 focus:ring-violet-500 ${submitAttempted && !acceptTerms ? 'border-red-500 ring-1 ring-red-500/70' : 'border-white'}`}
              aria-describedby="terms-desc"
            />
            <span id="terms-desc" className={`text-sm ${submitAttempted && !acceptTerms ? 'text-red-300' : 'text-white/80'}`}>
              {t('booking.accept_terms')}{' '}
              <Link href="/legal/terms" className="text-violet-400 hover:underline">{t('booking.terms_link')}</Link>
              {' · '}
              <Link href="/legal/privacy" className="text-violet-400 hover:underline">{t('booking.privacy_link')}</Link>
            </span>
          </label>
          {termsError ? <FieldError message="Please accept terms and privacy policy." className="mt-1 text-xs text-red-300" /> : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[#6b21a8] hover:bg-[#7c3aed] py-3.5 font-medium text-white flex items-center justify-center gap-2 disabled:opacity-50 transition-colors min-h-[46px] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
            aria-busy={loading}
          >
            {loading ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" aria-hidden /> : <MapPin className="h-5 w-5" />}
            {address ? (loading ? t('booking.sending') : t('booking.confirm')) : t('booking.enter_address')}
          </button>
        </form>
        </div>
      </main>
      {!shouldHideBottomNav && <BOLHNav current="booking" />}
    </div>
  )
}


