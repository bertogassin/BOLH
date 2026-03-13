import { api, newIdempotencyKey } from './api_client'
import type { Match } from './api_orders'

export type Bid = {
  id: string
  guard_id: string
  title: string
  licenses: string[]
  price_per_hour: number
  latitude: number
  longitude: number
  radius_km: number
  active: boolean
  created_at: string
  updated_at: string
}

export type CreateBidRequest = {
  title: string
  licenses?: string[]
  price_per_hour: number
  latitude: number
  longitude: number
  radius_km?: number
}

export type PaymentCard = {
  id: string
  user_id: string
  last_four: string
  brand: string
  created_at: string
}

export type Notification = {
  id: string
  user_id: string
  title: string
  body: string
  read: boolean
  created_at: string
}

export type VerificationStatus = {
  verified: boolean
  status: string
  requested: boolean
}

const CARDS_CACHE_TTL_MS = 20000

type CardsCacheEntry = {
  at: number
  data: PaymentCard[]
}

let cardsCache: CardsCacheEntry | null = null

function readCardsCache(): PaymentCard[] | null {
  if (typeof window === 'undefined' || !cardsCache) return null
  if (Date.now() - cardsCache.at > CARDS_CACHE_TTL_MS) {
    cardsCache = null
    return null
  }
  return cardsCache.data
}

function writeCardsCache(data: PaymentCard[]): void {
  if (typeof window === 'undefined') return
  cardsCache = { at: Date.now(), data }
}

function clearCardsCache(): void {
  cardsCache = null
}

export async function fetchBids(): Promise<Bid[]> {
  const data = await api<{ bids: Bid[] }>('/api/v1/bids')
  return data.bids
}

export async function createBid(body: CreateBidRequest): Promise<Bid> {
  const data = await api<{ bid?: Bid } & Bid>('/api/v1/bids', {
    method: 'POST',
    idempotencyKey: newIdempotencyKey('bid'),
    body: JSON.stringify(body),
  })
  return (data as { bid?: Bid }).bid ?? (data as Bid)
}

export async function fetchMatches(): Promise<Match[]> {
  const data = await api<{ matches: Match[] }>('/api/v1/matches')
  return data.matches
}

export async function fetchCards(): Promise<PaymentCard[]> {
  const cached = readCardsCache()
  if (cached) return cached
  const data = await api<{ cards: PaymentCard[] }>('/api/v1/cards')
  const cards = Array.isArray(data.cards) ? data.cards : []
  writeCardsCache(cards)
  return cards
}

export async function addCard(body: { last_four: string; brand?: string }): Promise<PaymentCard> {
  const data = await api<{ card: PaymentCard }>('/api/v1/cards', {
    method: 'POST',
    body: JSON.stringify(body),
  })
  clearCardsCache()
  return data.card
}

export async function deleteCard(id: string): Promise<void> {
  await api(`/api/v1/cards/${id}`, { method: 'DELETE' })
  clearCardsCache()
}

export async function fetchNotifications(): Promise<Notification[]> {
  const data = await api<{ notifications: Notification[] }>('/api/v1/notifications')
  return data.notifications
}

export async function markNotificationRead(id: string): Promise<void> {
  await api(`/api/v1/notifications/${id}/read`, { method: 'PATCH' })
}

export async function fetchVerificationStatus(): Promise<VerificationStatus> {
  return api<VerificationStatus>('/api/v1/verification/status')
}

export async function submitVerification(documentBase64?: string): Promise<{ ok: boolean; status: string }> {
  return api('/api/v1/verification', {
    method: 'POST',
    body: JSON.stringify({ document_base64: documentBase64 || '' }),
  })
}

