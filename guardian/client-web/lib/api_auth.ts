import { api } from './api_client'

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

const ME_CACHE_TTL_MS = 15000

type MeCacheEntry = {
  at: number
  data: User
}

let meCache: MeCacheEntry | null = null

function readMeCache(): User | null {
  if (typeof window === 'undefined' || !meCache) return null
  if (Date.now() - meCache.at > ME_CACHE_TTL_MS) {
    meCache = null
    return null
  }
  return meCache.data
}

function writeMeCache(data: User): void {
  if (typeof window === 'undefined') return
  meCache = { at: Date.now(), data }
}

function clearMeCache(): void {
  meCache = null
}

export async function login(email: string, password: string): Promise<{ user: User }> {
  return api('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
}

export async function register(params: {
  email: string
  password: string
  first_name: string
  last_name: string
  user_type?: string
}): Promise<{ user: User }> {
  return api('/api/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

export async function fetchMe(): Promise<User> {
  const cached = readMeCache()
  if (cached) return cached
  const data = await api<User>('/api/v1/auth/me')
  writeMeCache(data)
  return data
}

export async function updateProfile(params: {
  first_name?: string
  last_name?: string
  phone?: string
}): Promise<User> {
  const data = await api<User>('/api/v1/auth/me', {
    method: 'PATCH',
    body: JSON.stringify(params),
  })
  clearMeCache()
  return data
}

export async function changePassword(current_password: string, new_password: string): Promise<void> {
  await api('/api/v1/auth/me/password', {
    method: 'POST',
    body: JSON.stringify({ current_password, new_password }),
  })
}

export async function logoutSession(): Promise<void> {
  await api('/api/v1/auth/logout', {
    method: 'POST',
  })
  clearMeCache()
}

export async function deleteMyAccount(params?: { password?: string; confirmation?: string }): Promise<void> {
  await api('/api/v1/auth/me', {
    method: 'DELETE',
    body: JSON.stringify({
      password: params?.password || '',
      confirmation: params?.confirmation || '',
    }),
  })
  clearMeCache()
}

