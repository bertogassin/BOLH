'use client'

import { AVAILABLE_LOCALES, LOCALE_OPTIONS, useLocale } from '@/context/LocaleContext'

type Props = {
  locale: string
  setLocale: (code: string) => void
}

export function LanguagePicker({ locale, setLocale }: Props) {
  const { t } = useLocale()

  return (
    <section>
      <h2 className="text-sm font-semibold text-white mb-3">{t('profile_language.title')}</h2>
      <div className="theme-surface rounded-xl border border-violet-400 p-3 space-y-2">
        <div className="flex items-center justify-between text-xs text-white/70">
          <span>
            {t('profile_language.current')}: <span className="text-white font-semibold">{(LOCALE_OPTIONS.find((l) => l.code === locale)?.code || locale).toUpperCase()}</span>
          </span>
          <span>{LOCALE_OPTIONS.length} {t('profile_language.languages_count')}</span>
        </div>
        <div className="max-h-44 overflow-y-auto pr-1">
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {LOCALE_OPTIONS.map((opt) => {
              const isAvailable = AVAILABLE_LOCALES.has(opt.code)
              return (
                <button
                  key={opt.code}
                  type="button"
                  onClick={() => {
                    if (isAvailable) setLocale(opt.code)
                  }}
                  disabled={!isAvailable}
                  className={`rounded-lg px-2.5 py-2 text-xs font-semibold border min-h-[38px] transition ${
                    locale === opt.code
                      ? 'bg-violet-600 border-violet-400 text-white'
                      : isAvailable
                        ? 'theme-surface-soft border-violet-400 text-white theme-hover'
                        : 'theme-surface-soft border-violet-400 text-white/50 cursor-not-allowed opacity-70'
                  }`}
                  aria-pressed={locale === opt.code}
                >
                  {opt.code.toUpperCase()}
                  {!isAvailable && <span className="ml-1 text-[9px]">{t('profile_language.soon')}</span>}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}

