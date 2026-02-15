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

export default function ReorderPage(props: { onNavigate: (page: string) => void }) {
  // Mock order history — departments the user has ordered before
  const orderHistory = [
    { deptId: 'plumbing', lastDate: '12 фев 2026', count: 3 },
    { deptId: 'electrical', lastDate: '8 фев 2026', count: 1 },
    { deptId: 'cleaning', lastDate: '1 фев 2026', count: 5 },
    { deptId: 'locks', lastDate: '20 янв 2026', count: 2 },
  ];

  const historyDepts = () => orderHistory
    .map(h => {
      const dept = getDepartment(h.deptId);
      return dept ? { ...h, dept } : null;
    })
    .filter(Boolean) as { deptId: string; lastDate: string; count: number; dept: Department }[];

  const isEn = () => currentLang() === 'en';

  return (
    <div class="p-4 animate-fade-in">
      <h1 class="text-xl font-bold text-white mb-1">
        {isEn() ? 'Quick Reorder' : 'Быстрый повтор'}
      </h1>
      <p class="text-white/60 text-sm mb-5">
        {isEn() ? 'Tap a service to order again' : 'Нажми на услугу чтобы заказать снова'}
      </p>

      <Show when={historyDepts().length > 0} fallback={
        <div class="glass rounded-3xl p-8 text-center">
          <Icon name="inbox" class="text-white/30 mx-auto mb-3" size="xl" />
          <p class="text-white/50 text-sm">{isEn() ? 'No orders yet' : 'Пока нет заказов'}</p>
          <p class="text-white/30 text-xs mt-1">{isEn() ? 'Your order history will appear here' : 'История заказов появится здесь'}</p>
        </div>
      }>
        <div class="space-y-3">
          <For each={historyDepts()}>
            {(item) => (
              <button
                class="w-full glass rounded-2xl p-4 flex items-center gap-4 touch-scale text-left transition-all"
                onClick={() => {
                  setActiveDepartment(item.deptId);
                  props.onNavigate('department');
                }}
              >
                <div class={`w-14 h-14 rounded-2xl bg-gradient-to-br ${item.dept.color} flex items-center justify-center shadow-lg shrink-0`}>
                  <SkillIcon icon={item.dept.icon} class="text-white" size="lg" />
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-white font-semibold text-sm">
                    {isEn() ? item.dept.nameEn : item.dept.name}
                  </p>
                  <p class="text-white/50 text-xs mt-0.5">
                    {isEn() ? 'Last:' : 'Последний:'} {item.lastDate} • {item.count}x
                  </p>
                </div>
                <div class="flex flex-col items-end gap-1 shrink-0">
                  <div class="px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-xs font-bold shadow">
                    {isEn() ? 'Order' : 'Заказать'}
                  </div>
                </div>
              </button>
            )}
          </For>
        </div>
      </Show>

      {/* Suggestion to try new departments */}
      <div class="mt-6">
        <p class="text-white/40 text-xs font-medium uppercase tracking-wider mb-3">
          {isEn() ? 'Try something new' : 'Попробуй новое'}
        </p>
        <div class="flex gap-2 overflow-x-auto pb-2">
          <For each={departments.filter(d => !orderHistory.some(h => h.deptId === d.id)).slice(0, 5)}>
            {(dept) => (
              <button
                class="flex flex-col items-center gap-1.5 px-3 py-2 rounded-xl touch-scale shrink-0"
                style="background: rgba(255,255,255,0.06)"
                onClick={() => {
                  setActiveDepartment(dept.id);
                  props.onNavigate('department');
                }}
              >
                <div class={`w-10 h-10 rounded-xl bg-gradient-to-br ${dept.color} flex items-center justify-center shadow`}>
                  <SkillIcon icon={dept.icon} class="text-white" size="sm" />
                </div>
                <span class="text-white/50 text-[10px] font-medium">{isEn() ? dept.nameEn : dept.name}</span>
              </button>
            )}
          </For>
        </div>
      </div>
    </div>
  );
}

