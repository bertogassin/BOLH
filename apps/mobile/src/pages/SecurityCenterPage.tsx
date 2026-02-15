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

export default function SecurityCenterPage(props: { onBack: () => void }) {
  const [securityScore] = createSignal(72);
  const [pinEnabled, setPinEnabled] = createSignal(false);
  const [biometricEnabled, setBiometricEnabled] = createSignal(false);
  const [twoFAEnabled, setTwoFAEnabled] = createSignal(true);
  const [autoLockMin, setAutoLockMin] = createSignal(5);
  const [showPinSetup, setShowPinSetup] = createSignal(false);
  const [pinDigits, setPinDigits] = createSignal<number[]>([]);
  const [pinStep, setPinStep] = createSignal<'set' | 'confirm'>('set');
  const [firstPin, setFirstPin] = createSignal('');
  const [pinSuccess, setPinSuccess] = createSignal(false);
  const [locationSharing, setLocationSharing] = createSignal(true);
  const [profileVisibility, setProfileVisibility] = createSignal(true);
  const [onlineStatus, setOnlineStatus] = createSignal(true);
  const [readReceipts, setReadReceipts] = createSignal(true);
  const [activityStatus, setActivityStatus] = createSignal(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = createSignal(false);

  const scoreColor = () => {
    const s = securityScore();
    if (s < 40) return { stroke: '#ef4444', gradient: 'from-red-500 to-rose-600' };
    if (s < 70) return { stroke: '#f59e0b', gradient: 'from-amber-500 to-orange-500' };
    return { stroke: '#22c55e', gradient: 'from-emerald-500 to-green-600' };
  };
  const circumference = 2 * Math.PI * 44;
  const strokeDashOffset = () => circumference - (securityScore() / 100) * circumference;
  const [ringOffset, setRingOffset] = createSignal(circumference);
  onMount(() => {
    const t = requestAnimationFrame(() => requestAnimationFrame(() => setRingOffset(strokeDashOffset())));
    return () => cancelAnimationFrame(t);
  });

  const quickActions = () => [
    { id: 'pin', label: 'PIN Lock', icon: 'lock' as const, enabled: pinEnabled(), toggle: () => { if (!pinEnabled()) setShowPinSetup(true); else setPinEnabled(false); }, value: pinEnabled() ? 'ON' : 'OFF' },
    { id: 'bio', label: 'Biometric', icon: 'fingerprint' as const, enabled: biometricEnabled(), toggle: () => setBiometricEnabled(!biometricEnabled()), value: biometricEnabled() ? 'ON' : 'OFF' },
    { id: '2fa', label: '2FA', icon: 'shield' as const, enabled: twoFAEnabled(), toggle: () => setTwoFAEnabled(!twoFAEnabled()), value: twoFAEnabled() ? 'ON' : 'OFF' },
    { id: 'autolock', label: 'Auto-Lock', icon: 'clock' as const, enabled: true, toggle: () => setAutoLockMin(autoLockMin() === 5 ? 15 : autoLockMin() === 15 ? 30 : 5), value: `${autoLockMin()} min` },
  ];

  const addPinDigit = (d: number) => {
    if (pinDigits().length >= 4) return;
    const next = [...pinDigits(), d];
    setPinDigits(next);
    if (pinStep() === 'set' && next.length === 4) {
      setFirstPin(next.join(''));
      setPinDigits([]);
      setPinStep('confirm');
    } else if (pinStep() === 'confirm' && next.length === 4) {
      if (next.join('') === firstPin()) {
        setPinSuccess(true);
        setPinEnabled(true);
        setTimeout(() => { setShowPinSetup(false); setPinStep('set'); setPinDigits([]); setFirstPin(''); setPinSuccess(false); }, 1200);
      } else {
        setPinDigits([]);
      }
    }
  };
  const backspacePin = () => setPinDigits(pinDigits().slice(0, -1));

  const privacyToggles = () => [
    { label: 'Share live location during active orders', key: 'location', value: locationSharing(), set: setLocationSharing },
    { label: 'Show profile to non-clients', key: 'profile', value: profileVisibility(), set: setProfileVisibility },
    { label: "Show when I'm online", key: 'online', value: onlineStatus(), set: setOnlineStatus },
    { label: "Show when I've read messages", key: 'read', value: readReceipts(), set: setReadReceipts },
    { label: 'Show last active time', key: 'activity', value: activityStatus(), set: setActivityStatus },
  ];

  const sessions = () => [
    { id: '1', device: 'Samsung Galaxy A54', current: true, lastActive: null },
    { id: '2', device: 'iPhone 14 Pro', current: false, lastActive: '2h ago' },
    { id: '3', device: 'Chrome Windows', current: false, lastActive: '5h ago' },
  ];

  const activityLog = () => [
    { id: '1', icon: 'globe' as const, title: 'Login from new device', time: '2 hours ago', meta: 'Samsung A54', alert: false },
    { id: '2', icon: 'lock' as const, title: 'Password changed', time: '3 days ago', meta: '', alert: false },
    { id: '3', icon: 'lock' as const, title: 'PIN code updated', time: '1 week ago', meta: '', alert: false },
    { id: '4', icon: 'map' as const, title: 'New session', time: '2 weeks ago', meta: 'Moscow, Russia', alert: false },
    { id: '5', icon: 'alertCircle' as const, title: 'Suspicious login attempt blocked', time: '3 weeks ago', meta: '', alert: true },
  ];

  const emergencyContacts = () => [
    { id: '1', name: 'Maria Ivanova', phone: '+7 777 111-22-33', relationship: 'Spouse' },
    { id: '2', name: 'Emergency Service', phone: '112', relationship: 'Emergency' },
  ];

  const dataCards = () => [
    { id: 'e2e', icon: 'shield' as const, title: 'End-to-end encryption', desc: 'All messages are encrypted', color: 'from-emerald-500 to-green-600' },
    { id: 'docs', icon: 'lock' as const, title: 'Secure document storage', desc: 'Documents encrypted with AES-256', color: 'from-blue-500 to-cyan-500' },
    { id: 'pay', icon: 'creditCard' as const, title: 'Payment protection', desc: 'All payments processed securely', color: 'from-violet-500 to-purple-600' },
    { id: 'backup', icon: 'settings' as const, title: 'Data backup', desc: 'Encrypted cloud backup enabled', color: 'from-amber-500 to-orange-500' },
  ];

  return (
    <div class="min-h-screen animate-fade-in pb-8">
      {/* Header */}
      <div class="p-4">
        <div class="flex items-center gap-4 mb-2">
          <button class="w-10 h-10 rounded-full glass flex items-center justify-center touch-scale" onClick={props.onBack}>
            <Icon name="chevronLeft" class={isDark() ? 'text-white' : 'text-gray-700'} size="sm" />
          </button>
          <h1 class="text-xl font-bold text-gray-800 flex-1">{t('profile.security')}</h1>
        </div>
      </div>

      <Show when={!showPinSetup()}>
        {/* Section 1: Security Score */}
        <div class="px-4 mb-4 animate-slide-up">
          <div class="glass rounded-3xl p-6 overflow-hidden">
            <div class="bg-gradient-to-br from-red-500/10 via-rose-500/10 to-amber-500/10 -m-6 p-6 rounded-3xl">
              <div class="flex flex-col items-center">
                <div class="relative w-32 h-32" style="animation: none">
                  <svg class="w-32 h-32 -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="44" stroke={isDark() ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)'} stroke-width="10" fill="none" />
                    <circle cx="50" cy="50" r="44" stroke={scoreColor().stroke} stroke-width="10" fill="none" stroke-linecap="round"
                      stroke-dasharray={`${circumference}`}
                      stroke-dashoffset={ringOffset()}
                      style={{ transition: 'stroke-dashoffset 0.8s ease-out' }}
                    />
                  </svg>
                  <div class="absolute inset-0 flex flex-col items-center justify-center">
                    <span class="text-3xl font-bold text-gray-800">{securityScore()}</span>
                    <span class="text-sm text-gray-500">/100</span>
                  </div>
                </div>
                <p class="text-sm font-medium text-gray-600 mt-3">Your security score</p>
                <p class="text-xs text-gray-500">Improve your security</p>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Quick Security Actions */}
        <div class="px-4 mb-4 animate-slide-up" style="animation-delay: 0.05s">
          <div class="glass rounded-3xl p-4">
            <p class="text-sm font-semibold text-gray-800 mb-3 px-1">Quick security actions</p>
            <div class="flex gap-3 overflow-x-auto pb-1 -mx-1 scrollbar-hide">
              <For each={quickActions()}>
                {(action, i) => (
                  <button
                    type="button"
                    onClick={() => action.toggle()}
                    class="flex-shrink-0 w-28 glass rounded-2xl p-4 touch-scale flex flex-col items-center gap-2 animate-slide-up relative"
                    style={`animation-delay: ${0.08 + i() * 0.03}s`}
                  >
                    <div class={`w-12 h-12 rounded-xl flex items-center justify-center ${action.enabled ? 'bg-gradient-to-br from-emerald-500 to-green-600' : 'bg-gray-200'}`}>
                      <Icon name={action.icon} class="text-white" size="sm" />
                    </div>
                    <span class="text-xs font-medium text-gray-800">{action.label}</span>
                    <span class="text-[10px] text-gray-500">{action.value}</span>
                    <Show when={action.enabled && (action.id === 'pin' || action.id === 'bio' || action.id === '2fa')}>
                      <Icon name="checkCircle" class="text-emerald-600 dark:text-emerald-400 w-4 h-4 absolute top-2 right-2" />
                    </Show>
                  </button>
                )}
              </For>
            </div>
          </div>
        </div>

        {/* Section 3 is PIN Setup - shown in Show when showPinSetup */}

        {/* Section 4: Privacy Controls */}
        <div class="px-4 mb-4 animate-slide-up" style="animation-delay: 0.1s">
          <div class="glass rounded-3xl overflow-hidden">
            <div class="bg-gradient-to-r from-rose-500/20 to-red-500/20 px-4 py-3">
              <p class="text-sm font-semibold text-gray-800">Privacy controls</p>
            </div>
            <div class="divide-y divide-gray-100">
              <For each={privacyToggles()}>
                {(item, i) => (
                  <div class="flex items-center justify-between px-4 py-3 animate-slide-up" style={`animation-delay: ${0.12 + i() * 0.02}s`}>
                    <span class="text-sm text-gray-800 pr-4">{item.label}</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={item.value}
                      onClick={() => item.set(!item.value)}
                      class={`relative w-12 h-7 rounded-full transition-colors ${item.value ? 'bg-emerald-500' : 'bg-gray-300'}`}
                    >
                      <span class={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${item.value ? 'left-6' : 'left-1'}`} />
                    </button>
                  </div>
                )}
              </For>
            </div>
          </div>
        </div>

        {/* Section 5: Active Sessions */}
        <div class="px-4 mb-4 animate-slide-up" style="animation-delay: 0.15s">
          <div class="glass rounded-3xl overflow-hidden">
            <div class="bg-gradient-to-r from-rose-500/20 to-red-500/20 px-4 py-3">
              <p class="text-sm font-semibold text-gray-800">Active sessions</p>
            </div>
            <div class="p-4 space-y-3">
              <For each={sessions()}>
                {(s) => (
                  <div class="flex items-center justify-between glass rounded-2xl p-3">
                    <div class="flex items-center gap-3">
                      <span class={`w-2.5 h-2.5 rounded-full ${s.current ? 'bg-green-500' : 'bg-gray-400'}`} />
                      <div>
                        <p class="text-sm font-medium text-gray-800">{s.device}</p>
                        <p class="text-xs text-gray-500">{s.current ? 'Current device' : `Last active ${s.lastActive}`}</p>
                      </div>
                    </div>
                    <Show when={!s.current}>
                      <button type="button" class="text-red-500 text-sm font-medium touch-scale">Sign out</button>
                    </Show>
                  </div>
                )}
              </For>
              <button type="button" class="w-full py-2.5 text-center text-red-500 text-sm font-medium touch-scale rounded-xl border border-red-200">
                Sign out all other devices
              </button>
            </div>
          </div>
        </div>

        {/* Section 6: Activity Log */}
        <div class="px-4 mb-4 animate-slide-up" style="animation-delay: 0.18s">
          <div class="glass rounded-3xl overflow-hidden">
            <div class="bg-gradient-to-r from-rose-500/20 to-red-500/20 px-4 py-3">
              <p class="text-sm font-semibold text-gray-800">Activity log</p>
            </div>
            <div class="p-4 space-y-2">
              <For each={activityLog()}>
                {(e, i) => (
                  <div class={`flex items-center gap-3 p-3 rounded-xl animate-slide-up ${e.alert ? 'bg-red-50 border border-red-100' : ''}`} style={`animation-delay: ${0.2 + i() * 0.02}s`}>
                    <div class={`w-9 h-9 rounded-lg flex items-center justify-center ${e.alert ? 'bg-red-100' : 'bg-gray-100'}`}>
                      <Icon name={e.icon} class={e.alert ? 'text-red-600' : 'text-gray-600'} size="sm" />
                    </div>
                    <div class="flex-1 min-w-0">
                      <p class={`text-sm font-medium ${e.alert ? 'text-red-700' : 'text-gray-800'}`}>{e.title}</p>
                      <p class="text-xs text-gray-500">{e.time}{e.meta ? ` • ${e.meta}` : ''}</p>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </div>
        </div>

        {/* Section 7: Emergency Contacts */}
        <div class="px-4 mb-4 animate-slide-up" style="animation-delay: 0.21s">
          <div class="glass rounded-3xl overflow-hidden">
            <div class="bg-gradient-to-r from-rose-500/20 to-red-500/20 px-4 py-3">
              <p class="text-sm font-semibold text-gray-800">Emergency contacts</p>
            </div>
            <p class="px-4 pt-2 text-xs text-gray-500">These contacts will be notified in emergency</p>
            <div class="p-4 space-y-2">
              <For each={emergencyContacts()}>
                {(c) => (
                  <div class="flex items-center justify-between glass rounded-2xl p-3">
                    <div>
                      <p class="text-sm font-medium text-gray-800">{c.name}</p>
                      <p class="text-xs text-gray-500">{c.phone} • {c.relationship}</p>
                    </div>
                    <button type="button" class="text-red-500 p-1 touch-scale"><Icon name="trash" size="xs" /></button>
                  </div>
                )}
              </For>
              <button type="button" class="w-full py-3 rounded-xl border-2 border-dashed border-gray-300 text-gray-500 text-sm font-medium touch-scale flex items-center justify-center gap-2">
                <Icon name="plus" size="sm" /> Add contact
              </button>
            </div>
          </div>
        </div>

        {/* Section 8: Data & Encryption */}
        <div class="px-4 mb-4 animate-slide-up" style="animation-delay: 0.24s">
          <div class="glass rounded-3xl overflow-hidden">
            <div class="bg-gradient-to-r from-rose-500/20 to-red-500/20 px-4 py-3">
              <p class="text-sm font-semibold text-gray-800">Data & encryption</p>
            </div>
            <div class="p-4 grid gap-3">
              <For each={dataCards()}>
                {(card, i) => (
                  <div class={`flex items-center gap-4 glass rounded-2xl p-4 animate-slide-up`} style={`animation-delay: ${0.26 + i() * 0.02}s`}>
                    <div class={`w-12 h-12 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center flex-shrink-0`}>
                      <Icon name={card.icon} class="text-white" size="sm" />
                    </div>
                    <div class="min-w-0">
                      <p class="text-sm font-medium text-gray-800">{card.title}</p>
                      <p class="text-xs text-gray-500">{card.desc}</p>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </div>
        </div>

        {/* Section 9: Danger Zone */}
        <div class="px-4 mb-4 animate-slide-up" style="animation-delay: 0.28s">
          <div class="glass rounded-3xl overflow-hidden border-2 border-red-200/50 bg-red-50/30">
            <div class="bg-gradient-to-r from-red-500/30 to-rose-600/30 px-4 py-3">
              <p class="text-sm font-semibold text-red-800">Danger zone</p>
            </div>
            <div class="p-4 space-y-2">
              <button type="button" class="w-full flex items-center justify-between py-3 px-4 rounded-xl bg-white/80 text-red-600 text-sm font-medium touch-scale">
                <span>Delete all data</span>
                <span class="text-xs opacity-80">Erases local data</span>
              </button>
              <button type="button" class="w-full flex items-center justify-between py-3 px-4 rounded-xl bg-white/80 text-red-600 text-sm font-medium touch-scale" onClick={() => setShowDeleteConfirm(true)}>
                <span>Deactivate account</span>
                <span class="text-xs opacity-80">With confirmation</span>
              </button>
              <button type="button" class="w-full flex items-center justify-between py-3 px-4 rounded-xl bg-white/80 text-red-600 text-sm font-medium touch-scale">
                <span>Export my data</span>
                <span class="text-xs opacity-80">GDPR compliance</span>
              </button>
            </div>
          </div>
        </div>
        <Show when={showDeleteConfirm()}>
          <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setShowDeleteConfirm(false)}>
            <div class="glass rounded-3xl p-6 max-w-sm w-full animate-scale-in" onClick={(e) => e.stopPropagation()}>
              <p class="text-lg font-semibold text-gray-800 mb-2">Deactivate account?</p>
              <p class="text-sm text-gray-500 mb-4">This will disable your account. You can reactivate later by logging in.</p>
              <div class="flex gap-3">
                <button type="button" class="flex-1 py-2.5 rounded-xl bg-gray-200 text-gray-800 font-medium touch-scale" onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
                <button type="button" class="flex-1 py-2.5 rounded-xl bg-red-500 text-white font-medium touch-scale" onClick={() => { setShowDeleteConfirm(false); }}>Deactivate</button>
              </div>
            </div>
          </div>
        </Show>
      </Show>

      {/* PIN Setup overlay */}
      <Show when={showPinSetup()}>
        <div class="fixed inset-0 z-50 flex flex-col bg-gradient-to-br from-rose-600 via-red-500 to-rose-700 animate-fade-in">
          <div class="p-4 flex items-center gap-4">
            <button type="button" class="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center touch-scale" onClick={() => { setShowPinSetup(false); setPinStep('set'); setPinDigits([]); setFirstPin(''); }}>
              <Icon name="chevronLeft" class="text-white" size="sm" />
            </button>
            <h2 class="text-lg font-semibold text-white flex-1">Set your PIN code</h2>
          </div>
          <div class="flex-1 flex flex-col items-center justify-center px-6">
            <Show when={!pinSuccess()}>
              <p class="text-white/90 text-sm mb-6">{pinStep() === 'set' ? 'Enter 4 digits' : 'Confirm your PIN'}</p>
              <div class="flex gap-3 mb-10">
                <For each={[0, 1, 2, 3]}>
                  {(i) => (
                    <div class={`w-4 h-4 rounded-full border-2 transition-colors ${pinDigits().length > i ? 'bg-white border-white' : 'border-white/60'}`} />
                  )}
                </For>
              </div>
              <div class="grid grid-cols-3 gap-4 w-64">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((n) => (
                  <button type="button" class="w-14 h-14 rounded-2xl bg-white/20 text-white text-xl font-medium touch-scale flex items-center justify-center" onClick={() => addPinDigit(n)}>
                    {n}
                  </button>
                ))}
                <button type="button" class="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center touch-scale" onClick={backspacePin}>
                  <Icon name="chevronLeft" class="text-white rotate-180 w-6 h-6" />
                </button>
                <button type="button" class="w-14 h-14 rounded-2xl bg-white/30 flex items-center justify-center touch-scale col-span-2" onClick={() => pinStep() === 'confirm' && pinDigits().length === 4 && (pinDigits().join('') === firstPin() ? (setPinSuccess(true), setPinEnabled(true), setTimeout(() => { setShowPinSetup(false); setPinStep('set'); setPinDigits([]); setFirstPin(''); setPinSuccess(false); }, 1200)) : setPinDigits([]))}>
                  <Icon name="check" class="text-white w-6 h-6" />
                </button>
              </div>
            </Show>
            <Show when={pinSuccess()}>
              <div class="flex flex-col items-center gap-4">
                <div class="w-20 h-20 rounded-full bg-white/30 flex items-center justify-center animate-scale-in">
                  <Icon name="checkCircle" class="text-white w-12 h-12" />
                </div>
                <p class="text-white text-lg font-semibold">PIN set successfully</p>
              </div>
            </Show>
          </div>
        </div>
      </Show>
    </div>
  );
}

