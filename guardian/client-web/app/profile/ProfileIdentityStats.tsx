'use client'

import Link from 'next/link'

type Props = {
  initial: string
  displayName: string
  roleLabel: string
  completionPercent: number
  t: (key: string) => string
}

export function ProfileIdentityStats({ initial, displayName, roleLabel, completionPercent, t }: Props) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <Link href="/profile/personal" className="inline-flex items-center hover:opacity-90 transition-opacity">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-violet-500/40 text-2xl font-bold text-white">
            {initial}
          </span>
        </Link>
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-white">{displayName || t('profile.user')}</p>
          <p className="text-xs text-white/70">{roleLabel}</p>
          <div className="mt-1.5 w-36 max-w-full">
            <div className="h-1.5 overflow-hidden rounded-full bg-white/20">
              <div
                className="h-full rounded-full bg-violet-300 transition-all"
                style={{ width: `${Math.max(0, Math.min(100, completionPercent))}%` }}
              />
            </div>
            <p className="mt-1 text-[11px] text-white/60">{t('profile.completion_label')} {completionPercent}%</p>
          </div>
        </div>
      </div>
    </div>
  )
}

