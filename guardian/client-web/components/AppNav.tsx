'use client'

import { usePathname } from 'next/navigation'
import { Shield, ListOrdered, User } from 'lucide-react'
import { useLocale } from '@/context/LocaleContext'
import { MobileNav } from '@/components/MobileNav'

const navItems = [
  { href: '/booking', labelKey: 'navigation.home', icon: Shield },
  { href: '/orders', labelKey: 'navigation.orders', icon: ListOrdered },
  { href: '/profile', labelKey: 'navigation.profile', icon: User },
]

export function AppNav() {
  const pathname = usePathname()
  const currentPath = pathname ?? ''
  const { t } = useLocale()

  return <MobileNav items={navItems.map(({ href, labelKey, icon }) => ({
    href,
    label: t(labelKey),
    icon,
    active: currentPath === href || currentPath.startsWith(`${href}/`),
  }))} />
}
