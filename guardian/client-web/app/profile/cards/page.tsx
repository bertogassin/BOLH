'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, CreditCard, Plus } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useLocale } from '@/context/LocaleContext'
import { fetchCards, deleteCard, type PaymentCard } from '@/lib/api'
import { BOLHNav } from '@/components/BOLHNav'

export default function ProfileCardsPage() {
  const { user } = useAuth()
  const { t } = useLocale()
  const [cards, setCards] = useState<PaymentCard[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    fetchCards()
      .then(setCards)
      .catch(() => setCards([]))
      .finally(() => setLoading(false))
  }, [user])

  const handleDelete = async (id: string) => {
    if (!confirm(t('profile_cards.delete_confirm'))) return
    try {
      await deleteCard(id)
      setCards((c) => c.filter((x) => x.id !== id))
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
          <Link href="/profile" className="p-2 rounded-lg hover:bg-white/10 min-h-[44px] min-w-[44px] flex items-center justify-center">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-lg font-semibold">{t('profile.my_cards')}</h1>
        </div>
      </header>
      <main className="mx-auto max-w-lg px-4 py-6 space-y-4">
        {loading ? (
          <p className="text-white/50">{t('profile_cards.loading')}</p>
        ) : cards.length === 0 ? (
          <div className="rounded-xl bg-white/10 p-6 flex flex-col items-center gap-3 text-white/60">
            <CreditCard className="h-10 w-10" />
            <p className="text-sm">{t('profile.no_cards')}</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {cards.map((card) => (
              <li key={card.id} className="rounded-xl bg-white/10 px-4 py-3 flex items-center justify-between">
                <span className="text-white/90">•••• {card.last_four}</span>
                <span className="text-xs text-white/50">{card.brand}</span>
                <button
                  type="button"
                  onClick={() => handleDelete(card.id)}
                  className="text-red-400 hover:text-red-300 text-sm min-h-[44px] min-w-[44px] flex items-center justify-center"
                >
                  {t('profile_cards.delete')}
                </button>
              </li>
            ))}
          </ul>
        )}
        <Link
          href="/profile/cards/add"
          className="flex items-center justify-center gap-2 w-full rounded-xl bg-violet-600 hover:bg-violet-500 py-3.5 text-white font-medium min-h-[44px]"
        >
          <Plus className="h-5 w-5" />
          {t('profile.add_card')}
        </Link>
      </main>
      <BOLHNav current="profile" />
    </div>
  )
}
