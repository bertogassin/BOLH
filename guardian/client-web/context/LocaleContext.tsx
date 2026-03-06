'use client'

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'

type Messages = Record<string, unknown>

export const LOCALE_OPTIONS: Array<{ code: string; label: string }> = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
  { code: 'ru', label: 'Русский' },
  { code: 'de', label: 'Deutsch' },
  { code: 'es', label: 'Español' },
  { code: 'it', label: 'Italiano' },
  { code: 'pt', label: 'Português' },
  { code: 'nl', label: 'Nederlands' },
  { code: 'pl', label: 'Polski' },
  { code: 'uk', label: 'Українська' },
  { code: 'be', label: 'Беларуская' },
  { code: 'cs', label: 'Čeština' },
  { code: 'sk', label: 'Slovenčina' },
  { code: 'sl', label: 'Slovenščina' },
  { code: 'hr', label: 'Hrvatski' },
  { code: 'sr', label: 'Српски' },
  { code: 'bs', label: 'Bosanski' },
  { code: 'mk', label: 'Македонски' },
  { code: 'bg', label: 'Български' },
  { code: 'ro', label: 'Română' },
  { code: 'hu', label: 'Magyar' },
  { code: 'el', label: 'Ελληνικά' },
  { code: 'tr', label: 'Türkçe' },
  { code: 'sq', label: 'Shqip' },
  { code: 'ca', label: 'Català' },
  { code: 'eu', label: 'Euskara' },
  { code: 'gl', label: 'Galego' },
  { code: 'sv', label: 'Svenska' },
  { code: 'no', label: 'Norsk' },
  { code: 'da', label: 'Dansk' },
  { code: 'fi', label: 'Suomi' },
  { code: 'is', label: 'Íslenska' },
  { code: 'et', label: 'Eesti' },
  { code: 'lv', label: 'Latviešu' },
  { code: 'lt', label: 'Lietuvių' },
  { code: 'ga', label: 'Gaeilge' },
  { code: 'cy', label: 'Cymraeg' },
  { code: 'mt', label: 'Malti' },
  { code: 'lb', label: 'Lëtzebuergesch' },
  { code: 'fo', label: 'Føroyskt' },
  { code: 'hy', label: 'Հայերեն' },
  { code: 'az', label: 'Azərbaycanca' },
  { code: 'ka', label: 'ქართული' },
  { code: 'kk', label: 'Қазақша' },
  { code: 'zh', label: '中文' },
  { code: 'ja', label: '日本語' },
  { code: 'ko', label: '한국어' },
  { code: 'ar', label: 'العربية' },
  { code: 'fa', label: 'فارسی' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'id', label: 'Bahasa Indonesia' },
  { code: 'ce', label: 'Нохчийн' },
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
    placeholder_first: 'e.g. Alex',
    placeholder_last: 'e.g. Taylor',
    confirm_password: 'Confirm password',
    confirm_password_mismatch: 'Passwords do not match',
    terms_agree: 'By signing up you agree to the',
    password_ok: 'Min 6 characters',
  },
  booking: {
    title: 'Booking',
    login_required: 'Log in to create a security order.',
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
    online: 'Online',
    offline: 'Offline',
    ai_chat_aria: 'BOLH AI chat',
    repeat_last_order: 'Repeat last order',
    active_order: 'Active order',
    details: 'Details',
    chat: 'Chat',
    map: 'Map',
    previous_day: 'Previous day',
    next_day: 'Next day',
    previous_month: 'Previous month',
    next_month: 'Next month',
    detected_object: 'Detected object',
    mission_title: 'Mission',
    collapse: 'Collapse',
    auto: 'Auto',
    restore: 'Restore',
    clear: 'Clear',
    mission_hint: 'You can keep this text or add details. Draft is saved automatically.',
    per_hour: '/ hour',
    payment_card: 'Payment card',
    saved_cards: 'Saved cards',
    no_saved_cards: 'No saved cards',
    cardholder_name: 'Cardholder name',
    use_this_card: 'Use this card',
    service_security: 'Security',
    service_guardian: 'Guardian',
    service_patrol: 'Patrol',
    previous_time: 'Previous time',
    next_time: 'Next time',
    time_placeholder: '00:00',
    close: 'Close',
    expiry_placeholder: 'MM/YY',
    cvc_placeholder: 'CVC',
    error_rib_required: 'Add bank details in Settings before switching to Online mode.',
    error_bank_required_generic: 'Add bank details in Settings before switching to Online mode.',
    error_bank_required_iban: 'Add IBAN in Settings before switching to Online mode.',
    error_bank_required_rib: 'Add RIB in Settings before switching to Online mode.',
    error_address_required: 'Please enter an address.',
    error_terms_required: 'Please accept terms and privacy policy.',
    error_online_required: 'You need to be online to publish an order.',
    error_payment_required: 'Please choose at least one payment method.',
    error_time_range: 'End time must be after start time.',
    error_price_required: 'Price is required.',
    error_price_positive: 'Enter a valid price greater than zero.',
    error_start_future: 'Start time must be in the future.',
    error_generic: 'Error',
  },
  profile: { title: 'Profile', settings: 'Settings', delete_account: 'Delete account', edit_title: 'Job search details', edit_short: 'Job search details', edit_profile: 'Job search details', first_name: 'First name', last_name: 'Last name', phone: 'Phone', saved: 'Profile saved.', save_error: 'Save failed', placeholder_phone: '+1 234 567 8900', role_client: 'Client', role_guard: 'Guard', role_agency: 'Agency', completion_label: 'Profile', user: 'User', my_data: 'My data', verification: 'Verification', online_hint_demo: 'Complete profile details first: name and city.', online_hint_full: 'Complete profile details first: name, city, availability, radius (km), and price.' },
  profile_change_password: {
    title: 'Change password',
    current_password: 'Current password',
    new_password: 'New password',
    confirm_password: 'Confirm password',
    updated: 'Password updated.',
    save: 'Save',
    saving: 'Saving...',
    error_mismatch: 'Passwords do not match.',
    error_min_length: 'Password must contain at least 8 characters.',
    error_generic: 'Error',
  },
  profile_edit: {
    search_instruments: 'Search instruments',
    preferred_service: 'Preferred service',
    preferred_place_type: 'Preferred place type',
    all_services: 'All services',
    all_places: 'All places',
    radius_km: 'Radius (km)',
    preferred_zone: 'Preferred zone',
    min_price: 'Min price',
    max_price: 'Max price',
    base_price: 'Base price',
    rate_per_hour: 'Rate / hour',
    availability: 'Availability',
    placeholder_radius: 'e.g. 25',
    placeholder_zone: 'District / area',
    placeholder_min_price: 'e.g. 50',
    placeholder_max_price: 'e.g. 300',
    placeholder_base_price: 'e.g. 100',
    placeholder_rate: 'e.g. 25',
    placeholder_availability: 'e.g. 09:00-18:00',
    error_price_range: 'Min price cannot be greater than max price.',
    error_price_range_inline: 'Min price should be less than or equal to Max price.',
  },
  profile_add_card: {
    cvc: 'CVC',
    expiry_placeholder: 'MM/YY',
    number_placeholder: '4242 4242 4242 4242',
    holder_name_placeholder: 'NAME SURNAME',
  },
  profile_delete: {
    phrase_placeholder: 'DELETE ACCOUNT',
    password_placeholder: '******',
  },
  profile_about: {
    title: 'About app',
    subtitle: 'Security and guarding application.',
  },
  profile_business: {
    title: 'Business dashboard',
    become_partner: 'Become a partner',
  },
  profile_logout: {
    confirm_title: 'Sign out?',
    sign_out: 'Sign out',
  },
  profile_language: {
    title: 'Languages',
    current: 'Current',
    languages_count: 'languages',
    soon: 'Soon',
  },
  profile_online: {
    title: 'Online profile details',
    required_before_online: 'Required before Online:',
    required_before_online_list: 'Display name, City, Availability, Radius (km), Base price, and Rate per hour.',
    online_active: 'Online active',
    switch_online: 'Switch to online',
    error_required_prefix: 'Fill required fields first',
    field_display_name: 'Display name',
    field_city: 'City',
    field_availability: 'Availability',
    field_radius: 'Radius (km)',
    field_base_price: 'Base price',
    field_rate: 'Rate / hour',
    placeholder_display_name: 'Display name *',
    placeholder_phone: 'Phone',
    placeholder_city: 'City *',
    placeholder_address: 'Address',
    placeholder_languages: 'Languages (ex: FR, EN, RU)',
    placeholder_experience: 'Exp (years)',
    placeholder_radius: 'Radius km *',
    placeholder_base_price: 'Base price *',
    placeholder_rate: 'Rate / hour *',
    placeholder_availability: 'Availability *',
    placeholder_licenses: 'Licenses / certificates',
    placeholder_bio: 'Short bio / details',
    save_details: 'Save details',
    saving: 'Saving...',
    saved: 'Saved',
    saved_hint: 'Details are saved to your account and reused automatically next time.',
  },
  profile_addresses: {
    title: 'Saved addresses',
    manage: 'Manage addresses',
    default: 'Default',
    empty: 'No saved addresses yet.',
  },
  address_autocomplete: {
    saved_recent: 'Saved and recent addresses',
    saved: 'Saved addresses',
    recent: 'Recent history',
    remove: 'Remove',
    remove_from_history: 'Remove from history',
  },
  orders: { my_orders: 'My orders', guest_msg: 'Log in to see orders.', search_placeholder: 'Search', created_banner: 'Order created.', no_orders: 'No orders yet.', create_order: 'Create order' },
  notifications: { title: 'Notifications' },
  create_order: { login_required: 'Log in to create an order.', new_order: 'New order', title_label: 'Title', create_btn: 'Create order', creating: 'Creating...' },
  settings: {
    title: 'Settings',
    intro: 'Notifications, language, privacy.',
    lang_note: 'Language: English by default.',
    privacy_link: 'Privacy policy',
    saved: 'Saved',
    autosave_hint: 'All settings are saved automatically.',
    account: 'Account',
    change_password: 'Change password',
    rib_details: 'Bank account details',
    rib_label: 'Bank account details',
    rib_placeholder: 'Enter bank account details',
    rib_help: '',
    rib_attach: 'Attach document',
    bank_details: 'Bank account details',
    bank_label_generic: 'Bank account details',
    bank_label_iban: 'IBAN',
    bank_label_rib: 'RIB',
    bank_placeholder_generic: 'Enter bank account details',
    bank_placeholder_iban: 'Enter IBAN',
    bank_placeholder_rib: 'Enter RIB',
    bank_attach: 'Attach document',
    remove: 'Remove',
    rib_attached_prefix: 'Attached',
    rib_no_file: 'No file attached yet',
    experience: 'Experience',
    vibration: 'Vibration',
    vibration_hint: 'Mobile haptic feedback',
    action_sounds: 'Action sounds',
    action_sounds_hint: 'Clicks, submits, and validation feedback',
    sound_volume: 'Sound volume',
    sound_preset_soft: 'Soft',
    sound_preset_classic: 'Classic',
    sound_preset_arcade: 'Arcade',
    play_preview: 'Play preview',
    appearance_language: 'Appearance & Language',
    theme: 'Theme',
    theme_dark: 'Dark',
    theme_light: 'Light',
    language: 'Language',
    app_language: 'App language',
  },
  errors: {
    load_failed: 'Failed to load.',
    retry: 'Retry',
    boundary_title: 'Something went wrong',
    boundary_subtitle: 'Page load failed. Try again or return to home.',
  },
  help: {
    title: 'Help & FAQ',
    subtitle: 'Frequently asked questions and support.',
    faq_order: 'How to create an order? - Select date, time, and address on the home screen, then confirm.',
    faq_contact_guard: 'How to contact a guard? - Open chat from the order card after matching.',
    faq_cancel: 'How to cancel an order? - Open order details and tap cancel before shift start.',
    contact: 'For other questions: support@bolh-security.com',
  },
  legal: {
    terms_title: 'Terms and Conditions',
    privacy_title: 'Privacy & Escrow',
    last_updated: 'Last updated: 2026-03-05',
    terms_use_title: 'Use of Service',
    terms_use_text: 'By using BOLH Security, you agree to use the app lawfully and provide accurate account information.',
    terms_orders_title: 'Orders and Payments',
    terms_orders_text: 'Service requests are subject to provider availability. Pricing and payment terms are shown during booking.',
    terms_responsibility_title: 'User Responsibilities',
    terms_responsibility_text: 'You are responsible for account security and activities under your account credentials.',
    privacy_collect_title: 'Data We Collect',
    privacy_collect_text: 'We collect account data required to provide the service, such as name, email, and order details.',
    privacy_use_title: 'How We Use Data',
    privacy_use_text: 'Data is used for account access, service fulfillment, fraud prevention, and support.',
    privacy_security_title: 'Security and Retention',
    privacy_security_text: 'Data is transmitted over secure channels. We retain data only as needed for legal and operational purposes.',
    privacy_delete_title: 'Data Deletion Requests',
    privacy_delete_text: 'To request account or data deletion, contact support@bolh-security.com from your account email.',
    contact: 'Contact: support@bolh-security.com',
  },
  company_register: {
    pending: 'pending',
  },
  ai_chat: {
    title: 'BOLH AI',
  },
  plugin_detail: {
    role_viewer: 'viewer',
    role_editor: 'editor',
    role_admin: 'admin',
  },
  documents_detail: {
    id: 'ID',
    mime: 'MIME',
    unknown: 'unknown',
  },
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
