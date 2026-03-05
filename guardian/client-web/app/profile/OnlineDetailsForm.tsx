'use client'

import { ChevronDown, ChevronUp, Save, Wifi, WifiOff } from 'lucide-react'
import { useState, type Dispatch, type SetStateAction } from 'react'

export type ProfileDetails = {
  online: boolean
  displayName: string
  phoneAlt: string
  city: string
  address: string
  languages: string
  experienceYears: string
  licenses: string
  hourlyRate: string
  availability: string
  bio: string
}

type Props = {
  details: ProfileDetails
  setDetails: Dispatch<SetStateAction<ProfileDetails>>
  saveDetails: () => Promise<void>
  detailsSaving: boolean
  detailsSaved: boolean
}

export function OnlineDetailsForm({ details, setDetails, saveDetails, detailsSaving, detailsSaved }: Props) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <section>
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="w-full mb-3 rounded-xl bg-white/10 border border-violet-400 px-4 py-3 flex items-center justify-between text-left"
        aria-expanded={isOpen}
      >
        <span className="text-sm font-semibold text-white">Online profile details</span>
        {isOpen ? <ChevronUp className="h-4 w-4 text-white/70" /> : <ChevronDown className="h-4 w-4 text-white/70" />}
      </button>

      {isOpen ? (
      <div className="rounded-xl bg-white/10 border border-violet-400 p-4 space-y-3">
        <button
          type="button"
          onClick={() => setDetails((d) => ({ ...d, online: !d.online }))}
          className={`w-full rounded-xl border px-3 py-2.5 min-h-[44px] inline-flex items-center justify-center gap-2 font-medium ${
            details.online
              ? 'bg-green-500/30 border-green-400/60 text-green-100'
              : 'bg-white/10 border-violet-400 text-white'
          }`}
        >
          {details.online ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
          {details.online ? 'Online active' : 'Switch to online'}
        </button>

        <div className="grid grid-cols-1 gap-2">
          <input
            value={details.displayName}
            onChange={(e) => setDetails((d) => ({ ...d, displayName: e.target.value }))}
            placeholder="Display name"
            className="rounded-xl bg-white/10 border border-violet-400 px-3 py-2.5 text-sm outline-none"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              value={details.phoneAlt}
              onChange={(e) => setDetails((d) => ({ ...d, phoneAlt: e.target.value }))}
              placeholder="Phone"
              className="rounded-xl bg-white/10 border border-violet-400 px-3 py-2.5 text-sm outline-none"
            />
            <input
              value={details.city}
              onChange={(e) => setDetails((d) => ({ ...d, city: e.target.value }))}
              placeholder="City"
              className="rounded-xl bg-white/10 border border-violet-400 px-3 py-2.5 text-sm outline-none"
            />
          </div>
          <input
            value={details.address}
            onChange={(e) => setDetails((d) => ({ ...d, address: e.target.value }))}
            placeholder="Address"
            className="rounded-xl bg-white/10 border border-violet-400 px-3 py-2.5 text-sm outline-none"
          />
          <input
            value={details.languages}
            onChange={(e) => setDetails((d) => ({ ...d, languages: e.target.value }))}
            placeholder="Languages (ex: FR, EN, RU)"
            className="rounded-xl bg-white/10 border border-violet-400 px-3 py-2.5 text-sm outline-none"
          />
          <div className="grid grid-cols-3 gap-2">
            <input
              value={details.experienceYears}
              onChange={(e) => setDetails((d) => ({ ...d, experienceYears: e.target.value.replace(/[^\d]/g, '').slice(0, 2) }))}
              placeholder="Exp (years)"
              className="rounded-xl bg-white/10 border border-violet-400 px-3 py-2.5 text-sm outline-none"
            />
            <input
              value={details.hourlyRate}
              onChange={(e) => setDetails((d) => ({ ...d, hourlyRate: e.target.value.replace(',', '.') }))}
              placeholder="Rate / hour"
              className="rounded-xl bg-white/10 border border-violet-400 px-3 py-2.5 text-sm outline-none"
            />
            <input
              value={details.availability}
              onChange={(e) => setDetails((d) => ({ ...d, availability: e.target.value }))}
              placeholder="Availability"
              className="rounded-xl bg-white/10 border border-violet-400 px-3 py-2.5 text-sm outline-none"
            />
          </div>
          <input
            value={details.licenses}
            onChange={(e) => setDetails((d) => ({ ...d, licenses: e.target.value }))}
            placeholder="Licenses / certificates"
            className="rounded-xl bg-white/10 border border-violet-400 px-3 py-2.5 text-sm outline-none"
          />
          <textarea
            value={details.bio}
            onChange={(e) => setDetails((d) => ({ ...d, bio: e.target.value }))}
            placeholder="Short bio / details"
            rows={3}
            className="rounded-xl bg-white/10 border border-violet-400 px-3 py-2.5 text-sm outline-none resize-none"
          />
        </div>

        <button
          type="button"
          onClick={saveDetails}
          disabled={detailsSaving}
          className="w-full rounded-xl bg-violet-600 hover:bg-violet-500 border border-violet-400 py-3 min-h-[44px] inline-flex items-center justify-center gap-2 font-medium disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {detailsSaving ? 'Saving...' : detailsSaved ? 'Saved' : 'Save details'}
        </button>
        <p className="text-xs text-white/60">Details are saved to your account and reused automatically next time.</p>
      </div>
      ) : null}
    </section>
  )
}

