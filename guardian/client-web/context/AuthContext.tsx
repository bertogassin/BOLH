'use client'

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { User } from '@/lib/api'
import { fetchMe, login as apiLogin, logoutSession, register as apiRegister } from '@/lib/api'

const DEMO_TOKEN = 'demo'
const DEMO_USER: User = {
  id: 'demo',
  email: 'demo@bolh.local',
  first_name: 'Profil',
  last_name: '',
  user_type: 'client',
  verified: false,
}

type AuthContextType = {
  user: User | null
  token: string | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  loginDemo: () => void
  register: (params: { email: string; password: string; first_name: string; last_name: string; user_type?: string }) => Promise<void>
  logout: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)
const TOKEN_KEY = 'guardian_token'

function readStoredToken(): string | null {
  if (typeof window === 'undefined') return null
  const sessionToken = window.sessionStorage.getItem(TOKEN_KEY)
  if (sessionToken) return sessionToken
  const legacyToken = window.localStorage.getItem(TOKEN_KEY)
  if (legacyToken) {
    window.sessionStorage.setItem(TOKEN_KEY, legacyToken)
    window.localStorage.removeItem(TOKEN_KEY)
    return legacyToken
  }
  return null
}

function writeStoredToken(token: string) {
  if (typeof window === 'undefined') return
  window.sessionStorage.setItem(TOKEN_KEY, token)
  window.localStorage.removeItem(TOKEN_KEY)
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
    if (t === DEMO_TOKEN) {
      setToken(t)
      setUser(DEMO_USER)
      setLoading(false)
      return
    }
    try {
      const u = await fetchMe()
      if (t && t !== DEMO_TOKEN) {
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

  const loginDemo = useCallback(() => {
    writeStoredToken(DEMO_TOKEN)
    setToken(DEMO_TOKEN)
    setUser(DEMO_USER)
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
    <AuthContext.Provider value={{ user, token, loading, login, loginDemo, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
