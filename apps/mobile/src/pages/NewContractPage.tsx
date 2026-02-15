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

export default function NewContractPage(props: { onBack: () => void }) {
  const [step, setStep] = createSignal<'type' | 'details' | 'payment' | 'confirm' | 'success'>('type');
  const [contractType, setContractType] = createSignal<ContractType>(contractTypes[0]);
  const [selectedPayment, setSelectedPayment] = createSignal(paymentMethods[0]);
  const [duration, setDuration] = createSignal(4);
  const [hourlyRate] = createSignal(5000);
  const [address, setAddress] = createSignal('ул. Абая 150, Алматы');
  const [startDate, setStartDate] = createSignal<'today' | 'tomorrow' | 'select'>('today');
  const [processing, setProcessing] = createSignal(false);
  // Legal consent signals
  const [termsAccepted, setTermsAccepted] = createSignal(false);
  const [privacyAccepted, setPrivacyAccepted] = createSignal(false);
  const [cancellationAccepted, setCancellationAccepted] = createSignal(false);
  const [showTermsDetail, setShowTermsDetail] = createSignal<string | null>(null);
  const allLegalAccepted = () => termsAccepted() && privacyAccepted() && cancellationAccepted();

  // Price calculations
  const subtotal = () => hourlyRate() * duration();
  const platformFee = () => Math.round(subtotal() * (contractType().fee / 100));
  const paymentFee = () => Math.round(subtotal() * (selectedPayment().fee / 100));
  const total = () => subtotal() + platformFee() + paymentFee();
  const escrowAmount = () => contractType().escrow ? total() : 0;

  const handleConfirmPayment = () => {
    setProcessing(true);
    setTimeout(() => {
      setProcessing(false);
      setStep('success');
    }, 2000);
  };

  return (
    <div class="min-h-screen animate-fade-in">
      {/* Header */}
      <div class="p-4">
        <div class="flex items-center gap-4 mb-4">
          <button 
            class="w-10 h-10 rounded-full glass flex items-center justify-center touch-scale"
            onClick={() => {
              if (step() === 'type') props.onBack();
              else if (step() === 'details') setStep('type');
              else if (step() === 'payment') setStep('details');
              else if (step() === 'confirm') setStep('payment');
            }}
          >
            <Icon name="chevronLeft" class="text-gray-700" size="sm" />
          </button>
          <h1 class="text-xl font-bold text-white flex-1">
            {step() === 'type' && t('newContract.step1')}
            {step() === 'details' && t('newContract.step2')}
            {step() === 'payment' && t('newContract.step3')}
            {step() === 'confirm' && t('newContract.step4')}
            {step() === 'success' && t('newContract.step5')}
          </h1>
          
          {/* Step indicator */}
          <Show when={step() !== 'success'}>
            <div class="flex gap-1">
              <div class={`w-2 h-2 rounded-full ${['type', 'details', 'payment', 'confirm'].includes(step()) ? 'bg-white' : 'bg-white/30'}`} />
              <div class={`w-2 h-2 rounded-full ${['details', 'payment', 'confirm'].includes(step()) ? 'bg-white' : 'bg-white/30'}`} />
              <div class={`w-2 h-2 rounded-full ${['payment', 'confirm'].includes(step()) ? 'bg-white' : 'bg-white/30'}`} />
              <div class={`w-2 h-2 rounded-full ${['confirm'].includes(step()) ? 'bg-white' : 'bg-white/30'}`} />
            </div>
          </Show>
        </div>
      </div>

      <Switch>
        {/* ========== Step 1: Contract Type ========== */}
        <Match when={step() === 'type'}>
          <div class="p-4 space-y-4">
            <p class="text-white/90 text-sm mb-2">{t('newContract.chooseType')}</p>
            
            <For each={contractTypes}>
              {(type, i) => {
                const isSelected = () => contractType().id === type.id;
                return (
                  <button
                    class={`w-full glass rounded-3xl p-5 text-left touch-scale animate-slide-up ${
                      isSelected() ? 'ring-2 ring-indigo-500' : ''
                    }`}
                    style={`animation-delay: ${i() * 0.05}s`}
                    onClick={() => setContractType(type)}
                  >
                    <div class="flex items-start gap-4">
                      <div class={`w-16 h-16 rounded-2xl bg-gradient-to-br ${type.color} flex items-center justify-center text-3xl shadow-lg`}>
                        {type.icon}
                      </div>
                      
                      <div class="flex-1">
                        <div class="flex items-center justify-between">
                          <h3 class="font-bold text-gray-800 text-lg">{t(`contracts.${type.id}`)}</h3>
                          <Show when={isSelected()}>
                            <div class="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center">
                              <Icon name="check" class="text-white w-4 h-4" />
                            </div>
                          </Show>
                        </div>
                        <p class="text-gray-500 text-sm mt-1">{t(type.descriptionKey)}</p>
                        
                        <div class="flex items-center gap-3 mt-3">
                          <span class="px-2 py-1 bg-gray-100 rounded-lg text-xs font-medium text-gray-600">
                            {t(type.durationKey)}
                          </span>
                          <span class="px-2 py-1 bg-gray-100 rounded-lg text-xs font-medium text-gray-600">
                            {type.fee}% {t('newContract.commission')}
                          </span>
                          <Show when={type.escrow}>
                            <span class="px-2 py-1 bg-green-100 rounded-lg text-xs font-medium text-green-700 flex items-center gap-1">
                              <Icon name="lock" size="xs" />
                              {t('contracts.escrow')}
                            </span>
                          </Show>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              }}
            </For>

            <button 
              class="w-full py-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-2xl font-bold text-lg shadow-xl touch-scale flex items-center justify-center gap-2"
              onClick={() => setStep('details')}
            >
              {t('newContract.continue')}
              <Icon name="arrowRight" class="text-white" size="sm" />
            </button>
          </div>
        </Match>

        {/* ========== Step 2: Details ========== */}
        <Match when={step() === 'details'}>
          <div class="p-4 space-y-5">
            {/* Selected type indicator */}
            <div class={`glass rounded-2xl p-4 border-2 border-opacity-50 ${
              contractType().id === 'instant' ? 'border-amber-400' :
              contractType().id === 'short' ? 'border-blue-400' :
              contractType().id === 'monthly' ? 'border-indigo-400' :
              'border-green-400'
            }`}>
              <div class="flex items-center gap-3">
                <div class={`w-12 h-12 rounded-xl bg-gradient-to-br ${contractType().color} flex items-center justify-center text-2xl`}>
                  {contractType().icon}
                </div>
                <div>
                  <p class="font-semibold text-gray-800">{t(`contracts.${contractType().id}`)} {t('contracts.title').toLowerCase()}</p>
                  <p class="text-xs text-gray-500">{t(contractType().durationKey)}</p>
                </div>
              </div>
            </div>

            {/* Address */}
            <div class="glass rounded-3xl p-5">
              <label class="text-sm font-medium text-gray-700 mb-3 block">{t('newContract.address')}</label>
              <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-2xl">
                <div class="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                  <Icon name="location" class="text-indigo-600" size="sm" />
                </div>
                <input 
                  type="text" 
                  value={address()}
                  onInput={(e) => setAddress(e.currentTarget.value)}
                  class="flex-1 bg-transparent text-gray-800 font-medium outline-none"
                />
              </div>
            </div>

            {/* Start Date */}
            <div class="glass rounded-3xl p-5">
              <label class="text-sm font-medium text-gray-700 mb-3 block">{t('newContract.startDate')}</label>
              <div class="grid grid-cols-3 gap-2">
                {(['today', 'tomorrow', 'select'] as const).map(dateKey => (
                  <button
                    class={`py-3 rounded-xl font-medium text-sm transition-all ${
                      startDate() === dateKey 
                        ? 'bg-indigo-600 text-white' 
                        : 'bg-gray-100 text-gray-700'
                    }`}
                    onClick={() => setStartDate(dateKey)}
                  >
                    {t(`newContract.${dateKey}`)}
                  </button>
                ))}
              </div>
            </div>

            {/* Duration */}
            <div class="glass rounded-3xl p-5">
              <label class="text-sm font-medium text-gray-700 mb-4 block">{t('newContract.duration')}</label>
              <div class="flex items-center justify-between">
                <button 
                  class="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center touch-scale"
                  onClick={() => setDuration(d => Math.max(1, d - 1))}
                >
                  <Icon name="minus" class="text-gray-600" />
                </button>
                <div class="text-center flex-1">
                  <div class="text-5xl font-bold text-gray-800">{duration()}</div>
                  <div class="text-gray-500 text-sm mt-1">
                    {contractType().id === 'monthly' ? t('newContract.weeks') : 
                     contractType().id === 'subscription' ? t('newContract.months') : t('newContract.hoursUnit')}
                  </div>
                </div>
                <button 
                  class="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center touch-scale"
                  onClick={() => setDuration(d => Math.min(24, d + 1))}
                >
                  <Icon name="plus" class="text-gray-600" />
                </button>
              </div>
            </div>

            {/* Price Summary */}
            <div class="glass rounded-3xl p-5 bg-gradient-to-br from-indigo-50 to-purple-50">
              <p class="text-sm font-medium text-gray-700 mb-3">{t('newContract.costCalc')}</p>
              <div class="space-y-2">
                <div class="flex justify-between text-sm">
                  <span class="text-gray-500">{hourlyRate().toLocaleString()} ₸ × {duration()} ч</span>
                  <span class="text-gray-800">{subtotal().toLocaleString()} ₸</span>
                </div>
                <div class="flex justify-between text-sm">
                  <span class="text-gray-500">{t('newContract.commission')} ({contractType().fee}%)</span>
                  <span class="text-gray-800">{platformFee().toLocaleString()} ₸</span>
                </div>
                <div class="border-t border-gray-200 pt-2 mt-2 flex justify-between">
                  <span class="font-semibold text-gray-800">{t('newContract.total')}</span>
                  <span class="text-2xl font-bold text-indigo-600">{total().toLocaleString()} ₸</span>
                </div>
              </div>
            </div>

            <button 
              class="w-full py-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-2xl font-bold text-lg shadow-xl touch-scale flex items-center justify-center gap-2"
              onClick={() => setStep('payment')}
            >
              {t('newContract.selectPayment')}
              <Icon name="arrowRight" class="text-white" size="sm" />
            </button>
          </div>
        </Match>

        {/* ========== Step 3: Payment Method ========== */}
        <Match when={step() === 'payment'}>
          <div class="p-4 space-y-4">
            <p class="text-white/90 text-sm mb-2">{t('newContract.choosePayment')}</p>
            
            <For each={paymentMethods}>
              {(method, i) => {
                const isSelected = () => selectedPayment().id === method.id;
                return (
                  <button
                    class={`w-full glass rounded-2xl p-4 text-left touch-scale animate-slide-up ${
                      isSelected() ? 'ring-2 ring-indigo-500' : ''
                    }`}
                    style={`animation-delay: ${i() * 0.05}s`}
                    onClick={() => setSelectedPayment(method)}
                  >
                    <div class="flex items-center gap-4">
                      <div class="w-14 h-14 rounded-2xl bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-3xl">
                        {method.icon}
                      </div>
                      
                      <div class="flex-1">
                        <div class="flex items-center gap-2">
                          <p class="font-semibold text-gray-800">{method.name}</p>
                          <Show when={method.popular}>
                            <span class="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs">{t('newContract.popular')}</span>
                          </Show>
                        </div>
                        <p class="text-sm text-gray-500">{method.desc}</p>
                      </div>
                      
                      <div class="text-right">
                        <Show when={method.fee > 0}>
                          <span class="text-xs text-amber-600">+{method.fee}%</span>
                        </Show>
                        <Show when={method.fee === 0}>
                          <span class="text-xs text-green-600">{t('newContract.free')}</span>
                        </Show>
                      </div>

                      <Show when={isSelected()}>
                        <div class="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center">
                          <Icon name="check" class="text-white w-4 h-4" />
                        </div>
                      </Show>
                    </div>
                  </button>
                );
              }}
            </For>

            {/* Escrow explanation */}
            <Show when={contractType().escrow}>
              <div class="glass rounded-2xl p-4 border border-green-200 bg-green-50/50">
                <div class="flex items-start gap-3">
                  <div class="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                    <Icon name="lock" class="text-slate-500 dark:text-gray-200" size="sm" />
                  </div>
                  <div>
                    <p class="font-medium text-green-800">{t('newContract.escrowProtection')}</p>
                    <p class="text-xs text-green-700 mt-1">
                      {t('newContract.escrowDescLong')}
                    </p>
                  </div>
                </div>
              </div>
            </Show>

            {/* Subscription explanation */}
            <Show when={!contractType().escrow}>
              <div class="glass rounded-2xl p-4 border border-green-200 bg-green-50/50">
                <div class="flex items-start gap-3">
                  <div class="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                    <Icon name="repeat" class="text-slate-500 dark:text-gray-200" size="sm" />
                  </div>
                  <div>
                    <p class="font-medium text-green-800">Автоматическая подписка</p>
                    <p class="text-xs text-green-700 mt-1">
                      {total().toLocaleString()} ₸/мес будет списываться автоматически. 
                      Отменить подписку можно в любое время в профиле.
                    </p>
                  </div>
                </div>
              </div>
            </Show>

            <button 
              class="w-full py-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-2xl font-bold text-lg shadow-xl touch-scale flex items-center justify-center gap-2"
              onClick={() => setStep('confirm')}
            >
              {t('newContract.confirm')}
              <Icon name="arrowRight" class="text-white" size="sm" />
            </button>
          </div>
        </Match>

        {/* ========== Step 4: Confirm ========== */}
        <Match when={step() === 'confirm'}>
          <div class="p-4 space-y-5">
            {/* Order Summary */}
            <div class="glass rounded-3xl overflow-hidden">
              <div class={`p-5 bg-gradient-to-br ${contractType().color} text-white`}>
                <div class="flex items-center gap-3 mb-3">
                  <span class="text-4xl">{contractType().icon}</span>
                  <div>
                    <p class="font-bold text-xl">{t(`contracts.${contractType().id}`)} {t('contracts.contractWord')}</p>
                    <p class="text-white/90 text-sm">{t(contractType().durationKey)}</p>
                  </div>
                </div>
                <div class="text-right">
                  <p class="text-3xl font-bold">{total().toLocaleString()} ₸</p>
                </div>
              </div>
              
              <div class="p-5 space-y-4">
                <div class="flex items-center gap-3">
                  <Icon name="location" class="text-gray-400" size="sm" />
                  <div class="flex-1">
                    <p class="text-xs text-gray-400">{t('urgent.address')}</p>
                    <p class="font-medium text-gray-800">{address()}</p>
                  </div>
                </div>
                
                <div class="flex items-center gap-3">
                  <Icon name="calendar" class="text-gray-400" size="sm" />
                  <div class="flex-1">
                    <p class="text-xs text-gray-400">{t('newContract.start')}</p>
                    <p class="font-medium text-gray-800">{t(`newContract.${startDate()}`)}</p>
                  </div>
                </div>
                
                <div class="flex items-center gap-3">
                  <Icon name="clock" class="text-gray-400" size="sm" />
                  <div class="flex-1">
                    <p class="text-xs text-gray-400">{t('newContract.duration')}</p>
                    <p class="font-medium text-gray-800">
                      {duration()} {contractType().id === 'monthly' ? t('newContract.weeks') : 
                                    contractType().id === 'subscription' ? t('newContract.months') : t('newContract.hoursUnit')}
                    </p>
                  </div>
                </div>

                {/* Subscription auto-renewal info */}
                <Show when={contractType().id === 'subscription'}>
                  <div class="flex items-center gap-3 p-3 bg-green-50 rounded-xl">
                    <Icon name="repeat" class="text-slate-500 dark:text-gray-200" size="sm" />
                    <div class="flex-1">
                      <p class="text-xs text-green-600">{t('newContract.autoRenewal')}</p>
                      <p class="font-medium text-green-800">{t('newContract.everyMonth')}</p>
                    </div>
                  </div>
                </Show>

                <div class="border-t border-gray-100 pt-4">
                  <div class="flex items-center gap-3">
                    <span class="text-2xl">{selectedPayment().icon}</span>
                    <div class="flex-1">
                      <p class="text-xs text-gray-400">{t('payment.method')}</p>
                      <p class="font-medium text-gray-800">{selectedPayment().name ?? (selectedPayment().nameKey ? t(selectedPayment().nameKey || '') : '')}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Price breakdown */}
            <div class="glass rounded-2xl p-4">
              <div class="space-y-2">
                <div class="flex justify-between text-sm">
                  <span class="text-gray-500">{t('payment.subtotal')}</span>
                  <span class="text-gray-800">{subtotal().toLocaleString()} ₸</span>
                </div>
                <div class="flex justify-between text-sm">
                  <span class="text-gray-500">{t('payment.fee')} ({contractType().fee}%)</span>
                  <span class="text-gray-800">{platformFee().toLocaleString()} ₸</span>
                </div>
                <Show when={paymentFee() > 0}>
                  <div class="flex justify-between text-sm">
                    <span class="text-gray-500">{t('payment.fee')} {selectedPayment().name ?? (selectedPayment().nameKey ? t(selectedPayment().nameKey || '') : '')}</span>
                    <span class="text-gray-800">{paymentFee().toLocaleString()} ₸</span>
                  </div>
                </Show>
                <div class="border-t border-gray-200 pt-2 mt-2 flex justify-between">
                  <span class="font-semibold text-gray-800">{t('payment.total')}</span>
                  <span class="text-xl font-bold text-indigo-600">{total().toLocaleString()} ₸</span>
                </div>
              </div>
            </div>

            {/* Escrow info */}
            <Show when={escrowAmount() > 0}>
              <div class="glass rounded-2xl p-4 border border-indigo-200 bg-indigo-50/30">
                <div class="flex items-center gap-3">
                  <Icon name="lock" class="text-indigo-600" />
                  <div>
                    <p class="font-medium text-indigo-800">{t('contracts.escrow')}: {escrowAmount().toLocaleString()} ₸</p>
                    <p class="text-xs text-indigo-600">{t('contracts.secureEscrowDesc')}</p>
                  </div>
                </div>
              </div>
            </Show>

            {/* ===== Legal Compliance Block ===== */}
            <div class="glass rounded-3xl p-5 space-y-4">
              <div class="flex items-center gap-2 mb-1">
                <Icon name="fileText" class="text-gray-600" size="sm" />
                <p class="font-semibold text-gray-800">{t('legal.title')}</p>
              </div>

              {/* 1. Terms of Service */}
              <div class="space-y-2">
                <button
                  type="button"
                  class="w-full flex items-center gap-3 text-left"
                  onClick={() => { haptic('light'); setTermsAccepted(!termsAccepted()); }}
                >
                  <div class={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-all ${
                    termsAccepted() ? 'bg-green-500' : isDark() ? 'border-2 border-gray-500' : 'border-2 border-gray-300'
                  }`}>
                    <Show when={termsAccepted()}>
                      <Icon name="check" class="text-white w-4 h-4" />
                    </Show>
                  </div>
                  <p class={`text-sm flex-1 ${isDark() ? 'text-white' : 'text-gray-700'}`}>
                    {t('legal.acceptTerms')}
                  </p>
                  <span
                    role="button"
                    tabindex="0"
                    class="text-indigo-500 text-xs font-medium underline shrink-0 cursor-pointer"
                    onClick={(e) => { e.stopPropagation(); setShowTermsDetail(showTermsDetail() === 'terms' ? null : 'terms'); }}
                  >{t('legal.readMore')}</span>
                </button>
                <Show when={showTermsDetail() === 'terms'}>
                  <div class={`p-3 rounded-xl text-xs leading-relaxed animate-fade-in ${isDark() ? 'bg-black text-gray-300' : 'bg-gray-50 text-gray-600'}`}>
                    <p class="font-semibold mb-2">{t('legal.termsTitle')}</p>
                    <p>{t('legal.termsContent1')}</p>
                    <p class="mt-2">{t('legal.termsContent2')}</p>
                    <p class="mt-2">{t('legal.termsContent3')}</p>
                    <p class="mt-2">{t('legal.termsContent4')}</p>
                  </div>
                </Show>
              </div>

              {/* 2. Privacy Policy */}
              <div class="space-y-2">
                <button
                  type="button"
                  class="w-full flex items-center gap-3 text-left"
                  onClick={() => { haptic('light'); setPrivacyAccepted(!privacyAccepted()); }}
                >
                  <div class={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-all ${
                    privacyAccepted() ? 'bg-green-500' : isDark() ? 'border-2 border-gray-500' : 'border-2 border-gray-300'
                  }`}>
                    <Show when={privacyAccepted()}>
                      <Icon name="check" class="text-white w-4 h-4" />
                    </Show>
                  </div>
                  <p class={`text-sm flex-1 ${isDark() ? 'text-white' : 'text-gray-700'}`}>
                    {t('legal.acceptPrivacy')}
                  </p>
                  <span
                    role="button"
                    tabindex="0"
                    class="text-indigo-500 text-xs font-medium underline shrink-0 cursor-pointer"
                    onClick={(e) => { e.stopPropagation(); setShowTermsDetail(showTermsDetail() === 'privacy' ? null : 'privacy'); }}
                  >{t('legal.readMore')}</span>
                </button>
                <Show when={showTermsDetail() === 'privacy'}>
                  <div class={`p-3 rounded-xl text-xs leading-relaxed animate-fade-in ${isDark() ? 'bg-black text-gray-300' : 'bg-gray-50 text-gray-600'}`}>
                    <p class="font-semibold mb-2">{t('legal.privacyTitle')}</p>
                    <p>{t('legal.privacyContent1')}</p>
                    <p class="mt-2">{t('legal.privacyContent2')}</p>
                    <p class="mt-2">{t('legal.privacyContent3')}</p>
                  </div>
                </Show>
              </div>

              {/* 3. Cancellation & Refund Policy */}
              <div class="space-y-2">
                <button
                  type="button"
                  class="w-full flex items-center gap-3 text-left"
                  onClick={() => { haptic('light'); setCancellationAccepted(!cancellationAccepted()); }}
                >
                  <div class={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-all ${
                    cancellationAccepted() ? 'bg-green-500' : isDark() ? 'border-2 border-gray-500' : 'border-2 border-gray-300'
                  }`}>
                    <Show when={cancellationAccepted()}>
                      <Icon name="check" class="text-white w-4 h-4" />
                    </Show>
                  </div>
                  <p class={`text-sm flex-1 ${isDark() ? 'text-white' : 'text-gray-700'}`}>
                    {t('legal.acceptCancellation')}
                  </p>
                  <span
                    role="button"
                    tabindex="0"
                    class="text-indigo-500 text-xs font-medium underline shrink-0 cursor-pointer"
                    onClick={(e) => { e.stopPropagation(); setShowTermsDetail(showTermsDetail() === 'cancel' ? null : 'cancel'); }}
                  >{t('legal.readMore')}</span>
                </button>
                <Show when={showTermsDetail() === 'cancel'}>
                  <div class={`p-3 rounded-xl text-xs leading-relaxed animate-fade-in ${isDark() ? 'bg-black text-gray-300' : 'bg-gray-50 text-gray-600'}`}>
                    <p class="font-semibold mb-2">{t('legal.cancelTitle')}</p>
                    <p>{t('legal.cancelContent1')}</p>
                    <p class="mt-2">{t('legal.cancelContent2')}</p>
                    <p class="mt-2">{t('legal.cancelContent3')}</p>
                    <Show when={contractType().escrow}>
                      <p class="mt-2 font-medium">{t('legal.escrowNote')}</p>
                    </Show>
                  </div>
                </Show>
              </div>

              {/* Platform liability disclaimer */}
              <div class={`p-3 rounded-xl text-xs ${isDark() ? 'bg-amber-900/30 text-amber-300' : 'bg-amber-50 text-amber-800'}`}>
                <div class="flex items-start gap-2">
                  <Icon name="alertTriangle" size="sm" class="text-slate-500 dark:text-gray-200" />
                  <p>{t('legal.liability')}</p>
                </div>
              </div>

              {/* Dispute resolution info */}
              <div class={`p-3 rounded-xl text-xs ${isDark() ? 'bg-black/70 text-white/90' : 'bg-slate-50 text-slate-700'}`}>
                <div class="flex items-start gap-2">
                  <Icon name="scale" size="sm" class="text-slate-500 dark:text-gray-200" />
                  <p>{t('legal.dispute')}</p>
                </div>
              </div>
            </div>

            {/* Pay button — disabled until all consents given */}
            <button 
              class={`w-full py-4 rounded-2xl font-bold text-lg shadow-xl flex items-center justify-center gap-2 transition-all ${
                processing() 
                  ? 'bg-gray-400 text-white' 
                  : !allLegalAccepted()
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-green-500 to-emerald-600 text-white touch-scale'
              }`}
              onClick={() => { if (allLegalAccepted()) handleConfirmPayment(); }}
              disabled={processing() || !allLegalAccepted()}
            >
              <Show when={!processing()}>
                <Show when={contractType().escrow}>
                  <Icon name="lock" class="text-white" size="sm" />
                  {t('newContract.payButton')} {total().toLocaleString()} ₸
                </Show>
                <Show when={!contractType().escrow}>
                  <Icon name="repeat" class="text-white" size="sm" />
                  {t('newContract.subscribeButton')} {total().toLocaleString()} ₸/мес
                </Show>
              </Show>
              <Show when={processing()}>
                <div class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {t('payment.processing')}
              </Show>
            </button>
            <Show when={!allLegalAccepted()}>
              <p class="text-center text-xs text-amber-400">{t('legal.mustAcceptAll')}</p>
            </Show>
          </div>
        </Match>

        {/* ========== Step 5: Success ========== */}
        <Match when={step() === 'success'}>
          <div class="p-4 flex flex-col items-center justify-center min-h-[70vh]">
            {/* Success animation */}
            <div class="relative mb-8">
              <div class="w-32 h-32 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center animate-bounce shadow-2xl">
                <Icon name="check" class="text-white w-16 h-16" />
              </div>
              <div class="absolute inset-0 w-32 h-32 rounded-full border-4 border-green-400/30 animate-ping" />
            </div>
            
            <h2 class="text-3xl font-bold text-white mb-2">Оплата прошла!</h2>
            <p class="text-white/90 text-center mb-8 max-w-xs">
              <Show when={contractType().escrow}>
                Контракт создан. Ваши деньги защищены эскроу до выполнения заказа.
              </Show>
              <Show when={!contractType().escrow}>
                {t('newContract.successSubscription')}
              </Show>
            </p>
            
            {/* Receipt card */}
            <div class="w-full glass rounded-3xl p-5 mb-6">
              <div class="flex items-center justify-between mb-4">
                <div class="flex items-center gap-3">
                  <div class={`w-12 h-12 rounded-xl bg-gradient-to-br ${contractType().color} flex items-center justify-center text-xl`}>
                    {contractType().icon}
                  </div>
                  <div>
                    <p class="font-bold text-gray-800">{t('contracts.contractNumber')} {Math.floor(Math.random() * 9000 + 1000)}</p>
                    <p class="text-xs text-gray-500">{t(`contracts.${contractType().id}`)}</p>
                  </div>
                </div>
                <span class="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                  {t('newContract.paidLabel')}
                </span>
              </div>
              
              <div class="border-t border-gray-100 pt-4 flex justify-between items-center">
                <div>
                  <p class="text-xs text-gray-400">{t('newContract.amountLabel')}</p>
                  <p class="text-xl font-bold text-gray-800">{total().toLocaleString()} ₸</p>
                </div>
                <Show when={contractType().escrow}>
                  <div class="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 rounded-full">
                    <Icon name="lock" class="text-indigo-600 w-4 h-4" />
                    <span class="text-sm font-medium text-indigo-700">{t('newContract.inEscrowLabel')}</span>
                  </div>
                </Show>
                <Show when={!contractType().escrow}>
                  <div class="flex items-center gap-2 px-3 py-1.5 bg-green-50 rounded-full">
                    <Icon name="repeat" class="text-slate-500 dark:text-gray-200 w-4 h-4" />
                    <span class="text-sm font-medium text-green-700">{t('newContract.autoRenewal')}</span>
                  </div>
                </Show>
              </div>
            </div>

            {/* Action buttons */}
            <div class="w-full space-y-3">
              <button 
                class="w-full py-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-2xl font-bold text-lg shadow-xl touch-scale flex items-center justify-center gap-2"
                onClick={props.onBack}
              >
                <Icon name="fileText" class="text-white" size="sm" />
                {t('contracts.myContracts')}
              </button>
              <button 
                class="w-full py-3 glass rounded-2xl text-gray-600 font-medium touch-scale"
                onClick={props.onBack}
              >
                {t('nav.home')}
              </button>
            </div>
          </div>
        </Match>
      </Switch>
    </div>
  );
}

// ============== Document Vault (Сейф документов) ==============

interface Document {
  id: string;
  name: string;
  nameEn: string;
  type: 'payslip' | 'contract' | 'receipt' | 'certificate' | 'id' | 'diploma' | 'license' | 'insurance' | 'tax';
  date: string;
  size: string;
  encrypted: boolean;
  sender?: string;
  status: 'received' | 'signed' | 'pending' | 'expired' | 'rejected';
  expiresAt?: string;
  shared?: boolean;
  pinned?: boolean;
  tags?: string[];
}
