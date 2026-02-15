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

export default function RatingPage(props: { onBack: () => void }) {
  const [stars, setStars] = createSignal(0);
  const [hoverStar, setHoverStar] = createSignal(0);
  const [selectedTags, setSelectedTags] = createSignal<string[]>([]);
  const [reviewText, setReviewText] = createSignal('');
  const [submitted, setSubmitted] = createSignal(false);
  const [tapping, setTapping] = createSignal(false);

  const profession = getDepartment('plumbing');
  const worker = { name: 'Алексей К.', rating: 4.8, avatar: '👨‍✈️', profession };
  const workerTitle = () => profession ? (getCurrentLanguage().code === 'en' ? profession.workerTitleEn : profession.workerTitle) : 'Professional';

  const ratingLabels: Record<number, string> = {
    1: t('rating.terrible'),
    2: t('rating.bad'),
    3: t('rating.ok'),
    4: t('rating.good'),
    5: t('rating.excellent'),
  };

  const positiveTags = [
    { id: 'punctual', key: 'rating.tags.punctual' },
    { id: 'professional', key: 'rating.tags.professional' },
    { id: 'clean', key: 'rating.tags.clean' },
    { id: 'price', key: 'rating.tags.price' },
    { id: 'recommend', key: 'rating.tags.recommend' },
  ];
  const negativeTags = [
    { id: 'late', key: 'rating.tags.late' },
    { id: 'rude', key: 'rating.tags.rude' },
    { id: 'poor', key: 'rating.tags.poor' },
  ];

  const toggleTag = (id: string) => {
    setSelectedTags(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]);
  };

  const handleSubmit = () => {
    setSubmitted(true);
  };

  const displayStars = () => hoverStar() || stars();
  const label = () => ratingLabels[displayStars() as keyof typeof ratingLabels] || '';

  return (
    <div class="min-h-screen animate-fade-in">
      <Show when={!submitted()} fallback={
        <div class="min-h-screen flex flex-col items-center justify-center p-8 bg-gradient-to-b from-indigo-600/20 to-transparent">
          <div class="w-24 h-24 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center mb-6 animate-scale-in shadow-2xl">
            <Icon name="check" class="text-white w-12 h-12" />
          </div>
          <h2 class="text-2xl font-bold text-white mb-2">{t('rating.thanks')}</h2>
          <p class="text-white/90 text-center mb-8">Your review helps our community</p>
          <button
            onClick={props.onBack}
            class="px-8 py-3 rounded-2xl bg-white/10 text-white font-medium touch-scale"
          >
            {t('nav.orders')}
          </button>
        </div>
      }>
        {/* Header with gradient and worker */}
        <div class={`relative overflow-hidden rounded-b-3xl pb-8 pt-4 px-4 ${isDark() ? 'bg-black' : ''}`}>
          <div class="absolute inset-0 bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 opacity-90" />
          <div class="absolute inset-0 bg-black/20" />
          <div class="relative flex items-center gap-4">
            <button onClick={props.onBack} class="w-10 h-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center touch-scale">
              <Icon name="chevronLeft" class="text-white" size="sm" />
            </button>
            <h1 class="text-xl font-bold text-white">{t('rating.title')}</h1>
          </div>
          <div class="relative mt-6 flex items-center gap-4">
            <div class="w-16 h-16 rounded-2xl bg-white/30 backdrop-blur flex items-center justify-center text-3xl shadow-lg">
              {worker.avatar}
            </div>
            <div>
              <p class="font-bold text-white text-lg">{worker.name}</p>
              <p class="text-white/90 text-sm">{workerTitle()}</p>
              <p class="text-white/90 text-xs flex items-center gap-1 mt-0.5">
                <Icon name="star" class="text-amber-300 w-4 h-4" />
                {worker.rating}
              </p>
            </div>
          </div>
        </div>

        <div class="px-4 -mt-4">
          <div class="glass rounded-3xl p-6 shadow-xl">
            <p class="text-gray-700 font-medium mb-4">{t('rating.howWas')}</p>
            <div class="flex justify-center gap-2 mb-4">
              <For each={[1, 2, 3, 4, 5]}>
                {(n) => (
                  <button
                    type="button"
                    class={`p-1 transition-transform duration-150 touch-scale ${tapping() ? 'scale-110' : ''}`}
                    onMouseDown={() => setTapping(true)}
                    onMouseUp={() => setTapping(false)}
                    onTouchStart={() => setTapping(true)}
                    onTouchEnd={() => setTapping(false)}
                    onClick={() => setStars(n)}
                    onMouseEnter={() => setHoverStar(n)}
                    onMouseLeave={() => setHoverStar(0)}
                  >
                    <Icon
                      name="star"
                      class={n <= displayStars() ? 'text-amber-400' : 'text-gray-300'}
                      size="lg"
                    />
                  </button>
                )}
              </For>
            </div>
            <p class="text-center text-sm font-medium text-amber-600 min-h-[1.5rem]">{label()}</p>

            <p class="text-sm text-gray-500 mt-5 mb-2">Quick feedback</p>
            <div class="flex flex-wrap gap-2 mb-2">
              <For each={positiveTags}>
                {(tag) => (
                  <button
                    type="button"
                    class={`px-3 py-1.5 rounded-full text-sm font-medium transition-all touch-scale border-2 ${
                      selectedTags().includes(tag.id)
                        ? 'bg-green-100 border-green-500 text-green-700'
                        : 'bg-gray-100 border-transparent text-gray-600'
                    }`}
                    onClick={() => toggleTag(tag.id)}
                  >
                    {t(tag.key)}
                  </button>
                )}
              </For>
            </div>
            <div class="flex flex-wrap gap-2">
              <For each={negativeTags}>
                {(tag) => (
                  <button
                    type="button"
                    class={`px-3 py-1.5 rounded-full text-sm font-medium transition-all touch-scale border-2 ${
                      selectedTags().includes(tag.id)
                        ? 'bg-red-100 border-red-500 text-red-700'
                        : 'bg-gray-100 border-transparent text-gray-600'
                    }`}
                    onClick={() => toggleTag(tag.id)}
                  >
                    {t(tag.key)}
                  </button>
                )}
              </For>
            </div>

            <textarea
              placeholder={t('rating.writeReview')}
              class="w-full mt-4 p-4 rounded-2xl border border-gray-200 bg-gray-50 min-h-[100px] text-gray-800 placeholder-gray-400 resize-none focus:ring-2 focus:ring-amber-400 focus:border-transparent outline-none"
              value={reviewText()}
              onInput={(e) => setReviewText(e.currentTarget.value)}
            />
            <button
              type="button"
              class="w-full mt-3 py-3 rounded-2xl border-2 border-dashed border-gray-300 text-gray-500 flex items-center justify-center gap-2 touch-scale"
            >
              <Icon name="camera" class="text-gray-400" size="sm" />
              <span class="text-sm">Add photo</span>
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              class="w-full mt-6 py-4 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-white font-bold text-lg shadow-lg touch-scale flex items-center justify-center gap-2"
            >
              {t('rating.submit')}
            </button>
          </div>
        </div>
        </Show>
    </div>
  );
}

// Old AuthPage removed — new one is above App()

