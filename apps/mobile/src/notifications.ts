// ═══════════════════════════════════════════════════════════════
// BOLH Notification Service — WebSocket + REST API + fallback
// ═══════════════════════════════════════════════════════════════
import { createSignal } from 'solid-js';
import { api, isBackendAvailable, type ApiNotification } from './api';

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  icon?: string; // emoji
  type: 'info' | 'success' | 'warning' | 'error' | 'order' | 'message' | 'promo';
  action?: string; // page to navigate to
  timestamp: number;
  read?: boolean;
}

// ── Active toast queue ──
const [toasts, setToasts] = createSignal<AppNotification[]>([]);
const [toastHistory, setToastHistory] = createSignal<AppNotification[]>(
  (() => { try { return JSON.parse(localStorage.getItem('bolh_toast_history') || '[]'); } catch { return []; } })()
);
const [unreadCount, setUnreadCount] = createSignal(0);

export { toasts, toastHistory, unreadCount };

// ── Debounced localStorage save for toast history ──
let _historySaveTimer: ReturnType<typeof setTimeout> | null = null;
function _scheduleHistorySave(data: AppNotification[]) {
  if (_historySaveTimer) clearTimeout(_historySaveTimer);
  _historySaveTimer = setTimeout(() => {
    _historySaveTimer = null;
    try { localStorage.setItem('bolh_toast_history', JSON.stringify(data)); } catch {}
  }, 500);
}

// ── Show a toast notification ──
let toastCounter = 0;
export function showToast(opts: Omit<AppNotification, 'id' | 'timestamp'>) {
  const notif: AppNotification = {
    ...opts,
    id: `toast_${Date.now()}_${toastCounter++}`,
    timestamp: Date.now(),
  };

  // Add to visible toasts (max 3)
  setToasts(prev => [notif, ...prev].slice(0, 3));

  // Add to history (debounced save)
  setToastHistory(prev => {
    const next = [notif, ...prev].slice(0, 50);
    _scheduleHistorySave(next);
    return next;
  });

  // Update unread count
  setUnreadCount(c => c + 1);

  // Auto-remove after 4 seconds
  setTimeout(() => {
    setToasts(prev => prev.filter(t => t.id !== notif.id));
  }, 4000);

  // Vibrate if available
  try { navigator.vibrate?.(100); } catch {}

  // Browser notification (if permission granted & app not focused)
  if (document.hidden && Notification.permission === 'granted') {
    try {
      new Notification(notif.title, {
        body: notif.body,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: notif.id,
      });
    } catch {}
  }

  return notif;
}

// ── Dismiss a toast ──
export function dismissToast(id: string) {
  setToasts(prev => prev.filter(t => t.id !== id));
}

// ── Clear all toasts ──
export function clearToasts() {
  setToasts([]);
}

// ── Mark all as read ──
export function markAllToastsRead() {
  setUnreadCount(0);
  const ids = toastHistory().filter(t => !t.read).map(t => t.id);
  setToastHistory(prev => {
    const next = prev.map(t => ({ ...t, read: true }));
    try { localStorage.setItem('bolh_toast_history', JSON.stringify(next)); } catch {}
    return next;
  });

  // Also mark read on backend (only if online)
  if (ids.length > 0) {
    isBackendAvailable().then(up => { if (up) api.notifications.markRead(ids).catch(() => {}); });
  }
}

// ── Request browser notification permission ──
export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

// ── Shortcut helpers ──
export const notify = {
  info: (title: string, body: string, action?: string) =>
    showToast({ title, body, type: 'info', icon: 'ℹ️', action }),

  success: (title: string, body: string, action?: string) =>
    showToast({ title, body, type: 'success', icon: '✅', action }),

  warning: (title: string, body: string, action?: string) =>
    showToast({ title, body, type: 'warning', icon: '⚠️', action }),

  error: (title: string, body: string, action?: string) =>
    showToast({ title, body, type: 'error', icon: '❌', action }),

  order: (title: string, body: string, action?: string) =>
    showToast({ title, body, type: 'order', icon: '📦', action: action || 'orders' }),

  message: (title: string, body: string, action?: string) =>
    showToast({ title, body, type: 'message', icon: '💬', action: action || 'chat' }),

  promo: (title: string, body: string, action?: string) =>
    showToast({ title, body, type: 'promo', icon: '🎁', action }),
};

// ═══════════════════════════════════════════════════════════════
// WebSocket connection for real-time notifications
// ═══════════════════════════════════════════════════════════════

let _ws: WebSocket | null = null;
let _wsReconnectTimer: ReturnType<typeof setTimeout> | null = null;
let _wsReconnectDelay = 1000;
let _wsReconnectAttempts = 0;
const _WS_MAX_RECONNECTS = 3; // Stop after 3 failed reconnects

function _mapApiNotifType(type: string): AppNotification['type'] {
  const map: Record<string, AppNotification['type']> = {
    order: 'order', message: 'message', promo: 'promo',
    info: 'info', success: 'success', warning: 'warning', error: 'error',
  };
  return map[type] || 'info';
}

function _mapApiNotifIcon(type: string): string {
  const map: Record<string, string> = {
    order: '📦', message: '💬', promo: '🎁',
    info: 'ℹ️', success: '✅', warning: '⚠️', error: '❌',
  };
  return map[type] || 'ℹ️';
}

/** Connect WebSocket for real-time push notifications */
export function connectNotificationWs(): void {
  if (_ws && (_ws.readyState === WebSocket.CONNECTING || _ws.readyState === WebSocket.OPEN)) return;

  _ws = api.notifications.connectWs((data) => {
    // Convert backend notification to toast
    if (data.type === 'notification' || data.title) {
      showToast({
        title: data.title || 'Notification',
        body: data.body || data.message || '',
        type: _mapApiNotifType(data.notifType || data.type || 'info'),
        icon: _mapApiNotifIcon(data.notifType || data.type || 'info'),
        action: data.action,
      });
    }
  });

  if (_ws) {
    _ws.onclose = () => {
      _wsReconnectAttempts++;
      // Stop reconnecting after max attempts (backend is down)
      if (_wsReconnectAttempts >= _WS_MAX_RECONNECTS) {
        console.info('WS: max reconnect attempts reached, stopping');
        return;
      }
      if (_wsReconnectTimer) clearTimeout(_wsReconnectTimer);
      _wsReconnectTimer = setTimeout(() => {
        _wsReconnectDelay = Math.min(_wsReconnectDelay * 2, 30000);
        connectNotificationWs();
      }, _wsReconnectDelay);
    };
    _ws.onopen = () => {
      _wsReconnectDelay = 1000;
      _wsReconnectAttempts = 0; // Reset on successful connect
    };
  }
}

/** Disconnect WebSocket */
export function disconnectNotificationWs(): void {
  if (_wsReconnectTimer) { clearTimeout(_wsReconnectTimer); _wsReconnectTimer = null; }
  if (_ws) { _ws.close(); _ws = null; }
}

// ═══════════════════════════════════════════════════════════════
// SYNC — Load notification history from backend
// ═══════════════════════════════════════════════════════════════

/** Sync notification history from backend API */
export async function syncNotifications(): Promise<void> {
  const backendUp = await isBackendAvailable();
  if (!backendUp) return;

  try {
    const apiNotifs = await api.notifications.list();
    if (apiNotifs && Array.isArray(apiNotifs)) {
      const mapped: AppNotification[] = apiNotifs.map((n: ApiNotification) => ({
        id: n.id,
        title: n.title,
        body: n.body,
        type: _mapApiNotifType(n.type),
        icon: _mapApiNotifIcon(n.type),
        action: n.action,
        timestamp: new Date(n.createdAt).getTime(),
        read: n.read,
      }));

      if (mapped.length > 0) {
        setToastHistory(mapped);
        setUnreadCount(mapped.filter(n => !n.read).length);
        _scheduleHistorySave(mapped);
      }
    }
  } catch (e) {
    console.warn('syncNotifications failed:', e);
  }
}

// ── Demo notifications (simulates real-time events) ──
const demoNotifs = [
  { delay: 8000, fn: () => notify.order('New Order Nearby!', 'Plumbing repair needed — 1.2 km away') },
  { delay: 25000, fn: () => notify.message('Алексей К.', 'Здравствуйте! Когда вам удобно?') },
  { delay: 45000, fn: () => notify.success('Review Received', 'You got a 5-star review from Maria!') },
  { delay: 70000, fn: () => notify.promo('Weekend Bonus!', '2x earnings this Saturday — activate now', 'wallet') },
  { delay: 120000, fn: () => notify.info('Tip', 'Complete your profile to get 30% more orders') },
];

let demoStarted = false;
export function startDemoNotifications() {
  if (demoStarted) return;
  demoStarted = true;
  demoNotifs.forEach(({ delay, fn }) => setTimeout(fn, delay));
}
