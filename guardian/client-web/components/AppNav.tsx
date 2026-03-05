'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, ListOrdered, User } from 'lucide-react'
import { useLocale } from '@/context/LocaleContext'

const navItems = [
  { href: '/', labelKey: 'navigation.home', icon: Home },
  { href: '/orders', labelKey: 'navigation.orders', icon: ListOrdered },
  { href: '/profile', labelKey: 'navigation.profile', icon: User },
]

export function AppNav() {
  const pathname = usePathname()
  const { t } = useLocale()
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-20 border-t border-gray-200/80 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="flex justify-around py-2 safe-area-pb">
        {navItems.map(({ href, labelKey, icon: Icon }) => {
          const isActive = pathname === href || (href !== '/' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors ${
                isActive ? 'text-guardian-blue' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <Icon className="h-6 w-6" strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-xs font-medium">{t(labelKey)}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
