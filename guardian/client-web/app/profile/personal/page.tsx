'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useLocale } from '@/context/LocaleContext'
import { InputWithClear } from '@/components/InputWithClear'
import { FormField } from '@/components/FormField'
import { DARK_CLEAR_BUTTON_CLASS, DARK_FIELD_LABEL_CLASS, DARK_INPUT_CLASS } from '@/components/formStyles'
import { updateProfile } from '@/lib/api'
import { BOLHNav } from '@/components/BOLHNav'
import { clearProfileAvatar, fileToDataUrl, getProfileAvatar, setProfileAvatar } from '@/lib/profileAvatar'

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
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [avatarError, setAvatarError] = useState('')
  const avatarInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!user) return
    setFirstName(user.first_name || '')
    setLastName(user.last_name || '')
    setPhone(user.phone || '')
    setAvatarUrl(getProfileAvatar(user.id))
  }, [user])

  const handleAvatarUpload = async (file: File) => {
    if (!user?.id) return
    if (!file.type.startsWith('image/')) {
      setAvatarError('Please choose an image file.')
      return
    }
    if (file.size > 4 * 1024 * 1024) {
      setAvatarError('Image is too large. Max size is 4MB.')
      return
    }
    try {
      const dataUrl = await fileToDataUrl(file)
      setProfileAvatar(user.id, dataUrl)
      setAvatarUrl(dataUrl)
      setAvatarError('')
    } catch {
      setAvatarError('Failed to upload image.')
    }
  }

  const handleRemoveAvatar = () => {
    if (!user?.id) return
    clearProfileAvatar(user.id)
    setAvatarUrl(null)
    setAvatarError('')
  }

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
      <div className="min-h-screen bg-[#1a1b26] text-white flex items-center justify-center">
        <Link href="/login" className="text-violet-400 hover:underline">{t('auth.login_btn')}</Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#1a1b26] text-white pb-24">
      <header className="sticky top-0 z-10 border-b border-white/10 bg-[#1a1b26]/95 backdrop-blur">
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
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="mb-3 text-sm text-white/80">Profile photo</p>
            <div className="flex items-center gap-4">
              {avatarUrl ? (
                <Image
                  src={avatarUrl}
                  alt="Profile avatar"
                  width={64}
                  height={64}
                  unoptimized
                  className="h-16 w-16 rounded-full border border-violet-400/60 object-cover"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-full border border-violet-400/60 bg-violet-500/30 text-xl font-semibold text-white">
                  {(firstName?.[0] || user.first_name?.[0] || user.email?.[0] || 'U').toUpperCase()}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  className="rounded-lg border border-violet-400 bg-violet-600 px-3 py-2 text-sm text-white hover:bg-violet-500"
                >
                  {avatarUrl ? 'Change photo' : 'Add photo'}
                </button>
                {avatarUrl ? (
                  <button
                    type="button"
                    onClick={handleRemoveAvatar}
                    className="rounded-lg border border-red-500/60 bg-red-500/20 px-3 py-2 text-sm text-red-200 hover:bg-red-500/30"
                  >
                    Remove
                  </button>
                ) : null}
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    handleAvatarUpload(file)
                    e.currentTarget.value = ''
                  }}
                />
              </div>
            </div>
            {avatarError ? <p className="mt-2 text-xs text-red-300">{avatarError}</p> : null}
          </div>
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
