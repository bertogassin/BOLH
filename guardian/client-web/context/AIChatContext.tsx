'use client'

import React, { createContext, useCallback, useContext, useState } from 'react'

export type GeneratedItem = {
  type: 'text' | 'suggestion'
  content: string
  payload?: Record<string, unknown>
}

export type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  text: string
  generated?: GeneratedItem[]
  at: number
}

type AIChatContextType = {
  isOpen: boolean
  openChat: () => void
  closeChat: () => void
  toggleChat: () => void
  messages: ChatMessage[]
  sendMessage: (text: string) => Promise<void>
  clearChat: () => void
  isLoading: boolean
}

const AIChatContext = createContext<AIChatContextType | null>(null)

function generateId() {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

function buildReply(
  trimmed: string
): { text: string; generated: GeneratedItem[] } {
  const lower = trimmed.toLowerCase()
  const suggestions: GeneratedItem[] = []

  const add = (content: string, path: string) =>
    suggestions.push({ type: 'suggestion', content, payload: { action: 'navigate', path } })

  if (/order|reserve|book|security|guard|reservation|booking/.test(lower)) {
    add('Go to booking', '/booking')
    return {
      text: 'Create a security order from the booking screen: date, time, address, and guard count. The system matches guards by location, licenses, and ranking score.',
      generated: suggestions,
    }
  }
  if (/map|location|where|tracker/.test(lower)) {
    add('Open map', '/map')
    return {
      text: 'The map shows your orders and available guards. Open the map from the bottom navigation.',
      generated: suggestions,
    }
  }
  if (/document|sign|signature|expire|file/.test(lower)) {
    add('Documents', '/documents')
    return {
      text: 'In Documents you can upload, sign, store, download, and share files.',
      generated: suggestions,
    }
  }
  if (/profile|account|settings/.test(lower)) {
    add('Profile', '/profile')
    return {
      text: 'Profile includes account info, payment cards, and settings. Use the edit action to update details.',
      generated: suggestions,
    }
  }
  if (/payment|card|billing/.test(lower)) {
    add('Profile (cards)', '/profile')
    return {
      text: 'Payment cards are managed in profile. You can add and remove cards in the cards section.',
      generated: suggestions,
    }
  }
  if (/hello|hi|hey/.test(lower)) {
    add('Create order', '/booking')
    add('Map', '/map')
    add('Documents', '/documents')
    return {
      text: 'Hello! I am BOLH AI. I can help with booking, map, documents, and profile actions. Ask a question or pick a quick action.',
      generated: suggestions,
    }
  }
  if (/help|features|what can you do/.test(lower)) {
    add('Booking', '/booking')
    add('Map', '/map')
    add('Documents', '/documents')
    add('Profile', '/profile')
    return {
      text: 'BOLH AI can guide booking, map, documents, profile, and core workflow actions.',
      generated: suggestions,
    }
  }
  if (/forecast|demand|analytics|ltv|cac|cohort/.test(lower)) {
    return {
      text: 'Analytics module includes demand forecasting, conversion metrics, and order trend analysis. Main metrics are visible in orders and profile.',
      generated: [{ type: 'suggestion', content: 'Open orders', payload: { action: 'navigate', path: '/orders' } }],
    }
  }
  if (/fraud|security|verification|verify|risk/.test(lower)) {
    return {
      text: 'Security checks include behavioral risk evaluation and document verification. Additional review may be requested for high-risk actions.',
      generated: [],
    }
  }
  if (/language|translate|translation|multilingual/.test(lower)) {
    return {
      text: 'The app supports multiple languages. You can switch language from the locale selector.',
      generated: [],
    }
  }
  if (/matching|available guard|nearby guard|who is available/.test(lower)) {
    add('Booking', '/booking')
    add('Map', '/map')
    return {
      text: 'Matching uses location, licenses, budget, and ranking. After order creation, matching updates in near real-time.',
      generated: suggestions,
    }
  }
  if (/order|orders|my orders/.test(lower)) {
    add('My orders', '/orders')
    add('Booking', '/booking')
    return {
      text: 'Use Orders to see statuses and matches. Create a new order from Booking.',
      generated: suggestions,
    }
  }

  add('Booking', '/booking')
  add('Map', '/map')
  add('Documents', '/documents')
  add('Help', '/help')
  return {
    text: 'I can help with booking, map, documents, or profile actions. Ask a more specific question or choose an action below.',
    generated: suggestions.filter((s) => s.payload?.path),
  }
}

export function AIChatProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      const raw = localStorage.getItem('bolh_ai_chat')
      if (raw) {
        const parsed = JSON.parse(raw) as ChatMessage[]
        return Array.isArray(parsed) ? parsed : []
      }
    } catch {
      // ignore
    }
    return []
  })
  const [isLoading, setIsLoading] = useState(false)

  const appendMessages = useCallback(
    (updater: (prev: ChatMessage[]) => ChatMessage[]) => {
      setMessages((prev) => {
        const next = updater(prev)
        try {
          localStorage.setItem('bolh_ai_chat', JSON.stringify(next.slice(-100)))
        } catch {
          // ignore
        }
        return next
      })
    },
    []
  )

  const openChat = useCallback(() => setIsOpen(true), [])
  const closeChat = useCallback(() => setIsOpen(false), [])
  const toggleChat = useCallback(() => setIsOpen((o) => !o), [])

  const clearChat = useCallback(() => {
    setMessages([])
    try {
      localStorage.removeItem('bolh_ai_chat')
    } catch {
      // ignore
    }
  }, [])

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed) return

      const userMsg: ChatMessage = {
        id: generateId(),
        role: 'user',
        text: trimmed,
        at: Date.now(),
      }
      appendMessages((prev) => [...prev, userMsg])
      setIsLoading(true)

      try {
        await new Promise((r) => setTimeout(r, 350 + Math.random() * 250))
        const { text: replyText, generated } = buildReply(trimmed)

        const assistantMsg: ChatMessage = {
          id: generateId(),
          role: 'assistant',
          text: replyText,
          generated: generated.length > 0 ? generated : undefined,
          at: Date.now(),
        }
        appendMessages((prev) => [...prev, assistantMsg])
      } catch {
        const errMsg: ChatMessage = {
          id: generateId(),
          role: 'assistant',
          text: 'An error occurred. Please try again.',
          at: Date.now(),
        }
        appendMessages((prev) => [...prev, errMsg])
      } finally {
        setIsLoading(false)
      }
    },
    [appendMessages]
  )

  const value: AIChatContextType = {
    isOpen,
    openChat,
    closeChat,
    toggleChat,
    messages,
    sendMessage,
    clearChat,
    isLoading,
  }

  return (
    <AIChatContext.Provider value={value}>
      {children}
    </AIChatContext.Provider>
  )
}

export function useAIChat() {
  const ctx = useContext(AIChatContext)
  if (!ctx) throw new Error('useAIChat must be used within AIChatProvider')
  return ctx
}
