'use client'

import { type ReactNode, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, Settings, Moon, Sun, Globe2, Vibrate, KeyRound, Trash2 } from 'lucide-react'
import { AVAILABLE_LOCALES, LOCALE_OPTIONS, useLocale } from '@/context/LocaleContext'
import { useSound } from '@/context/SoundContext'
import { BOLHNav } from '@/components/BOLHNav'

type AppSettings = {
  vibrationEnabled: boolean
  theme: 'dark' | 'light'
  locale: string
  soundEnabled: boolean
  soundVolume: number
  soundPreset: 'soft' | 'classic' | 'arcade'
}

const DEFAULT_SETTINGS: AppSettings = {
  vibrationEnabled: true,
  theme: 'dark',
  locale: 'en',
  soundEnabled: true,
  soundVolume: 0.55,
  soundPreset: 'classic',
}

function SwitchRow({
  title,
  hint,
  value,
  onChange,
  icon,
}: {
  title: string
  hint?: string
  value: boolean
  onChange: (v: boolean) => void
  icon: ReactNode
}) {
  return (
    <div className="rounded-xl bg-white/10 border border-violet-400 px-4 py-3 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-white flex items-center gap-2">
          {icon}
          {title}
        </p>
        {hint ? <p className="text-xs text-white/60 mt-0.5">{hint}</p> : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={`relative h-7 w-12 rounded-full transition ${
          value ? 'bg-violet-600 border border-violet-400' : 'bg-white/20 border border-violet-400'
        }`}
      >
        <span
          className={`absolute top-0.5 h-5.5 w-5.5 rounded-full bg-white transition ${
            value ? 'left-6' : 'left-0.5'
          }`}
        />
      </button>
    </div>
  )
}

export default function SettingsPage() {
  const { t, locale, setLocale } = useLocale()
  const { soundEnabled, soundVolume, soundPreset, updateSoundSettings, playPreview } = useSound()
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [saved, setSaved] = useState(false)

  const storageKey = 'guardian_app_settings_v1'
  const availableLocaleCodes = useMemo(() => new Set(LOCALE_OPTIONS.map((l) => l.code)), [])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      const parsed = raw ? (JSON.parse(raw) as Partial<AppSettings>) : {}
      const merged: AppSettings = {
        ...DEFAULT_SETTINGS,
        ...parsed,
        locale: locale || parsed.locale || DEFAULT_SETTINGS.locale,
        soundEnabled: typeof parsed.soundEnabled === 'boolean' ? parsed.soundEnabled : soundEnabled,
        soundVolume: typeof parsed.soundVolume === 'number' ? parsed.soundVolume : soundVolume,
        soundPreset:
          parsed.soundPreset === 'soft' || parsed.soundPreset === 'classic' || parsed.soundPreset === 'arcade'
            ? parsed.soundPreset
            : soundPreset,
      }
      setSettings(merged)
      document.documentElement.setAttribute('data-theme', merged.theme)
    } catch {
      setSettings({ ...DEFAULT_SETTINGS, locale, soundEnabled, soundVolume, soundPreset })
    }
  }, [locale, soundEnabled, soundPreset, soundVolume])

  const persist = (next: AppSettings) => {
    setSettings(next)
    localStorage.setItem(storageKey, JSON.stringify(next))
    localStorage.setItem('bolh-theme', next.theme)
    updateSoundSettings({
      soundEnabled: next.soundEnabled,
      soundVolume: next.soundVolume,
      soundPreset: next.soundPreset,
    })
    if (AVAILABLE_LOCALES.has(next.locale)) {
      setLocale(next.locale)
    }
    document.documentElement.setAttribute('data-theme', next.theme)
    setSaved(true)
    setTimeout(() => setSaved(false), 1200)
  }

  const update = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    persist({ ...settings, [key]: value })
  }

  return (
    <div className="min-h-screen bg-[#1a1b26] text-white pb-24">
      <header className="sticky top-0 z-10 border-b border-white/10 bg-[#1a1b26]/95 backdrop-blur">
        <div className="flex items-center gap-2 px-4 py-3">
          <Link href="/profile" className="p-2 rounded-lg hover:bg-white/10">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-lg font-semibold">{t('settings.title')}</h1>
        </div>
      </header>
      <main className="mx-auto max-w-lg px-4 py-6 space-y-4">
        <div className="rounded-2xl bg-white/10 border border-violet-400 p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="inline-flex items-center gap-2">
              <Settings className="h-5 w-5 text-violet-300" />
              <p className="text-white/90 font-medium">{t('settings.intro')}</p>
            </div>
            {saved ? <span className="text-xs text-green-300">Saved</span> : null}
          </div>
          <p className="text-xs text-white/60">
            All settings are saved automatically.
          </p>
        </div>

        <section className="space-y-2">
          <h2 className="text-xs uppercase text-white/60 tracking-wide">Account</h2>
          <Link href="/profile/change-password" className="rounded-xl bg-white/10 border border-violet-400 px-4 py-3 flex items-center justify-between text-white hover:bg-white/15">
            <span className="flex items-center gap-2 text-sm">
              <KeyRound className="h-4 w-4 text-violet-300" />
              Change password
            </span>
            <span className="text-white/40">›</span>
          </Link>
          <Link href="/profile/delete" className="rounded-xl bg-red-500/10 border border-red-400/40 px-4 py-3 flex items-center justify-between text-red-200 hover:bg-red-500/15">
            <span className="flex items-center gap-2 text-sm">
              <Trash2 className="h-4 w-4 text-red-300" />
              Delete account
            </span>
            <span className="text-red-300/70">›</span>
          </Link>
        </section>

        <section className="space-y-2">
          <h2 className="text-xs uppercase text-white/60 tracking-wide">Experience</h2>
          <SwitchRow
            title="Vibration"
            hint="Mobile haptic feedback"
            value={settings.vibrationEnabled}
            onChange={(v) => update('vibrationEnabled', v)}
            icon={<Vibrate className="h-4 w-4 text-violet-300" />}
          />
          <SwitchRow
            title="Action sounds"
            hint="Clicks, submits, and validation feedback"
            value={settings.soundEnabled}
            onChange={(v) => update('soundEnabled', v)}
            icon={<Vibrate className="h-4 w-4 text-violet-300" />}
          />
          <div className="rounded-xl bg-white/10 border border-violet-400 px-4 py-3 space-y-3">
            <p className="text-sm text-white">Sound volume</p>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={Math.round(settings.soundVolume * 100)}
              onChange={(e) => update('soundVolume', Number(e.target.value) / 100)}
              className="w-full"
            />
            <p className="text-xs text-white/60">{Math.round(settings.soundVolume * 100)}%</p>
            <div className="grid grid-cols-3 gap-2">
              {(['soft', 'classic', 'arcade'] as const).map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => update('soundPreset', preset)}
                  className={`rounded-lg border px-3 py-2 text-sm ${
                    settings.soundPreset === preset
                      ? 'bg-violet-600 border-violet-400'
                      : 'bg-white/10 border-violet-400 hover:bg-white/15'
                  }`}
                >
                  {preset[0].toUpperCase() + preset.slice(1)}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={playPreview}
              className="rounded-lg border border-violet-400 px-3 py-2 text-sm bg-white/10 hover:bg-white/15"
            >
              Play preview
            </button>
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="text-xs uppercase text-white/60 tracking-wide">Appearance & Language</h2>
          <div className="rounded-xl bg-white/10 border border-violet-400 px-4 py-3 space-y-2">
            <p className="text-sm text-white inline-flex items-center gap-2">
              {settings.theme === 'dark' ? <Moon className="h-4 w-4 text-violet-300" /> : <Sun className="h-4 w-4 text-violet-300" />}
              Theme
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => update('theme', 'dark')}
                className={`rounded-lg border px-3 py-2 text-sm ${settings.theme === 'dark' ? 'bg-violet-600 border-violet-400' : 'bg-white/10 border-violet-400 hover:bg-white/15'}`}
              >
                Dark
              </button>
              <button
                type="button"
                onClick={() => update('theme', 'light')}
                className={`rounded-lg border px-3 py-2 text-sm ${settings.theme === 'light' ? 'bg-violet-600 border-violet-400' : 'bg-white/10 border-violet-400 hover:bg-white/15'}`}
              >
                Light
              </button>
            </div>
          </div>

          <div className="rounded-xl bg-white/10 border border-violet-400 px-4 py-3 space-y-2">
            <p className="text-sm text-white inline-flex items-center gap-2">
              <Globe2 className="h-4 w-4 text-violet-300" />
              Language
            </p>
            <select
              value={settings.locale}
              onChange={(e) => {
                const next = e.target.value
                if (!availableLocaleCodes.has(next)) return
                if (!AVAILABLE_LOCALES.has(next)) return
                update('locale', next)
              }}
              className="w-full rounded-lg bg-white/10 border border-violet-400 px-3 py-2 text-sm outline-none"
            >
              {LOCALE_OPTIONS.filter((o) => AVAILABLE_LOCALES.has(o.code)).map((opt) => (
                <option key={opt.code} value={opt.code}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </section>

        <div className="rounded-xl bg-white/10 border border-violet-400 p-4 text-sm text-white/80">
          <p>{t('settings.lang_note')}</p>
          <p className="mt-1">
            <Link href="/legal/privacy" className="text-violet-300 hover:underline">
              {t('settings.privacy_link')}
            </Link>
          </p>
        </div>
      </main>
      <BOLHNav current="profile" />
    </div>
  )
}
