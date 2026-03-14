export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '')
}

export function formatCardNumber(value: string): string {
  const d = digitsOnly(value).slice(0, 19)
  return d.replace(/(.{4})/g, '$1 ').trim()
}

export function formatExpiry(value: string): string {
  const d = digitsOnly(value).slice(0, 4)
  if (d.length <= 2) return d
  return `${d.slice(0, 2)}/${d.slice(2)}`
}

export function detectCardBrand(cardNumber: string): string {
  const d = digitsOnly(cardNumber)
  if (/^4/.test(d)) return 'Visa'
  if (/^(5[1-5]|2[2-7])/.test(d)) return 'Mastercard'
  if (/^3[47]/.test(d)) return 'Amex'
  if (/^6(?:011|5)/.test(d)) return 'Discover'
  if (/^35/.test(d)) return 'JCB'
  return 'card'
}

function isAllSameDigits(digits: string): boolean {
  return /^(\d)\1+$/.test(digits)
}

function hasValidLengthForBrand(digits: string, brand: string): boolean {
  if (brand === 'Amex') return digits.length === 15
  if (brand === 'Visa') return digits.length === 13 || digits.length === 16 || digits.length === 19
  if (brand === 'Mastercard') return digits.length === 16
  if (brand === 'Discover') return digits.length === 16 || digits.length === 19
  if (brand === 'JCB') return digits.length === 16 || digits.length === 19
  return digits.length >= 13 && digits.length <= 19
}

const KNOWN_TEST_CARDS = new Set([
  '4242424242424242',
  '4000056655665556',
  '5555555555554444',
  '378282246310005',
  '6011111111111117',
  '3566002020360505',
  '4111111111111111',
])

export function isValidLuhn(cardNumber: string): boolean {
  const digits = digitsOnly(cardNumber)
  if (digits.length < 13 || digits.length > 19) return false
  let sum = 0
  let shouldDouble = false
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let n = Number(digits[i])
    if (Number.isNaN(n)) return false
    if (shouldDouble) {
      n *= 2
      if (n > 9) n -= 9
    }
    sum += n
    shouldDouble = !shouldDouble
  }
  return sum % 10 === 0
}

export function isLikelyRealCardNumber(cardNumber: string): boolean {
  const digits = digitsOnly(cardNumber)
  if (!digits) return false
  if (!isValidLuhn(digits)) return false
  if (isAllSameDigits(digits)) return false
  if (KNOWN_TEST_CARDS.has(digits)) return false
  const brand = detectCardBrand(digits)
  if (!hasValidLengthForBrand(digits, brand)) return false
  return true
}

export function isExpiryValid(expiry: string): boolean {
  const match = expiry.match(/^(\d{2})\/(\d{2})$/)
  if (!match) return false
  const month = parseInt(match[1], 10)
  const year2 = parseInt(match[2], 10)
  if (Number.isNaN(month) || Number.isNaN(year2) || month < 1 || month > 12) return false
  const now = new Date()
  const fullYear = 2000 + year2
  const expiryEnd = new Date(fullYear, month, 0, 23, 59, 59, 999)
  return expiryEnd.getTime() >= now.getTime()
}
