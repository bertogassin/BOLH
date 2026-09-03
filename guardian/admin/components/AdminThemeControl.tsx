'use client'

import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'

type Theme = 'light' | 'dark'

export function AdminThemeControl() {
  const [theme, setTheme] = useState<Theme>('light')
  useEffect(() => setTheme(document.documentElement.classList.contains('dark') ? 'dark' : 'light'), [])
  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.classList.toggle('dark', next === 'dark')
    document.documentElement.style.colorScheme = next
    try { localStorage.setItem('bolh-admin-theme', next) } catch {}
  }
  return (
    <button type="button" onClick={toggle} aria-label={theme === 'dark' ? 'Use light theme' : 'Use dark theme'} className="fixed right-4 top-[max(1rem,env(safe-area-inset-top))] z-50 grid h-11 w-11 place-items-center rounded-xl border border-gray-200 bg-white/90 text-gray-700 shadow-lg backdrop-blur transition hover:scale-105 dark:border-white/10 dark:bg-gray-900/90 dark:text-gray-100">
      {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  )
}
