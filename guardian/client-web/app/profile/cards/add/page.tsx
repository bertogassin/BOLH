'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, CreditCard, ShieldCheck } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { addCard } from '@/lib/api'
import { BOLHNav } from '@/components/BOLHNav'

function digitsOnly(v: string): string {
  return v.replace(/\D/g, '')
}

function formatCardNumber(value: string): string {
  const d = digitsOnly(value).slice(0, 19)
  return d.replace(/(.{4})/g, '$1 ').trim()
}

function formatExpiry(value: string): string {
  const d = digitsOnly(value).slice(0, 4)
  if (d.length <= 2) return d
  return `${d.slice(0, 2)}/${d.slice(2)}`
}

function detectBrand(cardNumber: string): string {
  const d = digitsOnly(cardNumber)
  if (/^4/.test(d)) return 'Visa'
  if (/^(5[1-5]|2[2-7])/.test(d)) return 'Mastercard'
  if (/^3[47]/.test(d)) return 'Amex'
  if (/^6(?:011|5)/.test(d)) return 'Discover'
  if (/^35/.test(d)) return 'JCB'
  return 'card'
}

function isValidLuhn(cardNumber: string): boolean {
  const digits = digitsOnly(cardNumber)
  if (digits.length < 13) return false
  let sum = 0
  let shouldDouble = false
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = Number(digits[i])
    if (shouldDouble) {
      n *= 2
      if (n > 9) n -= 9
    }
    sum += n
    shouldDouble = !shouldDouble
  }
  return sum % 10 === 0
}

export default function AddCardPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [cardNumber, setCardNumber] = useState('')
  const [cardHolder, setCardHolder] = useState('')
  const [expiry, setExpiry] = useState('')
  const [cvc, setCvc] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const brand = detectBrand(cardNumber)
  const lastFour = digitsOnly(cardNumber).slice(-4).padStart(4, '•')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const number = digitsOnly(cardNumber)
    if (!isValidLuhn(number)) {
      setError('Номер карты введен неверно.')
      return
    }
    const cvcDigits = digitsOnly(cvc)
    const requiredCvcLen = brand === 'Amex' ? 4 : 3
    if (cvcDigits.length < requiredCvcLen) {
      setError(`Введите корректный CVC (${requiredCvcLen} цифры).`)
      return
    }
    if (!/^\d{2}\/\d{2}$/.test(expiry)) {
      setError('Введите срок действия в формате MM/YY.')
      return
    }
    const mm = Number(expiry.slice(0, 2))
    const yy = Number(expiry.slice(3))
    if (mm < 1 || mm > 12) {
      setError('Месяц срока действия некорректный.')
      return
    }
    const now = new Date()
    const currentYY = now.getFullYear() % 100
    const currentMM = now.getMonth() + 1
    if (yy < currentYY || (yy === currentYY && mm < currentMM)) {
      setError('Срок действия карты истек.')
      return
    }
    if (cardHolder.trim().length < 2) {
      setError('Укажите имя держателя карты.')
      return
    }
    const four = number.slice(-4)
    setLoading(true)
    try {
      await addCard({ last_four: four, brand })
      router.push('/profile/cards')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setLoading(false)
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#1a1b26] text-white flex items-center justify-center">
        <Link href="/login" className="text-violet-400 hover:underline">Войти</Link>
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
          <h1 className="text-lg font-semibold">Ajouter une carte</h1>
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
                <p className="text-[10px] uppercase text-white/60">Card holder</p>
                <p className="text-sm text-white">{cardHolder || 'YOUR NAME'}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase text-white/60">Expires</p>
                <p className="text-sm text-white">{expiry || 'MM/YY'}</p>
              </div>
            </div>
          </div>

          {error && (
            <div className="rounded-xl bg-red-500/20 border border-red-500/40 p-3 text-sm text-red-200">{error}</div>
          )}
          <div>
            <label className="block text-xs font-medium text-white/60 uppercase mb-1">Номер карты</label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={23}
              value={cardNumber}
              onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
              placeholder="4242 4242 4242 4242"
              className="w-full rounded-xl bg-white/10 px-4 py-3 text-white placeholder:text-white/40 outline-none border border-white/10 focus:border-violet-400 min-h-[44px]"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-white/60 uppercase mb-1">Срок (MM/YY)</label>
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
              <label className="block text-xs font-medium text-white/60 uppercase mb-1">CVC</label>
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
            <label className="block text-xs font-medium text-white/60 uppercase mb-1">Имя держателя</label>
            <input
              type="text"
              value={cardHolder}
              onChange={(e) => setCardHolder(e.target.value.toUpperCase())}
              placeholder="IVAN IVANOV"
              className="w-full rounded-xl bg-white/10 px-4 py-3 text-white placeholder:text-white/40 outline-none border border-white/10 focus:border-violet-400 min-h-[44px]"
            />
          </div>
          <div className="rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-xs text-white/70">
            Будет сохранено: бренд <span className="text-white">{brand}</span> и последние 4 цифры <span className="text-white">•••• {lastFour.slice(-4)}</span>.
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-violet-600 hover:bg-violet-500 py-3.5 font-medium text-white min-h-[44px] disabled:opacity-50"
          >
            {loading ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </form>
      </main>
      <BOLHNav current="profile" />
    </div>
  )
}
