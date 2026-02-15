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

export default function AchievementsPage(props: { onBack: () => void }) {
  const achs = [
    { id: '1', titleKey: 'ach.firstOrder', descKey: 'ach.firstOrderDesc', icon: 'shield' as const, pts: 100, progress: 1, max: 1, unlocked: true, rarity: 'common' },
    { id: '2', titleKey: 'ach.regular', descKey: 'ach.regularDesc', icon: 'repeat' as const, pts: 500, progress: 7, max: 10, unlocked: false, rarity: 'rare' },
    { id: '3', titleKey: 'ach.nightOwl', descKey: 'ach.nightOwlDesc', icon: 'moon' as const, pts: 200, progress: 1, max: 1, unlocked: true, rarity: 'rare' },
    { id: '4', titleKey: 'ach.safetyFirst', descKey: 'ach.safetyFirstDesc', icon: 'alertCircle' as const, pts: 50, progress: 0, max: 1, unlocked: false, rarity: 'common' },
    { id: '5', titleKey: 'ach.vipClient', descKey: 'ach.vipClientDesc', icon: 'award' as const, pts: 1000, progress: 234, max: 500, unlocked: false, rarity: 'epic' },
    { id: '6', titleKey: 'ach.legend', descKey: 'ach.legendDesc', icon: 'trophy' as const, pts: 5000, progress: 12, max: 100, unlocked: false, rarity: 'legendary' },
  ];
  const totalPts = achs.filter(a => a.unlocked).reduce((s, a) => s + a.pts, 0);
  const level = Math.floor(totalPts / 500) + 1;
  const pct = ((totalPts % 500) / 500) * 100;
  const rc: Record<string,string> = { common: 'from-gray-400 to-gray-500', rare: 'from-blue-400 to-blue-600', epic: 'from-purple-500 to-pink-500', legendary: 'from-amber-400 to-orange-500' };
  return (
    <div class="p-4 animate-fade-in pb-8">
      <div class="flex items-center mb-5"><button class="mr-3 p-2 rounded-xl bg-gray-100 touch-scale" onClick={props.onBack}><Icon name="chevronLeft" /></button><h2 class="text-xl font-bold">{t('achievements.title')}</h2></div>
      <div class="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-3xl p-6 text-white text-center mb-5 shadow-xl">
        <div class="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3"><span class="text-3xl font-bold">{level}</span></div>
        <h3 class="text-xl font-bold">{t('achievements.level')} {level}</h3>
        <p class="text-sm opacity-80">{totalPts} {t('achievements.points')}</p>
        <div class="mt-4"><div class="flex justify-between text-xs mb-1"><span>{totalPts % 500} / 500</span></div><div class="h-2 bg-white/20 rounded-full overflow-hidden"><div class="h-full bg-white rounded-full transition-all" style={`width:${pct}%`} /></div></div>
      </div>
      <div class="grid grid-cols-3 gap-3 mb-5">
        <div class="glass rounded-2xl p-3 text-center"><p class="text-2xl font-bold text-indigo-600">{achs.filter(a=>a.unlocked).length}</p><p class="text-xs text-gray-500">{t('achievements.unlocked')}</p></div>
        <div class="glass rounded-2xl p-3 text-center"><p class="text-2xl font-bold text-gray-600">{achs.length - achs.filter(a=>a.unlocked).length}</p><p class="text-xs text-gray-500">{t('achievements.locked')}</p></div>
        <div class="glass rounded-2xl p-3 text-center"><p class="text-2xl font-bold text-slate-600 dark:text-white/90">{totalPts}</p><p class="text-xs text-gray-500">{t('achievements.points')}</p></div>
      </div>
      <div class="space-y-3"><For each={achs}>{(a) => (
        <div class={`glass rounded-2xl p-4 flex items-center gap-4 ${a.unlocked ? '' : 'opacity-60'}`}>
          <div class={`w-14 h-14 rounded-xl bg-gradient-to-br ${rc[a.rarity]} flex items-center justify-center shadow-lg`}><Icon name={a.icon} size="lg" class="text-white" /></div>
          <div class="flex-1">
            <div class="flex items-center gap-2"><p class="font-semibold text-gray-800">{t(a.titleKey)}</p><Show when={a.unlocked}><Icon name="check" size="xs" class="text-emerald-600 dark:text-emerald-400" /></Show></div>
            <p class="text-sm text-gray-500">{t(a.descKey)}</p>
            <Show when={!a.unlocked && a.progress > 0}><div class="mt-2"><div class="h-1.5 bg-gray-200 rounded-full overflow-hidden"><div class="h-full bg-indigo-500 rounded-full" style={`width:${(a.progress/a.max)*100}%`} /></div><p class="text-xs text-gray-400 mt-1">{a.progress}/{a.max}</p></div></Show>
          </div>
          <div class="text-right"><span class={`px-2 py-0.5 text-xs font-semibold rounded-full ${a.unlocked?'bg-green-100 text-green-700':'bg-gray-100 text-gray-500'}`}>+{a.pts}</span><p class="text-[10px] text-gray-400 mt-1 capitalize">{a.rarity}</p></div>
        </div>
      )}</For></div>
    </div>
  );
}

