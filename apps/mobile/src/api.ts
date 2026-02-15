// ═══════════════════════════════════════════════════════════════
// BOLH API Client — connects to Rust/Axum backend
// Routes match backend/src/api/routes.rs exactly
// ═══════════════════════════════════════════════════════════════

// In dev: Vite proxy forwards /api/v1/* → http://localhost:8080/api/v1/*
// In production: VITE_API_URL points to the Cloud Run backend directly
const API_BASE = (import.meta as any).env?.VITE_API_URL
  ? `${(import.meta as any).env.VITE_API_URL}/api/v1`
  : '/api/v1';

// ── Token management ──
let _accessToken: string | null = null;
let _refreshToken: string | null = null;

try {
  _accessToken = localStorage.getItem('bolh_access_token');
  _refreshToken = localStorage.getItem('bolh_refresh_token');
} catch {}

export function setTokens(access: string | null, refresh?: string | null) {
  _accessToken = access;
  if (refresh !== undefined) _refreshToken = refresh;
  try {
    if (access) localStorage.setItem('bolh_access_token', access);
    else localStorage.removeItem('bolh_access_token');
    if (refresh) localStorage.setItem('bolh_refresh_token', refresh);
    else if (refresh === null) localStorage.removeItem('bolh_refresh_token');
  } catch {}
}

export function getAccessToken() { return _accessToken; }
export function getRefreshToken() { return _refreshToken; }

export function clearTokens() {
  _accessToken = null;
  _refreshToken = null;
  try {
    localStorage.removeItem('bolh_access_token');
    localStorage.removeItem('bolh_refresh_token');
  } catch {}
}

// ── Types matching backend models ──

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
}

export interface ApiUser {
  id: number;
  phone: string;
  name: string;
  email?: string;
  role: 'client' | 'guard' | 'admin';
  avatarUrl?: string;
  rating?: number;
  verifiedLevel?: number;
}

export interface AuthResponse extends AuthTokens {
  user: ApiUser;
}

export interface Guard {
  id: number;
  userId: number;
  name: string;
  phone: string;
  avatarUrl?: string;
  verificationLevel: number;
  rating: number;
  totalReviews: number;
  latitude: number;
  longitude: number;
  isAvailable: boolean;
  isOnline: boolean;
  hourlyRate: number;
  experienceYears: number;
  specializations: string[];
}

export interface Order {
  id: string;
  clientId: number;
  guardId?: number;
  serviceType: string;
  status: 'new' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';
  address: string;
  latitude: number;
  longitude: number;
  description?: string;
  durationHours: number;
  price: number;
  currency: string;
  scheduledAt?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}

export interface PaymentCardApi {
  id: string;
  last4: string;
  brand: string;
  expiry: string;
  isDefault: boolean;
}

export interface PaymentApi {
  id: string;
  orderId?: string;
  amount: number;
  method: string;
  status: string;
  createdAt: string;
}

export interface Conversation {
  id: string;
  participantId: number;
  participantName: string;
  participantAvatar?: string;
  lastMessage?: string;
  lastMessageAt?: string;
  unreadCount: number;
}

export interface ChatMessage {
  id: string;
  senderId: number;
  text: string;
  createdAt: string;
  read: boolean;
}

export interface ApiNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
  action?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

// ── Base fetch wrapper with auto-refresh ──

let _isRefreshing = false;
let _refreshQueue: Array<{ resolve: (v: any) => void; reject: (e: any) => void }> = [];

async function apiFetch<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };

  // Don't set Content-Type for FormData (browser sets boundary)
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  if (_accessToken) {
    headers['Authorization'] = `Bearer ${_accessToken}`;
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  // Auto-refresh on 401
  if (res.status === 401 && _refreshToken && !path.includes('/auth/')) {
    if (!_isRefreshing) {
      _isRefreshing = true;
      try {
        const refreshed = await _doRefresh();
        if (refreshed) {
          // Retry the original request
          _isRefreshing = false;
          _refreshQueue.forEach(q => q.resolve(true));
          _refreshQueue = [];
          return apiFetch<T>(path, options);
        }
      } catch {
        _isRefreshing = false;
        _refreshQueue.forEach(q => q.reject(new Error('Refresh failed')));
        _refreshQueue = [];
        clearTokens();
      }
    } else {
      // Wait for ongoing refresh
      await new Promise((resolve, reject) => _refreshQueue.push({ resolve, reject }));
      return apiFetch<T>(path, options);
    }
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(err.error || err.message || 'API Error', res.status, err);
  }

  // Handle 204 No Content
  if (res.status === 204) return undefined as T;

  return res.json();
}

async function _doRefresh(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: _refreshToken }),
    });
    if (!res.ok) return false;
    const data: AuthTokens = await res.json();
    setTokens(data.accessToken, data.refreshToken);
    return true;
  } catch {
    return false;
  }
}

// ── API Error class ──
export class ApiError extends Error {
  status: number;
  data: any;
  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

// ── Check if backend is reachable ──
let _backendAvailable: boolean | null = null;
let _lastHealthCheck = 0;
let _consecutiveFails = 0;

export async function isBackendAvailable(): Promise<boolean> {
  const now = Date.now();
  // If offline: cache for 60s (don't keep retrying). If online: cache for 30s.
  const cacheDuration = _backendAvailable === false ? 60000 : 30000;
  if (_backendAvailable !== null && now - _lastHealthCheck < cacheDuration) {
    return _backendAvailable;
  }
  // After 3 consecutive fails, assume offline for 2 minutes
  if (_consecutiveFails >= 3 && now - _lastHealthCheck < 120000) {
    return false;
  }
  try {
    const res = await fetch('/health', { signal: AbortSignal.timeout(1500) });
    _backendAvailable = res.ok;
    if (res.ok) _consecutiveFails = 0;
    else _consecutiveFails++;
  } catch {
    _backendAvailable = false;
    _consecutiveFails++;
  }
  _lastHealthCheck = now;
  return _backendAvailable;
}

// ═══════════════════════════════════════════════════════════════
// API ENDPOINTS — match backend/src/api/routes.rs
// ═══════════════════════════════════════════════════════════════

export const api = {
  // ── Health ──
  health: () => fetch('/health').then(r => r.json()),

  // ── Auth (/api/v1/auth) ──
  auth: {
    register: (data: { phone: string; password: string; name: string; role: 'client' | 'guard' }) =>
      apiFetch<AuthResponse>('/auth/register', { method: 'POST', body: JSON.stringify(data) }),

    login: (phone: string, password: string) =>
      apiFetch<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify({ phone, password }) }),

    verifyPhone: (phone: string, code: string) =>
      apiFetch<{ verified: boolean }>('/auth/verify-phone', { method: 'POST', body: JSON.stringify({ phone, code }) }),

    refresh: (refreshToken: string) =>
      apiFetch<AuthTokens>('/auth/refresh', { method: 'POST', body: JSON.stringify({ refreshToken }) }),

    logout: () =>
      apiFetch<void>('/auth/logout', { method: 'POST' }),
  },

  // ── Users (/api/v1/users) ──
  users: {
    getMe: () =>
      apiFetch<ApiUser>('/users/me'),

    updateProfile: (data: Partial<ApiUser>) =>
      apiFetch<ApiUser>('/users/me', { method: 'PUT', body: JSON.stringify(data) }),

    updateLocation: (latitude: number, longitude: number) =>
      apiFetch<void>('/users/me/location', { method: 'PUT', body: JSON.stringify({ latitude, longitude }) }),

    uploadAvatar: (file: File) => {
      const form = new FormData();
      form.append('avatar', file);
      return apiFetch<{ url: string }>('/users/me/avatar', { method: 'POST', body: form });
    },

    getById: (id: number) =>
      apiFetch<ApiUser>(`/users/${id}`),
  },

  // ── Guards/Workers (/api/v1/guards) ──
  guards: {
    list: (params?: { page?: number; limit?: number }) => {
      const qs = params ? '?' + new URLSearchParams(params as any).toString() : '';
      return apiFetch<PaginatedResponse<Guard>>(`/guards${qs}`);
    },

    nearby: (params: { latitude: number; longitude: number; radiusKm?: number; limit?: number }) => {
      const qs = '?' + new URLSearchParams(params as any).toString();
      return apiFetch<Guard[]>(`/guards/nearby${qs}`);
    },

    search: (params: { q?: string; specialization?: string; minRating?: number }) => {
      const qs = '?' + new URLSearchParams(params as any).toString();
      return apiFetch<Guard[]>(`/guards/search${qs}`);
    },

    getById: (id: number) =>
      apiFetch<Guard>(`/guards/${id}`),

    getAvailability: (id: number) =>
      apiFetch<any>(`/guards/${id}/availability`),

    getReviews: (id: number) =>
      apiFetch<any[]>(`/guards/${id}/reviews`),
  },

  // ── Orders (/api/v1/orders) ──
  orders: {
    list: (params?: { status?: string; page?: number; limit?: number }) => {
      const qs = params ? '?' + new URLSearchParams(params as any).toString() : '';
      return apiFetch<PaginatedResponse<Order>>(`/orders${qs}`);
    },

    create: (data: {
      serviceType: string;
      address: string;
      latitude: number;
      longitude: number;
      description?: string;
      durationHours?: number;
      price?: number;
      scheduledAt?: string;
    }) =>
      apiFetch<Order>('/orders', { method: 'POST', body: JSON.stringify(data) }),

    getById: (id: string) =>
      apiFetch<Order>(`/orders/${id}`),

    update: (id: string, data: Partial<Order>) =>
      apiFetch<Order>(`/orders/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

    accept: (id: string) =>
      apiFetch<Order>(`/orders/${id}/accept`, { method: 'POST' }),

    start: (id: string) =>
      apiFetch<Order>(`/orders/${id}/start`, { method: 'POST' }),

    complete: (id: string) =>
      apiFetch<Order>(`/orders/${id}/complete`, { method: 'POST' }),

    cancel: (id: string) =>
      apiFetch<Order>(`/orders/${id}/cancel`, { method: 'POST' }),
  },

  // ── Payments (/api/v1/payments) ──
  payments: {
    list: () =>
      apiFetch<PaginatedResponse<PaymentApi>>('/payments'),

    create: (data: { orderId?: string; amount: number; method: string }) =>
      apiFetch<PaymentApi>('/payments', { method: 'POST', body: JSON.stringify(data) }),

    listCards: () =>
      apiFetch<PaymentCardApi[]>('/payments/cards'),

    addCard: (data: { number: string; expiry: string; cvv: string }) =>
      apiFetch<PaymentCardApi>('/payments/cards', { method: 'POST', body: JSON.stringify(data) }),

    removeCard: (id: string) =>
      apiFetch<void>(`/payments/cards/${id}`, { method: 'DELETE' }),

    getSubscription: () =>
      apiFetch<any>('/payments/subscription'),

    subscribe: (plan: string) =>
      apiFetch<any>('/payments/subscription', { method: 'POST', body: JSON.stringify({ plan }) }),
  },

  // ── Chat (/api/v1/chat) ──
  chat: {
    listConversations: () =>
      apiFetch<Conversation[]>('/chat/conversations'),

    getMessages: (conversationId: string, params?: { page?: number; limit?: number }) => {
      const qs = params ? '?' + new URLSearchParams(params as any).toString() : '';
      return apiFetch<ChatMessage[]>(`/chat/conversations/${conversationId}/messages${qs}`);
    },

    sendMessage: (conversationId: string, text: string) =>
      apiFetch<ChatMessage>(`/chat/conversations/${conversationId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ text }),
      }),
  },

  // ── Notifications (/api/v1/notifications) ──
  notifications: {
    list: () =>
      apiFetch<ApiNotification[]>('/notifications'),

    markRead: (ids: string[]) =>
      apiFetch<void>('/notifications/read', { method: 'POST', body: JSON.stringify({ ids }) }),

    getSettings: () =>
      apiFetch<any>('/notifications/settings'),

    updateSettings: (settings: any) =>
      apiFetch<any>('/notifications/settings', { method: 'PUT', body: JSON.stringify(settings) }),

    /** Connect to notification WebSocket */
    connectWs: (onMessage: (notif: any) => void): WebSocket | null => {
      try {
        const wsProtocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
        const ws = new WebSocket(`${wsProtocol}//${location.host}/api/v1/notifications/ws`);
        ws.onmessage = (e) => {
          try { onMessage(JSON.parse(e.data)); } catch {}
        };
        ws.onerror = () => {};
        ws.onclose = () => {};
        return ws;
      } catch {
        return null;
      }
    },
  },

  // ── Blockchain (/api/v1/blockchain) ──
  blockchain: {
    init: () =>
      apiFetch<any>('/blockchain/init', { method: 'POST' }),

    listWallets: () =>
      apiFetch<any[]>('/blockchain/wallets'),

    createWallet: (name: string, password: string) =>
      apiFetch<any>('/blockchain/wallets', { method: 'POST', body: JSON.stringify({ name, password }) }),

    getWallet: (name: string) =>
      apiFetch<any>(`/blockchain/wallets/${name}`),

    getWalletBalance: (name: string) =>
      apiFetch<any>(`/blockchain/wallets/${name}/balance`),

    deleteWallet: (name: string) =>
      apiFetch<void>(`/blockchain/wallets/${name}`, { method: 'DELETE' }),

    importWallet: (data: { name: string; mnemonic: string; password: string }) =>
      apiFetch<any>('/blockchain/wallets/import', { method: 'POST', body: JSON.stringify(data) }),

    getBalance: (address: string) =>
      apiFetch<any>(`/blockchain/balance/${address}`),

    submitTransaction: (data: { from: string; to: string; amount: number; fee?: number }) =>
      apiFetch<any>('/blockchain/transactions', { method: 'POST', body: JSON.stringify(data) }),

    validateTransaction: (txId: string) =>
      apiFetch<any>('/blockchain/transactions/validate', { method: 'POST', body: JSON.stringify({ txId }) }),

    getConsensus: () =>
      apiFetch<any>('/blockchain/consensus'),

    getUtxos: (address: string) =>
      apiFetch<any[]>(`/blockchain/utxos/${address}`),

    initGenesis: () =>
      apiFetch<any>('/blockchain/genesis', { method: 'POST' }),

    estimateFees: (data: { from: string; to: string; amount: number }) =>
      apiFetch<any>('/blockchain/fees/estimate', { method: 'POST', body: JSON.stringify(data) }),

    /** Connect to blockchain WebSocket */
    connectWs: (onMessage: (event: any) => void): WebSocket | null => {
      try {
        const wsProtocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
        const ws = new WebSocket(`${wsProtocol}//${location.host}/api/v1/blockchain/ws`);
        ws.onmessage = (e) => {
          try { onMessage(JSON.parse(e.data)); } catch {}
        };
        return ws;
      } catch {
        return null;
      }
    },
  },

  // ── Loyalty (/api/v1/loyalty) — added at main.rs level ──
  loyalty: {
    getBalance: () =>
      apiFetch<any>('/loyalty/balance'),

    getLedger: () =>
      apiFetch<any[]>('/loyalty/ledger'),

    getStats: () =>
      apiFetch<any>('/loyalty/stats'),

    earn: (data: { action: string; amount: number }) =>
      apiFetch<any>('/loyalty/earn', { method: 'POST', body: JSON.stringify(data) }),

    referral: (code: string) =>
      apiFetch<any>('/loyalty/referral', { method: 'POST', body: JSON.stringify({ code }) }),

    redeem: (data: { reward: string; points: number }) =>
      apiFetch<any>('/loyalty/redeem', { method: 'POST', body: JSON.stringify(data) }),
  },

  // ── File Upload ──
  upload: async (file: File): Promise<{ url: string }> => {
    const form = new FormData();
    form.append('file', file);
    return apiFetch<{ url: string }>('/upload', { method: 'POST', body: form });
  },
};

export default api;
