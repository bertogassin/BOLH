export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'
const BUILD_INTEGRITY_SEED = process.env.NEXT_PUBLIC_APP_BUILD_ID || 'dev-build'
const SIGNED_MODE = (process.env.NEXT_PUBLIC_SIGNED_REQUEST_MODE || 'partial').toLowerCase()
const SIGNED_ENABLED = (process.env.NEXT_PUBLIC_SIGNED_REQUESTS_ENABLED || '1').toLowerCase() !== '0'
const SIGNED_PARTIAL_PATHS = (
  process.env.NEXT_PUBLIC_SIGNED_REQUEST_PARTIAL_PATHS ||
  '/api/v1/auth/me/password,/api/v1/orders,/api/v1/bids,/api/v1/documents/upload'
)
  .split(',')
  .map((v) => v.trim())
  .filter(Boolean)

type BehaviorSignals = {
  score: number
  autofill: boolean
  fastSubmit: boolean
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  const sessionToken = sessionStorage.getItem('guardian_token')
  if (sessionToken) {
    if (sessionToken === 'demo') return sessionToken
    sessionStorage.removeItem('guardian_token')
    return null
  }
  const legacyToken = localStorage.getItem('guardian_token')
  if (legacyToken) {
    localStorage.removeItem('guardian_token')
    if (legacyToken === 'demo') {
      sessionStorage.setItem('guardian_token', legacyToken)
      return legacyToken
    }
  }
  return null
}

function isNetworkError(e: unknown): boolean {
  if (e instanceof TypeError && e.message === 'Failed to fetch') return true
  if (e instanceof Error && /network|connection|refused|fetch/i.test(e.message)) return true
  return false
}

function isSensitivePath(path: string): boolean {
  const fullSet = new Set(['/api/v1/auth/me/password', '/api/v1/orders', '/api/v1/bids', '/api/v1/documents/upload'])
  if (SIGNED_MODE === 'full') return fullSet.has(path)
  if (SIGNED_MODE === 'partial') return SIGNED_PARTIAL_PATHS.includes(path)
  return fullSet.has(path)
}

function randomNonce(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function hasWebCrypto(): boolean {
  return typeof crypto !== 'undefined' && !!crypto.subtle
}

async function sha256Hex(value: string): Promise<string | null> {
  if (hasWebCrypto()) {
    const enc = new TextEncoder()
    const digest = await crypto.subtle.digest('SHA-256', enc.encode(value))
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  }
  return null
}

function readBehaviorSignals(path: string): BehaviorSignals | null {
  if (typeof window === 'undefined') return null
  const key = path.includes('/auth/register') ? 'guardian_behavior_register' : path.includes('/auth/login') ? 'guardian_behavior_login' : ''
  if (!key) return null
  const raw = sessionStorage.getItem(key)
  if (!raw) return null
  sessionStorage.removeItem(key)
  try {
    const parsed = JSON.parse(raw) as BehaviorSignals
    return parsed
  } catch {
    return null
  }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }
  const behavior = readBehaviorSignals(path)
  if (behavior) {
    headers['X-Behavior-Score'] = String(behavior.score)
    headers['X-Behavior-Autofill'] = behavior.autofill ? '1' : '0'
    headers['X-Behavior-FastSubmit'] = behavior.fastSubmit ? '1' : '0'
  }

  const integrity = await sha256Hex(`${BUILD_INTEGRITY_SEED}|${typeof navigator !== 'undefined' ? navigator.userAgent : 'server'}`)
  headers['X-Client-Integrity'] = integrity || 'unavailable'

  if (token) headers['Authorization'] = `Bearer ${token}`
  if (SIGNED_ENABLED && token && isSensitivePath(path) && integrity && hasWebCrypto()) {
    const ts = String(Math.floor(Date.now() / 1000))
    const nonce = randomNonce()
    const signature = await sha256Hex(`${(options.method || 'GET').toUpperCase()}|${path}|${ts}|${nonce}|${token}|${integrity}`)
    if (signature) {
      headers['X-Request-Timestamp'] = ts
      headers['X-Request-Nonce'] = nonce
      headers['X-Request-Signature'] = signature
    }
  }

  let res: Response
  try {
    res = await fetch(`${API_BASE}${path}`, { ...options, headers, credentials: 'include' })
  } catch (e) {
    if (isNetworkError(e)) {
      throw new Error('Server unavailable. Start API Gateway on port 8080.')
    }
    throw e
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error || res.statusText || 'Request failed')
  return data as T
}

export async function apiHealth(): Promise<boolean> {
  const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'
  try {
    const res = await fetch(`${base}/health`, { method: 'GET' })
    return res.ok
  } catch {
    return false
  }
}

