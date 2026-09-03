'use client'

import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'

export type MobileNavItem = {
  href: string
  label: string
  icon: LucideIcon
  active: boolean
}

export function MobileNav({ items }: { items: MobileNavItem[] }) {
  return (
    <nav className="fixed bottom-0 left-1/2 z-30 w-full max-w-[480px] -translate-x-1/2 px-3 pb-[max(.7rem,env(safe-area-inset-bottom))]" aria-label="Primary navigation">
      <div className="grid grid-cols-3 gap-1 rounded-[1.35rem] border border-white/10 bg-[#0b0f19]/90 p-1.5 shadow-[0_18px_55px_rgba(0,0,0,.58),inset_0_1px_rgba(255,255,255,.08)] backdrop-blur-2xl">
        {items.map(({ href, label, icon: Icon, active }) => (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={`group relative flex min-h-[54px] flex-col items-center justify-center gap-1 overflow-hidden rounded-[1rem] px-2 transition active:scale-[.98] ${
              active
                ? 'bg-gradient-to-b from-violet-500/25 to-blue-500/10 text-white shadow-[inset_0_0_0_1px_rgba(167,139,250,.24)]'
                : 'text-white/48 hover:bg-white/[.055] hover:text-white/80'
            }`}
          >
            {active && <span className="absolute top-0 h-[2px] w-8 rounded-full bg-gradient-to-r from-violet-400 to-sky-400 shadow-[0_0_12px_#8b5cf6]" />}
            <Icon className={`h-[1.15rem] w-[1.15rem] ${active ? 'text-violet-300' : ''}`} strokeWidth={active ? 2.4 : 1.9} />
            <span className="text-[11px] font-semibold tracking-wide">{label}</span>
          </Link>
        ))}
      </div>
    </nav>
  )
}
