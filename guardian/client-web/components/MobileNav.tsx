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
      <div className="bolh-mobile-nav grid grid-cols-3 gap-1 rounded-[1.35rem] border p-1.5 backdrop-blur-2xl">
        {items.map(({ href, label, icon: Icon, active }) => (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={`group relative flex min-h-[54px] flex-col items-center justify-center gap-1 overflow-hidden rounded-[1rem] px-2 transition active:scale-[.98] ${
              active
                ? 'bg-gradient-to-br from-violet-600 to-blue-600 text-white shadow-[0_8px_22px_rgba(91,33,182,.25)]'
                : 'theme-text-muted hover:bg-white/[.055] hover:text-violet-400'
            }`}
          >
            {active && <span className="absolute top-0 h-[2px] w-8 rounded-full bg-gradient-to-r from-violet-400 to-sky-400 shadow-[0_0_12px_#8b5cf6]" />}
            <Icon className="h-[1.15rem] w-[1.15rem]" strokeWidth={active ? 2.4 : 1.9} />
            <span className="text-[11px] font-semibold tracking-wide">{label}</span>
          </Link>
        ))}
      </div>
    </nav>
  )
}
