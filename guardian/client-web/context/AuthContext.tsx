'use client'

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { User } from '@/lib/api'
import { betaLogin as apiBetaLogin, fetchMe, login as apiLogin, logoutSession, register as apiRegister } from '@/lib/api'

type AuthContextType = {
  user: User | null
  token: string | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  betaLogin: (userType?: 'client' | 'guard') => Promise<void>
  register: (params: { email: string; password: string; first_name: string; last_name: string; user_type?: string }) => Promise<void>
  logout: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)
const TOKEN_KEY = 'guardian_token'

function readStoredToken(): string | null {
  if (typeof window === 'undefined') return null
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

function clearStoredToken() {
  if (typeof window === 'undefined') return
  window.sessionStorage.removeItem(TOKEN_KEY)
  window.localStorage.removeItem(TOKEN_KEY)
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshUser = useCallback(async () => {
    const t = readStoredToken()
    try {
      const u = await fetchMe()
      if (t) {
        clearStoredToken()
        setToken(null)
      } else {
        setToken(t)
      }
      setUser(u)
    } catch {
      clearStoredToken()
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
    const { user: u } = await apiLogin(email, password)
    clearStoredToken()
    setToken(null)
    setUser(u)
  }, [])

  const betaLogin = useCallback(async (userType: 'client' | 'guard' = 'client') => {
    const { user: u } = await apiBetaLogin(userType)
    clearStoredToken()
    setToken(null)
    setUser(u)
  }, [])

  const register = useCallback(
    async (params: { email: string; password: string; first_name: string; last_name: string; user_type?: string }) => {
      const { user: u } = await apiRegister(params)
      clearStoredToken()
      setToken(null)
      setUser(u)
    },
    []
  )

  const logout = useCallback(() => {
    clearStoredToken()
    logoutSession().catch(() => {
      // Ignore API logout errors on client-side logout.
    })
    setToken(null)
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, token, loading, login, betaLogin, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
