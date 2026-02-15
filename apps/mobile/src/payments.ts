// ═══════════════════════════════════════════════════════════════
// BOLH Payment Service — API-first with localStorage cache
// ═══════════════════════════════════════════════════════════════
import { createSignal } from 'solid-js';
import { api, isBackendAvailable, type PaymentCardApi, type PaymentApi } from './api';

// ── Types ──
export interface PaymentCard {
  id: string;
  last4: string;
  brand: 'visa' | 'mastercard' | 'mir' | 'unionpay';
  expiry: string;
  isDefault: boolean;
  color: string;
}

export interface Transaction {
  id: string;
  type: 'deposit' | 'withdrawal' | 'payment' | 'earning' | 'refund' | 'bonus' | 'subscription';
  amount: number;
  currency: string;
  description: string;
  status: 'completed' | 'pending' | 'failed' | 'processing';
  timestamp: number;
  orderId?: string;
  counterparty?: string;
}

export interface EscrowPayment {
  id: string;
  orderId: string;
  clientId: string;
  workerId: string;
  amount: number;
  status: 'held' | 'released' | 'refunded' | 'disputed';
  service: string;
  createdAt: number;
}

// ── State ──
const STORAGE_KEY = 'bolh_payments_v2';

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return null;
}

function saveState(data: any) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
}

const initial = loadState();

const [balance, setBalance] = createSignal<number>(initial?.balance ?? 25000);
const [frozenBalance, setFrozenBalance] = createSignal<number>(initial?.frozenBalance ?? 5000);
const [cards, setCards] = createSignal<PaymentCard[]>(initial?.cards ?? [
  { id: 'c1', last4: '4242', brand: 'visa', expiry: '12/28', isDefault: true, color: '#1a1a2e' },
  { id: 'c2', last4: '5555', brand: 'mastercard', expiry: '08/27', isDefault: false, color: '#16213e' },
]);
const [transactions, setTransactions] = createSignal<Transaction[]>(initial?.transactions ?? [
  { id: 'tx1', type: 'deposit', amount: 50000, currency: '₸', description: 'Пополнение с Visa •4242', status: 'completed', timestamp: Date.now() - 86400000 },
  { id: 'tx2', type: 'payment', amount: -16000, currency: '₸', description: 'Заказ #1245 — Сантехника', status: 'completed', timestamp: Date.now() - 172800000, orderId: '1245', counterparty: 'Алексей К.' },
  { id: 'tx3', type: 'earning', amount: 48000, currency: '₸', description: 'Выполнен заказ — Охрана мероприятия', status: 'completed', timestamp: Date.now() - 259200000, orderId: '1244' },
  { id: 'tx4', type: 'bonus', amount: 2000, currency: '₸', description: 'Бонус за приглашение друга', status: 'completed', timestamp: Date.now() - 345600000 },
  { id: 'tx5', type: 'payment', amount: -9000, currency: '₸', description: 'Заказ #1243 — Уборка квартиры', status: 'completed', timestamp: Date.now() - 432000000, orderId: '1243', counterparty: 'Мария Л.' },
  { id: 'tx6', type: 'withdrawal', amount: -30000, currency: '₸', description: 'Вывод на Kaspi Gold', status: 'completed', timestamp: Date.now() - 518400000 },
  { id: 'tx7', type: 'subscription', amount: -4990, currency: '₸', description: 'Подписка Basic — февраль', status: 'completed', timestamp: Date.now() - 604800000 },
  { id: 'tx8', type: 'refund', amount: 12000, currency: '₸', description: 'Возврат — заказ отменён', status: 'completed', timestamp: Date.now() - 691200000, orderId: '1240' },
]);
const [escrows, setEscrows] = createSignal<EscrowPayment[]>(initial?.escrows ?? [
  { id: 'esc1', orderId: '1246', clientId: 'user1', workerId: 'worker1', amount: 5000, status: 'held', service: 'Мелкий ремонт', createdAt: Date.now() - 3600000 },
]);

export { balance, frozenBalance, cards, transactions, escrows };

// ── Debounced persist (avoids thrashing localStorage on rapid changes) ──
let _persistTimer: ReturnType<typeof setTimeout> | null = null;
function persist() {
  if (_persistTimer) clearTimeout(_persistTimer);
  _persistTimer = setTimeout(() => {
    _persistTimer = null;
    saveState({
      balance: balance(),
      frozenBalance: frozenBalance(),
      cards: cards(),
      transactions: transactions(),
      escrows: escrows(),
    });
  }, 300);
}

// ── Helpers ──
let txCounter = 100;
function newTxId() { return `tx_${Date.now()}_${txCounter++}`; }

// ═══════════════════════════════════════════════════════════════
// SYNC — Load payment data from backend
// ═══════════════════════════════════════════════════════════════

/** Sync payments and cards from the backend */
export async function syncPayments(): Promise<void> {
  const backendUp = await isBackendAvailable();
  if (!backendUp) return;

  try {
    // Fetch cards from backend
    const apiCards = await api.payments.listCards();
    if (apiCards && Array.isArray(apiCards)) {
      const cardColors = ['#1a1a2e', '#16213e', '#0f3460', '#533483', '#2c3333'];
      const mapped: PaymentCard[] = apiCards.map((c: PaymentCardApi, i: number) => ({
        id: c.id,
        last4: c.last4,
        brand: (c.brand?.toLowerCase() || 'visa') as PaymentCard['brand'],
        expiry: c.expiry,
        isDefault: c.isDefault,
        color: cardColors[i % cardColors.length],
      }));
      setCards(mapped);
    }

    // Fetch payment history from backend
    const apiPayments = await api.payments.list();
    if (apiPayments?.data && Array.isArray(apiPayments.data)) {
      const mapped: Transaction[] = apiPayments.data.map((p: PaymentApi) => ({
        id: p.id,
        type: p.method === 'deposit' ? 'deposit' as const : 'payment' as const,
        amount: p.amount,
        currency: '₸',
        description: p.method,
        status: p.status as Transaction['status'],
        timestamp: new Date(p.createdAt).getTime(),
        orderId: p.orderId,
      }));
      if (mapped.length > 0) {
        setTransactions(mapped);
      }
    }

    persist();
  } catch (e) {
    console.warn('syncPayments failed:', e);
  }
}

// ── Actions ──

export function deposit(amount: number, cardId?: string): Transaction {
  const card = cards().find(c => c.id === cardId) || cards().find(c => c.isDefault);
  const tx: Transaction = {
    id: newTxId(),
    type: 'deposit',
    amount,
    currency: '₸',
    description: card ? `Пополнение с ${card.brand.toUpperCase()} •${card.last4}` : 'Пополнение баланса',
    status: 'completed',
    timestamp: Date.now(),
  };
  setBalance(b => b + amount);
  setTransactions(prev => [tx, ...prev]);
  persist();

  // Also send to backend (fire-and-forget, only if online)
  isBackendAvailable().then(up => { if (up) api.payments.create({ amount, method: 'deposit' }).catch(() => {}); });

  return tx;
}

export function withdraw(amount: number, destination: string = 'Kaspi Gold'): Transaction | null {
  if (amount > balance()) return null;
  const tx: Transaction = {
    id: newTxId(),
    type: 'withdrawal',
    amount: -amount,
    currency: '₸',
    description: `Вывод на ${destination}`,
    status: 'processing',
    timestamp: Date.now(),
  };
  setBalance(b => b - amount);
  setTransactions(prev => [tx, ...prev]);

  // Send to backend (only if online)
  isBackendAvailable().then(up => { if (up) api.payments.create({ amount: -amount, method: 'withdrawal' }).catch(() => {}); });

  // Simulate processing
  setTimeout(() => {
    setTransactions(prev => prev.map(t => t.id === tx.id ? { ...t, status: 'completed' } : t));
    persist();
  }, 3000);
  persist();
  return tx;
}

export function payForOrder(amount: number, orderId: string, service: string, worker: string): Transaction | null {
  if (amount > balance()) return null;
  // Create escrow
  const esc: EscrowPayment = {
    id: `esc_${Date.now()}`,
    orderId,
    clientId: 'current_user',
    workerId: worker,
    amount,
    status: 'held',
    service,
    createdAt: Date.now(),
  };
  const tx: Transaction = {
    id: newTxId(),
    type: 'payment',
    amount: -amount,
    currency: '₸',
    description: `Заказ #${orderId} — ${service}`,
    status: 'completed',
    timestamp: Date.now(),
    orderId,
    counterparty: worker,
  };
  setBalance(b => b - amount);
  setFrozenBalance(fb => fb + amount);
  setEscrows(prev => [esc, ...prev]);
  setTransactions(prev => [tx, ...prev]);
  persist();

  // Send to backend (only if online)
  isBackendAvailable().then(up => { if (up) api.payments.create({ orderId, amount, method: 'escrow' }).catch(() => {}); });

  return tx;
}

export function releaseEscrow(escrowId: string): void {
  const esc = escrows().find(e => e.id === escrowId);
  if (!esc || esc.status !== 'held') return;
  setEscrows(prev => prev.map(e => e.id === escrowId ? { ...e, status: 'released' } : e));
  setFrozenBalance(fb => Math.max(0, fb - esc.amount));
  // Worker earns
  const tx: Transaction = {
    id: newTxId(),
    type: 'earning',
    amount: esc.amount,
    currency: '₸',
    description: `Выполнен заказ — ${esc.service}`,
    status: 'completed',
    timestamp: Date.now(),
    orderId: esc.orderId,
  };
  setTransactions(prev => [tx, ...prev]);
  persist();
}

export function refundEscrow(escrowId: string): void {
  const esc = escrows().find(e => e.id === escrowId);
  if (!esc || esc.status !== 'held') return;
  setEscrows(prev => prev.map(e => e.id === escrowId ? { ...e, status: 'refunded' } : e));
  setFrozenBalance(fb => Math.max(0, fb - esc.amount));
  setBalance(b => b + esc.amount);
  const tx: Transaction = {
    id: newTxId(),
    type: 'refund',
    amount: esc.amount,
    currency: '₸',
    description: `Возврат — ${esc.service}`,
    status: 'completed',
    timestamp: Date.now(),
    orderId: esc.orderId,
  };
  setTransactions(prev => [tx, ...prev]);
  persist();
}

export function addCard(card: Omit<PaymentCard, 'id'>): PaymentCard {
  const newCard: PaymentCard = { ...card, id: `card_${Date.now()}` };
  if (newCard.isDefault) {
    setCards(prev => prev.map(c => ({ ...c, isDefault: false })));
  }
  setCards(prev => [...prev, newCard]);
  persist();

  // Send to backend (only if online)
  isBackendAvailable().then(up => { if (up) api.payments.addCard({ number: `****${newCard.last4}`, expiry: newCard.expiry, cvv: '***' }).catch(() => {}); });

  return newCard;
}

export function removeCard(cardId: string): void {
  setCards(prev => prev.filter(c => c.id !== cardId));
  persist();

  // Send to backend (only if online)
  isBackendAvailable().then(up => { if (up) api.payments.removeCard(cardId).catch(() => {}); });
}

export function setDefaultCard(cardId: string): void {
  setCards(prev => prev.map(c => ({ ...c, isDefault: c.id === cardId })));
  persist();
}

export function addEarning(amount: number, description: string, orderId?: string): Transaction {
  const tx: Transaction = {
    id: newTxId(),
    type: 'earning',
    amount,
    currency: '₸',
    description,
    status: 'completed',
    timestamp: Date.now(),
    orderId,
  };
  setBalance(b => b + amount);
  setTransactions(prev => [tx, ...prev]);
  persist();
  return tx;
}

// ── Stats ──
export function getStats() {
  const txs = transactions();
  const now = Date.now();
  const thisMonth = txs.filter(t => now - t.timestamp < 30 * 86400000);
  const totalEarnings = txs.filter(t => t.type === 'earning' && t.status === 'completed').reduce((s, t) => s + t.amount, 0);
  const monthEarnings = thisMonth.filter(t => t.type === 'earning' && t.status === 'completed').reduce((s, t) => s + t.amount, 0);
  const totalSpent = txs.filter(t => t.type === 'payment' && t.status === 'completed').reduce((s, t) => s + Math.abs(t.amount), 0);
  const monthSpent = thisMonth.filter(t => t.type === 'payment' && t.status === 'completed').reduce((s, t) => s + Math.abs(t.amount), 0);
  return { totalEarnings, monthEarnings, totalSpent, monthSpent, txCount: txs.length };
}
