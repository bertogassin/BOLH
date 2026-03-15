'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useLocale } from '@/context/LocaleContext'
import { changePassword } from '@/lib/api'
import { BOLHNav } from '@/components/BOLHNav'

export default function ChangePasswordPage() {
  const { user } = useAuth()
  const { t } = useLocale()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (newPassword !== confirmPassword) {
      setError(t('profile_change_password.error_mismatch'))
      return
    }
    if (newPassword.length < 8) {
      setError(t('profile_change_password.error_min_length'))
      return
    }
    setLoading(true)
    try {
      await changePassword(currentPassword, newPassword)
      setSuccess(true)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setError(err instanceof Error ? err.message : t('profile_change_password.error_generic'))
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
          <h1 className="text-lg font-semibold">{t('profile_change_password.title')}</h1>
        </div>
      </header>
      <main className="mx-auto max-w-lg px-4 py-6">
        {success && (
          <div className="rounded-xl bg-green-500/20 border border-green-500/40 p-3 text-sm text-green-200 mb-4">
            {t('profile_change_password.updated')}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-xl bg-red-500/20 border border-red-500/40 p-3 text-sm text-red-200">{error}</div>
          )}
          <div>
            <label className="block text-xs font-medium text-white/60 uppercase mb-1">{t('profile_change_password.current_password')}</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              className="w-full rounded-xl bg-white/10 px-4 py-3 text-white placeholder:text-white/40 outline-none border border-white/10 focus:border-violet-400 min-h-[44px]"
              placeholder="••••••••"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-white/60 uppercase mb-1">{t('profile_change_password.new_password')}</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
              className="w-full rounded-xl bg-white/10 px-4 py-3 text-white placeholder:text-white/40 outline-none border border-white/10 focus:border-violet-400 min-h-[44px]"
              placeholder="••••••••"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-white/60 uppercase mb-1">{t('profile_change_password.confirm_password')}</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              className="w-full rounded-xl bg-white/10 px-4 py-3 text-white placeholder:text-white/40 outline-none border border-white/10 focus:border-violet-400 min-h-[44px]"
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-violet-600 hover:bg-violet-500 py-3.5 font-medium text-white min-h-[44px] disabled:opacity-50"
          >
            {loading ? t('profile_change_password.saving') : t('profile_change_password.save')}
          </button>
        </form>
      </main>
      <BOLHNav current="profile" />
    </div>
  )
}
