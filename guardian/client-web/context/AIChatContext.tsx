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

  if (
    /заказ|резерв|order|réserver|бронир|book|охрана|gardien|guard/.test(lower)
  ) {
    add('Перейти к бронированию', '/booking')
    return {
      text: 'Создать заказ на охрану можно на главной: дата, время, адрес, количество охранников. Система подберёт исполнителя по геолокации, лицензиям и ML-скорингу.',
      generated: suggestions,
    }
  }
  if (/карт|map|carte|где заказ|мои заказы на карте/.test(lower)) {
    add('Открыть карту', '/map')
    return {
      text: 'На карте отображаются ваши заказы и доступные охранники (Violet = gardien, Vert = réservation). Раздел «Carte» в нижнем меню.',
      generated: suggestions,
    }
  }
  if (/документ|document|подпис|sign|истекаю|expir|файл/.test(lower)) {
    add('Документы', '/documents')
    return {
      text: 'В разделе «Документы»: загрузка, подпись, хранение, скачивание и отправка документов.',
      generated: suggestions,
    }
  }
  if (/профиль|profil|account|счёт|настройки|settings/.test(lower)) {
    add('Профиль', '/profile')
    return {
      text: 'В профиле: заказы, матчи, карты оплаты, уровень и рейтинг. Редактирование — кнопка с карандашом.',
      generated: suggestions,
    }
  }
  if (/оплат|payment|карта оплаты|card|payer/.test(lower)) {
    add('Профиль (карты)', '/profile')
    return {
      text: 'Карты оплаты управляются в профиле. Добавление и удаление карт — в блоке с иконкой кредитной карты.',
      generated: suggestions,
    }
  }
  if (
    /привет|bonjour|hello|salut|здравствуй|добрый день|hi/.test(lower)
  ) {
    add('Создать заказ', '/booking')
    add('Карта', '/map')
    add('Документы', '/documents')
    return {
      text: 'Привет! Я BOLH AI 1.0. Могу подсказать по заказам, карте, документам и аналитике. Напишите вопрос или нажмите кнопку ниже.',
      generated: suggestions,
    }
  }
  if (
    /помощь|help|aide|что умеешь|возможности|как пользоваться/.test(lower)
  ) {
    add('Бронирование', '/booking')
    add('Карта', '/map')
    add('Документы', '/documents')
    add('Профиль', '/profile')
    return {
      text: 'BOLH AI: Matching Engine (подбор охраны), антифрод, прогнозы, мультиязычность, аналитика, AGI-модули, Purifier. Спросите: заказ, карта, документы, прогноз, профиль — или нажмите кнопку.',
      generated: suggestions,
    }
  }
  if (
    /прогноз|forecast|спрос|demand|аналитик|analytics|ltv|cac|когорт/.test(lower)
  ) {
    return {
      text: 'Модуль аналитики: прогноз спроса (время, локация), LTV/CAC, когортный анализ, Prophet по выручке. Данные подтягиваются из заказов и матчей. В приложении основные метрики — в профиле и заказах.',
      generated: [{ type: 'suggestion', content: 'Открыть заказы', payload: { action: 'navigate', path: '/orders' } }],
    }
  }
  if (
    /антифрод|fraud|мошенник|безопасность|security|верификац|verify/.test(lower)
  ) {
    return {
      text: 'Антифрод: оценка риска по поведению (Isolation Forest), верификация документов (OCR, лицо, MRZ). Работает в фоне при заказах и регистрации. При высоком риске запрашивается доп. проверка.',
      generated: [],
    }
  }
  if (
    /язык|language|langue|перевод|translate|мультиязыч/.test(lower)
  ) {
    return {
      text: 'Поддержка множества языков: определение языка текста, редкие языки (zero-shot). В интерфейсе переключение языка — в правом верхнем углу (глобус).',
      generated: [],
    }
  }
  if (
    /подбор|matching|исполнитель|охранник рядом|кто доступен/.test(lower)
  ) {
    add('Бронирование', '/booking')
    add('Карта', '/map')
    return {
      text: 'Подбор идёт по геопоиску, лицензиям, бюджету и ML-скорингу (рейтинг, опыт, скорость ответа, расстояние). После создания заказа матч приходит в реальном времени.',
      generated: suggestions,
    }
  }
  if (/заказ|orders|мои заказы/.test(lower)) {
    add('Мои заказы', '/orders')
    add('Бронирование', '/booking')
    return {
      text: 'Список заказов — в разделе «Заказы». Там же статусы и матчи. Новый заказ — с главной (бронирование).',
      generated: suggestions,
    }
  }

  add('Бронирование', '/booking')
  add('Карта', '/map')
  add('Документы', '/documents')
  add('Помощь', '')
  return {
    text: 'По этому запросу могу подсказать: как создать заказ, открыть карту, документы или профиль. Напишите точнее или выберите действие ниже.',
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

  const persist = useCallback((next: ChatMessage[]) => {
    setMessages(next)
    try {
      localStorage.setItem('bolh_ai_chat', JSON.stringify(next.slice(-100)))
    } catch {
      // ignore
    }
  }, [])

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
      persist([...messages, userMsg])
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
        persist([...messages, userMsg, assistantMsg])
      } catch {
        const errMsg: ChatMessage = {
          id: generateId(),
          role: 'assistant',
          text: 'Произошла ошибка. Попробуйте ещё раз.',
          at: Date.now(),
        }
        persist([...messages, userMsg, errMsg])
      } finally {
        setIsLoading(false)
      }
    },
    [messages, persist]
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
