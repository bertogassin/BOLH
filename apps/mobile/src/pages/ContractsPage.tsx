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

const contractTypes: ContractType[] = [
  { id: 'instant', name: 'Instant', nameRu: 'Срочный', icon: '⚡', descriptionKey: 'contracts.descInstant', durationKey: 'contracts.durationInstant', escrow: true, fee: 15, color: 'from-amber-400 to-orange-500' },
  { id: 'short', name: 'Short', nameRu: 'Краткий', icon: '📅', descriptionKey: 'contracts.descShort', durationKey: 'contracts.durationShort', escrow: true, fee: 12, color: 'from-blue-400 to-cyan-500' },
  { id: 'monthly', name: 'Monthly', nameRu: 'Месячный', icon: '📆', descriptionKey: 'contracts.descMonthly', durationKey: 'contracts.durationMonthly', escrow: true, fee: 10, color: 'from-indigo-500 to-purple-600' },
  { id: 'subscription', name: 'Subscription', nameRu: 'Подписка', icon: '🔄', descriptionKey: 'contracts.descSubscription', durationKey: 'contracts.durationUnlimited', escrow: false, fee: 8, color: 'from-green-400 to-emerald-500' },
];

const paymentMethods = [
  { id: 'kaspi', name: 'Kaspi Pay', nameKey: null as string | null, descKey: 'payment.instantTransfer', icon: '🏦', desc: 'Visa, Mastercard', fee: 0, popular: true },
  { id: 'card', name: null as string | null, nameKey: 'payment.card', descKey: null, icon: '💳', desc: 'Visa, Mastercard', fee: 2, popular: false },
  { id: 'apple', name: 'Apple Pay', nameKey: null, descKey: null, icon: '🍎', desc: 'iPhone / iPad', fee: 0, popular: false },
  { id: 'google', name: 'Google Pay', nameKey: null, descKey: null, icon: '🤖', desc: 'Android', fee: 0, popular: false },
  { id: 'balance', name: null, nameKey: 'payment.balance', descKey: null, icon: '👛', desc: '15 000 ₸', fee: 0, popular: false },
];


export default function ContractsPage(props: { onNavigate: (page: string) => void }) {
  const [expandedContract, setExpandedContract] = createSignal<string | null>(null);
  
  // Contracts with progress data
  const contracts = [
    { id: '2024-001', type: 'instant', guard: 'Алексей Козлов', avatar: '👨‍✈️', status: 'active', start: 'Сегодня 14:00', end: '18:00', total: 20000, paid: true, progress: 65, hoursWorked: 2.5, hoursTotal: 4, phases: [
      { phaseKey: 'phaseArrival', done: true },
      { phaseKey: 'phaseOnSite', done: true },
      { phaseKey: 'phasePatrol', done: false },
      { phaseKey: 'phaseComplete', done: false },
    ]},
    { id: '2024-002', type: 'monthly', guard: 'Дмитрий Сидоров', avatar: '🧔', status: 'active', start: '1 февраля', end: '28 февраля', total: 180000, paid: true, progress: 22, hoursWorked: 44, hoursTotal: 200, phases: [
      { phaseKey: 'phaseWeek', phaseNum: 1, done: true },
      { phaseKey: 'phaseWeek', phaseNum: 2, done: false },
      { phaseKey: 'phaseWeek', phaseNum: 3, done: false },
      { phaseKey: 'phaseWeek', phaseNum: 4, done: false },
    ]},
    { id: '2023-098', type: 'short', guard: 'Максим Иванов', avatar: '👮', status: 'completed', start: '25 января', end: '27 января', total: 45000, paid: true, progress: 100, hoursWorked: 48, hoursTotal: 48, phases: [
      { phaseKey: 'phaseDay', phaseNum: 1, done: true },
      { phaseKey: 'phaseDay', phaseNum: 2, done: true },
      { phaseKey: 'phaseComplete', done: true },
    ]},
    { id: '2023-095', type: 'instant', guard: 'Артём Петров', avatar: '🕵️', status: 'completed', start: '20 января', end: '20 января', total: 8000, paid: true, progress: 100, hoursWorked: 2, hoursTotal: 2, phases: [
      { phaseKey: 'phaseDone', done: true },
    ]},
  ];

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'active': return { bg: 'bg-green-100', text: 'text-green-700', label: t('contracts.statusActive') };
      case 'pending': return { bg: 'bg-amber-100', text: 'text-amber-700', label: t('contracts.statusPending') };
      case 'completed': return { bg: 'bg-gray-100', text: 'text-gray-600', label: t('contracts.statusCompleted') };
      default: return { bg: 'bg-gray-100', text: 'text-gray-600', label: status };
    }
  };

  const getTypeInfo = (typeId: string) => contractTypes.find(t => t.id === typeId) || contractTypes[0];
  
  // Get gradient colors for progress ring
  const getProgressColors = (progress: number, status: string) => {
    if (status === 'completed') return { stroke: '#10b981', bg: '#d1fae5' };
    if (progress >= 75) return { stroke: '#10b981', bg: '#d1fae5' };
    if (progress >= 50) return { stroke: '#6366f1', bg: '#e0e7ff' };
    if (progress >= 25) return { stroke: '#f59e0b', bg: '#fef3c7' };
    return { stroke: '#ef4444', bg: '#fee2e2' };
  };

  // Circular Progress Component
  const CircularProgress = (props: { progress: number; size: number; status: string; icon: string }) => {
    const colors = () => getProgressColors(props.progress, props.status);
    const circumference = 2 * Math.PI * 28; // radius = 28
    const strokeDashoffset = () => circumference - (props.progress / 100) * circumference;
    
    return (
      <div class="relative" style={`width: ${props.size}px; height: ${props.size}px`}>
        {/* Background ring */}
        <svg class="absolute inset-0 transform -rotate-90" width={props.size} height={props.size}>
          <circle
            cx={props.size / 2}
            cy={props.size / 2}
            r="28"
            stroke={colors().bg}
            stroke-width="6"
            fill="none"
          />
          {/* Progress ring */}
          <circle
            cx={props.size / 2}
            cy={props.size / 2}
            r="28"
            stroke={colors().stroke}
            stroke-width="6"
            fill="none"
            stroke-linecap="round"
            stroke-dasharray={circumference.toString()}
            stroke-dashoffset={strokeDashoffset().toString()}
            class="transition-all duration-1000 ease-out"
            style={props.status === 'active' ? 'filter: drop-shadow(0 0 6px ' + colors().stroke + ')' : ''}
          />
        </svg>
        {/* Icon in center */}
        <div class="absolute inset-0 flex items-center justify-center text-2xl">
          {props.icon}
        </div>
        {/* Percentage badge */}
        <div 
          class="absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shadow-lg"
          style={`background: ${colors().stroke}; color: white`}
        >
          {props.progress}
        </div>
      </div>
    );
  };

  return (
    <div class="min-h-screen animate-fade-in">
      {/* Header */}
      <div class="p-4">
        <div class="flex items-center justify-between mb-2">
          <h1 class="text-2xl font-bold text-white">{t('contracts.title')}</h1>
          <button 
            class="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg touch-scale"
            onClick={() => props.onNavigate('newcontract')}
          >
            <Icon name="plus" class="text-white" size="sm" />
          </button>
        </div>
        <p class="text-white/90">{t('contracts.subtitle')}</p>
      </div>

      {/* Quick Stats */}
      <div class="px-4 mb-6">
        <div class="glass rounded-3xl p-5">
          <div class="grid grid-cols-3 gap-4">
            <div class="text-center">
              <p class="text-3xl font-bold text-indigo-600">2</p>
              <p class="text-xs text-gray-500 mt-1">{t('contracts.active')}</p>
            </div>
            <div class="text-center border-x border-gray-200">
              <p class="text-3xl font-bold text-green-600">253K</p>
              <p class="text-xs text-gray-500 mt-1">{t('contracts.paid')}</p>
            </div>
            <div class="text-center">
              <p class="text-3xl font-bold text-amber-500">200K</p>
              <p class="text-xs text-gray-500 mt-1">{t('contracts.inEscrow')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Contract Types */}
      <div class="px-4 mb-6">
        <p class="text-sm font-medium text-white/90 mb-3">{t('contracts.create')}</p>
        <div class="grid grid-cols-2 gap-3">
          <For each={contractTypes}>
            {(type, i) => (
              <button 
                class="glass rounded-2xl p-4 text-left touch-scale animate-slide-up"
                style={`animation-delay: ${i() * 0.05}s`}
                onClick={() => props.onNavigate('newcontract')}
              >
                <div class={`w-12 h-12 rounded-xl bg-gradient-to-br ${type.color} flex items-center justify-center text-2xl mb-3 shadow-lg`}>
                  {type.icon}
                </div>
                <p class="font-semibold text-gray-800">{t(`contracts.${type.id}`)}</p>
                <p class="text-xs text-gray-500">{t(type.durationKey)} • {type.fee}% {t('contracts.commission')}</p>
              </button>
            )}
          </For>
        </div>
      </div>

      {/* Active tracking banner */}
      <Show when={contracts.some(c => c.status === 'active')}>
        <div class="px-4 mb-4">
          <button
            class="w-full bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-4 flex items-center gap-3 shadow-lg shadow-blue-600/20 touch-scale"
            onClick={() => props.onNavigate('tracking')}
          >
            <div class="relative">
              <div class="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                <Icon name="location" size="lg" class="text-white" />
              </div>
              <div class="absolute -top-0.5 -right-0.5 w-4 h-4 bg-green-400 rounded-full border-2 border-blue-600 animate-pulse" />
            </div>
            <div class="flex-1 text-left">
              <p class="text-white font-semibold">{t('tracking.guardOnWay')}</p>
              <p class="text-blue-200 text-sm">Алексей Козлов • {t('tracking.arrivesIn')} ~5 {t('tracking.minutes')}</p>
            </div>
            <div class="text-right">
              <p class="text-white font-bold text-lg">~5 мин</p>
              <p class="text-blue-200 text-xs">{t('urgent.trackOnMap')} →</p>
            </div>
          </button>
        </div>
      </Show>

      {/* Active Contracts with Progress */}
      <div class="px-4">
        <p class="text-sm font-medium text-white/90 mb-3">{t('contracts.myContracts')}</p>
        <div class="space-y-3">
          <For each={contracts}>
            {(contract, i) => {
              const type = getTypeInfo(contract.type);
              const status = getStatusStyle(contract.status);
              const isExpanded = () => expandedContract() === contract.id;
              const colors = () => getProgressColors(contract.progress, contract.status);
              
              return (
                <div 
                  class="glass rounded-3xl overflow-hidden animate-slide-up"
                  style={`animation-delay: ${0.1 + i() * 0.05}s`}
                >
                  {/* Progress bar at top */}
                  <div class="h-1.5 bg-gray-100">
                    <div 
                      class="h-full transition-all duration-1000 ease-out rounded-full"
                      style={`width: ${contract.progress}%; background: ${colors().stroke}`}
                    />
                  </div>
                  
                  <div 
                    class="p-5 cursor-pointer touch-scale"
                    onClick={() => setExpandedContract(isExpanded() ? null : contract.id)}
                  >
                    <div class="flex items-start gap-4">
                      {/* Circular Progress with Icon */}
                      <CircularProgress 
                        progress={contract.progress} 
                        size={68} 
                        status={contract.status}
                        icon={contract.avatar}
                      />
                      
                      <div class="flex-1 min-w-0">
                        <div class="flex items-center justify-between mb-1">
                          <p class="font-semibold text-gray-800 truncate">{contract.guard}</p>
                          <span class={`px-2 py-0.5 ${status.bg} ${status.text} rounded-full text-xs font-medium flex-shrink-0`}>
                            {status.label}
                          </span>
                        </div>
                        <p class="text-xs text-gray-500 mb-2">#{contract.id} • {t(`contracts.${type.id}`)}</p>
                        
                        {/* Time info */}
                        <div class="flex items-center gap-3 text-xs text-gray-500">
                          <span class="flex items-center gap-1">
                            <Icon name="clock" size="xs" />
                            {contract.hoursWorked}/{contract.hoursTotal} {t('contracts.hoursShort')}
                          </span>
                          <span class="flex items-center gap-1">
                            <Icon name="calendar" size="xs" />
                            {contract.start}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Expanded Details */}
                    <Show when={isExpanded()}>
                      <div class="mt-4 pt-4 border-t border-gray-100 animate-fade-in">
                        {/* Progress phases */}
                        <p class="text-xs font-medium text-gray-500 mb-3">{t('contracts.stages')}</p>
                        <div class="flex items-center gap-1 mb-4">
                          <For each={contract.phases}>
                            {(phase, phaseIdx) => (
                              <div class="flex-1">
                                <div 
                                  class={`h-2 rounded-full transition-all ${
                                    phase.done 
                                      ? 'bg-gradient-to-r from-green-400 to-emerald-500' 
                                      : 'bg-gray-200'
                                  }`}
                                />
                                <p class={`text-xs mt-1 truncate ${phase.done ? 'text-green-600' : 'text-gray-400'}`}>
                                  {'phaseNum' in phase && phase.phaseNum
                                    ? `${t('contracts.' + phase.phaseKey)} ${phase.phaseNum}`
                                    : t('contracts.' + phase.phaseKey)}
                                </p>
                              </div>
                            )}
                          </For>
                        </div>

                        {/* Stats row */}
                        <div class="grid grid-cols-3 gap-3 mb-4">
                          <div class="bg-gray-50 rounded-xl p-3 text-center">
                            <p class="text-lg font-bold" style={`color: ${colors().stroke}`}>{contract.progress}%</p>
                            <p class="text-xs text-gray-500">{t('contracts.completed')}</p>
                          </div>
                          <div class="bg-gray-50 rounded-xl p-3 text-center">
                            <p class="text-lg font-bold text-indigo-600">{contract.hoursWorked}</p>
                            <p class="text-xs text-gray-500">{t('contracts.hours')}</p>
                          </div>
                          <div class="bg-gray-50 rounded-xl p-3 text-center">
                            <p class="text-lg font-bold text-amber-500">{Math.round(contract.total * contract.progress / 100).toLocaleString()}</p>
                            <p class="text-xs text-gray-500">{t('contracts.earned')}</p>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div class="flex gap-2 flex-wrap">
                          <Show when={contract.status === 'active'}>
                            <button 
                              class="w-full py-3 mb-2 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl text-white font-medium text-sm flex items-center justify-center gap-2 touch-scale shadow-lg shadow-blue-500/30"
                              onClick={(e) => { e.stopPropagation(); props.onNavigate('tracking'); }}
                            >
                              <div class="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                              <Icon name="location" size="xs" />
                              {t('urgent.trackOnMap')}
                            </button>
                          </Show>
                          <button class="flex-1 min-w-0 py-2.5 glass rounded-xl text-gray-700 font-medium text-sm flex items-center justify-center gap-2 touch-scale">
                            <Icon name="phone" size="xs" />
                            {t('contracts.call')}
                          </button>
                          <button class="flex-1 min-w-0 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl text-white font-medium text-sm flex items-center justify-center gap-2 touch-scale shadow-lg" onClick={() => props.onNavigate('chat')}>
                            <Icon name="message" size="xs" />
                            {t('contracts.message')}
                          </button>
                          <Show when={contract.status === 'completed'}>
                            <button
                              onClick={() => props.onNavigate('rating')}
                              class="w-full py-2.5 rounded-xl font-medium text-sm flex items-center justify-center gap-2 touch-scale bg-amber-100 text-amber-800 border border-amber-300"
                            >
                              <Icon name="star" size="xs" class="text-amber-500" />
                              {t('contracts.rate')}
                            </button>
                          </Show>
                        </div>
                      </div>
                    </Show>

                    {/* Collapsed bottom section */}
                    <Show when={!isExpanded()}>
                      <div class="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                        <div>
                          <p class="text-xs text-gray-400">{t('contracts.amount')}</p>
                          <p class="text-xl font-bold text-gray-800">{contract.total.toLocaleString()} ₸</p>
                        </div>
                        <Show when={contract.status === 'active'}>
                          <div class="flex items-center gap-2 px-3 py-1.5 rounded-full" style={`background: ${colors().bg}`}>
                            <div class="w-2 h-2 rounded-full animate-pulse" style={`background: ${colors().stroke}`} />
                            <span class="text-sm font-medium" style={`color: ${colors().stroke}`}>{contract.progress}% {t('contracts.done')}</span>
                          </div>
                        </Show>
                        <Show when={contract.status === 'completed'}>
                          <div class="flex items-center gap-2 px-3 py-1.5 bg-green-50 rounded-full">
                            <Icon name="checkCircle" class="text-emerald-600 dark:text-emerald-400 w-4 h-4" />
                            <span class="text-sm font-medium text-green-700">{t('contracts.finished')}</span>
                          </div>
                        </Show>
                      </div>
                    </Show>

                    {/* Expand hint */}
                    <div class="flex justify-center mt-3">
                      <div class={`w-10 h-1 rounded-full bg-gray-200 transition-all ${isExpanded() ? 'bg-indigo-400' : ''}`} />
                    </div>
                  </div>
                </div>
              );
            }}
          </For>
        </div>
      </div>

      {/* Escrow Info */}
      <div class="p-4 mt-4">
        <div class="glass rounded-2xl p-4 border border-indigo-200/50 bg-indigo-50/30">
          <div class="flex items-start gap-3">
            <div class="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
              <Icon name="lock" class="text-indigo-600" size="sm" />
            </div>
            <div>
              <p class="font-medium text-gray-800">{t('contracts.secureEscrow')}</p>
              <p class="text-xs text-gray-600 mt-1">
                {t('contracts.secureEscrowDesc')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
