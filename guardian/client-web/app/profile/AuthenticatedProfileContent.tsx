'use client'

import type { Dispatch, SetStateAction } from 'react'
import type { PaymentCard } from '@/lib/api'
import { OnlineDetailsForm, type ProfileDetails } from './OnlineDetailsForm'
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
  details: ProfileDetails
  setDetails: Dispatch<SetStateAction<ProfileDetails>>
  saveDetails: () => Promise<void>
  detailsSaving: boolean
  detailsSaved: boolean
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
  details,
  setDetails,
  saveDetails,
  detailsSaving,
  detailsSaved,
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
      <OnlineDetailsForm details={details} setDetails={setDetails} saveDetails={saveDetails} detailsSaving={detailsSaving} detailsSaved={detailsSaved} />
      <ProfileGeneralSection t={t} />
      <ProfileLogoutSection showLogoutConfirm={showLogoutConfirm} setShowLogoutConfirm={setShowLogoutConfirm} handleLogout={handleLogout} />
    </>
  )
}

