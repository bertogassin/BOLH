'use client'

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { User } from '@/lib/api'
import { fetchMe, login as apiLogin, logoutSession, register as apiRegister } from '@/lib/api'

type AuthContextType = {
  user: User | null
  token: string | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (params: { email: string; password: string; first_name: string; last_name: string; user_type?: string }) => Promise<void>
  logout: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)
const TOKEN_KEY = 'guardian_token'
const SESSION_HINT_KEY = 'guardian_session_hint'

function readStoredToken(): string | null {
  if (typeof window === 'undefined') return null
  const persistentToken = window.localStorage.getItem(TOKEN_KEY)
  if (persistentToken) {
    if (persistentToken === 'demo') {
      window.localStorage.removeItem(TOKEN_KEY)
      return null
    }
    return persistentToken
  }
  const sessionToken = window.sessionStorage.getItem(TOKEN_KEY)
  if (sessionToken) {
    if (sessionToken === 'demo') {
      window.sessionStorage.removeItem(TOKEN_KEY)
      return null
    }
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
  if (!value || value === 'demo') {
    clearStoredToken()
    return
  }
  window.localStorage.setItem(TOKEN_KEY, value)
  window.sessionStorage.removeItem(TOKEN_KEY)
}

function clearStoredToken() {
  if (typeof window === 'undefined') return
  window.sessionStorage.removeItem(TOKEN_KEY)
  window.localStorage.removeItem(TOKEN_KEY)
}

function hasSessionHint(): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(SESSION_HINT_KEY) === '1'
}

function setSessionHint(enabled: boolean) {
  if (typeof window === 'undefined') return
  if (enabled) {
    window.localStorage.setItem(SESSION_HINT_KEY, '1')
  } else {
    window.localStorage.removeItem(SESSION_HINT_KEY)
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

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
