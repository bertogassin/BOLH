'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, MapPin, Calendar, Wallet, Plus, Check } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useLocale } from '@/context/LocaleContext'
import { fetchOrders, type Order } from '@/lib/api'
import { subscribeOrderSync } from '@/lib/order_sync'
import { StatusBadge } from '@/components/StatusBadge'
import { InputWithClear } from '@/components/InputWithClear'
import { AppNav } from '@/components/AppNav'
import { formatDate } from '@/lib/format/date'

const STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'published', label: 'Published' },
  { value: 'matched', label: 'Matched' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]
const SEARCH_DEBOUNCE_MS = 220

export default function OrdersPage() {
  const { user } = useAuth()
  const { t, locale } = useLocale()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [searchQ, setSearchQ] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [showCreatedBanner, setShowCreatedBanner] = useState(false)
  const money = (value: number) => new Intl.NumberFormat(locale || 'en', {
    style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
  }).format(value)

  useEffect(() => {
    if (typeof window !== 'undefined' && window.sessionStorage.getItem('order_created') === '1') {
      window.sessionStorage.removeItem('order_created')
      setShowCreatedBanner(true)
      const t = setTimeout(() => setShowCreatedBanner(false), 4000)
      return () => clearTimeout(t)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearchQ(searchInput.trim())
    }, SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  useEffect(() => {
    if (!user || typeof document === 'undefined') {
      setOrders([])
      setLoading(false)
      return
    }
    let isCancelled = false
    let inFlight = false
    let intervalId: ReturnType<typeof setInterval> | null = null

    const loadOrders = (silent = false) => {
      if (inFlight) return
      inFlight = true
      if (!silent) setLoading(true)
      fetchOrders({ status: statusFilter || undefined, q: searchQ || undefined })
        .then((next) => {
          if (isCancelled) return
          const safeNext = Array.isArray(next) ? next : []
          setOrders((prev) => {
            if (prev.length === safeNext.length && prev[0]?.id === safeNext[0]?.id && prev[prev.length - 1]?.id === safeNext[safeNext.length - 1]?.id) {
              return prev
            }
            return safeNext
          })
        })
        .catch(() => {
          if (!isCancelled) setOrders([])
        })
        .finally(() => {
          inFlight = false
          if (!silent && !isCancelled) setLoading(false)
        })
    }

    const onVisible = () => {
      if (!document.hidden) loadOrders(true)
    }

    loadOrders()
    intervalId = setInterval(() => {
      if (!document.hidden) loadOrders(true)
    }, 10000)
    document.addEventListener('visibilitychange', onVisible)
    const unsubscribe = subscribeOrderSync(() => loadOrders(true))

    return () => {
      isCancelled = true
      if (intervalId) clearInterval(intervalId)
      document.removeEventListener('visibilitychange', onVisible)
      unsubscribe()
    }
  }, [user, statusFilter, searchQ])

  return (
    <div className="theme-page min-h-screen pb-28">
      <header className="theme-header sticky top-0 z-10 border-b backdrop-blur-xl">
        <div className="flex min-h-[76px] items-end gap-3 px-4 pb-3 pt-2">
          <Link href="/booking" className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[.04] theme-hover" aria-label="Back">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[.2em] text-violet-300">BOLH Security</p>
            <h1 className="text-xl font-bold tracking-tight">{t('orders.my_orders')}</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-4 px-4 py-5">
        {showCreatedBanner && (
          <div role="status" className="flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/20 px-4 py-3 text-emerald-200">
            <Check className="h-5 w-5 shrink-0" />
            <span>{t('orders.created_banner')}</span>
          </div>
        )}
        {user && orders.length > 0 && (
          <div className="theme-surface grid grid-cols-[auto_1fr] gap-2 rounded-2xl border p-2 shadow-xl">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="theme-input min-h-11 rounded-xl border px-3 py-2 text-sm"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value || 'all'} value={o.value}>{o.label}</option>
              ))}
            </select>
            <InputWithClear
              type="search"
              value={searchInput}
              onChange={setSearchInput}
              placeholder={t('orders.search_placeholder')}
              wrapperClassName="flex-1 min-w-0"
              className="theme-input min-h-11 w-full rounded-xl border px-3 py-2 text-sm"
            />
          </div>
        )}
        {!user ? (
          <div className="theme-surface rounded-2xl border p-6 text-center theme-text-muted">
            {t('orders.guest_msg')} <Link href="/login" className="text-guardian-blue hover:underline">{t('auth.login_btn')}</Link>
          </div>
        ) : loading ? (
          <div className="theme-surface rounded-2xl border p-8 text-center">
            <div className="mx-auto mb-2 h-8 w-8 animate-spin rounded-full border-2 border-guardian-blue border-t-transparent" />
            <p className="theme-text-muted">{t('auth.logging_in')}</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="theme-surface rounded-3xl border p-8 text-center theme-text-muted shadow-2xl">
            <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl border border-violet-400/30 bg-violet-500/10"><Wallet className="h-7 w-7 text-violet-300" /></div>
            <p className="font-semibold text-white">{t('orders.no_orders')}</p>
            <Link href="/create-order" className="bolh-primary-action mx-auto mt-5 max-w-xs text-sm">
              <Plus className="h-4 w-4" /> {t('orders.create_order')}
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {orders.map((order) => (
              <li key={order.id}>
                <Link href={`/orders/${order.id}`} className="theme-surface group block rounded-2xl border p-4 shadow-[0_12px_40px_rgba(0,0,0,.18)] transition hover:-translate-y-0.5 hover:border-violet-400/70">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold tracking-tight">{order.title}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <StatusBadge status={order.status} />
                      </div>
                      <div className="theme-text-muted mt-3 flex flex-wrap items-center gap-3 text-xs">
                        <span className="inline-flex items-center gap-1">
                          <Wallet className="h-3.5 w-3.5" />
                          {money(order.budget_min)}–{money(order.budget_max)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {formatDate(order.start_time, locale, { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                      {order.guard_count > 0 && (
                        <p className="theme-text-muted mt-2 text-xs">Guards: {order.guard_count}</p>
                      )}
                    </div>
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet-500/10 text-violet-300 transition group-hover:bg-violet-500/20"><MapPin className="h-5 w-5" /></div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>

      <AppNav />
    </div>
  )
}
