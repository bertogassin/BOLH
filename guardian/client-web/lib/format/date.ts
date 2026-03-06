function toIntlLocale(locale?: string): string {
  if (!locale) return 'fr-FR'
  if (locale === 'fr') return 'fr-FR'
  if (locale === 'en') return 'en-US'
  return locale
}

export function formatDate(
  value: string | number | Date,
  locale?: string,
  options?: Intl.DateTimeFormatOptions
): string {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return 'Unknown'
  return d.toLocaleDateString(toIntlLocale(locale), options)
}

export function formatDateTime(
  value: string | number | Date,
  locale?: string,
  options?: Intl.DateTimeFormatOptions
): string {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return 'Unknown'
  return d.toLocaleString(toIntlLocale(locale), options)
}
