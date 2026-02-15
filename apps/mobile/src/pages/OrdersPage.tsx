import { createSignal, For, Show, Switch, Match, onMount, onCleanup, createEffect } from 'solid-js';
import { t, setLanguage, getLanguages, getCurrentLanguage, isRTL, currentLang } from '../i18n';
import { theme, setTheme, isDark, activeTheme } from '../theme';
import { departments, getDepartment, getDepartmentSkills, getSkillGroups, type Department, type SkillGroup } from '../departments';
import { getDailyLesson, lessonTypeLabel, levelLabel } from '../english_learn';
import { BlockchainScreen } from '../components';
import { askElina, addPersonality, createElinaContext, updateContext, type ElinaMessage, type ElinaContext, type ElinaAction } from '../elina';
import { toasts, dismissToast, showToast, notify, requestNotificationPermission, startDemoNotifications, unreadCount, type AppNotification } from '../notifications';
import { balance, frozenBalance, cards, transactions, escrows, deposit, withdraw, payForOrder, releaseEscrow, refundEscrow, addCard, removeCard, setDefaultCard, getStats, type PaymentCard, type Transaction } from '../payments';
import {
  tauriCoreInvoke,
  activeDepartment, setActiveDepartment,
  workerSkills, setWorkerSkills,
  verifiedDiplomas, setVerifiedDiplomas,
  workerStatus, setWorkerStatus,
  busyUntil, setBusyUntil,
  autoOnlineTime, setAutoOnlineTime,
  profileMode, setProfileMode,
  clientNeeds, setClientNeeds,
  homeMode, setHomeMode,
  homeExpandedDept, setHomeExpandedDept,
  homeExpandedGroup, setHomeExpandedGroup,
  homeExpandedSkill, setHomeExpandedSkill,
  getActiveDept,
  pinnedDepts, setPinnedDepts, togglePin,
  initLikes, getLikeCount, hasLiked, likeOnce,
  authUser, setAuthUser, saveAuth, clearAuth, loadAuth, isAuthenticated,
  type AuthUser,
} from '../store';
import { Icon, SkillIcon, Icons, EMOJI_TO_ICON, type NotifType } from '../ui';
import { LikeBadge, SwipeLayer, SwipeBack, playGlobalSound, haptic, hapticOrder, globalSoundEnabled, setGlobalSoundEnabled, globalHapticEnabled, setGlobalHapticEnabled, globalNotifSound, setGlobalNotifSound, globalVolume, setGlobalVolume, vibrationIntensity, setVibrationIntensity, rareEscalationEnabled, setRareEscalationEnabled } from '../ui';
import { MobileElina, ElinaChatPanel } from '../elina-ui';
import { api, isBackendAvailable, type Order as ApiOrder } from '../api';

export default function OrdersPage() {
  const ORDERS_KEY = 'bolh_orders_v1';
  const loadOrders = () => { try { return JSON.parse(localStorage.getItem(ORDERS_KEY) || '[]'); } catch { return []; } };
  const [orders, setOrders] = createSignal<{id:string;worker:string;dept:string;deptIcon:string;date:string;time:string;status:'active'|'completed'|'cancelled';price:number}[]>(loadOrders());
  const [filter, setFilter] = createSignal<'all'|'active'|'completed'|'cancelled'>('all');
  const isEn = () => currentLang() === 'en';

  // Map API order status to local status
  const mapStatus = (s: string): 'active' | 'completed' | 'cancelled' => {
    if (s === 'completed') return 'completed';
    if (s === 'cancelled') return 'cancelled';
    return 'active'; // new, accepted, in_progress → active
  };

  // Fetch orders from API on mount
  onMount(async () => {
    try {
      const backendUp = await isBackendAvailable();
      if (!backendUp) return;

      const res = await api.orders.list();
      if (res?.data && Array.isArray(res.data) && res.data.length > 0) {
        const mapped = res.data.map((o: ApiOrder) => ({
          id: o.id,
          worker: o.guardId ? `Guard #${o.guardId}` : '-',
          dept: o.serviceType || 'general',
          deptIcon: '📦',
          date: o.createdAt?.slice(0, 10) || '',
          time: o.scheduledAt ? new Date(o.scheduledAt).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' }) : '-',
          status: mapStatus(o.status),
          price: o.price || 0,
        }));
        setOrders(mapped);
        try { localStorage.setItem(ORDERS_KEY, JSON.stringify(mapped)); } catch {}
        return;
      }
    } catch (e) {
      console.warn('Failed to load orders from API:', e);
    }
  });

  // Seed demo orders if empty
  if (orders().length === 0) {
    const demo = [
      {id:'1001',worker:'Алексей К.',dept:'plumbing',deptIcon:'🔧',date:'2026-02-14',time:'14:00-18:00',status:'active' as const,price:24000},
      {id:'1002',worker:'Дмитрий С.',dept:'electrical',deptIcon:'⚡',date:'2026-02-13',time:'10:00-14:00',status:'completed' as const,price:18000},
      {id:'1003',worker:'Максим И.',dept:'locks',deptIcon:'🔐',date:'2026-02-10',time:'09:00-12:00',status:'completed' as const,price:15000},
      {id:'1004',worker:'Анна В.',dept:'cleaning',deptIcon:'🧹',date:'2026-02-08',time:'08:00-17:00',status:'completed' as const,price:32000},
      {id:'1005',worker:'Игорь Л.',dept:'tech',deptIcon:'📱',date:'2026-02-05',time:'11:00-13:00',status:'cancelled' as const,price:8000},
    ];
    setOrders(demo);
    try { localStorage.setItem(ORDERS_KEY, JSON.stringify(demo)); } catch {}
  }

  const filtered = () => filter() === 'all' ? orders() : orders().filter(o => o.status === filter());
  const filters: {key:'all'|'active'|'completed'|'cancelled';label:string}[] = [
    {key:'all',label:isEn()?'All':'Все'},
    {key:'active',label:isEn()?'Active':'Активные'},
    {key:'completed',label:isEn()?'Done':'Готовые'},
    {key:'cancelled',label:isEn()?'Cancelled':'Отменённые'},
  ];

  const statusBadge = (s: string) => {
    if (s==='active') return {bg:'rgba(34,197,94,0.15)',color:'#22c55e',label:isEn()?'Active':'Активен'};
    if (s==='completed') return {bg:'rgba(107,114,128,0.15)',color:'#9ca3af',label:isEn()?'Done':'Готов'};
    return {bg:'rgba(239,68,68,0.15)',color:'#ef4444',label:isEn()?'Cancelled':'Отменён'};
  };

  return (
    <div style="padding: 16px; min-height: 80vh;">
      <h1 style="font-size: 22px; font-weight: 800; color: #fff; margin: 0 0 4px 0;">{isEn() ? 'My Orders' : 'Мои заказы'}</h1>
      <p style="font-size: 12px; color: rgba(255,255,255,0.4); margin: 0 0 16px 0;">{orders().length} {isEn() ? 'total' : 'всего'}</p>

      {/* Filters */}
      <div style="display: flex; gap: 8px; margin-bottom: 16px; overflow-x: auto;">
        <For each={filters}>{(f) => (
          <button style={`padding: 6px 16px; border-radius: 20px; font-size: 12px; font-weight: 600; border: none; cursor: pointer; white-space: nowrap; ${
            filter()===f.key ? 'background: linear-gradient(135deg,#6366f1,#8b5cf6); color: #fff;' : 'background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.5);'
          }`} onClick={() => setFilter(f.key)}>{f.label}</button>
        )}</For>
      </div>

      {/* Empty state */}
      <Show when={filtered().length === 0}>
        <div style="background: rgba(255,255,255,0.05); border-radius: 24px; padding: 40px 20px; text-align: center; border: 1px solid rgba(255,255,255,0.08);">
          <span style="font-size: 48px; display: block; margin-bottom: 16px;">📋</span>
          <p style="color: rgba(255,255,255,0.5); font-size: 15px; font-weight: 600; margin: 0;">{isEn() ? 'No orders yet' : 'Заказов пока нет'}</p>
          <p style="color: rgba(255,255,255,0.3); font-size: 13px; margin: 6px 0 0 0;">{isEn() ? 'Your orders will appear here' : 'Твои заказы появятся здесь'}</p>
        </div>
      </Show>

      {/* Orders list */}
      <div style="display: flex; flex-direction: column; gap: 12px;">
        <For each={filtered()}>{(order) => {
          const badge = statusBadge(order.status);
          return (
            <div style={`background: rgba(255,255,255,0.05); border-radius: 20px; padding: 16px; border: 1px solid rgba(255,255,255,0.08); ${order.status==='active'?'border-left: 3px solid #22c55e;':''}`}>
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
                <div style="display: flex; align-items: center; gap: 12px;">
                  <span style="font-size: 28px;">{order.deptIcon}</span>
                  <div>
                    <p style="color: #fff; font-size: 14px; font-weight: 600; margin: 0;">#{order.id}</p>
                    <p style="color: rgba(255,255,255,0.5); font-size: 12px; margin: 2px 0 0 0;">{order.worker}</p>
                  </div>
                </div>
                <span style={`padding: 4px 10px; border-radius: 10px; font-size: 11px; font-weight: 600; background: ${badge.bg}; color: ${badge.color};`}>{badge.label}</span>
              </div>
              <div style="display: flex; align-items: center; gap: 16px; font-size: 12px; color: rgba(255,255,255,0.4); margin-bottom: 12px;">
                <span>📅 {order.date}</span>
                <span>🕐 {order.time}</span>
              </div>
              <div style="display: flex; align-items: center; justify-content: space-between; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.06);">
                <span style="color: rgba(255,255,255,0.4); font-size: 12px;">{isEn() ? 'Total' : 'Итого'}</span>
                <span style="color: #818cf8; font-size: 18px; font-weight: 700;">{order.price.toLocaleString()} ₸</span>
              </div>
            </div>
          );
        }}</For>
      </div>
    </div>
  );
}
