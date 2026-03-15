'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, MapPin, Calendar, Wallet, Users, FileText, XCircle, MessageCircle } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useLocale } from '@/context/LocaleContext'
import { fetchOrderWithMatch, cancelOrder, type Order, type Match } from '@/lib/api'
import { subscribeOrderSync } from '@/lib/order_sync'
import { StatusBadge } from '@/components/StatusBadge'
import { BOLHNav } from '@/components/BOLHNav'
import { formatDateTime } from '@/lib/format/date'
import { ErrorBanner } from '@/components/ErrorBanner'

const ORDER_TIMELINE = [
  { key: 'published', labelKey: 'order_detail.step_created' },
  { key: 'searching', labelKey: 'order_detail.step_searching' },
  { key: 'matched', labelKey: 'order_detail.step_matched' },
  { key: 'in_progress', labelKey: 'order_detail.step_in_progress' },
  { key: 'completed', labelKey: 'order_detail.step_completed' },
]

function timelineIndex(status: string): number {
  if (status === 'open' || status === 'published' || status === 'draft') return 0
  const idx = ORDER_TIMELINE.findIndex((s) => s.key === status)
  return idx >= 0 ? idx : 0
}

export default function OrderDetailPage({ params }: { params: { id: string } }) {
  const { user } = useAuth()
  const { t, locale } = useLocale()
  const [order, setOrder] = useState<Order | null>(null)
  const [match, setMatch] = useState<Match | null>(null)
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState(false)
  const [loadError, setLoadError] = useState('')
  const orderStatusRef = useRef<string | null>(null)

  useEffect(() => {
    orderStatusRef.current = order?.status ?? null
  }, [order?.status])

  useEffect(() => {
    if (!user || typeof document === 'undefined') {
      setLoading(false)
      return
    }

    let intervalId: ReturnType<typeof setInterval> | null = null
    let inFlight = false
    const isTerminal = (status: string | null) => status === 'cancelled' || status === 'completed'
    const load = (silent = false) => {
      if (inFlight) return
      if (silent && isTerminal(orderStatusRef.current)) return
      inFlight = true
      fetchOrderWithMatch(params.id)
        .then((data) => {
          setLoadError('')
          setOrder(data.order)
          setMatch(data.match ?? null)
        })
        .catch((err) => {
          setLoadError(err instanceof Error ? err.message : 'Failed to load order details.')
          if (!silent) setOrder(null)
        })
        .finally(() => {
          inFlight = false
          if (!silent) setLoading(false)
        })
    }

    const onVisible = () => {
      if (!document.hidden) load(true)
    }

    load()
    intervalId = setInterval(() => {
      if (!document.hidden) load(true)
    }, 15000)
    document.addEventListener('visibilitychange', onVisible)
    const unsubscribe = subscribeOrderSync(() => {
      if (!document.hidden) load(true)
    })
    return () => {
      if (intervalId) clearInterval(intervalId)
      document.removeEventListener('visibilitychange', onVisible)
      unsubscribe()
    }
  }, [user, params.id])

  const handleCancel = async () => {
    if (!order || order.status === 'cancelled') return
    if (!confirm(t('order_detail.cancel_confirm'))) return
    setCancelling(true)
    try {
      await cancelOrder(order.id)
      setOrder((o) => (o ? { ...o, status: 'cancelled' } : null))
      setMatch(null)
    } finally {
      setCancelling(false)
    }
  }

  const retryLoad = async () => {
    setLoading(true)
    try {
      const data = await fetchOrderWithMatch(params.id)
      setOrder(data.order)
      setMatch(data.match ?? null)
      setLoadError('')
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load order details.')
    } finally {
      setLoading(false)
    }
  }

  if (!user) {
    return (
      <div className="theme-page min-h-screen p-4 flex items-center justify-center text-white">
        <Link href="/login" className="text-violet-400 hover:underline">{t('auth.login_btn')}</Link>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="theme-page flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-violet-400 border-t-transparent" />
      </div>
    )
  }
  if (!order) {
    return (
      <div className="theme-page min-h-screen p-4 flex flex-col items-center justify-center text-white">
        <p>{t('order_detail.not_found')}</p>
        <Link href="/orders" className="mt-4 text-violet-400 hover:underline">← {t('order_detail.back_to_orders')}</Link>
      </div>
    )
  }

  const canCancel = ['draft', 'published', 'searching', 'open'].includes(order.status)
  const isCancelled = order.status === 'cancelled'
  const currentStep = timelineIndex(order.status)

  return (
    <div className="theme-page min-h-screen text-white pb-24">
      <header className="theme-header sticky top-0 z-10 border-b border-white/10 backdrop-blur">
        <div className="flex items-center gap-3 px-4 py-3">
          <Link href="/orders" className="p-2 rounded-lg hover:bg-white/10 min-h-[44px] min-w-[44px] flex items-center justify-center">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="truncate text-lg font-semibold">{order.title}</h1>
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-5 px-4 py-6">
        {loadError && (
          <ErrorBanner message={loadError} onRetry={retryLoad} onDismiss={() => setLoadError('')} />
        )}
        <div className="rounded-2xl bg-white/10 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-white/50">{t('order_detail.status')}</p>
          <div className="mt-1">
            <StatusBadge status={order.status} />
          </div>
        </div>

        <div className="rounded-2xl bg-white/10 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-white/50">{t('order_detail.progress')}</p>
          {isCancelled ? (
            <p className="mt-2 inline-flex items-center rounded-full border border-red-400/40 bg-red-500/20 px-2.5 py-1 text-xs text-red-200">
              {t('order_detail.cancelled')}
            </p>
          ) : (
            <div className="mt-3 space-y-2">
              {ORDER_TIMELINE.map((step, idx) => {
                const done = idx <= currentStep
                const isCurrent = idx === currentStep
                return (
                  <div key={step.key} className="flex items-center gap-2">
                    <span
                      className={`inline-flex h-2.5 w-2.5 rounded-full ${
                        done ? (isCurrent ? 'bg-violet-300' : 'bg-emerald-300') : 'bg-white/25'
                      }`}
                    />
                    <span className={`text-xs ${done ? 'text-white/90' : 'text-white/45'}`}>{t(step.labelKey)}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {match && (
          <div className="rounded-2xl bg-violet-500/20 border border-violet-400/30 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-violet-300">{t('order_detail.assigned_guard')}</p>
            <p className="mt-1 text-white font-medium">{t('order_detail.final_price')}: {match.final_price} €</p>
            <p className="text-sm text-white/70">{t('order_detail.guard_id')}: {match.guard_id.slice(0, 8)}…</p>
            <Link
              href={`/orders/${order.id}/chat`}
              className="mt-3 inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/15 min-h-[44px]"
            >
              <MessageCircle className="h-4 w-4" />
              {t('order_detail.open_chat')}
            </Link>
          </div>
        )}

        {order.description && (
          <div className="rounded-2xl bg-white/10 p-4">
            <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-white/50">
              <FileText className="h-4 w-4" /> {t('order_detail.description')}
            </p>
            <p className="mt-2 text-white/90">{order.description}</p>
          </div>
        )}

        <div className="rounded-2xl bg-white/10 p-4">
          <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-white/50">
            <Wallet className="h-4 w-4" /> {t('order_detail.budget')}
          </p>
          <p className="mt-2 text-lg font-semibold text-white">
            {order.budget_min} – {order.budget_max} €
          </p>
        </div>

        <div className="rounded-2xl bg-white/10 p-4">
          <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-white/50">
            <Calendar className="h-4 w-4" /> {t('order_detail.schedule')}
          </p>
          <p className="mt-2 text-white/90">
            {formatDateTime(order.start_time, locale, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })} – {formatDateTime(order.end_time, locale, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>

        <div className="rounded-2xl bg-white/10 p-4">
          <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-white/50">
            <Users className="h-4 w-4" /> {t('order_detail.guards')}
          </p>
          <p className="mt-2 font-medium">{order.guard_count}</p>
        </div>

        {order.latitude != null && order.longitude != null && (
          <div className="rounded-2xl bg-white/10 p-4">
            <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-white/50">
            <MapPin className="h-4 w-4" /> {t('order_detail.coordinates')}
            </p>
            <p className="mt-2 text-sm text-white/70">
              {order.latitude.toFixed(4)}, {order.longitude.toFixed(4)}
            </p>
          </div>
        )}

        {canCancel && (
          <div className="border-t border-white/10 pt-3">
            <button
              type="button"
              onClick={handleCancel}
              disabled={cancelling}
              className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-red-400/50 bg-red-500/20 py-3.5 text-red-300 hover:bg-red-500/30 disabled:opacity-50 min-h-[44px]"
            >
              <XCircle className="h-5 w-5" />
              {cancelling ? t('order_detail.cancelling') : t('order_detail.cancel_order')}
            </button>
          </div>
        )}

        <p className="pt-1">
          <Link href="/orders" className="text-violet-400 hover:underline">← {t('order_detail.back_to_orders')}</Link>
        </p>
      </main>

      <BOLHNav current="booking" />
    </div>
  )
}
