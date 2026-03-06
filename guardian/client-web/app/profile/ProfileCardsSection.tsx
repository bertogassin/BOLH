'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown, CreditCard, Plus } from 'lucide-react'
import type { PaymentCard } from '@/lib/api'

type Props = {
  cards: PaymentCard[]
  t: (key: string) => string
}

export function ProfileCardsSection({ cards, t }: Props) {
  const [isCardsExpanded, setIsCardsExpanded] = useState(false)

  return (
    <section>
      <button
        type="button"
        onClick={() => setIsCardsExpanded((prev) => !prev)}
        className="w-full rounded-xl bg-white/10 border border-violet-400 hover:bg-white/15 px-3 py-3 text-white font-medium min-h-[44px] flex items-center justify-between"
      >
        <span className="inline-flex items-center gap-2">
          <CreditCard className="h-4.5 w-4.5 text-white/80" />
          {t('profile.my_cards')}
        </span>
        <span className="inline-flex items-center gap-2 text-sm text-white/80">
          {cards.length}
          <ChevronDown className={`h-4 w-4 transition-transform ${isCardsExpanded ? 'rotate-180' : ''}`} />
        </span>
      </button>

      <div
        className={`overflow-hidden transition-all duration-200 ${isCardsExpanded ? 'max-h-96 mt-2 opacity-100' : 'max-h-0 opacity-0'}`}
      >
        <div className="rounded-xl border border-violet-400/70 bg-white/5 p-3">
          <Link
            href="/profile/cards"
            className="mb-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-violet-400 bg-white/10 py-2.5 text-sm font-medium text-white hover:bg-white/15"
          >
            <CreditCard className="h-4 w-4 text-white/80" />
            <Plus className="h-4 w-4 text-violet-300" />
            {t('profile.add_card')}
          </Link>
          <div className="max-h-56 space-y-2 overflow-y-auto">
            {cards.map((card) => (
              <div key={card.id} className="flex items-center justify-between rounded-lg bg-white/5 border border-violet-400 px-3 py-2">
                <span className="text-white/85">•••• {card.last_four}</span>
                <span className="text-xs text-white/60">{card.brand}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

