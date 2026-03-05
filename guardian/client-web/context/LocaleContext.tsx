'use client'

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'

type Messages = Record<string, unknown>

export const LOCALE_OPTIONS: Array<{ code: string; label: string }> = [
  { code: 'en', label: 'EN - English' },
  { code: 'fr', label: 'FR - Francais' },
  { code: 'ru', label: 'RU - Russkiy' },
  { code: 'de', label: 'DE - Deutsch' },
  { code: 'es', label: 'ES - Espanol' },
  { code: 'it', label: 'IT - Italiano' },
  { code: 'pt', label: 'PT - Portugues' },
  { code: 'nl', label: 'NL - Nederlands' },
  { code: 'pl', label: 'PL - Polski' },
  { code: 'uk', label: 'UK - Ukrayinska' },
  { code: 'be', label: 'BE - Belarusian' },
  { code: 'cs', label: 'CS - Cestina' },
  { code: 'sk', label: 'SK - Slovencina' },
  { code: 'sl', label: 'SL - Slovenscina' },
  { code: 'hr', label: 'HR - Hrvatski' },
  { code: 'sr', label: 'SR - Srpski' },
  { code: 'bs', label: 'BS - Bosanski' },
  { code: 'mk', label: 'MK - Makedonski' },
  { code: 'bg', label: 'BG - Balgarski' },
  { code: 'ro', label: 'RO - Romana' },
  { code: 'hu', label: 'HU - Magyar' },
  { code: 'el', label: 'EL - Ellinika' },
  { code: 'tr', label: 'TR - Turkce' },
  { code: 'sq', label: 'SQ - Shqip' },
  { code: 'ca', label: 'CA - Catala' },
  { code: 'eu', label: 'EU - Euskara' },
  { code: 'gl', label: 'GL - Galego' },
  { code: 'sv', label: 'SV - Svenska' },
  { code: 'no', label: 'NO - Norsk' },
  { code: 'da', label: 'DA - Dansk' },
  { code: 'fi', label: 'FI - Suomi' },
  { code: 'is', label: 'IS - Islenska' },
  { code: 'et', label: 'ET - Eesti' },
  { code: 'lv', label: 'LV - Latviesu' },
  { code: 'lt', label: 'LT - Lietuviu' },
  { code: 'ga', label: 'GA - Gaeilge' },
  { code: 'cy', label: 'CY - Cymraeg' },
  { code: 'mt', label: 'MT - Malti' },
  { code: 'lb', label: 'LB - Letzebuergesch' },
  { code: 'fo', label: 'FO - Foroyskt' },
  { code: 'hy', label: 'HY - Hayeren' },
  { code: 'az', label: 'AZ - Azerbaycanca' },
  { code: 'ka', label: 'KA - Kartuli' },
  { code: 'kk', label: 'KK - Qazaqsha' },
  { code: 'zh', label: 'ZH - Chinese' },
  { code: 'ja', label: 'JA - Japanese' },
  { code: 'ko', label: 'KO - Korean' },
  { code: 'ar', label: 'AR - Arabic' },
  { code: 'fa', label: 'FA - Persian' },
  { code: 'hi', label: 'HI - Hindi' },
  { code: 'id', label: 'ID - Indonesian' },
  { code: 'ce', label: 'CE - Chechen' },
]

const SUPPORTED_LOCALES = new Set(LOCALE_OPTIONS.map((l) => l.code))
export const AVAILABLE_LOCALES = new Set([
  'en',
  'fr',
  'ru',
  'de',
  'es',
  'it',
  'pt',
  'nl',
  'pl',
  'uk',
  'cs',
  'ro',
  'sv',
  'da',
  'fi',
  'no',
  'el',
  'hu',
  'sk',
  'sl',
  'hr',
  'sr',
  'bg',
  'tr',
  'zh',
  'ja',
  'ko',
  'ar',
  'fa',
  'hi',
  'id',
  'ce',
])

const LocaleContext = createContext<{
  locale: string
  setLocale: (l: string) => void
  t: (key: string) => string
  loading: boolean
} | null>(null)

function getByPath(obj: unknown, path: string): string | undefined {
  const parts = path.split('.')
  let cur: unknown = obj
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[p]
  }
  return typeof cur === 'string' ? cur : undefined
}

const DEFAULT_MESSAGES: Messages = {
  brand: 'BOLH',
  security: 'Security',
  back_home: '← Back to home',
  clear_aria: 'Clear',
  navigation: { home: 'Home', orders: 'Orders', profile: 'Profile', settings: 'Settings', map: 'Map', notifications: 'Notifications' },
  actions: { save: 'Save', cancel: 'Cancel' },
  auth: {
    login_title: 'Log in',
    login_subtitle: 'BOLH — security on demand',
    email: 'Email',
    password: 'Password',
    login_btn: 'Log in',
    logging_in: 'Logging in...',
    no_account: 'No account?',
    register_link: 'Sign up',
    remember_me: 'Remember email',
    show_password: 'Show password',
    login_error: 'Login failed',
    invalid_email: 'Enter a valid email',
    password_required: 'Enter password',
    caps_lock_on: 'Caps Lock is on',
    demo_btn: 'Demo (no server)',
    register_title: 'Sign up',
    register_subtitle: 'Create your BOLH account',
    first_name: 'First name',
    last_name: 'Last name',
    password_min: 'Password (min. 6 characters)',
    register_btn: 'Sign up',
    registering: 'Signing up...',
    have_account: 'Already have an account?',
    register_error: 'Registration failed',
    placeholder_email: 'you@example.com',
    placeholder_first: 'John',
    placeholder_last: 'Doe',
    confirm_password: 'Confirm password',
    confirm_password_mismatch: 'Passwords do not match',
    terms_agree: 'By signing up you agree to the',
    password_ok: 'Min 6 characters',
  },
  booking: {
    title: 'Booking',
    address: 'Address',
    place_type: 'Place type',
    your_price: 'Your price',
    per_guard: 'per guard',
    payment: 'Payment',
    payment_one_time: 'New card (this payment only)',
    payment_modal_title: 'Card for this payment only',
    payment_modal_use: 'Use this card',
    payment_modal_last4: 'Last 4 digits',
    payment_modal_brand: 'Brand',
    accept_terms: 'I accept the terms',
    terms_link: 'Terms',
    privacy_link: 'Privacy',
    confirm: 'Confirm booking',
    hire_fast_reliable: 'Hire security quickly and reliably',
    enter_address: 'Enter an address',
    sending: 'Sending...',
    price_positive: 'Enter a valid price',
  },
  profile: { title: 'Profile', settings: 'Settings', delete_account: 'Delete account', edit_title: 'Job search details', edit_short: 'Job search details', edit_profile: 'Job search details', first_name: 'First name', last_name: 'Last name', phone: 'Phone', saved: 'Profile saved.', save_error: 'Save failed', placeholder_phone: '+1 234 567 8900', role_client: 'Client', role_guard: 'Guard', role_agency: 'Agency', completion_label: 'Profile', user: 'User', my_data: 'My data', verification: 'Verification' },
  orders: { my_orders: 'My orders', guest_msg: 'Log in to see orders.', search_placeholder: 'Search', created_banner: 'Order created.', no_orders: 'No orders yet.', create_order: 'Create order' },
  create_order: { login_required: 'Log in to create an order.', new_order: 'New order', title_label: 'Title', create_btn: 'Create order', creating: 'Creating...' },
  settings: { title: 'Settings', intro: 'Notifications, language, privacy.', lang_note: 'Language: English by default.', privacy_link: 'Privacy policy' },
  errors: { load_failed: 'Failed to load.', retry: 'Retry' },
  map: { my_location_aria: 'My location', you_here: 'You are here', guard: 'Guard', order: 'Order', available: 'Available', reserve: 'Reserve', near_you: 'Near you', legend: 'Blue — you · Green — orders · Purple — guards' },
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState('en')
  const [messages, setMessages] = useState<Messages>({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('guardian_locale') : null
    if (stored && AVAILABLE_LOCALES.has(stored)) setLocaleState(stored)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    setLoading(true)
    fetch(`/locales/${locale}.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Not ok'))))
      .catch(() =>
        fetch('/locales/en.json').then((r) => (r.ok ? r.json() : Promise.reject(new Error('No fallback locale'))))
      )
      .then(setMessages)
      .catch(() => setMessages({}))
      .finally(() => setLoading(false))
  }, [locale])

  const setLocale = useCallback((l: string) => {
    if (!SUPPORTED_LOCALES.has(l) || !AVAILABLE_LOCALES.has(l)) return
    setLocaleState(l)
    if (typeof window !== 'undefined') localStorage.setItem('guardian_locale', l)
  }, [])

  const t = useCallback(
    (key: string): string => {
      const fromMessages = getByPath(messages, key)
      if (typeof fromMessages === 'string') return fromMessages
      const fromDefault = getByPath(DEFAULT_MESSAGES, key)
      if (typeof fromDefault === 'string') return fromDefault
      return key
    },
    [messages]
  )

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t, loading }}>
      {children}
    </LocaleContext.Provider>
  )
}

export function useLocale() {
  const ctx = useContext(LocaleContext)
  if (!ctx) throw new Error('useLocale must be used within LocaleProvider')
  return ctx
}
