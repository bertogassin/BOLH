'use client'

import { useLocale } from '@/context/LocaleContext'

export function LocaleSwitcher() {
  const { locale, setLocale } = useLocale()
  return (
    <select
      value={locale}
      onChange={(e) => setLocale(e.target.value)}
      className="rounded border border-gray-300 bg-white px-2 py-1 text-sm"
    >
      <option value="en">EN</option>
      <option value="ru">RU</option>
      <option value="fr">FR</option>
    </select>
  )
}
