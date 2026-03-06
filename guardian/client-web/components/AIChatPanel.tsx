'use client'

import { useRef, useEffect, useState } from 'react'
import Link from 'next/link'
import { X, Send, Sparkles, Trash2 } from 'lucide-react'
import { useAIChat, type ChatMessage, type GeneratedItem } from '@/context/AIChatContext'
import { useLocale } from '@/context/LocaleContext'

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === 'user'
  const items: GeneratedItem[] = Array.isArray(msg.generated)
    ? msg.generated
    : msg.generated
      ? [msg.generated as unknown as GeneratedItem]
      : []

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
          isUser
            ? 'bg-violet-600 text-white rounded-br-md'
            : 'bg-white/15 text-white/95 rounded-bl-md'
        }`}
      >
        <p className="text-sm whitespace-pre-wrap break-words">{msg.text}</p>
        {items.length > 0 && (
          <div className="mt-2 pt-2 border-t border-white/20 flex flex-wrap gap-2">
            {items.map((g, i) => (
              <span key={i}>
                {g.type === 'suggestion' && g.payload?.path ? (
                  <Link
                    href={String(g.payload.path)}
                    className="inline-block rounded-lg bg-violet-500/30 hover:bg-violet-500/50 px-3 py-1.5 text-xs font-medium text-violet-200"
                  >
                    {g.content}
                  </Link>
                ) : g.type === 'text' ? (
                  <span className="text-xs text-white/70 italic">{g.content}</span>
                ) : null}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="rounded-2xl rounded-bl-md bg-white/15 px-4 py-3 flex gap-1">
        <span className="w-2 h-2 rounded-full bg-white/50 animate-bounce [animation-delay:0ms]" />
        <span className="w-2 h-2 rounded-full bg-white/50 animate-bounce [animation-delay:150ms]" />
        <span className="w-2 h-2 rounded-full bg-white/50 animate-bounce [animation-delay:300ms]" />
      </div>
    </div>
  )
}

export function AIChatPanel() {
  const { t } = useLocale()
  const { isOpen, closeChat, messages, sendMessage, clearChat, isLoading } =
    useAIChat()
  const [input, setInput] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  const quickActions: { label: string; path?: string; prompt: string }[] = [
    { label: t('ai_chat.quick_order'), path: '/booking', prompt: t('ai_chat.prompt_order') },
    { label: t('ai_chat.quick_map'), path: '/map', prompt: t('ai_chat.prompt_map') },
    { label: t('ai_chat.quick_docs'), path: '/documents', prompt: t('ai_chat.prompt_docs') },
    { label: t('ai_chat.quick_forecast'), prompt: t('ai_chat.prompt_forecast') },
    { label: t('ai_chat.quick_help'), prompt: t('ai_chat.prompt_help') },
  ]

  useEffect(() => {
    if (isOpen && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [isOpen, messages, isLoading])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return
    sendMessage(input)
    setInput('')
  }

  const handleQuickAction = (prompt: string) => {
    sendMessage(prompt)
  }

  if (!isOpen) return null

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={closeChat}
        aria-hidden
      />
      <div
        className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-[#1a1b26] border-l border-white/10 flex flex-col shadow-xl"
        role="dialog"
        aria-label={t('ai_chat.aria_chat')}
      >
        <header className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-violet-400" />
            <h2 className="font-semibold text-white">{t('ai_chat.title')}</h2>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <button
                type="button"
                onClick={clearChat}
                className="p-2 rounded-lg hover:bg-white/10 min-h-[44px] min-w-[44px] flex items-center justify-center text-white/60 hover:text-white/90"
                aria-label={t('ai_chat.clear_chat')}
                title={t('ai_chat.clear_chat')}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              onClick={closeChat}
              className="p-2 rounded-lg hover:bg-white/10 min-h-[44px] min-w-[44px] flex items-center justify-center text-white/80"
                aria-label={t('ai_chat.close')}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        <div
          ref={listRef}
          className="flex-1 overflow-y-auto px-4 py-3 space-y-3"
        >
          {messages.length === 0 && !isLoading && (
            <div className="space-y-4">
              <p className="text-sm text-white/60 text-center">
                {t('ai_chat.empty_hint')}
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {quickActions.map((a) => (
                  <button
                    key={a.label}
                    type="button"
                    onClick={() => handleQuickAction(a.prompt)}
                    className="rounded-xl bg-white/10 hover:bg-violet-500/30 border border-white/10 px-3 py-2 text-xs font-medium text-white/90"
                  >
                    {a.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-white/40 text-center pt-2">
                BOLH AI 1.0 · Matching · Fraud · NLP · Analytics · AGI · Purifier
              </p>
            </div>
          )}
          {messages.map((msg) => (
            <MessageBubble key={msg.id} msg={msg} />
          ))}
          {isLoading && <TypingIndicator />}
        </div>

        <form
          onSubmit={handleSubmit}
          className="p-4 border-t border-white/10 shrink-0"
        >
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t('ai_chat.message_placeholder')}
              className="flex-1 min-w-0 rounded-xl bg-white/10 border border-white/10 px-4 py-3 text-white placeholder:text-white/40 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              disabled={isLoading}
              aria-label={t('ai_chat.message_placeholder')}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="shrink-0 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:pointer-events-none min-h-[48px] min-w-[48px] flex items-center justify-center text-white"
              aria-label={t('ai_chat.send')}
            >
              <Send className="h-5 w-5" />
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
