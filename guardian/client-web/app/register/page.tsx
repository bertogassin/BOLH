'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Shield, Mail, Lock, User, Check } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useLocale } from '@/context/LocaleContext'
import { InputWithClear } from '@/components/InputWithClear'
import { FieldError, FormErrorSummary } from '@/components/FormErrors'
import { FormField } from '@/components/FormField'

export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const [acceptedLegal, setAcceptedLegal] = useState(false)
  const [typingCount, setTypingCount] = useState(0)
  const [autofillUsed, setAutofillUsed] = useState(false)
  const firstInputRef = useRef<HTMLInputElement>(null)
  const errorRef = useRef<HTMLDivElement>(null)
  const startedAtRef = useRef<number>(Date.now())
  const { register } = useAuth()
  const { t } = useLocale()
  const router = useRouter()

  const passwordsMatch = !confirmPassword || password === confirmPassword
  const passwordLongEnough = password.length >= 6

  useEffect(() => {
    firstInputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [error])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitAttempted(true)
    setError('')
    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      setError('Please fill all required fields.')
      return
    }
    if (!/\S+@\S+\.\S+/.test(email.trim().toLowerCase())) {
      setError(t('auth.invalid_email'))
      return
    }
    if (!passwordLongEnough) {
      setError(t('auth.password_min'))
      return
    }
    if (!acceptedLegal) {
      setError('Please accept the Terms and Privacy Policy to continue.')
      return
    }
    if (password !== confirmPassword) {
      setError(t('auth.confirm_password_mismatch'))
      return
    }
    setLoading(true)
    if (typeof window !== 'undefined') {
      const elapsedMs = Date.now() - startedAtRef.current
      const score = Math.max(0, Math.min(100, Math.round((typingCount * 5) + Math.min(45, elapsedMs / 250))))
      const fastSubmit = elapsedMs < 3500 || typingCount < 5
      sessionStorage.setItem(
        'guardian_behavior_register',
        JSON.stringify({
          score,
          autofill: autofillUsed,
          fastSubmit,
        })
      )
    }
    try {
      await register({ email, password, first_name: firstName, last_name: lastName })
      router.push('/profile')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.register_error'))
    } finally {
      setLoading(false)
    }
  }

  const firstNameError = submitAttempted && !firstName.trim()
  const lastNameError = submitAttempted && !lastName.trim()
  const emailError = submitAttempted && (!email.trim() || !/\S+@\S+\.\S+/.test(email.trim().toLowerCase()))
  const passwordError = submitAttempted && !passwordLongEnough
  const confirmError = submitAttempted && (!confirmPassword || !passwordsMatch)
  const legalError = submitAttempted && !acceptedLegal

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-guardian-bg p-4 py-8">
      <div className="w-full max-w-md rounded-2xl border border-gray-200/80 bg-white p-8 shadow-xl">
        <div className="mb-6 flex justify-center">
          <div className="flex items-center gap-3 rounded-2xl bg-guardian-blue px-5 py-3 text-white">
            <Shield className="h-8 w-8 shrink-0" />
            <span className="text-2xl font-bold tracking-tight">BOLH</span>
          </div>
        </div>
        <h1 className="mb-1 text-center text-2xl font-bold text-gray-900">{t('auth.register_title')}</h1>
        <p className="mb-6 text-center text-sm text-gray-500">{t('auth.register_subtitle')}</p>
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {error && (
            <div ref={errorRef}>
              <FormErrorSummary message={error} />
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <FormField
                label={t('auth.first_name')}
                htmlFor="reg-first"
                error={firstNameError ? `${t('auth.first_name')} is required.` : ''}
              >
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400 z-10" />
                <InputWithClear
                  ref={firstInputRef}
                  value={firstName}
                  onChange={(v) => { setFirstName(v); setTypingCount((x) => x + 1) }}
                  className={`input-field pl-10 ${firstNameError ? 'border-red-400 focus:ring-red-400' : ''}`}
                  required
                  placeholder={t('auth.placeholder_first')}
                  autoComplete="given-name"
                  id="reg-first"
                  aria-invalid={firstNameError}
                />
              </div>
              </FormField>
            </div>
            <div>
              <FormField
                label={t('auth.last_name')}
                htmlFor="reg-last"
                error={lastNameError ? `${t('auth.last_name')} is required.` : ''}
              >
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400 z-10" />
                <InputWithClear
                  value={lastName}
                  onChange={(v) => { setLastName(v); setTypingCount((x) => x + 1) }}
                  className={`input-field pl-10 ${lastNameError ? 'border-red-400 focus:ring-red-400' : ''}`}
                  required
                  placeholder={t('auth.placeholder_last')}
                  autoComplete="family-name"
                  id="reg-last"
                  aria-invalid={lastNameError}
                />
              </div>
              </FormField>
            </div>
          </div>
          <FormField
            label={t('auth.email')}
            htmlFor="reg-email"
            error={emailError ? t('auth.invalid_email') : ''}
          >
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400 z-10" />
              <InputWithClear
                value={email}
                onChange={(v) => {
                  setEmail(v)
                  setTypingCount((x) => x + 1)
                  if (v.includes('@') && v.length > 8 && typingCount === 0) setAutofillUsed(true)
                }}
                type="email"
                className={`input-field pl-10 ${emailError ? 'border-red-400 focus:ring-red-400' : ''}`}
                required
                placeholder={t('auth.placeholder_email')}
                autoComplete="email"
                id="reg-email"
                aria-invalid={emailError}
              />
            </div>
          </FormField>
          <FormField
            label={t('auth.password_min')}
            htmlFor="reg-password"
            error={passwordError ? t('auth.password_min') : ''}
          >
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400 z-10" />
              <input
                id="reg-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setTypingCount((x) => x + 1) }}
                className={`input-field pl-10 ${passwordError ? 'border-red-400 focus:ring-red-400' : ''}`}
                required
                minLength={6}
                placeholder="••••••••"
                autoComplete="new-password"
                aria-invalid={passwordError}
              />
            </div>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-gray-500">
              {passwordLongEnough ? <Check className="h-3.5 w-3.5 text-green-600" /> : <span className="w-3.5 h-3.5" />}
              {t('auth.password_ok')}
            </p>
          </FormField>
          <FormField
            label={t('auth.confirm_password')}
            htmlFor="reg-confirm"
            error={confirmError ? t('auth.confirm_password_mismatch') : ''}
          >
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400 z-10" />
              <input
                id="reg-confirm"
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); setTypingCount((x) => x + 1) }}
                className={`input-field pl-10 ${confirmPassword && !passwordsMatch ? 'border-red-400 focus:ring-red-400' : ''}`}
                required
                minLength={6}
                placeholder="••••••••"
                autoComplete="new-password"
                aria-invalid={confirmError}
              />
            </div>
          </FormField>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showPassword}
              onChange={(e) => setShowPassword(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-guardian-blue focus:ring-guardian-blue"
            />
            <span className="text-sm text-gray-700">{t('auth.show_password')}</span>
          </label>
          <p className="text-xs text-gray-500">
            {t('auth.terms_agree')}{' '}
            <Link href="/legal/terms" className="text-guardian-blue hover:underline">{t('booking.terms_link')}</Link>
            {' · '}
            <Link href="/legal/privacy" className="text-guardian-blue hover:underline">{t('booking.privacy_link')}</Link>
          </p>
          <label className={`flex items-start gap-2 rounded-xl border p-3 bg-gray-50/70 cursor-pointer ${legalError ? 'border-red-300' : 'border-gray-200'}`}>
            <input
              type="checkbox"
              checked={acceptedLegal}
              onChange={(e) => setAcceptedLegal(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-guardian-blue focus:ring-guardian-blue"
              required
              aria-invalid={legalError}
            />
            <span className="text-sm text-gray-700">
              I confirm that I have read and accept the{' '}
              <Link href="/legal/terms" className="text-guardian-blue hover:underline">
                Terms and Conditions
              </Link>{' '}
              and{' '}
              <Link href="/legal/privacy" className="text-guardian-blue hover:underline">
                Privacy Policy
              </Link>.
            </span>
          </label>
          {legalError ? <FieldError message="Please accept legal terms to continue." /> : null}
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-3"
          >
            {loading ? t('auth.registering') : t('auth.register_btn')}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-gray-500">
          {t('auth.have_account')}{' '}
          <Link href="/login" className="font-medium text-guardian-blue hover:underline">
            {t('auth.login_btn')}
          </Link>
        </p>
        <p className="mt-2 text-center text-sm">
          <Link href="/profile" className="text-gray-500 hover:underline">{t('back_home')}</Link>
        </p>
      </div>
    </div>
  )
}
