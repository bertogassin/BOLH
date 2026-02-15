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

export default function AnalyticsPage(props: { onBack: () => void }) {
  const stats = { totalEarnings: 450000, thisMonth: 125000, completed: 45, rating: 4.8, reviews: 127, completionRate: 98, onTimeRate: 97 };
  const weekly = [{day:'Mon',amt:16000},{day:'Tue',amt:24000},{day:'Wed',amt:8000},{day:'Thu',amt:32000},{day:'Fri',amt:28000},{day:'Sat',amt:12000},{day:'Sun',amt:5000}];
  const maxE = Math.max(...weekly.map(d=>d.amt));
  const recent = [{svc:'Bodyguard',earn:16000,date:'2026-02-06',r:5},{svc:'Event Security',earn:48000,date:'2026-02-05',r:5},{svc:'Patrol',earn:9000,date:'2026-02-04',r:4}];
  return (
    <div class="p-4 animate-fade-in pb-8">
      <div class="flex items-center mb-5"><button class="mr-3 p-2 rounded-xl bg-gray-100 touch-scale" onClick={props.onBack}><Icon name="chevronLeft" /></button><h2 class="text-xl font-bold">{t('analytics.title')}</h2></div>
      <div class="bg-gradient-to-br from-green-500 to-emerald-600 rounded-3xl p-6 text-white text-center mb-5 shadow-xl">
        <p class="text-sm opacity-80">{t('analytics.totalEarnings')}</p><p class="text-3xl font-bold">{stats.totalEarnings.toLocaleString()} ₸</p><p class="text-sm opacity-80 mt-1">+{stats.thisMonth.toLocaleString()} ₸ {t('analytics.thisMonth')}</p>
      </div>
      <div class="grid grid-cols-2 gap-3 mb-5">
        <div class="glass rounded-2xl p-4 text-center"><Icon name="shield" class="text-slate-500 dark:text-gray-200 mx-auto mb-2" /><p class="text-2xl font-bold">{stats.completed}</p><p class="text-xs text-gray-500">{t('analytics.completedOrders')}</p></div>
        <div class="glass rounded-2xl p-4 text-center"><Icon name="star" class="text-amber-500 mx-auto mb-2" /><p class="text-2xl font-bold">{stats.rating}</p><p class="text-xs text-gray-500">{stats.reviews} {t('analytics.reviews')}</p></div>
        <div class="glass rounded-2xl p-4 text-center"><Icon name="check" class="text-emerald-600 dark:text-emerald-400 mx-auto mb-2" /><p class="text-2xl font-bold">{stats.completionRate}%</p><p class="text-xs text-gray-500">{t('analytics.completionRate')}</p></div>
        <div class="glass rounded-2xl p-4 text-center"><Icon name="clock" class="text-slate-500 dark:text-gray-200 mx-auto mb-2" /><p class="text-2xl font-bold">{stats.onTimeRate}%</p><p class="text-xs text-gray-500">{t('analytics.onTimeRate')}</p></div>
      </div>
      <div class="glass rounded-2xl p-4 mb-5">
        <p class="font-semibold text-gray-800 mb-3">{t('analytics.thisWeek')}</p>
        <div class="flex items-end justify-between h-28 gap-2"><For each={weekly}>{(d)=>(<div class="flex-1 flex flex-col items-center"><div class="w-full bg-gradient-to-t from-indigo-500 to-purple-500 rounded-t" style={`height:${(d.amt/maxE)*100}%;min-height:4px`}/><p class="text-[10px] text-gray-500 mt-1.5">{d.day}</p></div>)}</For></div>
        <p class="text-center text-sm text-gray-500 mt-3">{t('analytics.weeklyTotal')}: {weekly.reduce((s,d)=>s+d.amt,0).toLocaleString()} ₸</p>
      </div>
      <div class="glass rounded-2xl overflow-hidden">
        <p class="px-4 py-3 font-semibold text-gray-800">{t('analytics.recentOrders')}</p>
        <For each={recent}>{(o)=>(<div class="flex items-center justify-between px-4 py-3 border-t border-gray-100"><div><p class="font-medium text-gray-800">{o.svc}</p><p class="text-xs text-gray-500">{o.date}</p></div><div class="text-right"><p class="font-semibold text-emerald-600 dark:text-emerald-400">+{o.earn.toLocaleString()} ₸</p><div class="flex items-center gap-1 justify-end"><Icon name="star" size="xs" class="text-amber-400"/><span class="text-xs text-gray-500">{o.r}</span></div></div></div>)}</For>
      </div>
    </div>
  );
}

