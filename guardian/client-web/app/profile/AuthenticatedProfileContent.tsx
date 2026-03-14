'use client'

import type { PaymentCard } from '@/lib/api'
import { ProfileAddressesSection } from './ProfileAddressesSection'
import { ProfileBusinessSection } from './ProfileBusinessSection'
import { ProfileCardsSection } from './ProfileCardsSection'
import { ProfileDataLinksSection } from './ProfileDataLinksSection'
import { ProfileDangerSection } from './ProfileDangerSection'
import { ProfileGeneralSection } from './ProfileGeneralSection'
import { ProfileIdentityStats } from './ProfileIdentityStats'
import { ProfileLogoutSection } from './ProfileLogoutSection'

type Props = {
  t: (key: string) => string
  initial: string
  displayName: string
  roleLabel: string
  completionPercent: number
  avatarUrl?: string | null
  cards: PaymentCard[]
  isAgency: boolean
  showLogoutConfirm: boolean
  setShowLogoutConfirm: (value: boolean) => void
  handleLogout: () => void
}

export function AuthenticatedProfileContent({
  t,
  initial,
  displayName,
  roleLabel,
  completionPercent,
  avatarUrl,
  cards,
  isAgency,
  showLogoutConfirm,
  setShowLogoutConfirm,
  handleLogout,
}: Props) {
  return (
    <>
      <ProfileIdentityStats
        initial={initial}
        displayName={displayName}
        roleLabel={roleLabel}
        completionPercent={completionPercent}
        avatarUrl={avatarUrl}
        t={t}
      />
      <div className="space-y-3">
        <ProfileDataLinksSection />
        <ProfileCardsSection cards={cards} t={t} />
        <ProfileAddressesSection />
        <ProfileBusinessSection isAgency={isAgency} />
        <ProfileGeneralSection t={t} />
      </div>
      <div className="space-y-2 border-t border-white/10 pt-3">
        <ProfileLogoutSection showLogoutConfirm={showLogoutConfirm} setShowLogoutConfirm={setShowLogoutConfirm} handleLogout={handleLogout} />
        <ProfileDangerSection />
      </div>
    </>
  )
}

