'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Shield, ListOrdered, User } from 'lucide-react'
import { useLocale } from '@/context/LocaleContext'

const navItems = [
  { href: '/booking', labelKey: 'navigation.home', icon: Shield },
  { href: '/orders', labelKey: 'navigation.orders', icon: ListOrdered },
  { href: '/profile', labelKey: 'navigation.profile', icon: User },
]

export function AppNav() {
  const pathname = usePathname()
  const currentPath = pathname ?? ''
  const { t } = useLocale()

  return (
    <nav className="fixed bottom-0 left-1/2 z-20 w-full max-w-[430px] -translate-x-1/2 border-t theme-header backdrop-blur safe-area-pb">
      <div className="flex justify-around py-3">
        {navItems.map(({ href, labelKey, icon: Icon }) => {
          const isActive = currentPath === href || currentPath.startsWith(`${href}/`)

          return (
            <Link
              key={href}
              href={href}
              className={`group flex flex-col items-center gap-1 min-w-[44px] min-h-[44px] justify-center rounded-xl px-3 py-1.5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 ${
                isActive
                  ? 'text-violet-200 bg-violet-500/25 border border-violet-400/70'
                  : 'text-white/70 hover:text-white theme-hover border border-transparent'
              }`}
            >
              <Icon
                className={`h-5 w-5 ${isActive ? 'text-violet-300' : 'text-white/80 group-hover:text-white'}`}
                strokeWidth={isActive ? 2.4 : 2}
              />
              <span className="text-xs font-medium">{t(labelKey)}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
