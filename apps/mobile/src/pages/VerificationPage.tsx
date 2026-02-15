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

export default function VerificationPage(props: { onBack: () => void }) {
  const [activeTab, setActiveTab] = createSignal<'status' | 'upload' | 'photo'>('status');

  const verificationItems = [
    { id: 'identity', name: 'Удостоверение личности', status: 'verified', icon: 'userCheck' },
    { id: 'phone', name: 'Номер телефона', status: 'verified', icon: 'phone' },
    { id: 'address', name: 'Адрес проживания', status: 'pending', icon: 'location' },
    { id: 'diploma', name: 'Диплом/Сертификат', status: 'not_submitted', icon: 'award' },
    { id: 'license', name: 'Лицензия охранника', status: 'not_submitted', icon: 'shield' },
    { id: 'background', name: 'Проверка судимости', status: 'pending', icon: 'checkCircle' },
  ];

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'verified': return { bg: 'bg-green-100', text: 'text-green-700', label: '✓ Подтверждено' };
      case 'pending': return { bg: 'bg-amber-100', text: 'text-amber-700', label: '⏳ На проверке' };
      case 'rejected': return { bg: 'bg-red-100', text: 'text-red-700', label: '✗ Отклонено' };
      default: return { bg: 'bg-gray-100', text: 'text-gray-600', label: '○ Не отправлено' };
    }
  };

  const verificationScore = () => {
    const verified = verificationItems.filter(i => i.status === 'verified').length;
    return Math.round((verified / verificationItems.length) * 100);
  };

  return (
    <div class="min-h-screen animate-fade-in">
      {/* Header */}
      <div class="p-4">
        <div class="flex items-center gap-4 mb-4">
          <button 
            class="w-10 h-10 rounded-full glass flex items-center justify-center touch-scale"
            onClick={props.onBack}
          >
            <Icon name="chevronLeft" class="text-gray-700" size="sm" />
          </button>
          <h1 class="text-xl font-bold text-white flex-1">Верификация</h1>
        </div>
      </div>

      {/* Verification Score */}
      <div class="px-4 mb-6">
        <div class="glass rounded-3xl p-5">
          <div class="flex items-center gap-4">
            <div class="relative">
              <svg class="w-20 h-20 transform -rotate-90">
                <circle cx="40" cy="40" r="36" stroke="#e5e7eb" stroke-width="8" fill="none" />
                <circle 
                  cx="40" cy="40" r="36" 
                  stroke="url(#gradient)" 
                  stroke-width="8" 
                  fill="none"
                  stroke-linecap="round"
                  stroke-dasharray={`${verificationScore() * 2.26} 226`}
                />
                <defs>
                  <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stop-color="#6366f1" />
                    <stop offset="100%" stop-color="#a855f7" />
                  </linearGradient>
                </defs>
              </svg>
              <div class="absolute inset-0 flex items-center justify-center">
                <span class="text-2xl font-bold text-gray-800">{verificationScore()}%</span>
              </div>
            </div>
            <div class="flex-1">
              <p class="font-semibold text-gray-800 text-lg">Уровень доверия</p>
              <p class="text-sm text-gray-500 mt-1">
                {verificationScore() >= 80 ? 'Высокий уровень верификации' :
                 verificationScore() >= 50 ? 'Средний уровень. Загрузите документы' :
                 'Низкий уровень. Пройдите проверку'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div class="px-4 mb-4">
        <div class="flex gap-2">
          <button
            class={`flex-1 py-3 rounded-xl font-medium text-sm transition-all ${
              activeTab() === 'status' ? 'bg-indigo-600 text-white' : 'glass text-gray-700'
            }`}
            onClick={() => setActiveTab('status')}
          >
            Статус
          </button>
          <button
            class={`flex-1 py-3 rounded-xl font-medium text-sm transition-all ${
              activeTab() === 'upload' ? 'bg-indigo-600 text-white' : 'glass text-gray-700'
            }`}
            onClick={() => setActiveTab('upload')}
          >
            Загрузить
          </button>
          <button
            class={`flex-1 py-3 rounded-xl font-medium text-sm transition-all ${
              activeTab() === 'photo' ? 'bg-indigo-600 text-white' : 'glass text-gray-700'
            }`}
            onClick={() => setActiveTab('photo')}
          >
            Фото на месте
          </button>
        </div>
      </div>

      <Switch>
        {/* Status Tab */}
        <Match when={activeTab() === 'status'}>
          <div class="px-4 space-y-3">
            <For each={verificationItems}>
              {(item, i) => {
                const status = getStatusStyle(item.status);
                return (
                  <div 
                    class="glass rounded-2xl p-4 animate-slide-up"
                    style={`animation-delay: ${i() * 0.05}s`}
                  >
                    <div class="flex items-center gap-4">
                      <div class={`w-12 h-12 rounded-xl ${
                        item.status === 'verified' ? 'bg-gradient-to-br from-green-400 to-emerald-500' :
                        item.status === 'pending' ? 'bg-gradient-to-br from-amber-400 to-orange-500' :
                        'bg-gradient-to-br from-gray-300 to-gray-400'
                      } flex items-center justify-center`}>
                        <Icon name={item.icon as any} class="text-white" size="sm" />
                      </div>
                      
                      <div class="flex-1">
                        <p class="font-medium text-gray-800">{item.name}</p>
                        <span class={`text-xs px-2 py-0.5 rounded-full ${status.bg} ${status.text}`}>
                          {status.label}
                        </span>
                      </div>

                      <Show when={item.status === 'not_submitted'}>
                        <button class="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium touch-scale">
                          Загрузить
                        </button>
                      </Show>
                    </div>
                  </div>
                );
              }}
            </For>
          </div>
        </Match>

        {/* Upload Tab */}
        <Match when={activeTab() === 'upload'}>
          <div class="px-4 space-y-4">
            <div class="glass rounded-3xl p-5 border-2 border-dashed border-indigo-300">
              <div class="text-center">
                <div class="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center mx-auto mb-4">
                  <Icon name="uploadCloud" class="text-indigo-600" size="lg" />
                </div>
                <p class="font-semibold text-gray-800 mb-1">Загрузить документ</p>
                <p class="text-sm text-gray-500 mb-4">PDF, JPG или PNG до 10 MB</p>
                <button class="px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl font-medium touch-scale">
                  Выбрать файл
                </button>
              </div>
            </div>

            <div class="glass rounded-2xl p-4">
              <p class="font-medium text-gray-800 mb-3">Требования к документам:</p>
              <ul class="space-y-2 text-sm text-gray-600">
                <li class="flex items-center gap-2">
                  <Icon name="check" class="text-emerald-600 dark:text-emerald-400" size="xs" />
                  Чёткое фото без бликов
                </li>
                <li class="flex items-center gap-2">
                  <Icon name="check" class="text-emerald-600 dark:text-emerald-400" size="xs" />
                  Все углы документа видны
                </li>
                <li class="flex items-center gap-2">
                  <Icon name="check" class="text-emerald-600 dark:text-emerald-400" size="xs" />
                  Текст легко читается
                </li>
                <li class="flex items-center gap-2">
                  <Icon name="check" class="text-emerald-600 dark:text-emerald-400" size="xs" />
                  Документ действителен
                </li>
              </ul>
            </div>

            {/* Privacy notice */}
            <div class="glass rounded-2xl p-4 border border-green-200 bg-green-50/50">
              <div class="flex items-start gap-3">
                <Icon name="lock" class="text-slate-500 dark:text-gray-200" size="sm" />
                <div>
                  <p class="font-medium text-green-800">Конфиденциальность</p>
                  <p class="text-xs text-green-700 mt-1">
                    Документы шифруются и хранятся в защищённом хранилище. 
                    Доступ только у вас и верификаторов.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Match>

        {/* Photo Verification Tab */}
        <Match when={activeTab() === 'photo'}>
          <div class="px-4 space-y-4">
            {/* Camera preview placeholder */}
            <div class="glass rounded-3xl overflow-hidden">
              <div class="aspect-[4/3] bg-gradient-to-br from-gray-800 to-gray-900 flex flex-col items-center justify-center">
                <div class="w-20 h-20 rounded-full border-4 border-white/30 flex items-center justify-center mb-4">
                  <Icon name="camera" class="text-white/90" size="xl" />
                </div>
                <p class="text-white/90 font-medium">Камера для верификации</p>
                <p class="text-white/90 text-sm mt-1">Сделайте фото на месте работы</p>
              </div>
              
              <div class="p-4 bg-gradient-to-r from-indigo-500 to-purple-600">
                <div class="flex items-center justify-between text-white">
                  <div class="flex items-center gap-2">
                    <Icon name="location" size="sm" />
                    <span class="text-sm">GPS: Готово</span>
                  </div>
                  <div class="flex items-center gap-2">
                    <Icon name="clock" size="sm" />
                    <span class="text-sm">{new Date().toLocaleTimeString()}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Instructions */}
            <div class="glass rounded-2xl p-4">
              <p class="font-medium text-gray-800 mb-3">Как это работает:</p>
              <div class="space-y-3">
                <div class="flex items-start gap-3">
                  <div class="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 text-sm font-bold text-indigo-600">1</div>
                  <p class="text-sm text-gray-600">Охранник прибывает на место и делает селфи</p>
                </div>
                <div class="flex items-start gap-3">
                  <div class="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 text-sm font-bold text-indigo-600">2</div>
                  <p class="text-sm text-gray-600">Фото привязывается к GPS-координатам и времени</p>
                </div>
                <div class="flex items-start gap-3">
                  <div class="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 text-sm font-bold text-indigo-600">3</div>
                  <p class="text-sm text-gray-600">Клиент получает уведомление и подтверждает</p>
                </div>
                <div class="flex items-start gap-3">
                  <div class="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 text-sm font-bold text-indigo-600">4</div>
                  <p class="text-sm text-gray-600">Фото автоматически удаляется через 24 часа</p>
                </div>
              </div>
            </div>

            {/* Auto-delete notice */}
            <div class="glass rounded-2xl p-4 border border-amber-200 bg-amber-50/50">
              <div class="flex items-start gap-3">
                <Icon name="trash" class="text-slate-500 dark:text-gray-200" size="sm" />
                <div>
                  <p class="font-medium text-amber-800">Авто-удаление</p>
                  <p class="text-xs text-amber-700 mt-1">
                    Для защиты конфиденциальности все фото верификации 
                    автоматически удаляются из системы через 24 часа после подтверждения.
                  </p>
                </div>
              </div>
            </div>

            {/* Take photo button */}
            <button class="w-full py-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-2xl font-bold text-lg shadow-xl touch-scale flex items-center justify-center gap-2">
              <Icon name="camera" class="text-white" size="sm" />
              Сделать фото
            </button>
          </div>
        </Match>
      </Switch>
    </div>
  );
}

