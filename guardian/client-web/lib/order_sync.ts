export const ORDER_SYNC_EVENT_KEY = 'guardian_orders_sync_event'
const ORDER_SYNC_CHANNEL = 'guardian_orders_sync_channel'

type OrderSyncPayload = {
  ts: number
  reason: 'created' | 'updated' | 'cancelled' | 'message'
  orderId?: string
}

function canUseWindow(): boolean {
  return typeof window !== 'undefined'
}

export function emitOrderSync(payload: Omit<OrderSyncPayload, 'ts'>): void {
  if (!canUseWindow()) return
  const eventPayload: OrderSyncPayload = { ...payload, ts: Date.now() }
  const serialized = JSON.stringify(eventPayload)
  try {
    window.localStorage.setItem(ORDER_SYNC_EVENT_KEY, serialized)
  } catch {
    // Ignore storage errors in UI.
  }
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel(ORDER_SYNC_CHANNEL)
      bc.postMessage(eventPayload)
      bc.close()
    }
  } catch {
    // Ignore channel errors in UI.
  }
}

export function subscribeOrderSync(onSync: () => void): () => void {
  if (!canUseWindow()) return () => {}

  const onStorage = (event: StorageEvent) => {
    if (event.key === ORDER_SYNC_EVENT_KEY) onSync()
  }
  window.addEventListener('storage', onStorage)

  let bc: BroadcastChannel | null = null
  const onChannelMessage = () => onSync()
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      bc = new BroadcastChannel(ORDER_SYNC_CHANNEL)
      bc.addEventListener('message', onChannelMessage)
    }
  } catch {
    bc = null
  }

  return () => {
    window.removeEventListener('storage', onStorage)
    if (bc) {
      bc.removeEventListener('message', onChannelMessage)
      bc.close()
    }
  }
}
