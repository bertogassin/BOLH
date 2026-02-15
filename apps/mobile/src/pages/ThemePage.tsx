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

export default function ThemePage(props: { onBack: () => void }) {
  const themes = [
    { id: 'light' as const, nameKey: 'theme.light', descKey: 'theme.lightDesc', icon: 'sun' },
    { id: 'dark' as const, nameKey: 'theme.dark', descKey: 'theme.darkDesc', icon: 'moon' },
    { id: 'system' as const, nameKey: 'theme.system', descKey: 'theme.systemDesc', icon: 'settings' },
  ];

  return (
    <div class="min-h-screen animate-fade-in">
      {/* Header */}
      <div class="p-4 flex items-center gap-4">
        <button 
          class="w-10 h-10 rounded-full glass flex items-center justify-center touch-scale"
          onClick={props.onBack}
        >
          <Icon name="chevronLeft" class="text-gray-700" size="sm" />
        </button>
        <h1 class="text-xl font-bold text-white">{t('theme.title')}</h1>
      </div>

      {/* Theme Options */}
      <div class="p-4 space-y-3">
        <For each={themes}>
          {(th) => {
            const isSelected = () => theme() === th.id;
            return (
              <button
                class={`w-full glass rounded-2xl p-5 text-left touch-scale animate-slide-up transition-all ${
                  isSelected() ? 'ring-2 ring-indigo-500' : ''
                }`}
                onClick={() => setTheme(th.id)}
              >
                <div class="flex items-center gap-4">
                  <div class={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                    th.id === 'light' ? 'bg-gradient-to-br from-amber-400 to-orange-500' :
                    th.id === 'dark' ? 'bg-gradient-to-br from-indigo-600 to-purple-700' :
                    'bg-gradient-to-br from-gray-400 to-gray-600'
                  }`}>
                    <Icon name={th.icon as any} class="text-white" size="lg" />
                  </div>
                  
                  <div class="flex-1">
                    <p class="font-semibold text-gray-800 text-lg">{t(th.nameKey)}</p>
                    <p class="text-sm text-gray-500">{t(th.descKey)}</p>
                  </div>
                  
                  <Show when={isSelected()}>
                    <div class="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                      <Icon name="check" class="text-white w-5 h-5" />
                    </div>
                  </Show>
                </div>
              </button>
            );
          }}
        </For>
      </div>

      {/* Preview */}
      <div class="p-4">
        <p class="text-sm text-white/90 font-medium mb-3">{t('theme.preview')}</p>
        <div class="glass rounded-3xl p-5">
          <div class="flex items-center gap-4 mb-4">
            <div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <Icon name="shield" class="text-white" size="sm" />
            </div>
            <div>
              <p class="font-semibold text-gray-800">{t('theme.sampleCard')}</p>
              <p class="text-sm text-gray-500">{t('theme.interfaceLook')}</p>
            </div>
          </div>
          <div class="flex gap-2">
            <button class="flex-1 py-2 bg-gray-100 rounded-xl text-gray-700 text-sm font-medium">
              {t('theme.cancel')}
            </button>
            <button class="flex-1 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl text-white text-sm font-medium">
              {t('theme.confirm')}
            </button>
          </div>
        </div>
      </div>

      {/* Auto info */}
      <div class="p-4">
        <div class="glass rounded-2xl p-4 border border-indigo-200/50 bg-indigo-50/30">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
              <Icon name="zap" class="text-indigo-600" size="sm" />
            </div>
            <div>
              <p class="font-medium text-gray-800">{t('theme.activeTheme')}</p>
              <p class="text-sm text-gray-500">
                {activeTheme() === 'dark' ? `🌙 ${t('theme.dark')}` : `☀️ ${t('theme.light')}`}
                {theme() === 'system' && ` ${t('theme.auto')}`}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============== Contracts & Payments ==============

interface ContractType {
  id: string;
  name: string;
  nameRu: string;
  icon: string;
  descriptionKey: string;
  durationKey: string;
  escrow: boolean;
  fee: number;
  color: string;
}
