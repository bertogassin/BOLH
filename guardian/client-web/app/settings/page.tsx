'use client'

import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, Settings, Moon, Sun, Globe2, Vibrate, KeyRound, Paperclip } from 'lucide-react'
import { AVAILABLE_LOCALES, LOCALE_OPTIONS, useLocale } from '@/context/LocaleContext'
import { useSound } from '@/context/SoundContext'
import { useAuth } from '@/context/AuthContext'
import { BOLHNav } from '@/components/BOLHNav'
import { FormField } from '@/components/FormField'
import { DARK_FIELD_LABEL_CLASS } from '@/components/formStyles'
import { getBankDetailsMode } from '@/lib/bankDetails'

type AppSettings = {
  vibrationEnabled: boolean
  theme: 'dark' | 'light'
  locale: string
  soundEnabled: boolean
  soundVolume: number
  soundPreset: 'soft' | 'classic' | 'arcade'
  rib: string
  ribAttachmentName: string
}

const DEFAULT_SETTINGS: AppSettings = {
  vibrationEnabled: true,
  theme: 'dark',
  locale: 'en',
  soundEnabled: true,
  soundVolume: 0.55,
  soundPreset: 'classic',
  rib: '',
  ribAttachmentName: '',
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
        {hint ? <p className="text-xs text-white/75 mt-0.5">{hint}</p> : null}
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
  const { user } = useAuth()
  const { t, locale, setLocale } = useLocale()
  const { soundEnabled, soundVolume, soundPreset, updateSoundSettings, playPreview } = useSound()
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [saved, setSaved] = useState(false)
  const ribFileInputRef = useRef<HTMLInputElement>(null)

  const storageKey = 'guardian_app_settings_v1'
  const detailsStorageKey = `guardian_profile_details_${user?.id || 'guest'}`
  const availableLocaleCodes = useMemo(() => new Set(LOCALE_OPTIONS.map((l) => l.code)), [])
  const bankDetailsMode = useMemo(() => getBankDetailsMode(locale), [locale])
  const bankLabel =
    bankDetailsMode === 'rib'
      ? t('settings.bank_label_rib')
      : bankDetailsMode === 'iban'
      ? t('settings.bank_label_iban')
      : t('settings.bank_label_generic')
  const bankPlaceholder =
    bankDetailsMode === 'rib'
      ? t('settings.bank_placeholder_rib')
      : bankDetailsMode === 'iban'
      ? t('settings.bank_placeholder_iban')
      : t('settings.bank_placeholder_generic')

  useEffect(() => {
    try {
      const settingsRaw = localStorage.getItem(storageKey)
      const parsedSettings = settingsRaw ? (JSON.parse(settingsRaw) as Partial<AppSettings>) : {}
      const detailsRaw = localStorage.getItem(detailsStorageKey)
      const parsedDetails = detailsRaw ? (JSON.parse(detailsRaw) as { rib?: string; ribAttachmentName?: string }) : {}
      const merged: AppSettings = {
        ...DEFAULT_SETTINGS,
        ...parsedSettings,
        locale: locale || parsedSettings.locale || DEFAULT_SETTINGS.locale,
        soundEnabled: typeof parsedSettings.soundEnabled === 'boolean' ? parsedSettings.soundEnabled : soundEnabled,
        soundVolume: typeof parsedSettings.soundVolume === 'number' ? parsedSettings.soundVolume : soundVolume,
        soundPreset:
          parsedSettings.soundPreset === 'soft' || parsedSettings.soundPreset === 'classic' || parsedSettings.soundPreset === 'arcade'
            ? parsedSettings.soundPreset
            : soundPreset,
        rib:
          String(parsedDetails.rib || '').trim() ||
          String(parsedSettings.rib || '').trim() ||
          DEFAULT_SETTINGS.rib,
        ribAttachmentName:
          String(parsedDetails.ribAttachmentName || '').trim() ||
          String(parsedSettings.ribAttachmentName || '').trim() ||
          DEFAULT_SETTINGS.ribAttachmentName,
      }
      setSettings(merged)
      document.documentElement.setAttribute('data-theme', merged.theme)
    } catch {
      setSettings({ ...DEFAULT_SETTINGS, locale, soundEnabled, soundVolume, soundPreset })
    }
  }, [detailsStorageKey, locale, soundEnabled, soundPreset, soundVolume])

  const persist = (next: AppSettings) => {
    setSettings(next)
    localStorage.setItem(storageKey, JSON.stringify(next))
    localStorage.setItem('bolh-theme', next.theme)
    try {
      const raw = localStorage.getItem(detailsStorageKey)
      const base = raw ? (JSON.parse(raw) as Record<string, unknown>) : {}
      localStorage.setItem(
        detailsStorageKey,
        JSON.stringify({
          ...base,
          rib: next.rib.trim(),
          ribAttachmentName: next.ribAttachmentName.trim(),
        })
      )
    } catch {
      // Ignore local storage write errors in UI.
    }
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
            {saved ? <span className="text-xs text-green-300">{t('settings.saved')}</span> : null}
          </div>
          <p className="text-xs text-white/75">
            {t('settings.autosave_hint')}
          </p>
        </div>

        <section className="space-y-2">
          <h2 className="text-xs uppercase text-white/75 tracking-wide">{t('settings.account')}</h2>
          <Link href="/profile/change-password" className="rounded-xl bg-white/10 border border-violet-400 px-4 py-3 flex items-center justify-between text-white hover:bg-white/15">
            <span className="flex items-center gap-2 text-sm">
              <KeyRound className="h-4 w-4 text-violet-300" />
              {t('settings.change_password')}
            </span>
            <span className="text-white/40">›</span>
          </Link>
          <div className="rounded-xl bg-white/10 border border-violet-400 px-4 py-3 space-y-3">
            <p className="text-sm text-white inline-flex items-center gap-2">
              <Paperclip className="h-4 w-4 text-violet-300" />
              {t('settings.bank_details')}
            </p>
            <FormField
              label={bankLabel}
              labelClassName={DARK_FIELD_LABEL_CLASS}
            >
              <input
                type="text"
                value={settings.rib}
                onChange={(e) => update('rib', e.target.value.replace(/\s+/g, '').toUpperCase())}
                placeholder={bankPlaceholder}
                className="w-full rounded-lg bg-white/10 border border-violet-400 px-3 py-2 text-sm text-white placeholder:text-white/50 outline-none focus-visible:ring-2 focus-visible:ring-violet-400/80"
              />
            </FormField>
            <input
              ref={ribFileInputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={(e) => {
                const nextFile = e.target.files?.[0]
                if (!nextFile) return
                update('ribAttachmentName', nextFile.name)
              }}
              className="hidden"
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => ribFileInputRef.current?.click()}
                className="rounded-lg border border-violet-400 px-3 py-2 text-sm bg-white/10 hover:bg-white/15"
              >
                {t('settings.bank_attach')}
              </button>
              {settings.ribAttachmentName ? (
                <button
                  type="button"
                  onClick={() => update('ribAttachmentName', '')}
                  className="rounded-lg border border-violet-400 px-3 py-2 text-sm bg-white/10 hover:bg-white/15"
                >
                  {t('settings.remove')}
                </button>
              ) : null}
            </div>
            <p className="text-xs text-white/75">
              {settings.ribAttachmentName
                ? `${t('settings.rib_attached_prefix')}: ${settings.ribAttachmentName}`
                : t('settings.rib_no_file')}
            </p>
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="text-xs uppercase text-white/75 tracking-wide">{t('settings.experience')}</h2>
          <SwitchRow
            title={t('settings.vibration')}
            hint={t('settings.vibration_hint')}
            value={settings.vibrationEnabled}
            onChange={(v) => update('vibrationEnabled', v)}
            icon={<Vibrate className="h-4 w-4 text-violet-300" />}
          />
          <SwitchRow
            title={t('settings.action_sounds')}
            hint={t('settings.action_sounds_hint')}
            value={settings.soundEnabled}
            onChange={(v) => update('soundEnabled', v)}
            icon={<Vibrate className="h-4 w-4 text-violet-300" />}
          />
          <div className="rounded-xl bg-white/10 border border-violet-400 px-4 py-3 space-y-3">
            <p className="text-sm text-white">{t('settings.sound_volume')}</p>
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
                  {t(`settings.sound_preset_${preset}`)}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={playPreview}
              className="rounded-lg border border-violet-400 px-3 py-2 text-sm bg-white/10 hover:bg-white/15"
            >
              {t('settings.play_preview')}
            </button>
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="text-xs uppercase text-white/75 tracking-wide">{t('settings.appearance_language')}</h2>
          <div className="rounded-xl bg-white/10 border border-violet-400 px-4 py-3 space-y-2">
            <p className="text-sm text-white inline-flex items-center gap-2">
              {settings.theme === 'dark' ? <Moon className="h-4 w-4 text-violet-300" /> : <Sun className="h-4 w-4 text-violet-300" />}
              {t('settings.theme')}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => update('theme', 'dark')}
                className={`rounded-lg border px-3 py-2 text-sm ${settings.theme === 'dark' ? 'bg-violet-600 border-violet-400' : 'bg-white/10 border-violet-400 hover:bg-white/15'}`}
              >
                {t('settings.theme_dark')}
              </button>
              <button
                type="button"
                onClick={() => update('theme', 'light')}
                className={`rounded-lg border px-3 py-2 text-sm ${settings.theme === 'light' ? 'bg-violet-600 border-violet-400' : 'bg-white/10 border-violet-400 hover:bg-white/15'}`}
              >
                {t('settings.theme_light')}
              </button>
            </div>
          </div>

          <div className="rounded-xl bg-white/10 border border-violet-400 px-4 py-3 space-y-2">
            <p className="text-sm text-white inline-flex items-center gap-2">
              <Globe2 className="h-4 w-4 text-violet-300" />
              {t('settings.language')}
            </p>
            <FormField
              label={t('settings.app_language')}
              labelClassName={DARK_FIELD_LABEL_CLASS}
            >
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
            </FormField>
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
