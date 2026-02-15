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

export default function LanguagePage(props: { onBack: () => void }) {
  const languages = getLanguages();
  const current = () => getCurrentLanguage();
  
  const handleSelect = (code: string) => {
    setLanguage(code as any);
  };

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
        <h1 class="text-xl font-bold text-white">{t('profile.language')}</h1>
      </div>

      {/* Language Grid */}
      <div class="p-4 grid grid-cols-2 gap-3">
        <For each={languages}>
          {(lang, i) => {
            const isSelected = () => currentLang() === lang.code;
            return (
              <button
                class={`glass rounded-2xl p-4 text-left touch-scale animate-slide-up transition-all ${
                  isSelected() ? 'ring-2 ring-indigo-500 bg-indigo-50/50' : ''
                }`}
                style={`animation-delay: ${i() * 0.03}s`}
                onClick={() => handleSelect(lang.code)}
              >
                <div class="flex items-center justify-between mb-2">
                  <span class="text-2xl">{lang.flag}</span>
                  <Show when={isSelected()}>
                    <div class="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                      <Icon name="check" class="text-white w-4 h-4" />
                    </div>
                  </Show>
                </div>
                <p class={`font-semibold ${isSelected() ? 'text-indigo-700' : 'text-gray-800'}`}>
                  {lang.name}
                </p>
                <Show when={lang.rtl}>
                  <span class="text-xs text-gray-400 mt-1 inline-block">RTL</span>
                </Show>
              </button>
            );
          }}
        </For>
      </div>

      {/* Info */}
      <div class="p-4">
        <div class="glass rounded-2xl p-4 flex items-start gap-3">
          <div class="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
            <Icon name="globe" class="text-indigo-600" size="xs" />
          </div>
          <div>
            <p class="text-sm text-gray-600">
              <b>20</b> {t('profile.languageDesc')}
            </p>
            <p class="text-xs text-gray-400 mt-1">
              {t('profile.language')}: {current().name} {current().flag}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

