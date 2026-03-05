'use client'

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

export type SoundPreset = 'soft' | 'classic' | 'arcade'

type SoundSettings = {
  soundEnabled: boolean
  soundVolume: number
  soundPreset: SoundPreset
}

type SoundContextType = SoundSettings & {
  updateSoundSettings: (patch: Partial<SoundSettings>) => void
  playPreview: () => void
}

const STORAGE_KEY = 'guardian_app_settings_v1'
const DEFAULT_SETTINGS: SoundSettings = {
  soundEnabled: true,
  soundVolume: 0.55,
  soundPreset: 'classic',
}

const SoundContext = createContext<SoundContextType | null>(null)

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

export function SoundProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<SoundSettings>(DEFAULT_SETTINGS)
  const audioContextRef = useRef<AudioContext | null>(null)

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as Partial<SoundSettings>
      setSettings((prev) => ({
        soundEnabled: typeof parsed.soundEnabled === 'boolean' ? parsed.soundEnabled : prev.soundEnabled,
        soundVolume: typeof parsed.soundVolume === 'number' ? clamp(parsed.soundVolume, 0, 1) : prev.soundVolume,
        soundPreset:
          parsed.soundPreset === 'soft' || parsed.soundPreset === 'classic' || parsed.soundPreset === 'arcade'
            ? parsed.soundPreset
            : prev.soundPreset,
      }))
    } catch {
      // ignore storage errors
    }
  }, [])

  const ensureContext = useCallback(() => {
    if (typeof window === 'undefined') return null
    if (!audioContextRef.current) {
      const Ctx =
        window.AudioContext ||
        (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctx) return null
      audioContextRef.current = new Ctx()
    }
    if (audioContextRef.current.state === 'suspended') {
      void audioContextRef.current.resume()
    }
    return audioContextRef.current
  }, [])

  const playTone = useCallback(
    (frequency: number, ms: number, type: OscillatorType, gain = 1) => {
      if (!settings.soundEnabled) return
      const ctx = ensureContext()
      if (!ctx) return
      const now = ctx.currentTime
      const osc = ctx.createOscillator()
      const amp = ctx.createGain()
      const volume = settings.soundVolume * gain
      osc.type = type
      osc.frequency.setValueAtTime(frequency, now)
      amp.gain.setValueAtTime(0.0001, now)
      amp.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), now + 0.01)
      amp.gain.exponentialRampToValueAtTime(0.0001, now + ms / 1000)
      osc.connect(amp)
      amp.connect(ctx.destination)
      osc.start(now)
      osc.stop(now + ms / 1000 + 0.02)
    },
    [ensureContext, settings.soundEnabled, settings.soundVolume]
  )

  const playClickSound = useCallback(() => {
    switch (settings.soundPreset) {
      case 'soft':
        playTone(540, 55, 'sine', 0.45)
        break
      case 'arcade':
        playTone(760, 60, 'square', 0.8)
        break
      default:
        playTone(620, 60, 'triangle', 0.65)
        break
    }
  }, [playTone, settings.soundPreset])

  const playSubmitSound = useCallback(() => {
    if (settings.soundPreset === 'soft') {
      playTone(450, 60, 'sine', 0.55)
      window.setTimeout(() => playTone(620, 70, 'sine', 0.55), 70)
      return
    }
    if (settings.soundPreset === 'arcade') {
      playTone(670, 60, 'square', 0.8)
      window.setTimeout(() => playTone(840, 80, 'square', 0.8), 70)
      return
    }
    playTone(520, 60, 'triangle', 0.7)
    window.setTimeout(() => playTone(700, 80, 'triangle', 0.7), 70)
  }, [playTone, settings.soundPreset])

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null
      if (!target) return
      const control = target.closest(
        'button, a, [role="button"], input[type="checkbox"], input[type="radio"], select, summary'
      )
      if (control) playClickSound()
    }
    const onSubmit = () => playSubmitSound()
    const onInvalid = () => playTone(220, 120, 'sawtooth', 0.55)

    document.addEventListener('click', onClick, true)
    document.addEventListener('submit', onSubmit, true)
    document.addEventListener('invalid', onInvalid, true)
    return () => {
      document.removeEventListener('click', onClick, true)
      document.removeEventListener('submit', onSubmit, true)
      document.removeEventListener('invalid', onInvalid, true)
    }
  }, [playClickSound, playSubmitSound, playTone])

  const updateSoundSettings = useCallback((patch: Partial<SoundSettings>) => {
    setSettings((prev) => {
      const next: SoundSettings = {
        soundEnabled: typeof patch.soundEnabled === 'boolean' ? patch.soundEnabled : prev.soundEnabled,
        soundVolume: typeof patch.soundVolume === 'number' ? clamp(patch.soundVolume, 0, 1) : prev.soundVolume,
        soundPreset:
          patch.soundPreset === 'soft' || patch.soundPreset === 'classic' || patch.soundPreset === 'arcade'
            ? patch.soundPreset
            : prev.soundPreset,
      }
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY)
        const base = raw ? (JSON.parse(raw) as Record<string, unknown>) : {}
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...base, ...next }))
      } catch {
        // ignore storage errors
      }
      return next
    })
  }, [])

  const playPreview = useCallback(() => {
    playClickSound()
    window.setTimeout(playSubmitSound, 90)
  }, [playClickSound, playSubmitSound])

  return (
    <SoundContext.Provider value={{ ...settings, updateSoundSettings, playPreview }}>
      {children}
    </SoundContext.Provider>
  )
}

export function useSound() {
  const ctx = useContext(SoundContext)
  if (!ctx) throw new Error('useSound must be used within SoundProvider')
  return ctx
}

