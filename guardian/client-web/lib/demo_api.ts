const DEMO_USER = {
  id: 'demo-user', email: 'demo@bolh.app', phone: '+33 6 12 34 56 78',
  first_name: 'Alex', last_name: 'Morgan', user_type: 'client', verified: true,
  created_at: '2026-01-15T09:00:00.000Z',
}

const now = () => new Date().toISOString()
const readBody = (options: RequestInit) => {
  try { return JSON.parse(String(options.body || '{}')) as Record<string, unknown> } catch { return {} }
}

const orders = [
  { id: 'demo-order-1', client_id: 'demo-user', title: 'Executive protection — Paris', description: 'Airport transfer and evening event security.', required_licenses: ['Close protection'], budget_min: 420, budget_max: 650, latitude: 48.8566, longitude: 2.3522, start_time: '2026-09-04T18:00:00.000Z', end_time: '2026-09-05T01:00:00.000Z', status: 'active', guard_count: 2, created_at: now(), updated_at: now() },
  { id: 'demo-order-2', client_id: 'demo-user', title: 'Retail night watch — London', description: 'Overnight site patrol and incident reporting.', required_licenses: ['SIA'], budget_min: 280, budget_max: 390, latitude: 51.5074, longitude: -0.1278, start_time: '2026-09-06T21:00:00.000Z', end_time: '2026-09-07T06:00:00.000Z', status: 'matched', guard_count: 1, created_at: now(), updated_at: now() },
]

const STORE_KEY = 'bolh_demo_state_v1'
type DemoState = { orders: typeof orders; messages: Record<string, Array<Record<string, unknown>>> }

function readState(): DemoState {
  const fallback: DemoState = { orders: orders.map((order) => ({ ...order })), messages: { 'demo-order-2': [{ id: 'demo-msg-1', order_id: 'demo-order-2', sender_id: 'demo-guard', text: 'Confirmed. I will arrive 15 minutes early.', created_at: now() }] } }
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as Partial<DemoState>
    return { orders: Array.isArray(parsed.orders) ? parsed.orders : fallback.orders, messages: parsed.messages && typeof parsed.messages === 'object' ? parsed.messages : fallback.messages }
  } catch { return fallback }
}

function writeState(state: DemoState) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)) } catch {}
}

export const demoModeEnabled = process.env.NEXT_PUBLIC_DEMO_MODE === '1'

export function demoUser() { return { ...DEMO_USER } }

export async function demoApi<T>(path: string, options: RequestInit = {}): Promise<T | undefined> {
  if (!demoModeEnabled || typeof window === 'undefined') return undefined
  const token = localStorage.getItem('guardian_token') || sessionStorage.getItem('guardian_token')
  const method = (options.method || 'GET').toUpperCase()
  const body = readBody(options)

  if (path === '/api/v1/auth/login' || path === '/api/v1/auth/register') return { token: 'demo', user: DEMO_USER } as T
  if (path === '/api/v1/auth/logout') return {} as T
  if (token !== 'demo') return undefined
  if (path === '/api/v1/auth/me') return (method === 'PATCH' ? { ...DEMO_USER, ...body } : DEMO_USER) as T
  if (path === '/api/v1/auth/me/password') return {} as T
  if (path.startsWith('/api/v1/orders/') && path.endsWith('/messages')) {
    const state = readState()
    const orderId = path.split('/')[4]
    if (method === 'POST') {
      const message = { id: `demo-msg-${Date.now()}`, order_id: orderId, sender_id: 'demo-user', text: String(body.text || ''), created_at: now() }
      state.messages[orderId] = [...(state.messages[orderId] || []), message]
      writeState(state)
      return { message } as T
    }
    return { messages: state.messages[orderId] || [] } as T
  }
  if (path.match(/^\/api\/v1\/orders\/[^/]+\/cancel$/)) {
    const state = readState(); const id = path.split('/')[4]
    const index = state.orders.findIndex((order) => order.id === id)
    const order = { ...(index >= 0 ? state.orders[index] : state.orders[0]), id, status: 'cancelled', updated_at: now() }
    if (index >= 0) state.orders[index] = order; else state.orders.unshift(order)
    writeState(state); return { order } as T
  }
  if (path.match(/^\/api\/v1\/orders\/[^/?]+$/)) {
    const state = readState(); const id = path.split('/')[4]
    return { order: state.orders.find((order) => order.id === id) || state.orders[0], match: { id: 'demo-match', order_id: id, bid_id: 'demo-bid', guard_id: 'demo-guard', final_price: 480, created_at: now() } } as T
  }
  if (path.startsWith('/api/v1/orders')) {
    const state = readState()
    if (method === 'POST') {
      const order = { ...state.orders[0], ...body, id: `demo-order-${Date.now()}`, client_id: 'demo-user', status: 'active', created_at: now(), updated_at: now() }
      state.orders.unshift(order); writeState(state); return { order } as T
    }
    return { orders: state.orders } as T
  }
  if (path === '/api/v1/bids') return (method === 'POST' ? { bid: { id: `demo-bid-${Date.now()}`, guard_id: 'demo-user', active: true, created_at: now(), updated_at: now(), ...body } } : { bids: [{ id: 'demo-bid', guard_id: 'demo-guard', title: 'Licensed close-protection specialist', licenses: ['Close protection', 'First aid'], price_per_hour: 55, latitude: 48.86, longitude: 2.35, radius_km: 30, active: true, created_at: now(), updated_at: now() }] }) as T
  if (path === '/api/v1/matches') return { matches: [{ id: 'demo-match', order_id: 'demo-order-2', bid_id: 'demo-bid', guard_id: 'demo-guard', final_price: 480, created_at: now() }] } as T
  if (path === '/api/v1/cards') return (method === 'POST' ? { card: { id: `demo-card-${Date.now()}`, user_id: 'demo-user', last_four: String(body.last_four || '4242'), brand: String(body.brand || 'Visa'), created_at: now() } } : { cards: [{ id: 'demo-card', user_id: 'demo-user', last_four: '4242', brand: 'Visa', created_at: now() }] }) as T
  if (path.startsWith('/api/v1/cards/')) return {} as T
  if (path === '/api/v1/notifications') return { notifications: [{ id: 'demo-notification', user_id: 'demo-user', title: 'Guard assigned', body: 'A verified professional accepted your London order.', read: false, created_at: now() }] } as T
  if (path.includes('/notifications/') && path.endsWith('/read')) return {} as T
  if (path === '/api/v1/verification/status') return { verified: true, status: 'verified', requested: true } as T
  if (path === '/api/v1/verification') return { ok: true, status: 'pending' } as T
  if (path.startsWith('/api/v1/documents')) return path.match(/^\/api\/v1\/documents\/[^/?]+$/) ? { id: 'demo-document', user_id: 'demo-user', user_type: 'client', doc_type: 'contract', title: 'Protection agreement', file_name: 'agreement.pdf', file_size: 248000, mime_type: 'application/pdf', created_at: now(), updated_at: now(), status: 'signed', tags: ['contract'], version: 1, is_favorite: true } as T : { documents: [] } as T
  if (path.startsWith('/api/v1/payments/escrow')) return { payments: [], payment: { id: 'demo-payment', order_id: String(body.order_id || 'demo-order-1'), client_id: 'demo-user', amount: Number(body.amount || 480), currency: String(body.currency || 'EUR'), provider: 'demo', status: 'authorized', created_at: now(), authorized_at: now() }, mode: 'demo' } as T
  if (path === '/api/v1/company/register') return { ok: true, status: 'pending', application_id: 'demo-company' } as T
  if (path === '/api/v1/plans') {
    const plan = { id: 'demo-plan', owner_id: 'demo-user', title: 'Event security plan', description: 'Arrival, perimeter and departure checklist.', created_at: now(), updated_at: now() }
    return (method === 'POST' ? { ...plan, ...body } : { plans: [plan] }) as T
  }
  if (path.startsWith('/api/v1/plans/')) {
    const plan = { id: 'demo-plan', owner_id: 'demo-user', title: 'Event security plan', description: 'Arrival, perimeter and departure checklist.', created_at: now(), updated_at: now() }
    const task = { id: 'demo-task', plan_id: 'demo-plan', title: String(body.title || 'Confirm meeting point'), description: '', assignee_id: 'demo-user', status: 'in_progress', sort_order: 1, created_at: now(), updated_at: now() }
    if (path.includes('/tasks')) return (method === 'GET' ? { plan, tasks: [task] } : task) as T
    return (method === 'GET' ? { plan, tasks: [task] } : { ...plan, ...body }) as T
  }
  const plugin = { id: 'demo-plugin', user_id: 'demo-user', user_type: 'client', plugin_type: 'dashboard', name: 'Mission control', description: 'Live readiness and response workspace.', icon: 'shield', color_scheme: { accent: '#8b5cf6' }, config: {}, components: [], created_at: now(), updated_at: now(), status: 'draft', version: 1, is_public: false }
  if (path === '/api/v1/plugins/templates') return { templates: [{ id: 'demo-template', name: 'Operations board', description: 'A ready-made security operations dashboard.', icon: 'layout-dashboard', category: 'operations', components: ['status', 'map', 'timeline'] }] } as T
  if (path.startsWith('/api/v1/plugins/my')) return { plugins: [plugin] } as T
  if (path === '/api/v1/plugins') return { ...plugin, ...body, id: `demo-plugin-${Date.now()}` } as T
  if (path.startsWith('/api/v1/plugins/')) {
    if (path.endsWith('/team')) return method === 'POST' ? { plugin_id: 'demo-plugin', user_id: String(body.user_id || 'demo-colleague'), role: String(body.role || 'editor'), added_by: 'demo-user', added_at: now() } as T : { members: [] } as T
    if (path.endsWith('/comments')) return method === 'POST' ? { id: `demo-comment-${Date.now()}`, plugin_id: 'demo-plugin', user_id: 'demo-user', content: String(body.content || ''), resolved: false, created_at: now() } as T : { comments: [] } as T
    if (path.endsWith('/publish')) return { status: 'published' } as T
    return plugin as T
  }
  return undefined
}
