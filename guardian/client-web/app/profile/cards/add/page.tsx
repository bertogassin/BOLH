'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, CreditCard, ShieldCheck } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useLocale } from '@/context/LocaleContext'
import { addCard } from '@/lib/api'
import { BOLHNav } from '@/components/BOLHNav'
import { detectCardBrand, digitsOnly, formatCardNumber, formatExpiry, isLikelyRealCardNumber } from '@/lib/payment/cardUtils'

export default function AddCardPage() {
  const { user } = useAuth()
  const { t } = useLocale()
  const router = useRouter()
  const [cardNumber, setCardNumber] = useState('')
  const [cardHolder, setCardHolder] = useState('')
  const [expiry, setExpiry] = useState('')
  const [cvc, setCvc] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const brand = detectCardBrand(cardNumber)
  const lastFour = digitsOnly(cardNumber).slice(-4).padStart(4, '•')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const number = digitsOnly(cardNumber)
    if (!isLikelyRealCardNumber(number)) {
      setError(t('profile_add_card.error_invalid_number'))
      return
    }
    const cvcDigits = digitsOnly(cvc)
    const requiredCvcLen = brand === 'Amex' ? 4 : 3
    if (cvcDigits.length < requiredCvcLen) {
      setError(t('profile_add_card.error_invalid_cvc').replace('{n}', String(requiredCvcLen)))
      return
    }
    if (!/^\d{2}\/\d{2}$/.test(expiry)) {
      setError(t('profile_add_card.error_invalid_expiry_format'))
      return
    }
    const mm = Number(expiry.slice(0, 2))
    const yy = Number(expiry.slice(3))
    if (mm < 1 || mm > 12) {
      setError(t('profile_add_card.error_invalid_expiry_month'))
      return
    }
    const now = new Date()
    const currentYY = now.getFullYear() % 100
    const currentMM = now.getMonth() + 1
    if (yy < currentYY || (yy === currentYY && mm < currentMM)) {
      setError(t('profile_add_card.error_expired'))
      return
    }
    if (cardHolder.trim().length < 2) {
      setError(t('profile_add_card.error_holder_required'))
      return
    }
    const four = number.slice(-4)
    setLoading(true)
    try {
      await addCard({ last_four: four, brand })
      router.push('/profile/cards')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('profile_add_card.error_generic'))
    } finally {
      setLoading(false)
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
          <Link href="/profile/cards" className="p-2 rounded-lg hover:bg-white/10 min-h-[44px] min-w-[44px] flex items-center justify-center">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-lg font-semibold">{t('profile.add_card')}</h1>
        </div>
      </header>
      <main className="mx-auto max-w-lg px-4 py-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-2xl border border-violet-400 bg-gradient-to-br from-[#2a1640] via-[#3b1e5a] to-[#111827] p-4 shadow-lg">
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/80 uppercase tracking-wide">{brand}</span>
              <ShieldCheck className="h-4 w-4 text-green-300" />
            </div>
            <p className="mt-6 text-lg font-semibold tracking-[0.2em] text-white">
              {formatCardNumber(cardNumber || '4242424242424242').padEnd(19, '•')}
            </p>
            <div className="mt-5 flex items-end justify-between">
              <div>
                <p className="text-[10px] uppercase text-white/60">{t('profile_add_card.card_holder')}</p>
                <p className="text-sm text-white">{cardHolder || t('profile_add_card.card_holder_placeholder_preview')}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase text-white/60">{t('profile_add_card.expires')}</p>
                <p className="text-sm text-white">{expiry || t('profile_add_card.expiry_placeholder')}</p>
              </div>
            </div>
          </div>

          {error && (
            <div className="rounded-xl bg-red-500/20 border border-red-500/40 p-3 text-sm text-red-200">{error}</div>
          )}
          <div>
            <label className="block text-xs font-medium text-white/60 uppercase mb-1">{t('profile_add_card.number')}</label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={23}
              value={cardNumber}
              onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
              placeholder={t('profile_add_card.number_placeholder')}
              className="w-full rounded-xl bg-white/10 px-4 py-3 text-white placeholder:text-white/40 outline-none border border-white/10 focus:border-violet-400 min-h-[44px]"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
            <label className="block text-xs font-medium text-white/60 uppercase mb-1">{t('profile_add_card.expiry')}</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={5}
                value={expiry}
                onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                placeholder="12/29"
                className="w-full rounded-xl bg-white/10 px-4 py-3 text-white placeholder:text-white/40 outline-none border border-white/10 focus:border-violet-400 min-h-[44px]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-white/60 uppercase mb-1">{t('profile_add_card.cvc')}</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={4}
                value={cvc}
                onChange={(e) => setCvc(digitsOnly(e.target.value).slice(0, 4))}
                placeholder={brand === 'Amex' ? '1234' : '123'}
                className="w-full rounded-xl bg-white/10 px-4 py-3 text-white placeholder:text-white/40 outline-none border border-white/10 focus:border-violet-400 min-h-[44px]"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-white/60 uppercase mb-1">{t('profile_add_card.holder_name')}</label>
            <input
              type="text"
              value={cardHolder}
              onChange={(e) => setCardHolder(e.target.value.toUpperCase())}
              placeholder={t('profile_add_card.holder_name_placeholder')}
              className="w-full rounded-xl bg-white/10 px-4 py-3 text-white placeholder:text-white/40 outline-none border border-white/10 focus:border-violet-400 min-h-[44px]"
            />
          </div>
          <div className="rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-xs text-white/70">
            {t('profile_add_card.saved_hint_prefix')} <span className="text-white">{brand}</span> {t('profile_add_card.saved_hint_middle')} <span className="text-white">•••• {lastFour.slice(-4)}</span>.
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-violet-600 hover:bg-violet-500 py-3.5 font-medium text-white min-h-[44px] disabled:opacity-50"
          >
            {loading ? t('profile_add_card.saving') : t('profile_add_card.save')}
          </button>
        </form>
      </main>
      <BOLHNav current="profile" />
    </div>
  )
}
