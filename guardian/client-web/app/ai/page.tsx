'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAIChat } from '@/context/AIChatContext'
import { useLocale } from '@/context/LocaleContext'

export default function AIPage() {
  const router = useRouter()
  const { openChat } = useAIChat()
  const { t } = useLocale()

  useEffect(() => {
    openChat()
    router.replace('/profile')
  }, [openChat, router])

  return (
    <div className="theme-page min-h-screen flex items-center justify-center">
      <p className="text-white/50 text-sm">{t('ai_chat.opening')}</p>
    </div>
  )
}
