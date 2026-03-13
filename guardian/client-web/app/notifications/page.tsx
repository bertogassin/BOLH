'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, Bell } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useLocale } from '@/context/LocaleContext'
import { fetchNotifications, markNotificationRead, type Notification } from '@/lib/api'
import { BOLHNav } from '@/components/BOLHNav'
import { ErrorRetry } from '@/components/ErrorRetry'
import { formatDateTime } from '@/lib/format/date'

export default function NotificationsPage() {
  const { user } = useAuth()
  const { t, locale } = useLocale()
  const [list, setList] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(false)
  const inFlightRef = useRef(false)

  const load = useCallback(() => {
    if (!user || inFlightRef.current) return
    setFetchError(false)
    setLoading(true)
    inFlightRef.current = true
    fetchNotifications()
      .then((data) => {
        const next = Array.isArray(data) ? data : []
        setList((prev) => {
          const sameSize = prev.length === next.length
          const sameFirst = prev[0]?.id === next[0]?.id
          const sameLast = prev[prev.length - 1]?.id === next[next.length - 1]?.id
          return sameSize && sameFirst && sameLast ? prev : next
        })
        setFetchError(false)
      })
      .catch(() => setFetchError(true))
      .finally(() => {
        inFlightRef.current = false
        setLoading(false)
      })
  }, [user])

  useEffect(() => {
    if (!user) return
    load()
  }, [user, load])

  const handleMark = async (n: Notification) => {
    if (n.read) return
    try {
      await markNotificationRead(n.id)
      setList((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)))
    } catch {
      // ignore
    }
  }

  if (!user) {
    return (
      <div className="theme-page min-h-screen text-white flex items-center justify-center">
        <Link href="/login" className="text-violet-400 hover:underline">{t('auth.login_btn')}</Link>
      </div>
    )
  }

  return (
    <div className="theme-page min-h-screen text-white pb-24">
      <header className="theme-header sticky top-0 z-10 border-b border-white/10 backdrop-blur">
        <div className="flex items-center gap-2 px-4 py-3">
          <Link href="/profile" className="p-2 rounded-lg theme-hover min-h-[44px] min-w-[44px] flex items-center justify-center">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-lg font-semibold">{t('navigation.notifications')}</h1>
        </div>
      </header>
      <main className="mx-auto max-w-lg px-4 py-5">
        {loading ? (
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 rounded-xl bg-white/10" />
            ))}
          </div>
        ) : fetchError ? (
          <ErrorRetry message={t('notifications.load_failed')} onRetry={load} />
        ) : list.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="theme-surface h-16 w-16 rounded-2xl flex items-center justify-center mb-4">
              <Bell className="h-8 w-8 text-white/50" />
            </div>
            <p className="text-white/70 font-medium">{t('notifications.empty_title')}</p>
            <p className="text-sm text-white/50 mt-1">{t('notifications.empty_subtitle')}</p>
            <Link href="/profile" className="mt-6 text-violet-400 hover:underline text-sm">{t('notifications.to_profile')}</Link>
          </div>
        ) : (
          <ul className="space-y-2">
            {list.map((n) => (
              <li
                key={n.id}
                role="button"
                tabIndex={0}
                onClick={() => handleMark(n)}
                onKeyDown={(e) => e.key === 'Enter' && handleMark(n)}
                className={`rounded-xl border border-white/5 px-4 py-3 theme-hover min-h-[44px] flex flex-col justify-center ${!n.read ? 'bg-violet-500/10' : 'theme-surface-soft'}`}
              >
                <p className="font-medium text-white text-sm">{n.title}</p>
                <p className="mt-1 text-xs text-white/60">{n.body}</p>
                <p className="mt-1.5 text-xs text-white/40">{formatDateTime(n.created_at, locale, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
              </li>
            ))}
          </ul>
        )}
      </main>
      <BOLHNav current="profile" />
    </div>
  )
}
