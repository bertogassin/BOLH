'use client'

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { User } from '@/lib/api'
import { fetchMe, login as apiLogin, logoutSession, register as apiRegister } from '@/lib/api'
import { demoModeEnabled, demoUser } from '@/lib/demo_api'

type AuthContextType = {
  user: User | null
  token: string | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  enterDemo: () => void
  register: (params: { email: string; password: string; first_name: string; last_name: string; user_type?: string }) => Promise<void>
  logout: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)
const TOKEN_KEY = 'guardian_token'
const SESSION_HINT_KEY = 'guardian_session_hint'

function readStoredToken(): string | null {
  if (typeof window === 'undefined') return null
  let persistentToken: string | null = null
  let sessionToken: string | null = null
  try {
    persistentToken = window.localStorage.getItem(TOKEN_KEY)
    sessionToken = window.sessionStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
  if (persistentToken) {
    if (persistentToken === 'demo') return demoModeEnabled ? persistentToken : null
    return persistentToken
  }
  if (sessionToken) {
    if (sessionToken === 'demo') return demoModeEnabled ? sessionToken : null
    return sessionToken
  }
  const legacyToken = window.localStorage.getItem(TOKEN_KEY)
  if (legacyToken) {
    if (legacyToken === 'demo') {
      window.localStorage.removeItem(TOKEN_KEY)
      return null
    }
    window.sessionStorage.setItem(TOKEN_KEY, legacyToken)
    window.localStorage.removeItem(TOKEN_KEY)
    return legacyToken
  }
  return null
}

function writeStoredToken(token: string) {
  if (typeof window === 'undefined') return
  const value = token.trim()
  if (!value || (value === 'demo' && !demoModeEnabled)) {
    clearStoredToken()
    return
  }
  try {
    window.localStorage.setItem(TOKEN_KEY, value)
    window.sessionStorage.removeItem(TOKEN_KEY)
  } catch {
    window.sessionStorage.setItem(TOKEN_KEY, value)
  }
}

function clearStoredToken() {
  if (typeof window === 'undefined') return
  try { window.sessionStorage.removeItem(TOKEN_KEY) } catch {}
  try { window.localStorage.removeItem(TOKEN_KEY) } catch {}
}

function hasSessionHint(): boolean {
  if (typeof window === 'undefined') return false
  try { return window.localStorage.getItem(SESSION_HINT_KEY) === '1' } catch { return false }
}

function setSessionHint(enabled: boolean) {
  if (typeof window === 'undefined') return
  if (enabled) {
    try { window.localStorage.setItem(SESSION_HINT_KEY, '1') } catch {}
  } else {
    try { window.localStorage.removeItem(SESSION_HINT_KEY) } catch {}
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshUser = useCallback(async () => {
    const t = readStoredToken()
    // Avoid noisy 401 calls for unauthenticated visitors.
    if (!t && !hasSessionHint()) {
      setToken(null)
      setUser(null)
      setLoading(false)
      return
    }
    try {
      const u = await fetchMe()
      setToken(t)
      setUser(u)
    } catch {
      clearStoredToken()
      setSessionHint(false)
      setToken(null)
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshUser()
  }, [refreshUser])

  const login = useCallback(async (email: string, password: string) => {
    const { token: accessToken, user: u } = await apiLogin(email, password)
    if (accessToken) {
      writeStoredToken(accessToken)
      setToken(accessToken)
    } else {
      clearStoredToken()
      setToken(null)
    }
    setSessionHint(true)
    setUser(u)
  }, [])

  const register = useCallback(
    async (params: { email: string; password: string; first_name: string; last_name: string; user_type?: string }) => {
      const { token: accessToken, user: u } = await apiRegister(params)
      if (accessToken) {
        writeStoredToken(accessToken)
        setToken(accessToken)
      } else {
        clearStoredToken()
        setToken(null)
      }
      setSessionHint(true)
      setUser(u)
    },
    []
  )

  const logout = useCallback(() => {
    clearStoredToken()
    setSessionHint(false)
    logoutSession().catch(() => {
      // Ignore API logout errors on client-side logout.
    })
    setToken(null)
    setUser(null)
  }, [])

  const enterDemo = useCallback(() => {
    if (!demoModeEnabled) return
    writeStoredToken('demo')
    setSessionHint(true)
    setToken('demo')
    setUser(demoUser())
  }, [])

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, refreshUser, enterDemo }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
