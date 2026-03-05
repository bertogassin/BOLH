'use client'

import { useState, useEffect, useRef } from 'react'
import { Bell } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { fetchNotifications, markNotificationRead, type Notification } from '@/lib/api'

export function NotificationBell() {
  const { user } = useAuth()
  const [list, setList] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!user) {
      setList([])
      return
    }
    fetchNotifications()
      .then((data) => setList(Array.isArray(data) ? data : []))
      .catch(() => setList([]))
  }, [user])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const safeList = Array.isArray(list) ? list : []
  const unread = safeList.filter((n) => !n.read)

  if (!user) return null

  const handleMark = async (n: Notification) => {
    if (!n.read) {
      try {
        await markNotificationRead(n.id)
        setList((prev) => (Array.isArray(prev) ? prev : []).map((x) => (x.id === n.id ? { ...x, read: true } : x)))
      } catch {
        // ignore
      }
    }
    setOpen(false)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="p-2 rounded-lg hover:bg-white/10 text-white/80 hover:text-white min-h-[44px] min-w-[44px] flex items-center justify-center relative"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unread.length > 0 && (
          <span className="absolute top-1 right-1 h-4 w-4 rounded-full bg-red-500 text-[10px] font-bold text-white flex items-center justify-center">
            {unread.length > 9 ? '9+' : unread.length}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-80 max-h-96 overflow-auto rounded-xl bg-[#252530] border border-white/10 shadow-xl z-50">
          <p className="px-4 py-2 text-xs font-semibold text-white/60 uppercase border-b border-white/10">
            Notifications
          </p>
          {safeList.length === 0 ? (
            <p className="px-4 py-6 text-sm text-white/50 text-center">No notifications</p>
          ) : (
            <ul>
              {safeList.map((n) => (
                <li
                  key={n.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleMark(n)}
                  onKeyDown={(e) => e.key === 'Enter' && handleMark(n)}
                  className={`px-4 py-3 border-b border-white/5 hover:bg-white/10 cursor-pointer min-h-[44px] flex flex-col justify-center ${!n.read ? 'bg-violet-500/10' : ''}`}
                >
                  <p className="font-medium text-white text-sm">{n.title}</p>
                  <p className="text-xs text-white/60 mt-0.5">{n.body}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
