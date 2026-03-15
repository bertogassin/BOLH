'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Trash2 } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useLocale } from '@/context/LocaleContext'
import { deleteMyAccount } from '@/lib/api'
import { BOLHNav } from '@/components/BOLHNav'

export default function DeleteAccountPage() {
  const { user, logout } = useAuth()
  const { t } = useLocale()
  const router = useRouter()
  const [ack1, setAck1] = useState(false)
  const [ack2, setAck2] = useState(false)
  const [ack3, setAck3] = useState(false)
  const [phrase, setPhrase] = useState('')
  const [emailConfirm, setEmailConfirm] = useState('')
  const [password, setPassword] = useState('')
  const [armed, setArmed] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [holdProgress, setHoldProgress] = useState(0)
  const holdTimerRef = useRef<number | null>(null)
  const tickRef = useRef<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const HOLD_REQUIRED_MS = 2200

  useEffect(() => {
    if (!armed) return
    if (secondsLeft <= 0) {
      setArmed(false)
      setHoldProgress(0)
      return
    }
    tickRef.current = window.setTimeout(() => setSecondsLeft((s) => s - 1), 1000)
    return () => {
      if (tickRef.current) window.clearTimeout(tickRef.current)
    }
  }, [armed, secondsLeft])

  const canArm = useMemo(() => {
    if (!user) return false
    return (
      ack1 &&
      ack2 &&
      ack3 &&
      phrase.trim().toUpperCase() === 'DELETE ACCOUNT' &&
      emailConfirm.trim().toLowerCase() === user.email.toLowerCase() &&
      password.trim().length >= 6
    )
  }, [ack1, ack2, ack3, phrase, emailConfirm, password, user])

  const resetHold = () => {
    if (holdTimerRef.current) {
      window.clearInterval(holdTimerRef.current)
      holdTimerRef.current = null
    }
    setHoldProgress(0)
  }

  const executeDeletion = async () => {
    if (!user) return
    setSubmitting(true)
    setError('')
    try {
      await deleteMyAccount({ password, confirmation: 'DELETE ACCOUNT' })
      // Local cleanup after successful deletion
      localStorage.removeItem('guardian_token')
      localStorage.removeItem(`guardian_saved_addresses_${user.id}`)
      localStorage.removeItem(`guardian_partner_application_${user.id}`)
      logout()
      router.push('/register')
      router.refresh()
    } catch (e) {
      setError(
        e instanceof Error
          ? `${e.message}. ${t('profile_delete.server_manual_hint')}`
          : t('profile_delete.delete_failed')
      )
      setSubmitting(false)
      resetHold()
    }
  }

  const startHold = () => {
    if (!armed || submitting) return
    const started = Date.now()
    resetHold()
    holdTimerRef.current = window.setInterval(() => {
      const elapsed = Date.now() - started
      const progress = Math.min(100, Math.round((elapsed / HOLD_REQUIRED_MS) * 100))
      setHoldProgress(progress)
      if (elapsed >= HOLD_REQUIRED_MS) {
        resetHold()
        executeDeletion()
      }
    }, 30)
  }

  const stopHold = () => {
    if (submitting) return
    resetHold()
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
          <Link href="/profile" className="p-2 rounded-lg hover:bg-white/10">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-lg font-semibold">{t('profile_delete.title')}</h1>
        </div>
      </header>
      <main className="mx-auto max-w-lg px-4 py-6 space-y-4">
        <div className="rounded-2xl bg-red-500/10 border border-red-500/30 p-6 flex flex-col items-center gap-3">
          <Trash2 className="h-12 w-12 text-red-400" />
          <p className="text-white/80 text-center">{t('profile_delete.irreversible')}</p>
          <p className="text-white/50 text-sm">{t('profile_delete.protection_enabled')}</p>
        </div>

        <div className="rounded-2xl bg-white/10 border border-violet-400 p-4 space-y-3">
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" checked={ack1} onChange={(e) => setAck1(e.target.checked)} className="mt-1" />
            <span>{t('profile_delete.ack_irreversible')}</span>
          </label>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" checked={ack2} onChange={(e) => setAck2(e.target.checked)} className="mt-1" />
            <span>{t('profile_delete.ack_data_removed')}</span>
          </label>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" checked={ack3} onChange={(e) => setAck3(e.target.checked)} className="mt-1" />
            <span>{t('profile_delete.ack_owner')}</span>
          </label>

          <div>
            <label className="block text-xs text-white/60 mb-1">{t('profile_delete.enter_phrase')}: <span className="text-white">DELETE ACCOUNT</span></label>
            <input
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              className="w-full rounded-xl bg-white/10 border border-violet-400 px-3 py-3 min-h-[44px] outline-none"
              placeholder={t('profile_delete.phrase_placeholder')}
            />
          </div>
          <div>
            <label className="block text-xs text-white/60 mb-1">{t('profile_delete.confirm_email')}</label>
            <input
              value={emailConfirm}
              onChange={(e) => setEmailConfirm(e.target.value)}
              className="w-full rounded-xl bg-white/10 border border-violet-400 px-3 py-3 min-h-[44px] outline-none"
              placeholder={user.email}
            />
          </div>
          <div>
            <label className="block text-xs text-white/60 mb-1">{t('profile_delete.enter_password')}</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl bg-white/10 border border-violet-400 px-3 py-3 min-h-[44px] outline-none"
              placeholder={t('profile_delete.password_placeholder')}
            />
          </div>

          <button
            type="button"
            disabled={!canArm || armed || submitting}
            onClick={() => {
              setArmed(true)
              setSecondsLeft(7)
              setError('')
            }}
            className="w-full rounded-xl bg-amber-500/20 border border-amber-400/50 text-amber-200 py-3 min-h-[44px] font-medium disabled:opacity-50"
          >
            {armed ? `${t('profile_delete.confirmation_active')} (${secondsLeft}s)` : t('profile_delete.enable_deletion')}
          </button>

          <button
            type="button"
            disabled={!armed || submitting}
            onMouseDown={startHold}
            onMouseUp={stopHold}
            onMouseLeave={stopHold}
            onTouchStart={startHold}
            onTouchEnd={stopHold}
            className="w-full rounded-xl bg-red-500/30 border border-red-400/50 text-red-200 py-3 min-h-[44px] font-semibold disabled:opacity-50 relative overflow-hidden"
          >
            <span
              className="absolute inset-y-0 left-0 bg-red-500/40 transition-[width]"
              style={{ width: `${holdProgress}%` }}
            />
            <span className="relative z-10">
              {submitting ? t('profile_delete.deleting') : t('profile_delete.hold_to_delete')}
            </span>
          </button>
          {error && <p className="text-sm text-red-300">{error}</p>}
        </div>
      </main>
      <BOLHNav current="profile" />
    </div>
  )
}
