'use client'

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { apiHealth } from '@/lib/api'

const ApiHealthContext = createContext<{
  apiAvailable: boolean | null
  checkHealth: () => Promise<void>
} | null>(null)

export function ApiHealthProvider({ children }: { children: React.ReactNode }) {
  const [apiAvailable, setApiAvailable] = useState<boolean | null>(null)

  const checkHealth = useCallback(async () => {
    const ok = await apiHealth()
    setApiAvailable(ok)
  }, [])

  useEffect(() => {
    checkHealth()
    const t = setInterval(checkHealth, 30000)
    return () => clearInterval(t)
  }, [checkHealth])

  return (
    <ApiHealthContext.Provider value={{ apiAvailable, checkHealth }}>
      {children}
    </ApiHealthContext.Provider>
  )
}

export function useApiHealth() {
  const ctx = useContext(ApiHealthContext)
  if (!ctx) throw new Error('useApiHealth must be used within ApiHealthProvider')
  return ctx
}
