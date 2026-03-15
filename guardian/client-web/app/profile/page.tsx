'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  User,
  Sparkles,
  Wifi,
  WifiOff,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useLocale } from '@/context/LocaleContext'
import { useAIChat } from '@/context/AIChatContext'
import { fetchCards, type PaymentCard } from '@/lib/api'
import { BOLHNav } from '@/components/BOLHNav'
import type { ProfileDetails } from './OnlineDetailsForm'
import { AuthenticatedProfileContent } from './AuthenticatedProfileContent'
import { getProfileAvatar } from '@/lib/profileAvatar'

export default function ProfilePage() {
  const { user, loading, logout } = useAuth()
  const { t } = useLocale()
  const { openChat } = useAIChat()
  const router = useRouter()
  const [cards, setCards] = useState<PaymentCard[]>([])
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [onlineHint, setOnlineHint] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [details, setDetails] = useState<ProfileDetails>({
    online: false,
    displayName: '',
    phoneAlt: '',
    city: '',
    address: '',
    languages: '',
    experienceYears: '',
    licenses: '',
    serviceRadiusKm: '',
    basePrice: '',
    hourlyRate: '',
    availability: '',
    bio: '',
  })

  const detailsStorageKey = `guardian_profile_details_${user?.id || 'guest'}`
  const defaultDisplayName = `${user?.first_name || ''} ${user?.last_name || ''}`.trim() || user?.email || t('profile.user')

  useEffect(() => {
    if (!user) return
    try {
      const raw = window.localStorage.getItem(detailsStorageKey)
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<typeof details>
        setDetails((prev) => ({
          ...prev,
          ...parsed,
          displayName:
            String(parsed.displayName || '').trim() ||
            defaultDisplayName,
          phoneAlt: String(parsed.phoneAlt || '').trim() || user.phone || '',
        }))
      } else {
        setDetails((prev) => ({
          ...prev,
          displayName: defaultDisplayName,
          phoneAlt: user.phone || '',
        }))
      }
    } catch {
      setDetails((prev) => ({
        ...prev,
        displayName: defaultDisplayName,
        phoneAlt: user.phone || '',
      }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultDisplayName, user?.id])

  useEffect(() => {
    if (!user?.id) {
      setAvatarUrl(null)
      return
    }
    setAvatarUrl(getProfileAvatar(user.id))
  }, [user?.id])

  const toggleOnlineStatus = () => {
    if (!details.online) {
      const requiredForOnline = [
        details.displayName,
        details.city,
        details.availability,
        details.serviceRadiusKm,
        details.basePrice,
        details.hourlyRate,
      ]
      const missingRequired = requiredForOnline.some((v) => String(v || '').trim().length === 0)
      if (missingRequired) {
        setOnlineHint(t('profile.online_hint_full'))
        return
      }
    }
    setOnlineHint('')
    setDetails((prev) => {
      const next = { ...prev, online: !prev.online }
      try {
        window.localStorage.setItem(detailsStorageKey, JSON.stringify(next))
      } catch {
        // ignore storage errors
      }
      return next
    })
  }

  useEffect(() => {
    if (!user) {
      setCards([])
      return
    }
    fetchCards()
      .then((cardsList) => setCards(cardsList))
      .catch(() => {
        setCards([])
      })
  }, [user])

  const handleLogout = () => {
    if (!showLogoutConfirm) {
      setShowLogoutConfirm(true)
      return
    }
    setShowLogoutConfirm(false)
    logout()
    router.push('/booking')
    router.refresh()
  }

  const initial = user ? (user.first_name?.[0] || user.email?.[0] || 'U').toUpperCase() : 'U'
  const isAgency = user?.user_type === 'agency'
  const fallbackDisplayName = `${user?.first_name || ''} ${user?.last_name || ''}`.trim() || user?.email || t('profile.user')
  const displayName = (details.displayName || fallbackDisplayName).trim()
  const roleLabel =
    user?.user_type === 'agency'
      ? t('profile.role_agency')
      : user?.user_type === 'guard'
      ? t('profile.role_guard')
      : t('profile.role_client')
  const completionFields = [
    details.displayName,
    details.phoneAlt,
    details.city,
    details.address,
    details.languages,
    details.experienceYears,
    details.licenses,
    details.serviceRadiusKm,
    details.basePrice,
    details.hourlyRate,
    details.availability,
    details.bio,
  ]
  const completionPercent = Math.round((completionFields.filter((v) => String(v || '').trim().length > 0).length / completionFields.length) * 100)

  if (loading) {
    return (
      <div className="theme-page min-h-screen pb-24">
        <div className="animate-pulse space-y-5 px-4 py-5">
          <div className="h-24 rounded-2xl bg-white/10" />
          <div className="grid grid-cols-3 gap-3">
            <div className="h-20 rounded-xl bg-white/10" />
            <div className="h-20 rounded-xl bg-white/10" />
            <div className="h-20 rounded-xl bg-white/10" />
          </div>
          <div className="h-14 rounded-xl bg-white/10" />
          <div className="h-14 rounded-xl bg-white/10" />
        </div>
      </div>
    )
  }

  return (
    <div className="theme-page min-h-screen text-white pb-24">
      <header className="theme-header sticky top-0 z-10 border-b border-white/10 backdrop-blur">
        <div className="flex min-h-[200px] items-end justify-between px-4 pb-4 pt-4">
          <span className="text-base font-bold uppercase tracking-wide">
            <span className="text-orange-300 font-extrabold">BOLH</span>{' '}
            <span className="text-white font-medium">SECURITY</span>
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleOnlineStatus}
              className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs border transition ${
                details.online
                  ? 'bg-green-500/20 border-green-400/40 text-green-200 hover:bg-green-500/30'
                  : 'theme-surface border-violet-400 text-white/90 theme-hover'
              }`}
            >
              <span className={`inline-block h-2 w-2 rounded-full ${details.online ? 'bg-green-300 animate-pulse' : 'bg-white/70'}`} />
              {details.online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
              {details.online ? t('profile.online') : t('profile.offline')}
            </button>
            <button
              type="button"
              onClick={openChat}
              className="p-2 rounded-lg theme-hover min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label={t('ai_chat.aria_chat')}
            >
              <Sparkles className="h-5 w-5 text-white/80" />
            </button>
          </div>
        </div>
        {onlineHint ? (
          <div className="px-4 pb-2 text-xs text-amber-300">
            {onlineHint}
          </div>
        ) : null}
      </header>

      <main className="mx-auto max-w-lg px-4 py-5 space-y-5">
        {user ? (
          <AuthenticatedProfileContent
            t={t}
            initial={initial}
            displayName={displayName}
            roleLabel={roleLabel}
            completionPercent={completionPercent}
            avatarUrl={avatarUrl}
            cards={cards}
            isAgency={isAgency}
            showLogoutConfirm={showLogoutConfirm}
            setShowLogoutConfirm={setShowLogoutConfirm}
            handleLogout={handleLogout}
          />
        ) : (
          <div className="theme-surface rounded-2xl border border-violet-400 p-8 text-center">
            <User className="h-12 w-12 text-white/30 mx-auto mb-3" />
            <p className="text-white/80">{t('profile.login_to_see')}</p>
            <Link href="/login" className="mt-4 inline-block text-violet-400 hover:underline min-h-[44px] flex items-center">{t('profile.login')}</Link>
          </div>
        )}
      </main>

      <BOLHNav current="profile" />
    </div>
  )
}
