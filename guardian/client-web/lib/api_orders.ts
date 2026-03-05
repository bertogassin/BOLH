import { api } from './api_client'

export type Order = {
  id: string
  client_id: string
  title: string
  description: string
  required_licenses: string[]
  budget_min: number
  budget_max: number
  latitude: number
  longitude: number
  start_time: string
  end_time: string
  status: string
  guard_count: number
  created_at: string
  updated_at: string
}

export type Match = {
  id: string
  order_id: string
  bid_id: string
  guard_id: string
  final_price: number
  created_at: string
}

export type ChatMessage = {
  id: string
  order_id: string
  sender_id: string
  text: string
  created_at: string
}

export async function fetchOrders(params?: { status?: string; q?: string }): Promise<Order[]> {
  const sp = new URLSearchParams()
  if (params?.status) sp.set('status', params.status)
  if (params?.q) sp.set('q', params.q)
  const query = sp.toString()
  const url = query ? `/api/v1/orders?${query}` : '/api/v1/orders'
  const data = await api<{ orders: Order[] }>(url)
  return data.orders
}

export async function fetchOrder(id: string): Promise<Order> {
  const data = await api<{ order: Order }>(`/api/v1/orders/${id}`)
  return data.order
}

export async function fetchOrderWithMatch(id: string): Promise<{ order: Order; match?: Match }> {
  const data = await api<{ order: Order; match?: Match }>(`/api/v1/orders/${id}`)
  return data
}

export async function fetchOrderMessages(orderId: string): Promise<ChatMessage[]> {
  const data = await api<{ messages: ChatMessage[] }>(`/api/v1/orders/${orderId}/messages`)
  return data.messages
}

export async function sendOrderMessage(orderId: string, text: string): Promise<ChatMessage> {
  const data = await api<{ message: ChatMessage }>(`/api/v1/orders/${orderId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  })
  return data.message
}

export async function createOrder(body: {
  title: string
  description?: string
  required_licenses?: string[]
  budget_min: number
  budget_max: number
  latitude: number
  longitude: number
  start_time: string
  end_time: string
  guard_count?: number
}): Promise<Order> {
  const data = await api<{ order?: Order } & Order>('/api/v1/orders', {
    method: 'POST',
    body: JSON.stringify(body),
  })
  return (data as { order?: Order }).order ?? (data as Order)
}

export async function cancelOrder(id: string): Promise<Order> {
  const data = await api<{ order: Order }>(`/api/v1/orders/${id}/cancel`, { method: 'POST' })
  return data.order
}

