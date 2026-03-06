const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'
const ADMIN_TOKEN_KEY = 'guardian_admin_token'

export type User = {
  id: string
  email: string
  phone?: string
  first_name: string
  last_name: string
  user_type: string
  verified: boolean
  created_at?: string
}

function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(ADMIN_TOKEN_KEY)
}

function getTokenFromCookie(): string | null {
  if (typeof document === 'undefined') return null
  const prefix = `${ADMIN_TOKEN_KEY}=`
  const entry = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix))
  if (!entry) return null
  return decodeURIComponent(entry.slice(prefix.length))
}

export function setAdminToken(token: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(ADMIN_TOKEN_KEY, token)
  document.cookie = `${ADMIN_TOKEN_KEY}=${encodeURIComponent(token)}; Path=/; Max-Age=86400; SameSite=Lax`
}

export function clearAdminToken(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(ADMIN_TOKEN_KEY)
  }
  if (typeof document !== 'undefined') {
    document.cookie = `${ADMIN_TOKEN_KEY}=; Path=/; Max-Age=0; SameSite=Lax`
  }
}

export function hasAdminToken(): boolean {
  return !!(getToken() || getTokenFromCookie())
}

export async function login(email: string, password: string): Promise<{ token: string; user: User }> {
  const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || res.statusText || 'Login failed')
  }
  return data as { token: string; user: User }
}

export async function fetchMe(): Promise<User> {
  const token = getToken()
  if (!token) throw new Error('Unauthorized')
  const res = await fetch(`${API_BASE}/api/v1/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error || 'Loading failed')
  return data as User
}
