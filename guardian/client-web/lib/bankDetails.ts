export type BankDetailsMode = 'rib' | 'iban' | 'generic'

const GENERIC_BANK_DETAILS_LOCALES = new Set([
  'ru',
  'ar',
  'fa',
  'hi',
  'id',
  'zh',
  'ja',
  'ko',
  'ce',
])

export function getBankDetailsMode(locale: string): BankDetailsMode {
  const normalized = String(locale || '').toLowerCase()
  if (normalized.startsWith('fr')) return 'rib'
  if (GENERIC_BANK_DETAILS_LOCALES.has(normalized)) return 'generic'
  return 'iban'
}

