'use client'

import { useEffect, useState } from 'react'
import { Shield } from 'lucide-react'

const SPLASH_SESSION_KEY = 'bolh_splash_shown'

interface SplashScreenProps {
  onDone: () => void
}

export function SplashScreen({ onDone }: SplashScreenProps) {
  const [phase, setPhase] = useState<'enter' | 'hold' | 'exit'>('enter')

  useEffect(() => {
    const enterTimer = window.setTimeout(() => setPhase('hold'), 80)
    const holdTimer = window.setTimeout(() => setPhase('exit'), 2400)
    const exitTimer = window.setTimeout(() => onDone(), 3000)
    return () => {
      window.clearTimeout(enterTimer)
      window.clearTimeout(holdTimer)
      window.clearTimeout(exitTimer)
    }
  }, [onDone])

  const isVisible = phase !== 'exit'

  return (
    <div
      role="status"
      aria-label="Loading BOLH"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(ellipse 80% 70% at 50% 40%, #1e0a3c 0%, #0d0d1a 60%, #000000 100%)',
        opacity: isVisible ? 1 : 0,
        transition: phase === 'exit' ? 'opacity 0.6s ease-out' : 'opacity 0.4s ease-in',
        pointerEvents: phase === 'exit' ? 'none' : 'all',
      }}
    >
      {/* Animated glow rings */}
      <div className="splash-rings" aria-hidden="true">
        <span className="splash-ring splash-ring-1" />
        <span className="splash-ring splash-ring-2" />
        <span className="splash-ring splash-ring-3" />
      </div>

      {/* Shield icon */}
      <div className="splash-shield-wrap">
        <Shield className="splash-shield-icon" aria-hidden="true" />
      </div>

      {/* BOLH wordmark */}
      <div className="splash-bolh" aria-hidden="true">
        BOLH
      </div>

      {/* Tagline */}
      <p className="splash-tagline">Security Platform</p>

      {/* Progress bar */}
      <div className="splash-bar-track" aria-hidden="true">
        <span className="splash-bar-fill" />
      </div>
    </div>
  )
}

export function useSplash(): { showSplash: boolean; markSplashDone: () => void } {
  const [showSplash, setShowSplash] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const seen = sessionStorage.getItem(SPLASH_SESSION_KEY)
    if (!seen) {
      setShowSplash(true)
    }
  }, [])

  const markSplashDone = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(SPLASH_SESSION_KEY, '1')
    }
    setShowSplash(false)
  }

  return { showSplash, markSplashDone }
}
