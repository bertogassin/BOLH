import { api, newIdempotencyKey } from './api_client'

export type EscrowPayment = {
  id: string
  order_id: string
  client_id: string
  amount: number
  currency: string
  provider: string
  provider_ref?: string
  payment_method_hint?: string
  status: string
  description?: string
  created_at: string
  authorized_at?: string
  released_at?: string
  cancelled_at?: string
}

export async function authorizeEscrowPayment(body: {
  order_id: string
  payment_method_id?: string
  payment_method_hint?: string
  description?: string
}): Promise<{ payment: EscrowPayment; mode: string; client_secret?: string }> {
  return api<{ payment: EscrowPayment; mode: string; client_secret?: string }>(`/api/v1/payments/escrow/authorize`, {
    method: 'POST',
    idempotencyKey: newIdempotencyKey('escrow_auth'),
    body: JSON.stringify(body),
  })
}

export async function releaseEscrowPayment(id: string): Promise<EscrowPayment> {
  const data = await api<{ payment: EscrowPayment }>(`/api/v1/payments/escrow/${id}/release`, {
    method: 'POST',
    idempotencyKey: newIdempotencyKey('escrow_release'),
  })
  return data.payment
}

export async function cancelEscrowPayment(id: string): Promise<EscrowPayment> {
  const data = await api<{ payment: EscrowPayment }>(`/api/v1/payments/escrow/${id}/cancel`, {
    method: 'POST',
    idempotencyKey: newIdempotencyKey('escrow_cancel'),
  })
  return data.payment
}

export async function fetchEscrowPaymentsByOrder(orderId: string): Promise<EscrowPayment[]> {
  const data = await api<{ payments: EscrowPayment[] }>(`/api/v1/payments/escrow/order/${orderId}`)
  return Array.isArray(data.payments) ? data.payments : []
}
