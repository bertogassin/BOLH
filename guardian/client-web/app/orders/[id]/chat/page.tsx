'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { ChevronLeft, Send } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useLocale } from '@/context/LocaleContext'
import { fetchOrder, fetchOrderMessages, sendOrderMessage, type ChatMessage } from '@/lib/api'
import { BOLHNav } from '@/components/BOLHNav'

const CHAT_POLL_MS = 5000

export default function OrderChatPage({ params }: { params: { id: string } }) {
  const { user } = useAuth()
  const { t, locale } = useLocale()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!user || typeof document === 'undefined') {
      setLoading(false)
      return
    }

    let intervalId: ReturnType<typeof setInterval> | null = null
    let inFlight = false
    const applyMessages = (next: ChatMessage[]) => {
      const safe = Array.isArray(next) ? next : []
      setMessages((prev) => {
        const sameSize = prev.length === safe.length
        const sameFirst = prev[0]?.id === safe[0]?.id
        const sameLast = prev[prev.length - 1]?.id === safe[safe.length - 1]?.id
        return sameSize && sameFirst && sameLast ? prev : safe
      })
    }
    const loadMessages = (silent = false) => {
      if (inFlight) return
      inFlight = true
      const request = silent
        ? fetchOrderMessages(params.id)
        : fetchOrder(params.id).then(() => fetchOrderMessages(params.id))
      request
        .then((next) => {
          applyMessages(Array.isArray(next) ? next : [])
        })
        .catch(() => {})
        .finally(() => {
          inFlight = false
          if (!silent) setLoading(false)
        })
    }

    const onVisible = () => {
      if (!document.hidden) loadMessages(true)
    }

    loadMessages()
    intervalId = setInterval(() => {
      if (!document.hidden) loadMessages(true)
    }, CHAT_POLL_MS)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      if (intervalId) clearInterval(intervalId)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [user, params.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    const text = input.trim()
    if (!text || sending) return
    setInput('')
    setSending(true)
    try {
      const msg = await sendOrderMessage(params.id, text)
      setMessages((prev) => [...prev, msg])
    } catch {
      setInput(text)
    } finally {
      setSending(false)
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#1a1b26] flex items-center justify-center text-white">
        <Link href="/login" className="text-violet-400 hover:underline">{t('auth.login_btn')}</Link>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#1a1b26]">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-violet-400 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#1a1b26] text-white flex flex-col pb-24">
      <header className="sticky top-0 z-10 border-b border-white/10 bg-[#1a1b26]/95 backdrop-blur">
        <div className="flex items-center gap-3 px-4 py-3">
          <Link href={`/orders/${params.id}`} className="p-2 rounded-lg hover:bg-white/10 min-h-[44px] min-w-[44px] flex items-center justify-center">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-lg font-semibold">{t('order_chat.title')}</h1>
        </div>
      </header>

      <main className="flex-1 overflow-auto p-4 space-y-3">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.sender_id === user.id ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                m.sender_id === user.id
                  ? 'bg-violet-600 text-white'
                  : 'bg-white/10 text-white/90'
              }`}
            >
              <p className="text-sm">{m.text}</p>
              <p className="text-[10px] opacity-70 mt-0.5">
                {new Date(m.created_at).toLocaleTimeString(locale === 'ru' ? 'ru-RU' : locale === 'de' ? 'de-DE' : locale === 'fr' ? 'fr-FR' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </main>

      <div className="fixed bottom-20 left-0 right-0 p-4 bg-[#1a1b26]/95 border-t border-white/10">
        <div className="mx-auto max-w-lg flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder={t('order_chat.message_placeholder')}
            className="flex-1 rounded-xl bg-white/10 px-4 py-3 text-white placeholder:text-white/40 outline-none border border-white/10 min-h-[44px]"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={sending || !input.trim()}
            className="rounded-xl bg-violet-600 px-4 py-3 text-white hover:bg-violet-500 disabled:opacity-50 min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <Send className="h-5 w-5" />
          </button>
        </div>
      </div>

      <BOLHNav current="booking" />
    </div>
  )
}
