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

export default function UrgentOrderPage(props: { onBack: () => void }) {
  // Steps: form -> confirm -> waiting -> offers -> selected -> success
  const [step, setStep] = createSignal<'form' | 'confirm' | 'waiting' | 'offers' | 'selected' | 'success'>('form');
  const [budget, setBudget] = createSignal(15000);
  const [duration, setDuration] = createSignal(2);
  const [address, setAddress] = createSignal('ул. Абая 150, Алматы');
  const [offers, setOffers] = createSignal<any[]>([]);
  const [countdown, setCountdown] = createSignal(30);
  const [selectedOffer, setSelectedOffer] = createSignal<any>(null);
  const [searchRadius, setSearchRadius] = createSignal(0);

  // Price per hour calculation
  const pricePerHour = () => Math.round(budget() / duration());

  // Simulate incoming offers with better data
  createEffect(() => {
    if (step() === 'waiting') {
      // Animate search radius
      const radiusTimer = setInterval(() => {
        setSearchRadius(r => r < 3 ? r + 0.1 : 3);
      }, 100);

      const timer = setInterval(() => {
        setCountdown(c => {
          if (c <= 1) {
            clearInterval(timer);
            clearInterval(radiusTimer);
            if (offers().length > 0) {
              setStep('offers');
            }
            return 0;
          }
          return c - 1;
        });
      }, 1000);

      // Guard 1: Accepts your price
      setTimeout(() => {
        setOffers(prev => [...prev, {
          id: 1,
          name: 'Алексей Козлов',
          avatar: '👨‍✈️',
          rating: 4.9,
          reviews: 127,
          experienceKey: 'urgent.experience5Years',
          distance: 1.2,
          eta: 8,
          price: budget(),
          originalPrice: budget(),
          type: 'accept',
          badgeKey: 'urgent.badgeTop',
          badgeColor: 'bg-amber-500'
        }]);
      }, 3000);

      // Guard 2: Wants more (closer, faster)
      setTimeout(() => {
        setOffers(prev => [...prev, {
          id: 2,
          name: 'Дмитрий Сидоров',
          avatar: '🧔',
          rating: 4.8,
          reviews: 89,
          experienceKey: 'urgent.experience3Years',
          distance: 0.8,
          eta: 5,
          price: budget() + 3000,
          originalPrice: budget(),
          type: 'counter',
          badgeKey: 'urgent.badgeFast',
          badgeColor: 'bg-indigo-500'
        }]);
      }, 5000);

      // Guard 3: Offers discount (further away)
      setTimeout(() => {
        setOffers(prev => [...prev, {
          id: 3,
          name: 'Артём Петров',
          avatar: '👮',
          rating: 4.9,
          reviews: 156,
          experienceKey: 'urgent.experience7Years',
          distance: 2.1,
          eta: 12,
          price: budget() - 2000,
          originalPrice: budget(),
          type: 'discount',
          badgeKey: 'urgent.badgeDiscount',
          badgeColor: 'bg-green-500'
        }]);
        setStep('offers');
      }, 8000);

      return () => {
        clearInterval(timer);
        clearInterval(radiusTimer);
      };
    }
  });

  // Handle guard selection
  const handleSelectGuard = (offer: any) => {
    setSelectedOffer(offer);
    setStep('selected');
  };

  // Confirm selection
  const handleConfirmSelection = () => {
    setStep('success');
  };

  return (
    <div class="min-h-screen animate-fade-in">
      {/* Header with Step Indicator */}
      <div class="p-4">
        <div class="flex items-center gap-4 mb-4">
          <button 
            class="w-10 h-10 rounded-full glass flex items-center justify-center touch-scale"
            onClick={() => {
              if (step() === 'confirm') setStep('form');
              else if (step() === 'offers') setStep('waiting');
              else if (step() === 'selected') setStep('offers');
              else props.onBack();
            }}
          >
            <Icon name="chevronLeft" class="text-gray-700" size="sm" />
          </button>
          <h1 class="text-xl font-bold text-white flex-1">{t('urgent.title')}</h1>
          
          {/* Step indicator */}
          <Show when={step() !== 'success'}>
            <div class="flex gap-1">
              <div class={`w-2 h-2 rounded-full ${['form', 'confirm', 'waiting', 'offers', 'selected'].includes(step()) ? 'bg-white' : 'bg-white/30'}`} />
              <div class={`w-2 h-2 rounded-full ${['confirm', 'waiting', 'offers', 'selected'].includes(step()) ? 'bg-white' : 'bg-white/30'}`} />
              <div class={`w-2 h-2 rounded-full ${['waiting', 'offers', 'selected'].includes(step()) ? 'bg-white' : 'bg-white/30'}`} />
              <div class={`w-2 h-2 rounded-full ${['offers', 'selected'].includes(step()) ? 'bg-white' : 'bg-white/30'}`} />
            </div>
          </Show>
        </div>

        {/* Progress bar */}
        <Show when={step() !== 'success'}>
          <div class="h-1 bg-white/20 rounded-full overflow-hidden">
            <div 
              class="h-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-500"
              style={`width: ${
                step() === 'form' ? '25%' : 
                step() === 'confirm' ? '50%' : 
                step() === 'waiting' ? '62.5%' : 
                step() === 'offers' ? '75%' : 
                step() === 'selected' ? '87.5%' : '100%'
              }`}
            />
          </div>
        </Show>
      </div>

      <Switch>
        {/* ========== Step 1: Form ========== */}
        <Match when={step() === 'form'}>
          <div class="p-4 space-y-5">
            {/* Location */}
            <div class="glass rounded-3xl p-5">
              <div class="flex items-center justify-between mb-3">
                <label class="text-sm font-medium text-gray-700">{t('urgent.address')}</label>
                <span class="text-xs text-indigo-600 font-medium flex items-center gap-0.5"><Icon name="location" size="xs" class="text-indigo-600" /> GPS</span>
              </div>
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

            {/* Duration */}
            <div class="glass rounded-3xl p-5">
              <label class="text-sm font-medium text-gray-700 mb-4 block">{t('urgent.duration')}</label>
              <div class="flex items-center justify-between">
                <button 
                  class="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center touch-scale active:bg-gray-200"
                  onClick={() => setDuration(d => Math.max(1, d - 1))}
                >
                  <Icon name="minus" class="text-gray-600" />
                </button>
                <div class="text-center flex-1">
                  <div class="text-5xl font-bold text-gray-800">{duration()}</div>
                  <div class="text-gray-500 text-sm mt-1">{t('urgent.hours')}</div>
                </div>
                <button 
                  class="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center touch-scale active:bg-gray-200"
                  onClick={() => setDuration(d => Math.min(24, d + 1))}
                >
                  <Icon name="plus" class="text-gray-600" />
                </button>
              </div>
            </div>

            {/* Budget */}
            <div class="glass rounded-3xl p-5">
              <div class="flex items-center justify-between mb-4">
                <label class="text-sm font-medium text-gray-700">{t('urgent.budget')}</label>
                <span class="text-xs text-gray-400">{pricePerHour().toLocaleString()} ₸/{t('urgent.hours').slice(0, 3)}</span>
              </div>
              <div class="text-center mb-6">
                <span class="text-5xl font-bold text-gray-800">{budget().toLocaleString()}</span>
                <span class="text-2xl text-gray-400 ml-1">₸</span>
              </div>
              
              {/* Custom slider */}
              <div class="relative">
                <input 
                  type="range" 
                  min="5000" 
                  max="50000" 
                  step="1000"
                  value={budget()}
                  onInput={(e) => setBudget(parseInt(e.currentTarget.value))}
                  class="w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer accent-indigo-600"
                />
                <div class="flex justify-between text-xs text-gray-400 mt-3">
                  <span>5 000 ₸</span>
                  <span class="text-indigo-500 font-medium">{t('urgent.recommend')}</span>
                  <span>50 000 ₸</span>
                </div>
              </div>
            </div>

            {/* Info box */}
            <div class="glass rounded-2xl p-4 border border-amber-200 bg-amber-50/50">
              <div class="flex items-start gap-3">
                <div class="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <Icon name="zap" class="text-slate-500 dark:text-gray-200" />
                </div>
                <div>
                  <p class="font-medium text-gray-800 mb-1">{t('urgent.howItWorks')}</p>
                  <p class="text-sm text-gray-600">
                    {t('urgent.info')}
                  </p>
                </div>
              </div>
            </div>

            {/* Continue Button */}
            <button 
              class="w-full py-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-2xl font-bold text-lg shadow-xl touch-scale"
              onClick={() => setStep('confirm')}
            >
              {t('urgent.continue')}
            </button>
          </div>
        </Match>

        {/* ========== Step 2: Confirm Order ========== */}
        <Match when={step() === 'confirm'}>
          <div class="p-4 space-y-5">
            {/* Order Summary Card */}
            <div class="glass rounded-3xl overflow-hidden">
              <div class="p-5 bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
                <p class="text-white/90 text-sm mb-1">{t('urgent.yourOrder')}</p>
                <p class="text-3xl font-bold">{budget().toLocaleString()} ₸</p>
                <p class="text-white/90 text-sm mt-1">{pricePerHour().toLocaleString()} ₸ × {duration()} {t('urgent.hours')}</p>
              </div>
              
              <div class="p-5 space-y-4">
                {/* Address */}
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
                    <Icon name="location" class="text-indigo-600" size="sm" />
                  </div>
                  <div class="flex-1">
                    <p class="text-xs text-gray-400">{t('urgent.address')}</p>
                    <p class="font-medium text-gray-800">{address()}</p>
                  </div>
                </div>

                {/* Duration */}
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-xl bg-slate-100 dark:bg-black/70 flex items-center justify-center">
                    <Icon name="clock" class="text-slate-500 dark:text-gray-200" size="sm" />
                  </div>
                  <div class="flex-1">
                    <p class="text-xs text-gray-400">{t('urgent.duration')}</p>
                    <p class="font-medium text-gray-800">{duration()} {t('urgent.hours')}</p>
                  </div>
                </div>

                {/* Search radius */}
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                    <Icon name="shield" class="text-slate-500 dark:text-gray-200" size="sm" />
                  </div>
                  <div class="flex-1">
                    <p class="text-xs text-gray-400">{t('urgent.searchRadius')}</p>
                    <p class="font-medium text-gray-800">3 {t('urgent.km')} (~15 {t('urgent.guards')})</p>
                  </div>
                </div>
              </div>
            </div>

            {/* What happens next */}
            <div class="glass rounded-3xl p-5">
              <p class="font-semibold text-gray-800 mb-4">{t('urgent.whatNext')}</p>
              <div class="space-y-3">
                <div class="flex items-start gap-3">
                  <div class="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 text-sm font-bold text-indigo-600">1</div>
                  <p class="text-sm text-gray-600">{t('urgent.step1')}</p>
                </div>
                <div class="flex items-start gap-3">
                  <div class="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 text-sm font-bold text-indigo-600">2</div>
                  <p class="text-sm text-gray-600">{t('urgent.step2a')}<span class="text-green-600 font-medium">{t('urgent.accept')}</span>{t('urgent.step2b')}<span class="text-amber-600 font-medium">{t('urgent.offerOwn')}</span></p>
                </div>
                <div class="flex items-start gap-3">
                  <div class="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 text-sm font-bold text-indigo-600">3</div>
                  <p class="text-sm text-gray-600">{t('urgent.step3')}</p>
                </div>
              </div>
            </div>

            {/* Important note */}
            <div class="glass rounded-2xl p-4 border border-amber-200 bg-amber-50/50">
              <div class="flex items-center gap-2 text-amber-700">
                <Icon name="zap" size="sm" />
                <span class="text-sm font-medium">{t('urgent.paymentNote')}</span>
              </div>
            </div>

            {/* Confirm Button */}
            <button 
              class="w-full py-4 bg-gradient-to-r from-amber-400 to-orange-500 text-white rounded-2xl font-bold text-lg shadow-xl touch-scale flex items-center justify-center gap-2"
              onClick={() => {
                setSearchRadius(0);
                setOffers([]);
                setCountdown(30);
                setStep('waiting');
              }}
            >
              <Icon name="send" class="text-white" size="sm" />
              {t('urgent.submit')}
            </button>
          </div>
        </Match>

        {/* ========== Step 3: Waiting for offers ========== */}
        <Match when={step() === 'waiting'}>
          <div class="p-4">
            {/* Animated search visualization */}
            <div class="relative flex items-center justify-center py-12">
              {/* Expanding rings */}
              <div class="absolute w-48 h-48 rounded-full border-2 border-amber-400/20 animate-ping" style="animation-duration: 2s" />
              <div class="absolute w-64 h-64 rounded-full border-2 border-amber-400/10 animate-ping" style="animation-duration: 3s" />
              <div class="absolute w-80 h-80 rounded-full border-2 border-amber-400/5 animate-ping" style="animation-duration: 4s" />
              
              {/* Center icon */}
              <div class="relative">
                <div class="w-28 h-28 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-2xl">
                  <Icon name="zap" class="text-white" size="xl" />
                </div>
                
                {/* Radius indicator */}
                <div class="absolute -bottom-8 left-1/2 transform -translate-x-1/2 glass rounded-full px-3 py-1">
                  <span class="text-xs font-medium text-gray-700">{searchRadius().toFixed(1)} {t('urgent.km')}</span>
                </div>
              </div>
            </div>
            
            {/* Status text */}
            <div class="text-center mb-6">
              <h2 class="text-2xl font-bold text-white mb-2">{t('urgent.searching')}</h2>
              <p class="text-white/90">{t('urgent.waiting')}</p>
            </div>
            
            {/* Countdown and offers counter */}
            <div class="flex gap-4 mb-6">
              <div class="flex-1 glass rounded-2xl p-4 text-center">
                <div class="text-3xl font-bold text-indigo-600">{countdown()}</div>
                <div class="text-xs text-gray-500 mt-1">{t('urgent.sec')}</div>
              </div>
              <div class="flex-1 glass rounded-2xl p-4 text-center">
                <div class="text-3xl font-bold text-green-600">{offers().length}</div>
                <div class="text-xs text-gray-500 mt-1">{t('urgent.responses')}</div>
              </div>
            </div>

            {/* Live offers preview */}
            <Show when={offers().length > 0}>
              <div class="space-y-3">
                <p class="text-sm text-white/90 font-medium">{t('urgent.responsesReceived')}</p>
                <For each={offers()}>
                  {(offer) => (
                    <div class="glass rounded-2xl p-3 flex items-center gap-3 animate-slide-up">
                      <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-xl">
                        {offer.avatar}
                      </div>
                      <div class="flex-1">
                        <p class="font-medium text-gray-800 text-sm">{offer.name}</p>
                        <p class="text-xs text-gray-500">{offer.eta} {t('urgent.min')} • {offer.price.toLocaleString()} ₸</p>
                      </div>
                      <Show when={offer.type === 'accept'}>
                        <span class="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">{t('urgent.yourPrice')}</span>
                      </Show>
                      <Show when={offer.type === 'counter'}>
                        <span class="px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">{t('urgent.ownPriceBadge')}</span>
                      </Show>
                      <Show when={offer.type === 'discount'}>
                        <span class="px-2 py-1 bg-slate-100 dark:bg-black/70 text-slate-700 dark:text-white/90 rounded-full text-xs font-medium">{t('urgent.discount')}</span>
                      </Show>
                    </div>
                  )}
                </For>
              </div>
            </Show>

            {/* Skip button */}
            <Show when={offers().length >= 2}>
              <button 
                class="w-full mt-6 py-3 glass rounded-2xl text-indigo-600 font-medium touch-scale"
                onClick={() => setStep('offers')}
              >
                {t('urgent.viewOffers')} {offers().length} {t('urgent.offers')} →
              </button>
            </Show>
          </div>
        </Match>

        {/* ========== Step 4: View Offers ========== */}
        <Match when={step() === 'offers'}>
          <div class="p-4">
            {/* Summary bar */}
            <div class="glass rounded-2xl p-4 mb-4">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <div class="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                    <Icon name="check" class="text-emerald-600 dark:text-emerald-400" size="xs" />
                  </div>
                  <span class="font-medium text-gray-700">{offers().length} {t('urgent.guardsResponded')}</span>
                </div>
                <div class="text-right">
                  <p class="text-xs text-gray-400">{t('urgent.yourBudget')}</p>
                  <p class="font-bold text-indigo-600">{budget().toLocaleString()} ₸</p>
                </div>
              </div>
            </div>

            {/* Sort/Filter tabs */}
            <div class="flex gap-2 mb-4 overflow-x-auto pb-1">
              <button class="px-4 py-2 bg-indigo-600 text-white rounded-full text-sm font-medium whitespace-nowrap">
                {t('urgent.all')} ({offers().length})
              </button>
              <button class="px-4 py-2 glass rounded-full text-sm font-medium text-gray-600 whitespace-nowrap">
                {t('urgent.acceptedPrice')}
              </button>
              <button class="px-4 py-2 glass rounded-full text-sm font-medium text-gray-600 whitespace-nowrap">
                {t('urgent.cheaper')}
              </button>
              <button class="px-4 py-2 glass rounded-full text-sm font-medium text-gray-600 whitespace-nowrap">
                {t('urgent.faster')}
              </button>
            </div>

            {/* Offers list */}
            <div class="space-y-4">
              <For each={offers()}>
                {(offer, i) => {
                  const priceDiff = () => offer.price - budget();
                  const isAccept = () => offer.type === 'accept';
                  const isDiscount = () => offer.type === 'discount';
                  
                  return (
                    <div 
                      class={`glass rounded-3xl overflow-hidden animate-slide-up ${isAccept() ? 'ring-2 ring-green-400' : isDiscount() ? 'ring-2 ring-blue-400' : ''}`}
                      style={`animation-delay: ${i() * 0.1}s`}
                    >
                      {/* Badge header */}
                      <Show when={offer.badgeKey}>
                        <div class={`${offer.badgeColor} text-white text-xs font-medium py-1.5 px-4 flex items-center gap-1`}>
                          <Show when={isAccept()}>✓</Show>
                          <Show when={isDiscount()}>↓</Show>
                          <Show when={offer.type === 'counter'}>⚡</Show>
                          {t(offer.badgeKey)}
                        </div>
                      </Show>
                      
                      <div class="p-5">
                        {/* Guard info */}
                        <div class="flex items-start gap-4 mb-4">
                          <div class="relative">
                            <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-3xl">
                              {offer.avatar}
                            </div>
                            <div class="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-white" />
                          </div>
                          
                          <div class="flex-1">
                            <h3 class="font-bold text-gray-800 text-lg">{offer.name}</h3>
                            <div class="flex items-center gap-2 mt-1">
                              <div class="flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded-full">
                                <Icon name="star" class="text-amber-400 w-4 h-4" />
                                <span class="text-sm font-semibold text-amber-700">{offer.rating}</span>
                              </div>
                              <span class="text-sm text-gray-400">{offer.reviews} {t('urgent.reviews')}</span>
                            </div>
                            <p class="text-xs text-gray-400 mt-1">{t('urgent.experience')}: {offer.experienceKey ? t(offer.experienceKey) : ''}</p>
                          </div>
                        </div>

                        {/* Distance and ETA */}
                        <div class="flex gap-3 mb-4">
                          <div class="flex-1 bg-gray-50 rounded-xl p-3 text-center">
                            <div class="flex items-center justify-center gap-1 text-gray-500 mb-1">
                              <Icon name="location" size="xs" />
                              <span class="text-xs">{t('urgent.distance')}</span>
                            </div>
                            <p class="font-bold text-gray-800">{offer.distance} {t('urgent.km')}</p>
                          </div>
                          <div class="flex-1 bg-gray-50 rounded-xl p-3 text-center">
                            <div class="flex items-center justify-center gap-1 text-gray-500 mb-1">
                              <Icon name="clock" size="xs" />
                              <span class="text-xs">{t('urgent.arrivesIn')}</span>
                            </div>
                            <p class="font-bold text-gray-800">{offer.eta} {t('urgent.min')}</p>
                          </div>
                        </div>

                        {/* Price section */}
                        <div class={`p-4 rounded-2xl mb-4 ${
                          isAccept() ? 'bg-green-50 border border-green-200' : 
                          isDiscount() ? 'bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700' :
                          'bg-amber-50 border border-amber-200'
                        }`}>
                          <div class="flex items-center justify-between">
                            <div>
                              <Show when={isAccept()}>
                                <p class="text-green-700 font-medium flex items-center gap-1">
                                  <Icon name="check" size="xs" />
                                  {t('urgent.acceptedYourPrice')}
                                </p>
                              </Show>
                              <Show when={isDiscount()}>
                                <p class="text-slate-600 dark:text-white/90 font-medium">
                                  {t('urgent.offersDiscount')} -{Math.abs(priceDiff()).toLocaleString()} ₸
                                </p>
                              </Show>
                              <Show when={offer.type === 'counter'}>
                                <p class="text-amber-700 font-medium">
                                  {t('urgent.asksMore')} +{priceDiff().toLocaleString()} ₸
                                </p>
                              </Show>
                            </div>
                            <div class="text-right">
                              <p class="text-3xl font-bold text-gray-800">{offer.price.toLocaleString()}</p>
                              <p class="text-xs text-gray-400">₸ {t('urgent.for')} {duration()} {t('urgent.hours')}</p>
                            </div>
                          </div>
                        </div>

                        {/* Select button */}
                        <button 
                          class={`w-full py-4 rounded-2xl font-bold text-lg shadow-lg touch-scale flex items-center justify-center gap-2 ${
                            isAccept() ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white' :
                            isDiscount() ? 'bg-gradient-to-r from-blue-500 to-cyan-600 text-white' :
                            'bg-gradient-to-r from-indigo-500 to-purple-600 text-white'
                          }`}
                          onClick={() => handleSelectGuard(offer)}
                        >
                          {t('urgent.select')}
                        </button>
                      </div>
                    </div>
                  );
                }}
              </For>
            </div>
          </div>
        </Match>

        {/* ========== Step 5: Confirm Selection ========== */}
        <Match when={step() === 'selected'}>
          <Show when={selectedOffer()}>
            <div class="p-4 space-y-5">
              {/* Guard card */}
              <div class="glass rounded-3xl overflow-hidden">
                <div class="p-6 bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-center">
                  <div class="w-24 h-24 rounded-full bg-white/20 flex items-center justify-center text-5xl mx-auto mb-4">
                    {selectedOffer().avatar}
                  </div>
                  <h2 class="text-2xl font-bold">{selectedOffer().name}</h2>
                  <div class="flex items-center justify-center gap-2 mt-2">
                    <div class="flex items-center gap-1 bg-white/20 px-3 py-1 rounded-full">
                      <Icon name="star" class="text-amber-300 w-4 h-4" />
                      <span class="font-medium">{selectedOffer().rating}</span>
                    </div>
                    <span class="text-white/90">{selectedOffer().reviews} {t('urgent.reviews')}</span>
                  </div>
                </div>
                
                <div class="p-5">
                  {/* Details */}
                  <div class="grid grid-cols-2 gap-3 mb-5">
                    <div class="bg-gray-50 rounded-xl p-3 text-center">
                      <p class="text-xs text-gray-400">{t('urgent.arrivesIn')}</p>
                      <p class="text-xl font-bold text-gray-800">{selectedOffer().eta} {t('urgent.min')}</p>
                    </div>
                    <div class="bg-gray-50 rounded-xl p-3 text-center">
                      <p class="text-xs text-gray-400">{t('urgent.distance')}</p>
                      <p class="text-xl font-bold text-gray-800">{selectedOffer().distance} {t('urgent.km')}</p>
                    </div>
                  </div>

                  {/* Divider */}
                  <div class="border-t border-gray-100 my-5" />

                  {/* Order summary */}
                  <div class="space-y-3">
                    <div class="flex justify-between">
                      <span class="text-gray-500">{t('urgent.address')}</span>
                      <span class="font-medium text-gray-800 text-right">{address()}</span>
                    </div>
                    <div class="flex justify-between">
                      <span class="text-gray-500">{t('urgent.duration')}</span>
                      <span class="font-medium text-gray-800">{duration()} {t('urgent.hours')}</span>
                    </div>
                    <div class="flex justify-between">
                      <span class="text-gray-500">{t('urgent.yourBudget')}</span>
                      <span class="text-gray-400">{budget().toLocaleString()} ₸</span>
                    </div>
                    <div class="border-t border-gray-100 pt-3 flex justify-between">
                      <span class="font-semibold text-gray-800">{t('urgent.totalToPay')}</span>
                      <span class="text-2xl font-bold text-indigo-600">{selectedOffer().price.toLocaleString()} ₸</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Confirmation note */}
              <div class="glass rounded-2xl p-4 border border-green-200 bg-green-50/50">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                    <Icon name="shield" class="text-slate-500 dark:text-gray-200" />
                  </div>
                  <div>
                    <p class="font-medium text-green-800">{t('urgent.secureDeal')}</p>
                    <p class="text-xs text-green-600">{t('urgent.moneyNote')}</p>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div class="space-y-3">
                <button 
                  class="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-2xl font-bold text-lg shadow-xl touch-scale flex items-center justify-center gap-2"
                  onClick={handleConfirmSelection}
                >
                  <Icon name="check" class="text-white" size="sm" />
                  {t('urgent.confirmOrder')}
                </button>
                <button 
                  class="w-full py-3 glass rounded-2xl text-gray-600 font-medium touch-scale"
                  onClick={() => setStep('offers')}
                >
                  {t('urgent.chooseAnother')}
                </button>
              </div>
            </div>
          </Show>
        </Match>

        {/* ========== Step 6: Success ========== */}
        <Match when={step() === 'success'}>
          <div class="p-4 flex flex-col items-center justify-center min-h-[70vh]">
            {/* Success animation */}
            <div class="relative mb-8">
              <div class="w-32 h-32 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center animate-bounce shadow-2xl">
                <Icon name="check" class="text-white w-16 h-16" />
              </div>
              <div class="absolute inset-0 w-32 h-32 rounded-full border-4 border-green-400/30 animate-ping" />
            </div>
            
            <h2 class="text-3xl font-bold text-white mb-2">{t('urgent.orderConfirmed')}</h2>
            <p class="text-white/90 text-center mb-8 max-w-xs">
              {selectedOffer()?.name} {t('urgent.enRouteToYou')} ~{selectedOffer()?.eta} {t('urgent.min')}
            </p>
            
            {/* Order card */}
            <div class="w-full glass rounded-3xl p-5 mb-6">
              <div class="flex items-center gap-4 mb-4">
                <div class="w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-2xl">
                  {selectedOffer()?.avatar}
                </div>
                <div class="flex-1">
                  <p class="font-bold text-gray-800">{selectedOffer()?.name}</p>
                  <p class="text-sm text-gray-500">{t('urgent.orderNumber')}{Math.floor(Math.random() * 9000 + 1000)}</p>
                </div>
                <div class="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                  {t('urgent.enRoute')}
                </div>
              </div>
              
              <div class="flex gap-3">
                <button class="flex-1 py-3 glass rounded-xl flex items-center justify-center gap-2 touch-scale">
                  <Icon name="phone" class="text-indigo-600" size="sm" />
                  <span class="font-medium text-gray-700">{t('tracking.call')}</span>
                </button>
                <button class="flex-1 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center gap-2 shadow-lg touch-scale">
                  <Icon name="message" class="text-white" size="sm" />
                  <span class="font-medium text-white">{t('tracking.message')}</span>
                </button>
              </div>
            </div>

            {/* Track button */}
            <button 
              class="w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-2xl font-bold text-lg shadow-xl touch-scale flex items-center justify-center gap-2"
              onClick={props.onBack}
            >
              <Icon name="map" class="text-white" size="sm" />
              {t('urgent.trackOnMap')}
            </button>
          </div>
        </Match>
      </Switch>
    </div>
  );
}
