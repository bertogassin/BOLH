'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Shield, Mail, Lock, Eye, EyeOff, Sparkles } from 'lucide-react'
import { demoModeEnabled } from '@/lib/demo_api'
import { useAuth } from '@/context/AuthContext'
import { useLocale } from '@/context/LocaleContext'
import { InputWithClear } from '@/components/InputWithClear'
import { ErrorBanner } from '@/components/ErrorBanner'
import { FormField } from '@/components/FormField'

const REMEMBER_EMAIL_KEY = 'guardian_remember_email'
const SAVED_EMAIL_KEY = 'guardian_saved_email'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [capsLockOn, setCapsLockOn] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const [typingCount, setTypingCount] = useState(0)
  const [autofillUsed, setAutofillUsed] = useState(false)
  const emailInputRef = useRef<HTMLInputElement>(null)
  const passwordInputRef = useRef<HTMLInputElement>(null)
  const startedAtRef = useRef<number>(Date.now())
  const { login, enterDemo } = useAuth()
  const { t } = useLocale()
  const router = useRouter()

  useEffect(() => {
    if (typeof window === 'undefined') return
    const saved = localStorage.getItem(SAVED_EMAIL_KEY)
    const remember = localStorage.getItem(REMEMBER_EMAIL_KEY)
    if (saved) setEmail(saved)
    if (remember !== null) setRememberMe(remember === '1')
    emailInputRef.current?.focus()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitAttempted(true)
    const form = e.currentTarget as HTMLFormElement
    const formEmail = form.querySelector<HTMLInputElement>('#login-email')?.value || ''
    const formPassword = form.querySelector<HTMLInputElement>('#login-password')?.value || ''

    const normalizedEmail = (email || formEmail).trim().toLowerCase()
    const effectivePassword = password || formPassword

    if (normalizedEmail !== email) {
      setEmail(normalizedEmail)
    }
    if (effectivePassword !== password) {
      setPassword(effectivePassword)
    }

    if (!normalizedEmail || !/\S+@\S+\.\S+/.test(normalizedEmail)) {
      setError(t('auth.invalid_email'))
      emailInputRef.current?.focus()
      return
    }
    if (!effectivePassword) {
      setError(t('auth.password_required'))
      passwordInputRef.current?.focus()
      return
    }

    setError('')
    setLoading(true)
    if (typeof window !== 'undefined') {
      const elapsedMs = Date.now() - startedAtRef.current
      const score = Math.max(0, Math.min(100, Math.round((typingCount * 6) + Math.min(40, elapsedMs / 250))))
      const fastSubmit = elapsedMs < 2500 || typingCount < 3
      sessionStorage.setItem(
        'guardian_behavior_login',
        JSON.stringify({
          score,
          autofill: autofillUsed,
          fastSubmit,
        })
      )
    }
    try {
      await login(normalizedEmail, effectivePassword)
      if (typeof window !== 'undefined') {
        if (rememberMe) {
          localStorage.setItem(SAVED_EMAIL_KEY, normalizedEmail)
          localStorage.setItem(REMEMBER_EMAIL_KEY, '1')
        } else {
          localStorage.removeItem(SAVED_EMAIL_KEY)
          localStorage.setItem(REMEMBER_EMAIL_KEY, '0')
        }
      }
      router.push('/profile')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.login_error'))
      emailInputRef.current?.focus()
    } finally {
      setLoading(false)
    }
  }

  const handleEmailChange = (value: string) => {
    setEmail(value)
    setTypingCount((v) => v + 1)
    if (value.includes('@') && value.length > 8 && typingCount === 0) {
      setAutofillUsed(true)
    }
    if (error) setError('')
  }

  const handlePasswordChange = (value: string) => {
    setPassword(value)
    setTypingCount((v) => v + 1)
    if (error) setError('')
  }

  const emailInvalid = submitAttempted && (!email.trim() || !/\S+@\S+\.\S+/.test(email.trim().toLowerCase()))
  const passwordMissing = submitAttempted && !password

  const handlePasswordKeyEvent = (e: React.KeyboardEvent<HTMLInputElement>) => {
    setCapsLockOn(e.getModifierState('CapsLock'))
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-guardian-bg p-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-200/80 bg-white p-8 shadow-xl">
        <div className="mb-6 flex justify-center">
          <div className="flex items-center gap-3 rounded-2xl bg-guardian-blue px-5 py-3 text-white">
            <Shield className="h-8 w-8 shrink-0" />
            <span className="text-2xl font-bold tracking-tight">BOLH</span>
          </div>
        </div>
        <h1 className="mb-1 text-center text-2xl font-bold text-gray-900">{t('auth.login_title')}</h1>
        <p className="mb-6 text-center text-sm text-gray-500">{t('auth.login_subtitle')}</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <ErrorBanner message={error} onDismiss={() => setError('')} />
          )}
          <FormField
            label={t('auth.email')}
            htmlFor="login-email"
            error={emailInvalid ? t('auth.invalid_email') : ''}
          >
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400 z-10" />
              <InputWithClear
                ref={emailInputRef}
                id="login-email"
                type="email"
                value={email}
                onChange={handleEmailChange}
                className={`input-field pl-10 ${emailInvalid ? 'border-red-400 focus:ring-red-400' : ''}`}
                required
                placeholder={t('auth.placeholder_email')}
                autoComplete="email"
                aria-invalid={emailInvalid}
              />
            </div>
          </FormField>
          <FormField
            label={t('auth.password')}
            htmlFor="login-password"
            error={passwordMissing ? t('auth.password_required') : ''}
          >
            <div className="relative overflow-visible">
              <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400 z-10 pointer-events-none" />
              <input
                id="login-password"
                ref={passwordInputRef}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => handlePasswordChange(e.target.value)}
                onKeyDown={handlePasswordKeyEvent}
                onKeyUp={handlePasswordKeyEvent}
                onBlur={() => setCapsLockOn(false)}
                className={`input-field pl-10 pr-12 relative z-0 ${passwordMissing ? 'border-red-400 focus:ring-red-400' : ''}`}
                required
                placeholder="••••••••"
                autoComplete="current-password"
                aria-invalid={passwordMissing}
              />
              <button
                type="button"
                tabIndex={0}
                onClick={(e) => {
                  e.preventDefault()
                  setShowPassword((v) => !v)
                }}
                onMouseDown={(e) => e.preventDefault()}
                className="absolute right-2 top-1/2 -translate-y-1/2 z-20 p-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-guardian-blue/50"
                title={t('auth.show_password')}
                aria-label={t('auth.show_password')}
                aria-pressed={showPassword}
              >
                {showPassword ? <EyeOff className="h-5 w-5" aria-hidden /> : <Eye className="h-5 w-5" aria-hidden />}
              </button>
            </div>
            {capsLockOn && (
              <p className="mt-1 text-xs text-amber-600">{t('auth.caps_lock_on')}</p>
            )}
          </FormField>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-guardian-blue focus:ring-guardian-blue"
            />
            <span className="text-sm text-gray-700">{t('auth.remember_me')}</span>
          </label>
          <button type="submit" disabled={loading} className="btn-primary w-full py-3">
            {loading ? t('auth.logging_in') : t('auth.login_btn')}
          </button>
          {demoModeEnabled && (
            <button type="button" onClick={() => { enterDemo(); router.push('/map'); router.refresh() }} className="flex w-full items-center justify-center gap-2 rounded-xl border border-violet-300 bg-violet-50 px-4 py-3 font-semibold text-violet-800 transition hover:bg-violet-100">
              <Sparkles className="h-4 w-4" /> Explore demo without server
            </button>
          )}
        </form>
        <p className="mt-6 text-center text-sm text-gray-500">
          {t('auth.no_account')}{' '}
          <Link href="/register" className="font-medium text-guardian-blue hover:underline">
            {t('auth.register_link')}
          </Link>
        </p>
        <p className="mt-2 text-center text-sm">
          <Link href="/profile" className="text-gray-500 hover:underline">{t('back_home')}</Link>
        </p>
      </div>
    </div>
  )
}
