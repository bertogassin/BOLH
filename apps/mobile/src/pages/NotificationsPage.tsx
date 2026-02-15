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
import { syncNotifications, connectNotificationWs, disconnectNotificationWs } from '../notifications';

const MOCK_NOTIFICATIONS: { id: number; type: NotifType; icon: keyof typeof Icons; title: string; desc: string; timeAgo: string; timeUnit: 'min' | 'hour' | 'day'; unread: boolean }[] = [
  { id: 1, type: 'accepted', icon: 'checkCircle', title: 'Order accepted', desc: 'Worker Alexey K. accepted your order', timeAgo: '5', timeUnit: 'min', unread: true },
  { id: 2, type: 'info', icon: 'location', title: 'Worker on the way', desc: 'Arriving in ~10 min', timeAgo: '12', timeUnit: 'min', unread: true },
  { id: 3, type: 'accepted', icon: 'checkCircle', title: 'Work completed', desc: 'Please rate the service', timeAgo: '1', timeUnit: 'hour', unread: false },
  { id: 4, type: 'info', icon: 'dollarSign', title: 'New offer', desc: 'You have a new price offer', timeAgo: '2', timeUnit: 'hour', unread: true },
  { id: 5, type: 'accepted', icon: 'creditCard', title: 'Payment processed', desc: '15,000 ₸ charged', timeAgo: '3', timeUnit: 'hour', unread: false },
  { id: 6, type: 'accepted', icon: 'userCheck', title: 'Diploma verified', desc: 'Your certificate has been approved', timeAgo: '1', timeUnit: 'day', unread: false },
  { id: 7, type: 'accepted', icon: 'award', title: 'Academy achievement', desc: 'You completed Fire Safety module!', timeAgo: '1', timeUnit: 'day', unread: false },
  { id: 8, type: 'info', icon: 'alertCircle', title: 'System update', desc: 'New features available', timeAgo: '2', timeUnit: 'day', unread: false },
];

export default function NotificationsPage(props: { onBack: () => void }) {
  // ── Merge mock data + live toast history ──
  const NOTIF_READ_KEY = 'bolh_notif_read_v1';
  const readIds = (() => { try { return new Set(JSON.parse(localStorage.getItem(NOTIF_READ_KEY) || '[]')); } catch { return new Set(); } })();
  
  // Combine MOCK_NOTIFICATIONS with toastHistory from push system
  const allNotifs = () => {
    const mockMapped = MOCK_NOTIFICATIONS.map(n => ({
      id: `mock_${n.id}`,
      title: n.title,
      desc: n.desc,
      icon: n.icon,
      type: n.type as string,
      emoji: n.type === 'accepted' ? '✅' : n.type === 'warning' ? '⚠️' : n.type === 'urgent' ? '🔴' : 'ℹ️',
      timeAgo: n.timeAgo,
      timeUnit: n.timeUnit,
      unread: !readIds.has(n.id),
      timestamp: Date.now() - (n.timeUnit === 'min' ? parseInt(n.timeAgo) * 60000 : n.timeUnit === 'hour' ? parseInt(n.timeAgo) * 3600000 : parseInt(n.timeAgo) * 86400000),
    }));
    const liveMapped = toastHistory().map(th => ({
      id: th.id,
      title: th.title,
      desc: th.body,
      icon: '',
      type: th.type,
      emoji: th.icon || 'ℹ️',
      timeAgo: '',
      timeUnit: '' as any,
      unread: !th.read,
      timestamp: th.timestamp,
    }));
    return [...liveMapped, ...mockMapped].sort((a, b) => b.timestamp - a.timestamp);
  };

  const [filter, setFilter] = createSignal<'all' | 'unread'>('all');
  const [pushEnabled, setPushEnabled] = createSignal(Notification?.permission === 'granted');
  const [showSettings, setShowSettings] = createSignal(false);
  const [notifPrefs, setNotifPrefs] = createSignal<Record<string, boolean>>(
    (() => { try { return JSON.parse(localStorage.getItem('bolh_notif_prefs') || '{}'); } catch { return {}; } })()
  );

  const filtered = () => {
    const items = allNotifs();
    if (filter() === 'unread') return items.filter(n => n.unread);
    return items;
  };

  const unreadTotal = () => allNotifs().filter(n => n.unread).length;

  // Sync notifications from backend on mount
  onMount(() => {
    syncNotifications();
    connectNotificationWs();
  });

  onCleanup(() => {
    disconnectNotificationWs();
  });

  const markAllRead = () => {
    const ids = MOCK_NOTIFICATIONS.map(n => n.id);
    try { localStorage.setItem(NOTIF_READ_KEY, JSON.stringify(ids)); } catch {}
    import('../notifications').then(m => m.markAllToastsRead());
    readIds.clear();
    ids.forEach(id => readIds.add(id));
  };

  const togglePush = async () => {
    if (!pushEnabled()) {
      const granted = await requestNotificationPermission();
      setPushEnabled(granted);
    }
  };

  const togglePref = (key: string) => {
    setNotifPrefs(prev => {
      const next = { ...prev, [key]: !prev[key] };
      try { localStorage.setItem('bolh_notif_prefs', JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const typeColors: Record<string, string> = {
    accepted: '#22c55e', success: '#22c55e', info: '#3b82f6',
    warning: '#f59e0b', urgent: '#ef4444', error: '#ef4444',
    order: '#6366f1', message: '#8b5cf6', promo: '#ec4899',
  };

  const formatTimestamp = (ts: number) => {
    const diff = Date.now() - ts;
    if (diff < 60000) return t('notifications.minAgo').replace('{n}', '1') || 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} ${t('notifications.minAgo') || 'min ago'}`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} ${t('notifications.hourAgo') || 'h ago'}`;
    return t('notifications.yesterday') || 'yesterday';
  };

  const prefItems = [
    { key: 'orders', emoji: '📦', label: 'Orders' },
    { key: 'messages', emoji: '💬', label: 'Messages' },
    { key: 'promotions', emoji: '🎁', label: 'Promotions' },
    { key: 'reviews', emoji: '⭐', label: 'Reviews' },
    { key: 'system', emoji: 'ℹ️', label: 'System updates' },
  ];

  return (
    <div style={`min-height: 100vh; ${isDark() ? 'background: #0a0a0f;' : 'background: #f8f9fa;'}`}>
      {/* ── Header ── */}
      <div style={`display: flex; align-items: center; justify-content: space-between; padding: 16px; padding-top: max(16px, env(safe-area-inset-top)); ${isDark() ? 'background: rgba(0,0,0,0.95);' : 'background: rgba(255,255,255,0.95);'} backdrop-filter: blur(20px); border-bottom: 1px solid ${isDark() ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06);'}`}>
        <div style="display: flex; align-items: center; gap: 12px;">
          <button onClick={props.onBack} style={`width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: ${isDark() ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)'}; border: none; cursor: pointer;`}>
            <span style={`font-size: 18px; color: ${isDark() ? '#fff' : '#333'};`}>←</span>
          </button>
          <div>
            <h1 style={`font-size: 20px; font-weight: 800; color: ${isDark() ? '#fff' : '#111'}; margin: 0;`}>{t('notifications.title')}</h1>
            <Show when={unreadTotal() > 0}>
              <p style="font-size: 12px; color: #6366f1; margin: 2px 0 0 0; font-weight: 600;">{unreadTotal()} unread</p>
            </Show>
          </div>
        </div>
        <div style="display: flex; gap: 8px;">
          <button onClick={() => setShowSettings(!showSettings())} style={`width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; background: ${isDark() ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)'}; border: none; cursor: pointer; font-size: 16px;`}>⚙️</button>
          <button onClick={markAllRead} style="padding: 8px 14px; border-radius: 10px; background: #6366f120; border: none; cursor: pointer; color: #6366f1; font-size: 13px; font-weight: 600;">{t('notifications.markRead')}</button>
        </div>
      </div>

      {/* ── Settings Panel ── */}
      <Show when={showSettings()}>
        <div style={`margin: 12px; padding: 16px; border-radius: 16px; ${isDark() ? 'background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08);' : 'background: #fff; border: 1px solid #eee; box-shadow: 0 2px 8px rgba(0,0,0,0.06);'}`}>
          <p style={`font-size: 14px; font-weight: 700; margin: 0 0 12px; color: ${isDark() ? '#fff' : '#111'};`}>🔔 Notification Settings</p>
          
          {/* Push toggle */}
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; padding-bottom: 14px; border-bottom: 1px solid rgba(128,128,128,0.15);">
            <div>
              <p style={`font-size: 13px; font-weight: 600; margin: 0; color: ${isDark() ? '#fff' : '#111'};`}>Browser Push</p>
              <p style="font-size: 11px; color: #888; margin: 2px 0 0 0;">Get notified even when app is minimized</p>
            </div>
            <button onClick={togglePush} style={`width: 48px; height: 26px; border-radius: 13px; border: none; cursor: pointer; position: relative; transition: background 0.3s; ${pushEnabled() ? 'background: #22c55e;' : 'background: #666;'}`}>
              <div style={`width: 22px; height: 22px; border-radius: 11px; background: #fff; position: absolute; top: 2px; transition: left 0.3s; box-shadow: 0 1px 3px rgba(0,0,0,0.2); ${pushEnabled() ? 'left: 24px;' : 'left: 2px;'}`} />
            </button>
          </div>

          {/* Category toggles */}
          <For each={prefItems}>
            {(item) => (
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
                <div style="display: flex; align-items: center; gap: 10px;">
                  <span style="font-size: 16px;">{item.emoji}</span>
                  <p style={`font-size: 13px; margin: 0; color: ${isDark() ? '#ddd' : '#333'};`}>{item.label}</p>
                </div>
                <button onClick={() => togglePref(item.key)} style={`width: 42px; height: 24px; border-radius: 12px; border: none; cursor: pointer; position: relative; transition: background 0.3s; ${notifPrefs()[item.key] === false ? 'background: #666;' : 'background: #6366f1;'}`}>
                  <div style={`width: 20px; height: 20px; border-radius: 10px; background: #fff; position: absolute; top: 2px; transition: left 0.3s; box-shadow: 0 1px 3px rgba(0,0,0,0.2); ${notifPrefs()[item.key] === false ? 'left: 2px;' : 'left: 20px;'}`} />
                </button>
              </div>
            )}
          </For>
        </div>
      </Show>

      {/* ── Filter tabs ── */}
      <div style="display: flex; gap: 8px; padding: 12px 16px;">
        <button onClick={() => setFilter('all')} style={`padding: 8px 18px; border-radius: 20px; border: none; cursor: pointer; font-size: 13px; font-weight: 600; transition: all 0.2s; ${filter() === 'all' ? 'background: #6366f1; color: #fff;' : `background: ${isDark() ? 'rgba(255,255,255,0.08)' : '#e8e8e8'}; color: ${isDark() ? '#ccc' : '#666'};`}`}>
          All ({allNotifs().length})
        </button>
        <button onClick={() => setFilter('unread')} style={`padding: 8px 18px; border-radius: 20px; border: none; cursor: pointer; font-size: 13px; font-weight: 600; transition: all 0.2s; ${filter() === 'unread' ? 'background: #6366f1; color: #fff;' : `background: ${isDark() ? 'rgba(255,255,255,0.08)' : '#e8e8e8'}; color: ${isDark() ? '#ccc' : '#666'};`}`}>
          Unread ({unreadTotal()})
        </button>
      </div>

      {/* ── Notification List ── */}
      <div style="padding: 0 12px 100px;">
        <Show when={filtered().length > 0} fallback={
          <div style="text-align: center; padding: 60px 20px;">
            <div style="font-size: 64px; margin-bottom: 16px;">🔔</div>
            <p style={`font-size: 16px; font-weight: 600; color: ${isDark() ? '#fff' : '#333'};`}>{filter() === 'unread' ? 'All caught up!' : t('notifications.empty')}</p>
            <p style="font-size: 13px; color: #888; margin-top: 6px;">{filter() === 'unread' ? 'No unread notifications' : 'Notifications will appear here'}</p>
          </div>
        }>
          <For each={filtered()}>
            {(n) => {
              const c = typeColors[n.type] || '#6366f1';
              return (
                <div style={`display: flex; gap: 12px; padding: 14px; margin-bottom: 8px; border-radius: 16px; cursor: pointer; transition: all 0.2s; border-left: 4px solid ${n.unread ? c : 'transparent'}; ${isDark() ? `background: ${n.unread ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.02)'}; border: 1px solid rgba(255,255,255,0.06);` : `background: ${n.unread ? '#fff' : '#fafafa'}; border: 1px solid ${n.unread ? '#eee' : '#f0f0f0'}; box-shadow: ${n.unread ? '0 2px 8px rgba(0,0,0,0.06)' : 'none'};`}`}>
                  <div style={`width: 42px; height: 42px; border-radius: 12px; background: ${c}15; display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0;`}>
                    {n.emoji || '📌'}
                  </div>
                  <div style="flex: 1; min-width: 0;">
                    <div style="display: flex; align-items: start; justify-content: space-between; gap: 8px;">
                      <p style={`font-size: 14px; font-weight: ${n.unread ? '700' : '500'}; margin: 0; color: ${isDark() ? '#fff' : '#111'}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;`}>{n.title}</p>
                      <Show when={n.unread}>
                        <div style={`width: 8px; height: 8px; border-radius: 50%; background: ${c}; flex-shrink: 0; margin-top: 6px;`} />
                      </Show>
                    </div>
                    <p style={`font-size: 12px; margin: 3px 0 0; color: ${isDark() ? 'rgba(255,255,255,0.5)' : '#666'}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;`}>{n.desc}</p>
                    <p style="font-size: 11px; color: #999; margin: 6px 0 0 0;">{formatTimestamp(n.timestamp)}</p>
                  </div>
                </div>
              );
            }}
          </For>
        </Show>
      </div>
    </div>
  );
}

