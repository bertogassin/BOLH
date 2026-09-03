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

export async function login(email: string, password: string): Promise<{ user: User }> {
  const res = await fetch('/api/session/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || res.statusText || 'Login failed')
  }
  return data as { user: User }
}

export async function clearAdminToken(): Promise<void> {
  await fetch('/api/session/logout', { method: 'POST' }).catch(() => undefined)
}
