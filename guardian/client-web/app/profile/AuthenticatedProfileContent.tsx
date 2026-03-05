'use client'

import type { PaymentCard } from '@/lib/api'
import { ProfileAddressesSection } from './ProfileAddressesSection'
import { ProfileBusinessSection } from './ProfileBusinessSection'
import { ProfileCardsSection } from './ProfileCardsSection'
import { ProfileDataLinksSection } from './ProfileDataLinksSection'
import { ProfileGeneralSection } from './ProfileGeneralSection'
import { ProfileIdentityStats } from './ProfileIdentityStats'
import { ProfileLogoutSection } from './ProfileLogoutSection'

type Props = {
  t: (key: string) => string
  initial: string
  displayName: string
  roleLabel: string
  completionPercent: number
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
        t={t}
      />
      <ProfileDataLinksSection />
      <ProfileCardsSection cards={cards} t={t} />
      <ProfileAddressesSection />
      <ProfileBusinessSection isAgency={isAgency} />
      <ProfileGeneralSection t={t} />
      <ProfileLogoutSection showLogoutConfirm={showLogoutConfirm} setShowLogoutConfirm={setShowLogoutConfirm} handleLogout={handleLogout} />
    </>
  )
}

