export function normalize(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, '')
}

export function luhnCheck(digits: string): boolean {
  let sum = 0
  let alt = false
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let n = Number(digits[i])
    if (alt) {
      n *= 2
      if (n > 9) n -= 9
    }
    sum += n
    alt = !alt
  }
  return sum % 10 === 0
}

export function includesNameHint(ownerFullName: string, payload: unknown): { match: boolean; evidence?: string } {
  const raw = JSON.stringify(payload || '').toLowerCase()
  const tokens = ownerFullName
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length >= 3)
  const matched = tokens.filter((t) => raw.includes(t))
  if (matched.length >= Math.min(2, tokens.length)) {
    return { match: true, evidence: `Matched tokens: ${matched.join(', ')}` }
  }
  return { match: false }
}
