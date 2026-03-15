'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useLocale } from '@/context/LocaleContext'
import { InputWithClear } from '@/components/InputWithClear'
import { FormField } from '@/components/FormField'
import { DARK_CLEAR_BUTTON_CLASS, DARK_FIELD_LABEL_CLASS, DARK_INPUT_CLASS } from '@/components/formStyles'
import { updateProfile } from '@/lib/api'
import { BOLHNav } from '@/components/BOLHNav'

export default function ProfilePersonalPage() {
  const { user, refreshUser } = useAuth()
  const { t } = useLocale()
  const router = useRouter()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (!user) return
    setFirstName(user.first_name || '')
    setLastName(user.last_name || '')
    setPhone(user.phone || '')
  }, [user])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await updateProfile({ first_name: firstName, last_name: lastName, phone: phone || undefined })
      await refreshUser()
      setSuccess(true)
      router.push('/profile')
    } catch (err) {
      setError(err instanceof Error ? err.message : t('profile.save_error'))
    } finally {
      setLoading(false)
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
          <h1 className="text-lg font-semibold">{t('profile.title')}</h1>
        </div>
      </header>
      <main className="mx-auto max-w-lg px-4 py-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          {success ? (
            <div className="rounded-xl bg-emerald-500/20 border border-emerald-500/40 p-3 text-sm text-emerald-200">
              {t('profile.saved')}
            </div>
          ) : null}
          {error ? (
            <div className="rounded-xl bg-red-500/20 border border-red-500/40 p-3 text-sm text-red-200">{error}</div>
          ) : null}
          <FormField
            label={t('profile.first_name')}
            labelClassName={DARK_FIELD_LABEL_CLASS}
          >
            <InputWithClear
              value={firstName}
              onChange={setFirstName}
              placeholder={t('profile.first_name')}
              className={DARK_INPUT_CLASS}
              clearButtonClassName={DARK_CLEAR_BUTTON_CLASS}
            />
          </FormField>
          <FormField
            label={t('profile.last_name')}
            labelClassName={DARK_FIELD_LABEL_CLASS}
          >
            <InputWithClear
              value={lastName}
              onChange={setLastName}
              placeholder={t('profile.last_name')}
              className={DARK_INPUT_CLASS}
              clearButtonClassName={DARK_CLEAR_BUTTON_CLASS}
            />
          </FormField>
          <FormField
            label={t('profile.phone')}
            labelClassName={DARK_FIELD_LABEL_CLASS}
          >
            <InputWithClear
              value={phone}
              onChange={setPhone}
              type="tel"
              placeholder={t('profile.placeholder_phone')}
              className={DARK_INPUT_CLASS}
              clearButtonClassName={DARK_CLEAR_BUTTON_CLASS}
            />
          </FormField>
          <div className="border-t border-white/10 pt-3">
            <button
              type="submit"
              disabled={loading || success}
              className="w-full rounded-xl bg-violet-600 hover:bg-violet-500 py-3.5 font-medium text-white min-h-[44px] disabled:opacity-50"
            >
              {loading ? t('profile.saving') : t('profile.save')}
            </button>
          </div>
        </form>
      </main>
      <BOLHNav current="profile" />
    </div>
  )
}
