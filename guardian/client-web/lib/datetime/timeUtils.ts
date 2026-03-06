export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

export function timeToMinutes(value: string): number {
  const [h, m] = value.split(':').map((v) => parseInt(v, 10))
  if (Number.isNaN(h) || Number.isNaN(m)) return 0
  return h * 60 + m
}

export function minutesToTime(totalMinutes: number): string {
  const safe = Math.max(0, Math.min(23 * 60 + 59, totalMinutes))
  const h = Math.floor(safe / 60)
  const m = safe % 60
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
}

export function sanitizeTimeDraft(raw: string): string {
  const cleaned = raw.replace(/[^\d:]/g, '')
  if (cleaned.includes(':')) {
    const [h = '', m = ''] = cleaned.split(':')
    return `${h.slice(0, 2)}:${m.slice(0, 2)}`
  }
  const digits = cleaned.replace(/\D/g, '').slice(0, 4)
  if (digits.length <= 2) return digits
  return `${digits.slice(0, 2)}:${digits.slice(2)}`
}

export function normalizeTime(raw: string): string | null {
  const match = raw.match(/^(\d{1,2}):(\d{1,2})$/)
  if (!match) return null
  const hh = parseInt(match[1], 10)
  const mm = parseInt(match[2], 10)
  if (Number.isNaN(hh) || Number.isNaN(mm)) return null
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null
  return `${hh.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}`
}
