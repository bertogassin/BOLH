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
    <div className="min-h-screen bg-guardian-bg pb-24">
      <header className="sticky top-0 z-10 border-b border-gray-200/80 bg-white/95 backdrop-blur text-gray-900">
        <div className="flex items-center gap-3 px-4 py-3">
          <Link href="/booking" className="rounded-full p-2 hover:bg-gray-100">
            <ArrowLeft className="h-5 w-5 text-gray-700" />
          </Link>
          <h1 className="text-lg font-semibold text-gray-900">{t('orders.my_orders')}</h1>
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-4 px-4 py-6">
        {showCreatedBanner && (
          <div role="status" className="flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/20 px-4 py-3 text-emerald-200">
            <Check className="h-5 w-5 shrink-0" />
            <span>{t('orders.created_banner')}</span>
          </div>
        )}
        {user && orders.length > 0 && (
          <div className="flex flex-col gap-2 sm:flex-row">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
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
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500"
            />
          </div>
        )}
        {!user ? (
          <div className="card p-6 text-center text-gray-500">
            {t('orders.guest_msg')} <Link href="/login" className="text-guardian-blue hover:underline">{t('auth.login_btn')}</Link>
          </div>
        ) : loading ? (
          <div className="card p-8 text-center">
            <div className="mx-auto mb-2 h-8 w-8 animate-spin rounded-full border-2 border-guardian-blue border-t-transparent" />
            <p className="text-gray-500">{t('auth.logging_in')}</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="card p-8 text-center text-gray-500">
            <Wallet className="mx-auto mb-3 h-12 w-12 text-gray-300" />
            <p className="font-medium">{t('orders.no_orders')}</p>
            <Link href="/create-order" className="mt-4 inline-flex items-center gap-2 rounded-lg bg-guardian-blue px-4 py-2 text-sm font-medium text-white hover:bg-blue-600">
              <Plus className="h-4 w-4" /> {t('orders.create_order')}
            </Link>
          </div>
        ) : (
          <ul className="space-y-4">
            {orders.map((order) => (
              <li key={order.id}>
                <Link href={`/orders/${order.id}`} className="card block">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900 truncate">{order.title}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <StatusBadge status={order.status} />
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                        <span className="inline-flex items-center gap-1">
                          <Wallet className="h-3.5 w-3.5" />
                          {order.budget_min}–{order.budget_max} ₽
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {formatDate(order.start_time, locale, { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                      {order.guard_count > 0 && (
                        <p className="mt-1 text-xs text-gray-500">Guards: {order.guard_count}</p>
                      )}
                    </div>
                    <MapPin className="h-5 w-5 shrink-0 text-gray-400" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <p className="pt-1">
          <Link href="/booking" className="text-guardian-blue hover:underline">← Back to home</Link>
        </p>
      </main>

      <AppNav />
    </div>
  )
}
