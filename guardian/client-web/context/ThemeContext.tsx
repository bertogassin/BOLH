'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'

export type AppTheme = 'dark' | 'light'
type ThemeValue = { theme: AppTheme; ready: boolean; setTheme: (theme: AppTheme) => void }
const ThemeContext = createContext<ThemeValue | null>(null)

function currentTheme(): AppTheme {
  if (typeof document === 'undefined') return 'dark'
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<AppTheme>('dark')
  const [ready, setReady] = useState(false)
  useEffect(() => { setThemeState(currentTheme()); setReady(true) }, [])
  const setTheme = useCallback((next: AppTheme) => {
    setThemeState(next)
    document.documentElement.dataset.theme = next
    document.documentElement.style.colorScheme = next
    try { localStorage.setItem('bolh-theme', next) } catch {}
  }, [])
  return <ThemeContext.Provider value={{ theme, ready, setTheme }}>{children}</ThemeContext.Provider>
}

export function useAppTheme() {
  const value = useContext(ThemeContext)
  if (!value) throw new Error('useAppTheme must be used within ThemeProvider')
  return value
}
