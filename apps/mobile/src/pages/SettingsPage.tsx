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

export default function SettingsPage(props: { onBack: () => void }) {
  const [showResetConfirm, setShowResetConfirm] = createSignal(false);

  const volPercent = () => Math.round(globalVolume() * 100);

  const settingSections = () => [
    {
      title: t('settings.soundHaptics'),
      icon: '🔊',
      items: [
        {
          id: 'sounds',
          icon: 'volume2' as const,
          label: t('settings.sounds'),
          desc: t('settings.soundsDesc'),
          type: 'toggle' as const,
          value: globalSoundEnabled(),
          onChange: () => { playGlobalSound('toggle'); setGlobalSoundEnabled(!globalSoundEnabled()); }
        },
        {
          id: 'haptics',
          icon: 'activity' as const,
          label: t('settings.haptics'),
          desc: t('settings.hapticsDesc'),
          type: 'toggle' as const,
          value: globalHapticEnabled(),
          onChange: () => { haptic('medium'); setGlobalHapticEnabled(!globalHapticEnabled()); }
        },
        {
          id: 'notifSound',
          icon: 'bell' as const,
          label: t('settings.notifSound'),
          desc: t('settings.notifSoundDesc'),
          type: 'toggle' as const,
          value: globalNotifSound(),
          onChange: () => { playGlobalSound('notify'); setGlobalNotifSound(!globalNotifSound()); }
        },
        {
          id: 'volume',
          icon: 'volume2' as const,
          label: t('settings.volume'),
          desc: volPercent() + '%',
          type: 'slider' as const,
          value: globalVolume(),
          onChange: (v: number) => { setGlobalVolume(v); }
        },
      ]
    },
    {
      title: t('settings.display'),
      icon: '🎨',
      items: [
        {
          id: 'theme',
          icon: isDark() ? 'moon' : 'sun',
          label: t('settings.themeMode'),
          desc: isDark() ? t('settings.dark') : t('settings.light'),
          type: 'action' as const,
          action: () => { playGlobalSound('toggle'); setTheme(isDark() ? 'light' : 'dark'); }
        },
        {
          id: 'language',
          icon: 'globe' as const,
          label: t('settings.language'),
          desc: getCurrentLanguage().name + ' ' + getCurrentLanguage().flag,
          type: 'action' as const,
          action: () => props.onBack()
        },
      ]
    },
    {
      title: t('settings.notifications'),
      icon: '🔔',
      items: [
        {
          id: 'pushNotif',
          icon: 'bell' as const,
          label: t('settings.pushNotif'),
          desc: t('settings.pushNotifDesc'),
          type: 'toggle' as const,
          value: true,
          onChange: () => { playGlobalSound('toggle'); }
        },
        {
          id: 'orderAlerts',
          icon: 'zap' as const,
          label: t('settings.orderAlerts'),
          desc: t('settings.orderAlertsDesc'),
          type: 'toggle' as const,
          value: true,
          onChange: () => { playGlobalSound('toggle'); }
        },
        {
          id: 'rareEscalation',
          icon: 'zap' as const,
          label: currentLang() === 'en' ? 'Rare order alert' : 'Усиленная вибрация',
          desc: currentLang() === 'en' ? 'Stronger vibration for rare orders' : 'Сильнее вибрировать при редких заказах',
          type: 'toggle' as const,
          value: rareEscalationEnabled(),
          onChange: () => {
            const next = !rareEscalationEnabled();
            setRareEscalationEnabled(next);
            localStorage.setItem('bolh_rare_escalation', String(next));
            hapticOrder(next ? 'rare' : 'normal');
          }
        },
        {
          id: 'vibIntensity',
          icon: 'activity' as const,
          label: currentLang() === 'en' ? 'Vibration intensity' : 'Сила вибрации',
          desc: Math.round(vibrationIntensity() * 100) + '%',
          type: 'slider' as const,
          value: vibrationIntensity(),
          onChange: (v: number) => {
            const clamped = Math.max(0.3, Math.min(3.0, v * 3));
            setVibrationIntensity(clamped);
            localStorage.setItem('bolh_vib_intensity', String(clamped));
          }
        },
        {
          id: 'testVibration',
          icon: 'zap' as const,
          label: currentLang() === 'en' ? 'Test vibration' : 'Тест вибрации',
          desc: currentLang() === 'en' ? 'Feel the rare order pattern' : 'Почувствуй паттерн редкого заказа',
          type: 'action' as const,
          action: () => hapticOrder('rare')
        },
        {
          id: 'chatNotif',
          icon: 'message' as const,
          label: t('settings.chatNotif'),
          desc: t('settings.chatNotifDesc'),
          type: 'toggle' as const,
          value: true,
          onChange: () => { playGlobalSound('toggle'); }
        },
      ]
    },
    {
      title: t('settings.dataStorage'),
      icon: '💾',
      items: [
        {
          id: 'autoDownload',
          icon: 'download' as const,
          label: t('settings.autoDownload'),
          desc: t('settings.autoDownloadDesc'),
          type: 'toggle' as const,
          value: false,
          onChange: () => { playGlobalSound('toggle'); }
        },
        {
          id: 'cache',
          icon: 'trash' as const,
          label: t('settings.clearCache'),
          desc: '24.3 MB',
          type: 'action' as const,
          action: () => { playGlobalSound('delete'); }
        },
      ]
    }
  ];

  return (
    <div class="min-h-screen animate-fade-in">
      {/* Header */}
      <div class="glass sticky top-0 z-50 px-4 py-3 flex items-center gap-3">
        <button class="w-10 h-10 rounded-2xl glass flex items-center justify-center touch-press"
          onClick={() => { playGlobalSound('swoosh'); props.onBack(); }}>
          <Icon name="chevronLeft" class="text-gray-700" size="sm" />
        </button>
        <div class="flex-1">
          <h1 class="text-lg font-bold text-gray-800">{t('settings.title')}</h1>
          <p class="text-xs text-gray-500">{t('settings.subtitle')}</p>
        </div>
        <button class="w-10 h-10 rounded-2xl glass flex items-center justify-center touch-press"
          onClick={() => { playGlobalSound('tap'); setShowResetConfirm(true); }}>
          <Icon name="repeat" class="text-gray-500" size="sm" />
        </button>
      </div>

      <div class="p-4 space-y-4">
        {/* Sound preview card */}
        <div class="glass rounded-3xl p-5 animate-slide-up">
          <div class="flex items-center gap-3 mb-4">
            <div class="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg">
              <Icon name="volume2" size="lg" class="text-indigo-500" />
            </div>
            <div class="flex-1">
              <p class="font-bold text-gray-800">{t('settings.soundPreview')}</p>
              <p class="text-xs text-gray-500">{t('settings.soundPreviewDesc')}</p>
            </div>
          </div>
          <div class="grid grid-cols-4 gap-2">
            {(['tap', 'success', 'error', 'notify'] as const).map(snd => (
              <button
                class="py-3 rounded-2xl glass text-center touch-press"
                onClick={() => { playGlobalSound(snd); haptic('light'); }}
              >
                <span class="text-xl block mb-1">
                  {snd === 'tap' ? '👆' : snd === 'success' ? '✅' : snd === 'error' ? '❌' : '🔔'}
                </span>
                <span class="text-[10px] font-medium text-gray-600 capitalize">{snd}</span>
              </button>
            ))}
          </div>
          <div class="grid grid-cols-4 gap-2 mt-2">
            {(['send', 'receive', 'delete', 'levelup'] as const).map(snd => (
              <button
                class="py-3 rounded-2xl glass text-center touch-press"
                onClick={() => { playGlobalSound(snd); haptic('light'); }}
              >
                <span class="text-xl block mb-1">
                  {snd === 'send' ? '📤' : snd === 'receive' ? '📥' : snd === 'delete' ? '🗑️' : '🎉'}
                </span>
                <span class="text-[10px] font-medium text-gray-600 capitalize">{snd}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Setting sections */}
        <For each={settingSections()}>
          {(section, idx) => (
            <div class="glass rounded-3xl overflow-hidden animate-slide-up" style={`animation-delay: ${0.05 * (idx() + 1)}s`}>
              <div class="px-5 py-3 flex items-center gap-2">
                <span class="text-lg">{section.icon}</span>
                <p class="font-bold text-gray-800 text-sm">{section.title}</p>
              </div>
              <For each={section.items}>
                {(item) => (
                  <button
                    class="w-full flex items-center gap-3 px-5 py-4 border-t border-gray-100/50 touch-scale"
                    onClick={() => {
                      if (item.type === 'toggle' && item.onChange) (item.onChange as () => void)();
                      if (item.type === 'action' && (item as any).action) (item as any).action();
                    }}
                  >
                    <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
                      <Icon name={item.icon as any} class="text-gray-600" size="sm" />
                    </div>
                    <div class="flex-1 text-left">
                      <p class="text-sm font-medium text-gray-800">{item.label}</p>
                      <p class="text-xs text-gray-500">{item.desc}</p>
                    </div>
                    <Show when={item.type === 'toggle'}>
                      <div class={`w-12 h-7 rounded-full transition-all duration-300 flex items-center px-0.5 ${
                        (item as any).value ? 'bg-gradient-to-r from-green-400 to-emerald-500' : 'bg-gray-300'
                      }`}>
                        <div class={`w-6 h-6 rounded-full bg-white shadow-md transition-transform duration-300 ${
                          (item as any).value ? 'translate-x-5' : 'translate-x-0'
                        }`} />
                      </div>
                    </Show>
                    <Show when={item.type === 'slider'}>
                      <div class="w-24 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="range"
                          min="0" max="1" step="0.05"
                          value={(item as any).value as number}
                          onInput={(e) => {
                            const v = parseFloat(e.currentTarget.value);
                            ((item as any).onChange as (v: number) => void)(v);
                          }}
                          class="w-full accent-indigo-500 h-1.5"
                        />
                      </div>
                    </Show>
                    <Show when={item.type === 'action'}>
                      <Icon name="chevronRight" class="text-gray-400" size="sm" />
                    </Show>
                  </button>
                )}
              </For>
            </div>
          )}
        </For>

        {/* App info */}
        <div class="glass rounded-3xl p-5 text-center animate-slide-up" style="animation-delay: 0.25s">
          <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mx-auto mb-3 shadow-lg">
            <span class="text-white text-2xl font-black">B</span>
          </div>
          <p class="font-bold text-gray-800">BOLH</p>
          <p class="text-xs text-gray-500 mb-1">Build Online Link Hub</p>
          <p class="text-xs text-gray-400">v2.1.0</p>
        </div>

        <div class="h-8" />
      </div>

      {/* Reset confirm */}
      <Show when={showResetConfirm()}>
        <div class="fixed inset-0 bg-black/50 flex items-end justify-center z-50 p-4" onClick={() => setShowResetConfirm(false)}>
          <div class="glass rounded-3xl p-6 max-w-sm w-full animate-slide-up mb-8" onClick={(e) => e.stopPropagation()}>
            <div class="text-center mb-4">
              <div class="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-3">
                <Icon name="alertTriangle" size="lg" class="text-amber-500 dark:text-amber-400" />
              </div>
              <h3 class="font-bold text-gray-800">{t('settings.resetTitle')}</h3>
              <p class="text-sm text-gray-500 mt-1">{t('settings.resetDesc')}</p>
            </div>
            <button
              class="w-full py-3 bg-red-500 text-white rounded-2xl font-semibold mb-2 touch-press"
              onClick={() => {
                playGlobalSound('delete');
                setGlobalSoundEnabled(true);
                setGlobalHapticEnabled(true);
                setGlobalNotifSound(true);
                setGlobalVolume(0.7);
                setShowResetConfirm(false);
              }}
            >
              {t('settings.resetConfirm')}
            </button>
            <button class="w-full py-3 glass rounded-2xl text-gray-600 font-medium touch-scale" onClick={() => setShowResetConfirm(false)}>
              {t('settings.cancel')}
            </button>
          </div>
        </div>
      </Show>

      {/* About App */}
      <div style="margin-top: 24px; padding: 20px; border-radius: 20px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.06); text-align: center;">
        <div style="width: 56px; height: 56px; border-radius: 16px; background: linear-gradient(135deg, #6366f1, #8b5cf6); display: flex; align-items: center; justify-content: center; margin: 0 auto 12px; box-shadow: 0 4px 15px rgba(99,102,241,0.3);">
          <span style="font-size: 24px; font-weight: 900; color: #fff;">B</span>
        </div>
        <p style="color: #fff; font-size: 16px; font-weight: 700; margin: 0;">BOLH</p>
        <p style="color: rgba(255,255,255,0.4); font-size: 12px; margin: 4px 0 0 0;">v2.0.0 • Professional Services</p>
        <p style="color: rgba(255,255,255,0.25); font-size: 10px; margin: 8px 0 0 0;">{currentLang() === 'en' ? 'Made with care for professionals' : 'Сделано с заботой о профессионалах'}</p>
      </div>

      {/* Logged in info + Logout */}
      <Show when={authUser()}>
        <div style="margin-top: 16px; padding: 16px 20px; border-radius: 16px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.06);">
          <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 14px;">
            <div style="width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, #6366f1, #8b5cf6); display: flex; align-items: center; justify-content: center;">
              <span style="color: #fff; font-size: 16px; font-weight: 800;">{authUser()!.name.charAt(0).toUpperCase()}</span>
            </div>
            <div style="flex: 1;">
              <p style="color: #fff; font-size: 14px; font-weight: 700; margin: 0;">{authUser()!.name}</p>
              <p style="color: rgba(255,255,255,0.4); font-size: 12px; margin: 2px 0 0 0;">{authUser()!.phone}</p>
            </div>
            <span style={`padding: 4px 10px; border-radius: 8px; font-size: 10px; font-weight: 700; ${authUser()!.role === 'worker' ? 'background: rgba(16,185,129,0.15); color: #34d399;' : 'background: rgba(99,102,241,0.15); color: #a78bfa;'}`}>
              {authUser()!.role === 'worker' ? '💼 PRO' : '👤 Client'}
            </span>
          </div>
          <button
            onClick={() => { clearAuth(); setAuthUser(null); window.location.reload(); }}
            style="width: 100%; padding: 12px; border-radius: 12px; background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.2); color: #ef4444; font-size: 14px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;"
          >
            🚪 {currentLang() === 'en' ? 'Log Out' : 'Выйти из аккаунта'}
          </button>
        </div>
      </Show>
    </div>
  );
}

// ============== Main App ==============

