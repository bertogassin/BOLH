'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, Bell } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useLocale } from '@/context/LocaleContext'
import { fetchNotifications, markNotificationRead, type Notification } from '@/lib/api'
import { BOLHNav } from '@/components/BOLHNav'
import { ErrorRetry } from '@/components/ErrorRetry'

function formatDate(s: string, locale: string): string {
  try {
    const loc = locale === 'ru' ? 'ru-RU' : locale === 'fr' ? 'fr-FR' : 'en-US'
    return new Date(s).toLocaleString(loc, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  } catch {
    return s
  }
}

export default function NotificationsPage() {
  const { user } = useAuth()
  const { t, locale } = useLocale()
  const [list, setList] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(false)

  const load = () => {
    if (!user) return
    setFetchError(false)
    setLoading(true)
    fetchNotifications()
      .then((data) => {
        setList(data)
        setFetchError(false)
      })
      .catch(() => setFetchError(true))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (!user) return
    load()
  }, [user])

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
          <h1 className="text-lg font-semibold">{t('navigation.notifications')}</h1>
        </div>
      </header>
      <main className="mx-auto max-w-lg px-4 py-4">
        {loading ? (
          <div className="animate-pulse space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 rounded-xl bg-white/10" />
            ))}
          </div>
        ) : fetchError ? (
          <ErrorRetry message="Не удалось загрузить уведомления." onRetry={load} />
        ) : list.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="h-16 w-16 rounded-2xl bg-white/10 flex items-center justify-center mb-4">
              <Bell className="h-8 w-8 text-white/50" />
            </div>
            <p className="text-white/70 font-medium">Нет уведомлений</p>
            <p className="text-sm text-white/50 mt-1">Здесь появятся матчи, сообщения и статусы заказов.</p>
            <Link href="/profile" className="mt-6 text-violet-400 hover:underline text-sm">В профиль</Link>
          </div>
        ) : (
          <ul className="space-y-1">
            {list.map((n) => (
              <li
                key={n.id}
                role="button"
                tabIndex={0}
                onClick={() => handleMark(n)}
                onKeyDown={(e) => e.key === 'Enter' && handleMark(n)}
                className={`rounded-xl px-4 py-3 border border-white/5 hover:bg-white/5 min-h-[44px] flex flex-col justify-center ${!n.read ? 'bg-violet-500/10' : 'bg-white/5'}`}
              >
                <p className="font-medium text-white text-sm">{n.title}</p>
                <p className="text-xs text-white/60 mt-0.5">{n.body}</p>
                <p className="text-xs text-white/40 mt-1">{formatDate(n.created_at, locale)}</p>
              </li>
            ))}
          </ul>
        )}
      </main>
      <BOLHNav current="profile" />
    </div>
  )
}
